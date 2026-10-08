'use strict';

/**
 * MySQL-dialect verification, run without a MySQL server.
 *
 * The sandbox has no mysqld, so the file a reviewer will actually execute —
 * `database/schema.sql` pasted into MySQL Workbench — is checked two ways here:
 *
 *  1. Every statement is parsed with node-sql-parser's MySQL grammar. That
 *     catches MySQL-incompatible syntax (a double-quoted literal, a comma
 *     before a closing paren, `CREATE INDEX … IF NOT EXISTS`, CHECK placement)
 *     that the SQLite verification adapter happily swallows.
 *  2. The InnoDB index-key byte budget is computed from the real column types.
 *     "Specified key was too long; max key length is 767 bytes" is the single
 *     most common reason a student schema fails to create on MySQL, and no
 *     amount of reading catches it by eye.
 *
 * The parser knows MySQL and MariaDB syntax, not server state, so this proves
 * the SQL is well-formed for MySQL — the migration run on a real server is still
 * what proves the database itself is reachable. That step is documented in
 * arena/README.md and reported at the end of this phase.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { Parser } = require('node-sql-parser');
const { splitStatements } = require('../src/db/sqlUtils');
const { parseSchema, keyBytes } = require('./helpers/ddl');

const DB_DIR = path.join(__dirname, '..', '..', 'database');
const FILES = {
  'schema.sql': fs.readFileSync(path.join(DB_DIR, 'schema.sql'), 'utf8'),
  'seed_demo_data.sql': fs.readFileSync(path.join(DB_DIR, 'seed_demo_data.sql'), 'utf8'),
};

// Session commands a client runs before the schema; the parser only knows
// statements with a grammar, so these are checked by hand instead.
const SESSION_COMMANDS = /^SET\s+NAMES\b/i;

// InnoDB index-key byte budgets. innodb_large_prefix is the default from MySQL
// 5.7.7 upwards; 767 is what an old COMPACT-format server still enforces.
const LIMIT = 3072;
const SAFE = 767;

const parser = new Parser();

function statements(name) {
  return splitStatements(FILES[name]).filter((s) => !SESSION_COMMANDS.test(s));
}

test('every statement parses as MySQL, not just as the test adapter’s dialect', () => {
  const failures = [];
  for (const name of Object.keys(FILES)) {
    for (const stmt of statements(name)) {
      try {
        parser.astify(stmt, { database: 'mysql' });
      } catch (err) {
        failures.push(`${name}: ${stmt.replace(/\s+/g, ' ').slice(0, 70)}… → ${err.message.split('\n')[0]}`);
      }
    }
  }
  assert.deepEqual(failures, [], `\n${failures.join('\n')}`);
});

test('the file contains exactly nine tables and the documented number of indexes', () => {
  const schema = statements('schema.sql');
  const created = schema.filter((x) => /^CREATE\s+TABLE/i.test(x));
  const indexed = schema.filter((x) => /^CREATE\s+(?:UNIQUE\s+)?INDEX/i.test(x));
  assert.equal(created.length, 9, 'one CREATE TABLE per planned table');
  assert.equal(indexed.length, 20, 'one CREATE INDEX per planned query');
  assert.equal(schema.length, created.length + indexed.length,
    'the schema file must contain nothing but tables and indexes');
});

test('the seed is insert-and-reset only: it never alters structure', () => {
  for (const stmt of statements('seed_demo_data.sql')) {
    assert.ok(
      /^(INSERT|DELETE|ALTER TABLE\s+`\w+`\s+AUTO_INCREMENT\s*=\s*1)/i.test(stmt),
      `unexpected statement kind in the seed: ${stmt.slice(0, 60)}…`,
    );
  }
});

test('no index exceeds the InnoDB key-length budget', () => {
  const { tables, indexes } = parseSchema(FILES['schema.sql']);
  const report = [];

  const measure = (table, columns) => columns.reduce((total, column) => {
    const def = tables.get(table).columns.get(column);
    assert.ok(def, `${table}.${column} is indexed but does not exist`);
    const { bytes, blob, note } = keyBytes(def);
    if (blob) {
      assert.fail(`${table}.${column} is a ${note} column indexed without a prefix length — MySQL refuses this`);
    }
    return total + bytes;
  }, 0);

  for (const idx of indexes) {
    const bytes = measure(idx.table, idx.columns);
    report.push([`${idx.table}.${idx.name}`, bytes]);
    assert.ok(bytes <= LIMIT, `${idx.name} needs ${bytes} bytes, over the ${LIMIT} byte InnoDB limit`);
  }
  for (const [table, entry] of tables) {
    for (const unique of entry.uniques) {
      const bytes = measure(table, unique.columns);
      report.push([`${table}.${unique.name || 'unique'}`, bytes]);
      assert.ok(bytes <= LIMIT, `UNIQUE ${unique.name} on ${table} needs ${bytes} bytes, over the limit`);
    }
  }

  // Comfortably under the old 767-byte ceiling too, which is why email is
  // VARCHAR(190) and not VARCHAR(255) — 255 × 4 = 1020 would fail on COMPACT.
  const worst = report.sort((a, b) => b[1] - a[1])[0];
  assert.ok(worst[1] <= SAFE, `the widest key is ${worst[0]} at ${worst[1]} bytes; keep every key ≤ ${SAFE}`);
});

test('a column too wide to index is never indexed', () => {
  // The mirror image of the byte-budget test: a VARCHAR(500) note field is
  // perfectly good design as long as nobody promises MySQL an index on it, and
  // MySQL (not the SQLite adapter) is what rejects the promise.
  const { tables, indexes } = parseSchema(FILES['schema.sql']);
  const indexed = new Set(indexes.flatMap((i) => i.columns.map((c) => `${i.table}.${c}`)));
  const offenders = [];
  for (const [table, entry] of tables) {
    for (const [column, def] of entry.columns) {
      const { bytes } = keyBytes(def);
      const inKey = indexed.has(`${table}.${column}`)
        || [...entry.uniques].some((u) => u.columns.includes(column));
      if (inKey && bytes > SAFE) offenders.push(`${table}.${column} (${bytes} bytes)`);
    }
  }
  assert.deepEqual(offenders, [], `indexed columns must stay inside ${SAFE} bytes each: ${offenders.join(', ')}`);
});

test('a fresh MySQL server can create this schema in one pass, in file order', () => {
  // MySQL creates foreign keys immediately, so a table may only reference a
  // table defined above it. The SQLite adapter is tolerant here; MySQL is not.
  const { tables } = parseSchema(FILES['schema.sql']);
  const order = [...tables.keys()];
  const seen = new Set();
  for (const table of order) {
    for (const fk of tables.get(table).fks) {
      assert.ok(seen.has(fk.refTable) || fk.refTable === table,
        `${table}.${fk.column} references ${fk.refTable}, which is created later — MySQL would fail with errno 150`);
    }
    seen.add(table);
  }
  assert.deepEqual(order, [
    'users', 'students', 'student_skills', 'companies', 'jobs',
    'applications', 'interviews', 'notifications', 'ai_activity',
  ], 'table order must stay dependency-first');
});

test('the seed inserts parents before the children that point at them', () => {
  const inserts = statements('seed_demo_data.sql')
    .filter((s) => /^INSERT INTO/i.test(s))
    .map((s) => s.match(/^INSERT INTO `(\w+)`/i)[1]);
  const first = new Map();
  inserts.forEach((t, i) => { if (!first.has(t)) first.set(t, i); });
  const expectsBefore = {
    students: 'users', student_skills: 'students', companies: 'users', jobs: 'companies',
    applications: 'students', interviews: 'applications', notifications: 'users', ai_activity: 'jobs',
  };
  for (const [child, parent] of Object.entries(expectsBefore)) {
    assert.ok(first.has(child) && first.has(parent), `${child}/${parent} must both be seeded`);
    assert.ok(first.get(parent) < first.get(child), `${parent} must be inserted before ${child}`);
  }
});

test('the schema file stays free of MySQL-incompatible conveniences', () => {
  const sql = FILES['schema.sql'];
  for (const banned of [
    /CREATE\s+(?:UNIQUE\s+)?INDEX[^;]*IF\s+NOT\s+EXISTS/i,
    /GENERATED\s+(?:ALWAYS\s+)?AS/i,
    /\bINVISIBLE\b/i,
    /\bCHECK\s*\([^)]*SELECT\b/i,
    /WITH\s+(?:VALUES|SYSTEM\s+VERSIONING)/i,
  ]) {
    assert.doesNotMatch(FILES['schema.sql'], banned, `${banned} is not portable MySQL DDL`);
  }
  assert.match(sql, /utf8mb4_unicode_ci/, 'a pinned collation avoids a server-default surprise');
});
