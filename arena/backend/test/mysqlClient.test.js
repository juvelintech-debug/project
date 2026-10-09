'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createMysqlClient } = require('../src/db/mysqlClient');
const client = () => createMysqlClient({ db: { host: '127.0.0.1', port: 3306, user: '', password: '', database: 'test', connectionLimit: 1 } });
// Driver-contract doubles only, NOT a claim that a real MySQL server ran.
test('transaction readers unwrap the mysql2 [rows, fields] result correctly', async () => {
  const t = client().bind({ execute: async () => [[{ id: 42, name: 'Test' }], [{ name: 'id' }]] });
  assert.deepEqual(await t.one('SELECT id, name FROM users WHERE id = ?', [42]), { id: 42, name: 'Test' });
  assert.equal(await t.value('SELECT COUNT(*) FROM users'), 42);
  assert.deepEqual(await t.query('SELECT id FROM users'), [{ id: 42, name: 'Test' }]);
});
test('transaction one/value return null for no matching row', async () => {
  const t = client().bind({ execute: async () => [[], []] });
  assert.equal(await t.one('SELECT id FROM users'), null); assert.equal(await t.value('SELECT id FROM users'), null);
});
test('transaction inserts/updates preserve the mysql2 result-header contract', async () => {
  const t = client().bind({ execute: async () => [{ insertId: 9, affectedRows: 1, changedRows: 1 }, []] });
  assert.deepEqual(await t.insert('INSERT INTO users (email) VALUES (?)', ['test@example.test']), { insertId: 9, affectedRows: 1 });
  assert.equal((await t.execute('UPDATE users SET status = ? WHERE id = ?', ['Active', 9])).affectedRows, 1);
});

test('bootstrap advisory lock is held through commit and released on the same connection', async () => {
  const driver = require('mysql2/promise'); const original = driver.createPool; const calls = [];
  const conn = {
    execute: async (sql) => { calls.push(sql); return sql.includes('GET_LOCK') ? [[{ acquired: 1 }], []] : [[{ released: 1 }], []]; },
    beginTransaction: async () => calls.push('BEGIN'), commit: async () => calls.push('COMMIT'), rollback: async () => calls.push('ROLLBACK'), release: () => calls.push('RELEASE CONNECTION'),
  };
  driver.createPool = () => ({ getConnection: async () => conn, releaseConnection() {}, end: async () => {} });
  const c = client();
  try {
    await c.init(); await c.tx(async () => { calls.push('WORK'); }, { advisoryLock: 'test-bootstrap-lock' });
    assert.deepEqual(calls, ['SELECT GET_LOCK(?, 10) AS acquired', 'BEGIN', 'WORK', 'COMMIT', 'SELECT RELEASE_LOCK(?)', 'RELEASE CONNECTION']);
    calls.length = 0;
    await assert.rejects(c.tx(async () => { throw new Error('test transaction failure'); }, { advisoryLock: 'test-bootstrap-lock' }));
    assert.ok(calls.indexOf('ROLLBACK') < calls.indexOf('SELECT RELEASE_LOCK(?)'));
  } finally { await c.close(); driver.createPool = original; }
});
