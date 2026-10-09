'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const run = promisify(execFile);
const logger = require('../src/utils/logger');
const { isDbUnavailable, isAuthSchemaMissing } = require('../src/utils/errors');

test('credential fields are redacted from structured logs', () => {
  const result = logger.redact({ password: 'test-secret', currentPassword: 'test-secret', newPassword: 'test-secret', confirmPassword: 'test-secret', password_hash: '$2b$10$test', token: 'test-token', authorization: 'Bearer test-token', apiKey: 'test-key' });
  assert.ok(Object.values(result).every((value) => value === '[redacted]'));
});
test('a missing schema is distinguished from a broken SQL query', () => {
  assert.equal(isDbUnavailable({ code: 'ECONNREFUSED' }), true);
  assert.equal(isDbUnavailable({ message: 'no such table: users' }), true);
  assert.equal(isDbUnavailable({ message: 'no such column: unrelated_bug' }), false);
  assert.equal(isAuthSchemaMissing({ message: 'no such column: token_version' }), true);
});
test('production refuses missing or weak JWT secrets without a fallback', async () => {
  for (const secret of ['', 'too-short']) {
    await assert.rejects(run(process.execPath, ['-e', "require('./src/config')"], {
      cwd: require('node:path').join(__dirname, '..'), env: { ...process.env, NODE_ENV: 'production', JWT_SECRET: secret },
    }), (err) => /JWT_SECRET must/.test(err.stderr));
  }
});
test('an unreachable MySQL server produces a safe 503 from the real HTTP app', async () => {
  const script = `
    const {createApp}=require('./src/app'); const db=require('./src/db');
    (async()=>{const server=createApp().listen(0,'127.0.0.1'); await new Promise(r=>server.once('listening',r));
      try { const res=await fetch('http://127.0.0.1:'+server.address().port+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'test@example.test',password:'TestOnly@123'})});
        const body=await res.json(); console.log('RESULT '+JSON.stringify({status:res.status,body}));
      }finally{await new Promise(r=>server.close(r)); await db.close();}})().catch(e=>{console.error(e.message);process.exitCode=1;});`;
  const result = await run(process.execPath, ['-e', script], { cwd: require('node:path').join(__dirname, '..'),
    env: { ...process.env, NODE_ENV: 'development', DB_CLIENT: 'mysql', DB_HOST: '127.0.0.1', DB_PORT: '1', DB_USER: 'test_user_not_real', DB_PASSWORD: 'test_password_not_real', JWT_SECRET: 'test-secret-not-a-production-credential' }, timeout: 15000 });
  const value = JSON.parse(result.stdout.split('\n').find((line) => line.startsWith('RESULT ')).slice(7));
  assert.equal(value.status, 503); assert.equal(value.body.error.code, 'DATABASE_UNAVAILABLE');
  for (const forbidden of ['test_password_not_real', 'test_user_not_real', 'SELECT', 'password_hash', 'stack']) assert.ok(!JSON.stringify(value.body).includes(forbidden));
});

test('standalone JWTs and bcrypt hashes are redacted even inside errors/SQL diagnostics', () => {
  const jwt = require('jsonwebtoken'); const bcrypt = require('bcryptjs');
  const token = jwt.sign({ sub: '1' }, 'test-only-signing-key'); const hash = bcrypt.hashSync('LogTest@123', 10);
  const logger = require('../src/utils/logger');
  const text = JSON.stringify(logger.redact(new Error(`Unexpected raw value ${token}; INSERT stored ${hash}`)));
  assert.ok(!text.includes(token)); assert.ok(!text.includes(hash)); assert.match(text, /redacted-token/); assert.match(text, /redacted-hash/);
});
