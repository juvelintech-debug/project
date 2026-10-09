'use strict';
process.env.DB_CLIENT = 'sqlite';
process.env.SQLITE_FILE = ':memory:';
process.env.NODE_ENV = 'development';
process.env.JWT_SECRET = 'bootstrap-test-secret-not-a-real-credential';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const db = require('../src/db');
const { bootstrapAdmin } = require('../src/scripts/bootstrapAdmin');
const { upgradeAuthSchema } = require('../src/scripts/upgradeAuth');
const { createApp } = require('../src/app');
const schema = fs.readFileSync(path.join(__dirname, '../../database/schema.sql'), 'utf8');
const env = { ADMIN_BOOTSTRAP_EMAIL: ' TEST.ADMIN@EXAMPLE.TEST ', ADMIN_BOOTSTRAP_NAME: 'Test Administrator', ADMIN_BOOTSTRAP_PASSWORD: 'BootstrapTest@123' };
test.beforeEach(async () => { await db.close(); await db.init(); await db.execScript(schema); });
test.after(async () => db.close());

test('controlled bootstrap creates the first Admin with a hash and normalised email', async () => {
  const result = await bootstrapAdmin(env); assert.equal(result.created, true);
  const user = await db.one('SELECT * FROM users WHERE id = ?', [result.userId]);
  assert.equal(user.role, 'Admin'); assert.equal(user.status, 'Active'); assert.equal(user.email, 'test.admin@example.test');
  assert.ok(await bcrypt.compare(env.ADMIN_BOOTSTRAP_PASSWORD, user.password_hash)); assert.notEqual(user.password_hash, env.ADMIN_BOOTSTRAP_PASSWORD);
  assert.ok(!JSON.stringify(result).includes(env.ADMIN_BOOTSTRAP_PASSWORD));
});
test('repeated bootstrap never changes a password or creates additional Admin accounts', async () => {
  await bootstrapAdmin(env); const before = await db.one('SELECT * FROM users');
  assert.deepEqual(await bootstrapAdmin({ ...env, ADMIN_BOOTSTRAP_EMAIL: 'other.admin@example.test', ADMIN_BOOTSTRAP_PASSWORD: 'AnotherTest@123' }), { created: false });
  assert.deepEqual(await db.one('SELECT * FROM users'), before); assert.equal(Number(await db.value('SELECT COUNT(*) FROM users')), 1);
  assert.deepEqual(await bootstrapAdmin({}), { created: false });
});
test('concurrent bootstrap calls cannot create two first administrators (SQLite transaction serialization)', async () => {
  const results = await Promise.all([bootstrapAdmin(env), bootstrapAdmin({ ...env, ADMIN_BOOTSTRAP_EMAIL: 'other.admin@example.test' })]);
  assert.equal(results.filter((r) => r.created).length, 1); assert.equal(Number(await db.value("SELECT COUNT(*) FROM users WHERE role = 'Admin'")), 1);
});
test('missing/weak bootstrap credentials are rejected without inserting an account', async () => {
  for (const input of [{}, { ...env, ADMIN_BOOTSTRAP_PASSWORD: 'weak' }, { ...env, ADMIN_BOOTSTRAP_EMAIL: 'invalid' }]) await assert.rejects(bootstrapAdmin(input), (err) => err.status === 422);
  assert.equal(Number(await db.value('SELECT COUNT(*) FROM users')), 0);
});
test('bootstrap cannot promote or overwrite an existing student with the same email', async () => {
  const hash = await bcrypt.hash('StudentTest@123', 10);
  await db.insert("INSERT INTO users (role,email,password_hash,full_name) VALUES ('Student',?,?,?)", ['test.admin@example.test', hash, 'Test Student']);
  await assert.rejects(bootstrapAdmin(env), (err) => err.status === 409);
  const row = await db.one('SELECT * FROM users'); assert.equal(row.role, 'Student'); assert.equal(row.password_hash, hash);
});
test('the authentication upgrade preserves Phase 2 data and is idempotent', async () => {
  await db.close(); await db.init();
  // Exact Phase 2 schema, with only the new counter/check removed.
  const previous = schema.replace(/  `token_version` INT UNSIGNED\s+NOT NULL DEFAULT 0\s+COMMENT '[^']*',\n/, '').replace(/  CONSTRAINT `chk_users_token_version` CHECK \(`token_version` >= 0\),\n/, '');
  await db.execScript(previous);
  const hash = await bcrypt.hash('LegacyTest@123', 10);
  await db.insert("INSERT INTO users (role,email,password_hash,full_name) VALUES ('Admin',?,?,?)", ['legacy@example.test', hash, 'Legacy Test Admin']);
  const before = await db.one('SELECT * FROM users');
  let server = createApp().listen(0, '127.0.0.1'); await new Promise((resolve) => server.once('listening', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: before.email, password: 'LegacyTest@123' }) });
    assert.equal(response.status, 503); assert.equal((await response.json()).error.code, 'AUTH_SCHEMA_REQUIRED');
    assert.deepEqual(await upgradeAuthSchema(), { changed: true });
    const after = await db.one('SELECT * FROM users'); assert.equal(after.token_version, 0);
    const { token_version: _version, ...oldFields } = after; assert.deepEqual(oldFields, { ...before });
    assert.deepEqual(await upgradeAuthSchema(), { changed: false });
    const login = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: before.email, password: 'LegacyTest@123' }) });
    assert.equal(login.status, 200);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});

test('actual bootstrap CLI gives safe setup errors, hashes credentials and is repeatable on an isolated file DB', async () => {
  const { execFileSync } = require('node:child_process');
  const temp = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'placement-bootstrap-cli-test-'));
  const file = path.join(temp, 'test.sqlite'); const cwd = path.join(__dirname, '..');
  const { createSqliteClient } = require('../src/db/sqliteClient');
  const fixture = createSqliteClient({ db: { sqliteFile: file } });
  await fixture.execScript(schema); await fixture.close();
  const environment = { ...process.env, NODE_ENV: 'development', DB_CLIENT: 'sqlite', SQLITE_FILE: file,
    JWT_SECRET: 'cli-test-key-not-for-real-use', ADMIN_BOOTSTRAP_EMAIL: 'cli-test@example.test',
    ADMIN_BOOTSTRAP_NAME: 'CLI Test Admin', ADMIN_BOOTSTRAP_PASSWORD: 'BootstrapCliTest@123' };
  const script = path.join(cwd, 'src/scripts/bootstrapAdmin.js');
  try {
    assert.throws(() => execFileSync(process.execPath, [script], { cwd, env: { ...environment, ADMIN_BOOTSTRAP_PASSWORD: 'weak' }, encoding: 'utf8', stdio: 'pipe' }),
      (err) => err.status === 1 && /Invalid bootstrap configuration/.test(err.stderr) && !/Fix the SQL/.test(err.stderr));
    const first = execFileSync(process.execPath, [script], { cwd, env: environment, encoding: 'utf8', stdio: 'pipe' });
    assert.match(first, /Administrator created/); assert.ok(!first.includes(environment.ADMIN_BOOTSTRAP_PASSWORD)); assert.ok(!/\$2[aby]\$/.test(first));
    const second = execFileSync(process.execPath, [script], { cwd, env: { ...environment, ADMIN_BOOTSTRAP_PASSWORD: 'DifferentCliTest@123' }, encoding: 'utf8', stdio: 'pipe' });
    assert.match(second, /already exists/);
    const verify = createSqliteClient({ db: { sqliteFile: file } });
    try {
      const row = await verify.one('SELECT * FROM users'); assert.equal(row.role, 'Admin');
      assert.ok(await bcrypt.compare(environment.ADMIN_BOOTSTRAP_PASSWORD, row.password_hash)); assert.equal(Number(await verify.value('SELECT COUNT(*) FROM users')), 1);
    } finally { await verify.close(); }
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
