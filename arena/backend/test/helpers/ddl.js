'use strict';

/**
 * Shared DDL reader for the database tests.
 *
 * Deliberately a small hand-written reader instead of a dependency: it works on
 * the exact file the migration runner will execute, so the tests cannot drift
 * from what gets applied. Quote/paren-aware splitting comes from the same
 * sqlUtils the production code uses.
 */

const { splitStatements, splitTopLevel, readBalanced } = require('../../src/db/sqlUtils');

/** Approximate stored size per value, used only for the InnoDB key-length budget. */
const BYTE_SIZE = {
  TINYINT: 1, BOOLEAN: 1, BOOL: 1,
  SMALLINT: 2, MEDIUMINT: 3, INT: 4, INTEGER: 4, BIGINT: 8,
  DATE: 3, TIME: 3, DATETIME: 8, TIMESTAMP: 8, YEAR: 1,
  FLOAT: 4, DOUBLE: 8,
};

function typeOf(definition) {
  const m = definition.match(/^([A-Za-z]+)\s*(\(\s*[\d,\s]+\s*\))?/);
  return m ? { name: m[1].toUpperCase(), args: m[2] ? m[2].replace(/[()\s]/g, '') : '' } : { name: '', args: '' };
}

/** Bytes MySQL must be able to hold in an index entry for this column. */
function keyBytes(definition) {
  const { name, args } = typeOf(definition);
  if (name === 'VARCHAR' || name === 'CHAR') {
    const chars = Number(args.split(',')[0]) || 0;
    // utf8mb4: MySQL budgets 4 bytes per character in a key.
    return { bytes: chars * 4, text: true, note: `${name}(${chars}) utf8mb4` };
  }
  if (name === 'ENUM' || name === 'SET') {
    const values = readBalanced(definition, definition.indexOf('(')).inner.split(',').length;
    return { bytes: values <= 255 ? 1 : 2, note: `${ENUM_HINT(values)}` };
  }
  if (name === 'DECIMAL' || name === 'NUMERIC') {
    const precision = Number(args.split(',')[0]) || 10;
    return { bytes: Math.ceil(precision / 2) + 1, note: `DECIMAL(${args || '10,0'})` };
  }
  if (name === 'TEXT' || name === 'MEDIUMTEXT' || name === 'LONGTEXT' || name === 'JSON') {
    return { bytes: Infinity, blob: true, note: name };
  }
  return { bytes: BYTE_SIZE[name] ?? 8, note: name };
}

const ENUM_HINT = (n) => `ENUM with ${n} values`;

/** table → { stmt, parts, columns, enums, fks, uniques, checks } plus parsed index list. */
function parseSchema(sql) {
  const tables = new Map();
  const indexes = [];

  for (const stmt of splitStatements(sql)) {
    let m = stmt.match(/^CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+`(\w+)`/i);
    if (m) {
      const tableName = m[1];
      const { inner } = readBalanced(stmt, stmt.indexOf('('));
      const parts = splitTopLevel(inner).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
      const entry = { stmt, parts, columns: new Map(), enums: new Map(), fks: [], uniques: [], checks: [] };
      for (const part of parts) {
        const cm = part.match(/^`(\w+)`\s+(.*)$/);
        if (cm && !/^(PRIMARY|UNIQUE|KEY|INDEX|FOREIGN|CONSTRAINT|CHECK)\b/i.test(cm[1])) {
          entry.columns.set(cm[1], cm[2]);
          if (/^ENUM\s*\(/i.test(cm[2])) {
            const { inner: values } = readBalanced(cm[2], cm[2].indexOf('('));
            entry.enums.set(cm[1], values
              .split(',')
              .map((v) => v.trim().replace(/^'(.*)'$/, '$1').replace(/''/g, "'")));
          }
        }
        m = part.match(/^CONSTRAINT\s+`(\w+)`\s+FOREIGN KEY\s*\(`(\w+)`\)\s*REFERENCES\s+`(\w+)`\s*\(`(\w+)`\)(.*)$/i);
        if (m) entry.fks.push({ name: m[1], column: m[2], refTable: m[3], refColumn: m[4], tail: m[5] });
        m = part.match(/^(?:CONSTRAINT\s+`\w+`\s+)?UNIQUE\s+(?:KEY\s+`?\w+`?\s*)?\(([^)]*)\)/i);
        if (m) entry.uniques.push({ name: (part.match(/UNIQUE\s+KEY\s+`(\w+)`/i) || [, 'inline'])[1], columns: m[1].split(',').map((c) => c.replace(/`/g, '').trim()) });
        m = part.match(/^CONSTRAINT\s+`(\w+)`\s+CHECK\s*\((.*)\)$/i);
        if (m) entry.checks.push({ name: m[1], expr: m[2] });
      }
      tables.set(tableName, entry);
      continue;
    }

    m = stmt.match(/^CREATE\s+(UNIQUE\s+)?INDEX\s+`?(\w+)`?\s+ON\s+`(\w+)`\s*\((.*)\)$/is);
    if (m) {
      indexes.push({
        unique: Boolean(m[1]),
        name: m[2],
        table: m[3],
        columns: splitTopLevel(m[4]).map((c) => c.replace(/`/g, '').trim()),
        stmt,
      });
    }
  }

  return { tables, indexes };
}

module.exports = { parseSchema, keyBytes, typeOf };
