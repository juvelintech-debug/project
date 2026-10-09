'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
// Override before importing configuration; NEVER reset the user's configured DB.
process.env.NODE_ENV = 'development';
process.env.DB_CLIENT = 'sqlite';
process.env.SQLITE_FILE = path.join(os.tmpdir(), `placement-auth-e2e-${process.pid}.sqlite`);
process.env.PORT = '4310';
process.env.DEMO_MODE = 'true';
process.env.AI_ENABLED = 'false';
process.env.GEMINI_API_KEY = '';
process.env.AI_API_KEY = '';
process.env.JWT_SECRET = 'e2e-test-only-secret-not-for-real-deployments';
process.env.JWT_EXPIRES_IN = '2h';
process.env.REGISTER_PER_HOUR_PER_IP = '30';
const backend = path.resolve(__dirname, '../../../backend');
const db = require(path.join(backend, 'src/db'));
const { start } = require(path.join(backend, 'src/server'));
process.on('exit', () => {
  for (const suffix of ['', '-journal', '-wal', '-shm']) fs.rmSync(process.env.SQLITE_FILE + suffix, { force: true });
});
(async () => {
  await db.init();
  await db.execScript(fs.readFileSync(path.join(backend, '../database/schema.sql'), 'utf8'));
  await db.execScript(fs.readFileSync(path.join(backend, '../database/seed_demo_data.sql'), 'utf8'));
  await start();
})().catch((err) => { console.error(err.message); process.exitCode = 1; });
