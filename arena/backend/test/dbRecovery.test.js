'use strict';
process.env.DB_CLIENT = 'mysql';
process.env.JWT_SECRET = 'database-facade-test-key-not-a-production-secret';
const test = require('node:test');
const assert = require('node:assert/strict');
const mysqlModule = require('../src/db/mysqlClient');
const original = mysqlModule.createMysqlClient;
let attempts = 0;
// Connection-lifecycle contract test. Does not pretend to be a real MySQL server.
mysqlModule.createMysqlClient = () => ({
  async init() { attempts += 1; if (attempts === 1) throw Object.assign(new Error('test connection refused'), { code: 'ECONNREFUSED' }); },
  async raw() { return [[{ ok: 1 }], []]; }, async close() {},
});
const db = require('../src/db');
test.after(async () => { await db.close(); mysqlModule.createMysqlClient = original; });
test('connection failure is retried and concurrent requests share the next connection attempt', async () => {
  assert.equal(await db.init(), false); assert.ok(db.lastConnectError);
  const results = await Promise.all(Array.from({ length: 8 }, () => db.one('SELECT 1 AS ok')));
  assert.ok(results.every((row) => row.ok === 1)); assert.equal(attempts, 2); assert.equal(db.lastConnectError, null);
});
