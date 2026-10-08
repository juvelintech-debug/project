'use strict';

/**
 * SQLite adapter — used ONLY when DB_CLIENT=sqlite, i.e. sandboxes/CI machines
 * with no MySQL server. Production uses the mysql2 client and never reaches
 * this file.
 *
 * It exists so the entire application (routes, SQL, transactions, auth, RBAC,
 * workflows) can be executed and tested end-to-end rather than written blind.
 * All SQL in src/routes + src/services is therefore written in the subset that
 * BOTH engines accept; this file translates the few places where MySQL and
 * SQLite genuinely differ.
 */

const fs = require('fs');
const path = require('path');
const { splitTopLevel, readBalanced, splitStatements } = require('./sqlUtils');

/* ── statement-level translation (MySQL → SQLite) ─────────────────────────── */

const FUNCTION_RULES = [
  // Seed data and "upcoming deadline" queries use MySQL date arithmetic so the
  // demo rows stay in the future however late someone runs them. Order matters:
  // these must be matched before the bare NOW()/CURDATE() rules rewrite the
  // inside of the call.
  [/\bDATE_ADD\s*\(\s*NOW\s*\(\s*\)\s*,\s*INTERVAL\s+(\d+)\s+DAY\s*\)/gi,
    (m, n) => `datetime('now', 'localtime', '+${n} days')`],
  [/\bDATE_SUB\s*\(\s*NOW\s*\(\s*\)\s*,\s*INTERVAL\s+(\d+)\s+DAY\s*\)/gi,
    (m, n) => `datetime('now', 'localtime', '-${n} days')`],
  [/\bDATE_ADD\s*\(\s*CURDATE\s*\(\s*\)\s*,\s*INTERVAL\s+(\d+)\s+DAY\s*\)/gi,
    (m, n) => `date('now', 'localtime', '+${n} days')`],
  [/\bDATE_SUB\s*\(\s*CURDATE\s*\(\s*\)\s*,\s*INTERVAL\s+(\d+)\s+DAY\s*\)/gi,
    (m, n) => `date('now', 'localtime', '-${n} days')`],
  [/\bNOW\s*\(\s*\)/gi, "datetime('now', 'localtime')"],
  [/\bUTC_TIMESTAMP\s*\(\s*\)/gi, "datetime('now')"],
  [/\bCURDATE\s*\(\s*\)/gi, "date('now')"],
  [/\bIFNULL\s*\(/gi, 'COALESCE('],
  // MySQL's CHAR_LENGTH counts characters, SQLite's LENGTH counts the same for
  // the text these CHECKs measure; the name is what SQLite does not know.
  [/\bCHAR_LENGTH\s*\(/gi, 'LENGTH('],
  [/\bCONCAT\s*\(/gi, '|| ('],
  [/\bDATE_FORMAT\s*\(([^;]*?),\s*'([^']*)'\s*\)/gi, (m, expr, fmt) => `strftime('${fmt.replace(/%Y/g, '%Y').replace(/%m/g, '%m').replace(/%d/g, '%d')}', ${expr.trim()})`],
  [/\bTIMESTAMPDIFF\s*\(\s*DAY\s*,\s*([^,]+),\s*([^)]+)\)/gi, "CAST(julianday($2) - julianday($1) AS INTEGER)"],
];

function translateStatement(sql) {
  let out = sql;
  for (const [re, rep] of FUNCTION_RULES) out = out.replace(re, rep);
  // MySQL's null-safe equality has no SQLite equivalent operator; `IS` is the
  // exact match (both sides may be NULL and rows still compare equal).
  out = out.replace(/\s<=>\s*/g, ' IS ');
  // MySQL backticks are fine in SQLite; leave them alone.
  return out;
}

/** Replace `TYPE( … )` with a bare `TYPE` for type names SQLite cannot parse. */
function dropTypeArgumentList(columnDef, typeNames) {
  let out = columnDef;
  for (const type of typeNames) {
    const re = new RegExp(`\\b${type}\\s*\\(`, 'gi');
    let m;
    while ((m = re.exec(out)) !== null) {
      const openIdx = m.index + m[0].length - 1;
      const { end } = readBalanced(out, openIdx);
      out = out.slice(0, m.index) + 'TEXT' + out.slice(end + 1);
      re.lastIndex = m.index + 4;
    }
  }
  return out;
}

/* ── DDL translation ──────────────────────────────────────────────────────── */

function translateColumnDef(def) {
  let col = def.trim();
  if (!col) return null;

  const nameMatch = col.match(/^`?(\w+)`?\s+/);
  if (!nameMatch) return col;
  const name = nameMatch[1];

  // Per-column COMMENT is not SQLite syntax.
  col = col.replace(/\s+COMMENT\s+'(?:[^']|'')*'/gi, '');
  // MySQL keeps auto-updated timestamps via ON UPDATE; this app writes
  // updated_at explicitly in SQL so behaviour is identical on both engines.
  col = col.replace(/\s+ON\s+UPDATE\s+CURRENT_TIMESTAMP(?:\s*\(\s*\d*\s*\))?/gi, '');
  // Column-level referential actions with ON UPDATE are not accepted by SQLite
  // when inlined; keep REFERENCES, drop the actions (enforced at table level).
  col = col.replace(/\s+REFERENCES\s+`?(\w+)`?\s*\(([^)]*)\)[^,]*/gi, ' REFERENCES `$1`($2)');

  const isAuto = /\bAUTO_INCREMENT\b/i.test(col);
  if (isAuto) {
    return { text: `\`${name}\` INTEGER PRIMARY KEY AUTOINCREMENT`, autoIncrement: true };
  }

  col = col.replace(/\bUNSIGNED\b/gi, '').replace(/\bZEROFILL\b/gi, '');
  // ENUM('a','b') / SET('a') → plain TEXT. SQLite has no enum type and rejects
  // a type name with string arguments, so the value list is dropped (the real
  // constraint lives in MySQL); CHECK(...) clauses added for a column survive.
  col = dropTypeArgumentList(col, ['ENUM', 'SET']);
  col = col.replace(/\bTINYINT\s*\(\s*1\s*\)/gi, 'INTEGER');
  // Every MySQL integer spelling collapses to SQLite's INTEGER (sizes and
  // UNSIGNED are type-affinity noise SQLite ignores anyway).
  col = col.replace(/\b(BIGINT|MEDIUMINT|SMALLINT|TINYINT|INT)\b(\s*\(\s*\d+\s*\))?/gi, 'INTEGER');
  col = col.replace(/\bVARCHAR\s*\(\s*\d+\s*\)/gi, 'TEXT');
  col = col.replace(/\bCHAR\s*\(\s*(\d+)\s*\)/gi, (m, n) => (Number(n) > 1 ? 'TEXT' : 'TEXT'));
  col = col.replace(/\b(TEXT|LONGTEXT|MEDIUMTEXT|JSON)\b/gi, 'TEXT');
  col = col.replace(/\b(DATETIME|TIMESTAMP)\b/gi, 'TEXT');
  col = col.replace(/\bDATE\b/gi, 'TEXT');
  col = col.replace(/\bDECIMAL\s*\(\s*\d+\s*,\s*\d+\s*\)/gi, 'REAL');
  col = col.replace(/\bDOUBLE(\s*\(\s*\d+\s*,\s*\d+\s*\))?/gi, 'REAL');
  col = col.replace(/\bFLOAT(\s*\(\s*\d+\s*,\s*\d+\s*\))?/gi, 'REAL');
  col = col.replace(/COLLATE\s+\w+/gi, '');
  col = col.replace(/\s{2,}/g, ' ').trim();
  return { text: col, autoIncrement: false };
}

function translateTableStatement(sql) {
  const header = sql.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?(\w+)`?\s*\(/i);
  if (!header) return sql;

  const openIdx = sql.indexOf('(', header.index);
  const { inner, end } = readBalanced(sql, openIdx);
  const tableOptions = sql.slice(end + 1).replace(/;\s*$/, '').trim();
  // Table options (ENGINE=, DEFAULT CHARSET=, COMMENT=) are MySQL-only.
  void tableOptions;

  const parts = splitTopLevel(inner);
  const autoNames = [];
  const outParts = [];

  for (const part of parts) {
    const p = part.trim();
    const constraint = /^(PRIMARY\s+KEY|UNIQUE|KEY|INDEX|FOREIGN\s+KEY|CONSTRAINT|CHECK|FULLTEXT)\b/i.test(p);

    if (!constraint) {
      const t = translateColumnDef(p);
      if (!t) continue;
      if (t.autoIncrement) autoNames.push(t.text.match(/`(\w+)`/)[1]);
      outParts.push(t.text);
      continue;
    }

    // The table-level PRIMARY KEY is redundant once an AUTO_INCREMENT column
    // became `INTEGER PRIMARY KEY AUTOINCREMENT`; keeping it would create two PKs.
    if (autoNames.length && /^PRIMARY\s+KEY\s*\(/i.test(p)) {
      const cols = p.match(/\(([^)]*)\)/)[1].replace(/[`\s]/g, '');
      if (cols.split(',').length === 1 && autoNames.includes(cols)) continue;
    }
    if (/^(UNIQUE\s+)?(KEY|INDEX)\b/i.test(p)) {
      const m = p.match(/^(UNIQUE\s+)?(?:KEY|INDEX)\s+`?\w*`?\s*\(([^)]*)\)/i);
      // A UNIQUE KEY is a rule about the data, so it survives as a table
      // constraint. A plain KEY/INDEX is only an access path — SQLite in this
      // adapter has no use for it, and it must NOT be promoted to UNIQUE (that
      // would silently reject rows the real MySQL schema happily accepts).
      if (m && m[1]) outParts.push(`UNIQUE (${m[2]})`);
      continue;
    }
    if (/^CONSTRAINT\b/i.test(p) && /\bFOREIGN\s+KEY\b/i.test(p)) {
      const m = p.match(/FOREIGN\s+KEY\s*\(([^)]*)\)\s*REFERENCES\s*`?(\w+)`?\s*\(([^)]*)\)(.*)$/i);
      if (m) {
        const actions = m[4].replace(/\bON\s+UPDATE\s+\w+(?:\s+\w+)?/gi, '').trim();
        outParts.push(`FOREIGN KEY (${m[1]}) REFERENCES \`${m[2]}\`(${m[3]})${actions ? ` ${actions}` : ''}`);
        continue;
      }
    }
    if (/^CHECK\b/i.test(p) || /^CONSTRAINT\b.*CHECK/i.test(p)) {
      // MySQL checks reference ENUM/DATE functions that behave differently in
      // SQLite; keep only those that translate cleanly, drop the rest.
      const simplified = p.replace(/^CONSTRAINT\s+`?\w+`?\s+/i, '');
      if (/\b(NOW|CURDATE|DATE_FORMAT|TIMESTAMPDIFF)\b/i.test(simplified)) continue;
      outParts.push(simplified.replace(/\bCURDATE\s*\(\s*\)/gi, "date('now')"));
      continue;
    }
    if (/^(UNIQUE\s+)?KEY\b/i.test(p) || /^INDEX\b/i.test(p)) continue;
    outParts.push(p);
  }

  return `CREATE TABLE IF NOT EXISTS \`${header[1]}\` (\n  ${outParts.join(',\n  ')}\n)`;
}

function translateIndexStatement(sql) {
  const m = sql.match(/CREATE\s+(UNIQUE\s+)?INDEX\s+`?(\w+)`?\s+ON\s+`?(\w+)`?\s*\(([^;]*)\)/i);
  if (!m) return sql;
  const cols = m[4].replace(/;$/, '').trim();
  return `CREATE ${m[1] ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS \`${m[2]}\` ON \`${m[3]}\` (${cols})`;
}

function translateDdl(sql) {
  return splitStatements(sql)
    .map((stmt) => {
      // Function names inside CHECK clauses are MySQL spellings too, so the
      // rewritten DDL goes through the same statement translation as queries.
      if (/^\s*CREATE\s+TABLE/i.test(stmt)) return translateStatement(translateTableStatement(stmt));
      if (/^\s*CREATE\s+(UNIQUE\s+)?INDEX/i.test(stmt)) return translateIndexStatement(stmt);
      if (/^\s*(ALTER|DROP|SET|USE)\b/i.test(stmt)) return null; // MySQL-specific maintenance
      return translateStatement(stmt);
    })
    .filter(Boolean);
}

/* ── the client ───────────────────────────────────────────────────────────── */

function createSqliteClient(config) {
  const { DatabaseSync } = require('node:sqlite');
  const file = config.db.sqliteFile || path.join(config.paths.root, '.placement-sandbox.sqlite');
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });

  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON');

  function coerce(params) {
    return params.map((v) => {
      if (v === undefined) return null;
      if (typeof v === 'boolean') return v ? 1 : 0;
      if (v === null || v === undefined) return null;
      if (v instanceof Date) return v.toISOString().slice(0, 19).replace('T', ' ');
      if (typeof v === 'object') return JSON.stringify(v);
      return v;
    });
  }

  function run(sql, params = []) {
    const translated = translateStatement(sql);
    const stmt = db.prepare(translated);
    const args = coerce(params);
    if (/^\s*(INSERT|REPLACE)/i.test(translated)) return { kind: 'insert', info: stmt.run(...args) };
    if (/^\s*(SELECT|PRAGMA|WITH|SHOW)/i.test(translated)) return { kind: 'select', rows: stmt.all(...args) };
    return { kind: 'write', info: stmt.run(...args) };
  }

  async function raw(sql, params = []) {
    const r = run(sql, params);
    if (r.kind === 'select') return [r.rows, []];
    return [{ insertId: Number(r.info.lastInsertRowid ?? 0), affectedRows: Number(r.info.changes ?? 0) }, []];
  }

  async function insert(sql, params = []) {
    const r = run(sql, params);
    return { insertId: Number(r.info.lastInsertRowid ?? 0), affectedRows: Number(r.info.changes ?? 0) };
  }

  async function execute(sql, params = []) {
    const r = run(sql, params);
    return { insertId: Number(r.info.lastInsertRowid ?? 0), affectedRows: Number(r.info.changes ?? 0) };
  }

  async function query(sql, params = []) {
    const [rows] = await raw(sql, params);
    return rows;
  }

  async function one(sql, params = []) {
    const rows = await query(sql, params);
    return rows.length ? rows[0] : null;
  }

  async function value(sql, params = []) {
    const row = await one(sql, params);
    return row ? row[Object.keys(row)[0]] : null;
  }

  function bind() {
    return { raw, query, one, value, insert, execute };
  }

  async function tx(work) {
    db.exec('BEGIN');
    try {
      const result = await work(bind());
      db.exec('COMMIT');
      return result;
    } catch (err) {
      try { db.exec('ROLLBACK'); } catch { /* already rolled back */ }
      throw err;
    }
  }

  function execScript(sql) {
    const statements = translateDdl(sql);
    for (let i = 0; i < statements.length; i += 1) {
      try {
        db.exec(statements[i]);
      } catch (err) {
        err.scriptPosition = `${i + 1}/${statements.length}`;
        err.scriptStatement = statements[i].slice(0, 160);
        throw err;
      }
    }
    return { count: statements.length };
  }

  async function ping() {
    const rows = db.prepare('SELECT 1 AS ok').all();
    return {
      client: 'sqlite',
      database: file,
      host: 'local file (test adapter — not a real MySQL server)',
      verified: rows[0].ok === 1,
    };
  }

  return {
    init: async () => db,
    raw, query, one, value, insert, execute, tx, ping, bind,
    execScript,
    translateDdl,
    close: async () => db.close(),
  };
}

module.exports = { createSqliteClient, translateDdl, translateStatement };
