'use strict';

/**
 * npm run db:seed — load arena/database/seed_demo_data.sql.
 *
 * Seed rows exist so a reviewer can log in and click around immediately. They
 * are marked in the SQL (see the DEMO DATA header there) and this script refuses
 * to run against a production instance, where invented companies, jobs and
 * applicants would be indistinguishable from real placement records.
 */

const config = require('../config');
const db = require('../db');
const { banner, readSql, runSqlFile, withExit } = require('./runSql');

const ALLOW = ['1', 'true', 'yes'];

withExit(async () => {
  if (config.isProd && !ALLOW.includes(String(process.env.SEED_ALLOW_PROD || '').toLowerCase())) {
    const err = new Error(
      'Refusing to insert demo data while NODE_ENV=production.\n' +
      '  Seed data is for development and demos. If you really mean it, re-run with SEED_ALLOW_PROD=true.'
    );
    err.friendly = true;
    throw err;
  }

  const { sql } = readSql('seed_demo_data.sql');
  const placeholder = /REPLACE_WITH|TODO|<schema/i.test(sql.slice(0, 400));
  if (placeholder) console.log('\n\u001b[33m  Note: seed file still contains placeholder text.\u001b[0m');

  await runSqlFile('seed_demo_data.sql', 'Seeding demo data');

  const dbInfo = await db.ping();
  banner('Row counts');
  for (const table of ['users', 'students', 'companies', 'jobs', 'applications']) {
    try {
      const row = await db.one(`SELECT COUNT(*) AS n FROM \`${table}\``);
      console.log(`  ${table.padEnd(14)} ${row ? row.n : 0}`);
    } catch {
      console.log(`  ${table.padEnd(14)} — (table not present yet)`);
    }
  }
});
