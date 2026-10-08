'use strict';

/**
 * npm run db:migrate — apply arena/database/schema.sql.
 *
 *   --fresh   drop the database first, then recreate and migrate
 *             (destructive: intended for development resets only)
 *
 * The schema file is written to be idempotent-friendly (CREATE TABLE IF NOT
 * EXISTS), but a real deploy should still snapshot before migrating.
 */

const mysql = require('mysql2/promise');
const config = require('../config');
const { banner, runSqlFile, withExit } = require('./runSql');

const fresh = process.argv.includes('--fresh');

async function dropDatabase() {
  if (config.db.client === 'sqlite') {
    const fs = require('fs');
    const path = require('path');
    const file = config.db.sqliteFile || path.join(config.paths.root, '.placement-sandbox.sqlite');
    banner(`--fresh (sqlite): removing ${file}`);
    for (const suffix of ['', '-journal', '-wal', '-shm']) {
      fs.rmSync(file + suffix, { force: true });
    }
    return;
  }

  banner(`--fresh: dropping \`${config.db.database}\` on ${config.db.host}:${config.db.port}`);
  const connection = await mysql.createConnection({
    host: config.db.host, port: config.db.port, user: config.db.user, password: config.db.password,
  });
  try {
    const name = config.db.database;
    if (!/^[A-Za-z_][A-Za-z0-9_$]*$/.test(name)) throw new Error(`Refusing to drop "${name}".`);
    await connection.query(`DROP DATABASE IF EXISTS \`${name}\``);
    await connection.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log('  Dropped and recreated.');
  } finally {
    await connection.end();
  }
}

withExit(async () => {
  if (fresh) {
    console.log('\n\u001b[33m--fresh will DELETE every table and row in this database.\u001b[0m');
    await dropDatabase();
  }
  await runSqlFile('schema.sql', 'Migrating schema');
});
