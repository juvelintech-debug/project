'use strict';

/**
 * Shared plumbing for the database CLIs (createDatabase / migrate / seed).
 *
 * Both supported clients are handled by the same code path: `db.execScript`
 * splits the file into statements and runs them one at a time, which is why a
 * schema written for MySQL can also be executed by the offline test adapter.
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');
const db = require('../db');

const DB_DIR = path.resolve(config.paths.root, '..', 'database');

function readSql(relativeName) {
  const file = path.join(DB_DIR, relativeName);
  if (!fs.existsSync(file)) {
    const err = new Error(
      `database/${relativeName} does not exist.\n` +
      `  Looked in: ${file}\n` +
      `  Expected: the SQL file shipped under arena/database/.`
    );
    err.friendly = true;
    throw err;
  }
  return { file, sql: fs.readFileSync(file, 'utf8') };
}

function banner(text) {
  console.log(`\n\u001b[1m${text}\u001b[0m`);
}

async function runSqlFile(relativeName, label) {
  const { file, sql } = readSql(relativeName);
  const target = config.db.client === 'sqlite' ? config.db.sqliteFile || 'in-memory' : `${config.db.host}:${config.db.port}/${config.db.database}`;
  banner(`${label} — ${path.basename(file)} → ${target} (${config.db.client})`);

  await db.init();
  const result = await db.execScript(sql);
  console.log(`  ${result.count} statement(s) applied.`);
  return result;
}

/** Exits the process with a readable message — CLIs should never print a stack. */
async function withExit(fn) {
  try {
    await fn();
    await db.close();
    console.log('\u001b[32mDone.\u001b[0m\n');
    process.exit(0);
  } catch (err) {
    await db.close().catch(() => {});
    console.error(`\n\u001b[31mFailed:\u001b[0m ${err.friendly ? err.message : err.sqlMessage || err.message}`);
    if (err.scriptPosition) {
      console.error(`  statement ${err.scriptPosition} of the file:`);
      console.error(`    ${String(err.scriptStatement).replace(/\s+/g, ' ')}${err.scriptStatement && err.scriptStatement.length >= 160 ? ' …' : ''}`);
    }
    if (!err.friendly && err.code && /ECONNREFUSED|ER_ACCESS|PROTOCOL|UNKNOWN/i.test(String(err.code))) {
      console.error(`\nCannot reach MySQL at ${config.db.host}:${config.db.port} as "${config.db.user}".`);
      console.error('Start your local server (XAMPP → MySQL) or fix DB_* values in arena/backend/.env.\n');
    } else if (!err.friendly) {
      console.error('\nFix the SQL above and re-run. Nothing else was applied.\n');
    }
    process.exit(1);
  }
}

module.exports = { DB_DIR, readSql, banner, runSqlFile, withExit };
