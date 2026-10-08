'use strict';

/**
 * npm run db:create — create an empty schema so `db:migrate` has somewhere to
 * write. Safe to re-run (IF NOT EXISTS); it never drops anything.
 *
 * Under DB_CLIENT=sqlite this only ensures the file's parent directory exists,
 * because SQLite has no server to talk to — it is a test adapter, not a target.
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../config');
const { banner, withExit } = require('./runSql');

async function createDatabase() {
  if (config.db.client === 'sqlite') {
    const file = config.db.sqliteFile || path.join(config.paths.root, '.placement-sandbox.sqlite');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    banner(`SQLite test adapter — using file ${file}`);
    console.log('  Nothing to create: the database is the file itself.');
    return;
  }

  banner(`Creating database \`${config.db.database}\` on ${config.db.host}:${config.db.port}`);
  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    // No `database:` — it does not exist yet.
  });
  try {
    // Identifier comes from .env (operator-controlled), never from user input,
    // and is validated before interpolation — MySQL has no parameter for a name.
    const name = config.db.database;
    if (!/^[A-Za-z_][A-Za-z0-9_$]*$/.test(name)) {
      throw new Error(`Refusing to create "${name}": use letters, digits, _ and $ only (no dots or spaces).`);
    }
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    console.log(`  \`${name}\` is ready (utf8mb4 / utf8mb4_unicode_ci).`);
  } finally {
    await connection.end();
  }
}

withExit(createDatabase);
