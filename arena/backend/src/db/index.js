'use strict';

/** Single data-access surface for MySQL and the explicit offline test adapter. */
const config = require('../config');
const { createMysqlClient } = require('./mysqlClient');
const { createSqliteClient } = require('./sqliteClient');

function buildClient() {
  if (config.db.client === 'sqlite') return createSqliteClient(config);
  if (config.db.client === 'mysql') return createMysqlClient(config);
  throw new Error(`Unsupported DB_CLIENT "${config.db.client}". Use "mysql" or "sqlite" (testing only).`);
}

let client = null;
let connecting = null;
let lastConnectError = null;

/**
 * Await the connection, including when the first request races server startup.
 * Concurrent callers share one attempt; a failure is NOT cached forever, so
 * starting MySQL after the API can recover without restarting Node.
 */
async function getClient() {
  if (!client) client = buildClient();
  if (client.__ready) return client;
  if (!connecting) {
    const current = client;
    connecting = Promise.resolve().then(() => current.init()).then(() => {
      current.__ready = true;
      lastConnectError = null;
      return current;
    }).catch((err) => {
      lastConnectError = err;
      throw err;
    }).finally(() => { connecting = null; });
  }
  return connecting;
}

module.exports = {
  get clientName() { return config.db.client; },
  get lastConnectError() { return lastConnectError?.message || null; },
  async init() {
    try { await getClient(); return true; } catch { return false; }
  },
  async close() {
    if (connecting) await connecting.catch(() => {});
    if (client) await client.close();
    client = null;
    connecting = null;
    lastConnectError = null;
  },
  async raw(sql, params = []) { return (await getClient()).raw(sql, params); },
  async query(sql, params = []) {
    const [rows] = await module.exports.raw(sql, params);
    return rows;
  },
  async one(sql, params = []) {
    const rows = await module.exports.query(sql, params);
    return rows[0] || null;
  },
  async value(sql, params = []) {
    const row = await module.exports.one(sql, params);
    return row ? row[Object.keys(row)[0]] : null;
  },
  async insert(sql, params = []) { return (await getClient()).insert(sql, params); },
  async execute(sql, params = []) { return (await getClient()).execute(sql, params); },
  async tx(work, options) { return (await getClient()).tx(work, options); },
  async ping() { return (await getClient()).ping(); },
  async execScript(sql) { return (await getClient()).execScript(sql); },
};
