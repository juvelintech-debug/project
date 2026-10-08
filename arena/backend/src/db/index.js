'use strict';

/**
 * Data access layer.
 *
 * Every module talks to the database through this one file, so the SQL style
 * stays consistent and the transaction rules are enforced in one place.
 *
 *   db.query(sql, params)         → rows                  (SELECT / any statement)
 *   db.raw(sql, params)           → [rows, fields]        (mysql2-compatible)
 *   db.insert(sql, params)        → { insertId, affectedRows }
 *   db.tx(async (client) => {...})→ runs in one transaction, auto-rollback
 *   db.ping()                     → connectivity + client info
 *
 * `client` inside tx() has the same query/insert/raw methods, bound to the
 * transaction connection.
 *
 * Two backends share this interface:
 *   • mysql  (production — what you run with MySQL Workbench / XAMPP)
 *   • sqlite (offline test adapter for environments with no MySQL server;
 *              see DB_CLIENT in .env. Not intended for real deployments.)
 */

const config = require('../config');
const { createMysqlClient } = require('./mysqlClient');
const { createSqliteClient } = require('./sqliteClient');

function buildClient() {
  if (config.db.client === 'sqlite') return createSqliteClient(config);
  if (config.db.client === 'mysql') return createMysqlClient(config);
  throw new Error(
    `Unsupported DB_CLIENT "${config.db.client}". Use "mysql" (recommended) or "sqlite" (testing only).`
  );
}

// Created lazily so importing this module never opens a socket on its own.
let client = null;
let lastConnectError = null;

function ensureReady() {
  if (!client) client = buildClient();
  if (client && !client.__ready && lastConnectError) throw lastConnectError;
  return client;
}

function getClient() {
  return ensureReady();
}

module.exports = {
  get clientName() {
    return config.db.client;
  },

  /**
   * Establish the underlying handle. Called once at boot.
   *
   * Deliberate policy: a database that cannot be reached must not take the whole
   * server down. We record the reason, let the HTTP layer keep answering (so the
   * frontend can say *why* it is failing instead of showing a network error), and
   * retry the connection on each subsequent request until it succeeds.
   */
  async init() {
    try {
      const c = ensureReady();
      await c.init();
      c.__ready = true;
      lastConnectError = null;
      return true;
    } catch (err) {
      lastConnectError = err;
      return false;
    }
  },

  get lastConnectError() {
    return lastConnectError ? lastConnectError.message : null;
  },

  async close() {
    if (!client) return;
    await client.close();
    client = null;
  },

  /** [rows, fields] — kept mysql2-shaped so SQL knowledge transfers directly. */
  raw(sql, params = []) {
    return getClient().raw(sql, params);
  },

  async query(sql, params = []) {
    const [rows] = await getClient().raw(sql, params);
    return rows;
  },

  async one(sql, params = []) {
    const rows = await module.exports.query(sql, params);
    return rows.length ? rows[0] : null;
  },

  /** First column of the first row of a scalar query (COUNT(*) etc.). */
  async value(sql, params = []) {
    const row = await module.exports.one(sql, params);
    if (!row) return null;
    const key = Object.keys(row)[0];
    return row[key];
  },

  async insert(sql, params = []) {
    return getClient().insert(sql, params);
  },

  async execute(sql, params = []) {
    return getClient().execute(sql, params);
  },

  /** One transaction. Throw inside the callback to roll everything back. */
  tx(work) {
    return getClient().tx(work);
  },

  async ping() {
    return getClient().ping();
  },

  /** Run a whole .sql script (used by the migrate/seed CLIs). */
  async execScript(sql) {
    return getClient().execScript(sql);
  },
};
