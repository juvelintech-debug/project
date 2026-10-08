'use strict';

/**
 * Production data client: a mysql2 connection pool against a real MySQL server.
 * This is the client you use with MySQL Workbench / XAMPP.
 */

const { splitStatements } = require('./sqlUtils');

module.exports = {
  createMysqlClient(config) {
    let pool = null;

    async function init() {
      if (pool) return pool;
      const mysql = require('mysql2/promise');

      pool = mysql.createPool({
        host: config.db.host,
        port: config.db.port,
        user: config.db.user,
        password: config.db.password,
        database: config.db.database,
        waitForConnections: true,
        connectionLimit: config.db.connectionLimit,
        queueLimit: 0,
        // Store dates as strings so DATETIME never shifts with the server's
        // timezone — the frontend formats them.
        dateStrings: true,
        namedPlaceholders: false,
        multipleStatements: false,
      });

      // A failed first connect must not leave a half-built pool behind, so that
      // a later call retries instead of reusing a broken handle.
      try {
        const conn = await pool.getConnection();
        pool.releaseConnection(conn);
      } catch (err) {
        try { await pool.end(); } catch { /* ignore */ }
        pool = null;
        throw friendlyError(err);
      }
      return pool;
    }

    function friendlyError(err) {
      const msg = err && err.code === 'ECONNREFUSED'
        ? `Cannot reach MySQL at ${config.db.host}:${config.db.port}. Is the MySQL service running (XAMPP → MySQL, or your system service)?`
        : err && (err.code === 'ER_BAD_DB_ERROR' || /Unknown database/i.test(err.message || ''))
          ? `Database "${config.db.database}" does not exist. Run: cd arena/backend && npm run db:create`
          : err && /Access denied/i.test(err.message || '')
            ? `MySQL refused the credentials for user "${config.db.user}". Check DB_USER / DB_PASSWORD in arena/backend/.env`
            : err;
      return msg instanceof Error ? msg : Object.assign(new Error(String(msg)), { code: err && err.code });
    }

    async function raw(sql, params = []) {
      try {
        return await pool.execute(sql, params);
      } catch (err) {
        throw friendlyError(err);
      }
    }

    async function insert(sql, params = []) {
      const [result] = await raw(sql, params);
      return { insertId: result.insertId, affectedRows: result.affectedRows };
    }

    async function execute(sql, params = []) {
      const [result] = await raw(sql, params);
      return { insertId: result.insertId, affectedRows: result.affectedRows, changedRows: result.changedRows };
    }

    async function tx(work) {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const result = await work(bind(conn));
        await conn.commit();
        return result;
      } catch (err) {
        try { await conn.rollback(); } catch { /* rollback best-effort */ }
        throw friendlyError(err);
      } finally {
        conn.release();
      }
    }

    /** Same surface as the pool, so services don't care which they got. */
    function bind(conn) {
      return {
        async raw(sql, params = []) {
          const [rows, fields] = await conn.execute(sql, params);
          return [rows, fields];
        },
        async query(sql, params = []) {
          const [rows] = await conn.execute(sql, params);
          return rows;
        },
        async one(sql, params = []) {
          const rows = await conn.query(sql, params);
          return rows.length ? rows[0] : null;
        },
        async value(sql, params = []) {
          const rows = await conn.query(sql, params);
          if (!rows.length) return null;
          const row = rows[0];
          return row[Object.keys(row)[0]];
        },
        async insert(sql, params = []) {
          const [r] = await conn.execute(sql, params);
          return { insertId: r.insertId, affectedRows: r.affectedRows };
        },
        async execute(sql, params = []) {
          const [r] = await conn.execute(sql, params);
          return { insertId: r.insertId, affectedRows: r.affectedRows, changedRows: r.changedRows };
        },
        __mysqlConnection: conn,
      };
    }

    async function ping() {
      const [rows] = await raw('SELECT 1 AS ok');
      return {
        client: 'mysql',
        verified: Array.isArray(rows) && !!rows[0] && rows[0].ok === 1,
        database: config.db.database,
        host: `${config.db.host}:${config.db.port}`,
      };
    }

    /**
     * Run a whole .sql script one statement at a time.
     *
     * `multipleStatements` stays off in the pool config — it is a real
     * SQL-injection amplifier — so scripts are split here and executed
     * sequentially instead. DDL must go through pool.query(), not
     * conn.execute(): MySQL prepared statements do not support CREATE/ALTER.
     */
    async function execScript(sql) {
      const statements = splitStatements(sql);
      for (let i = 0; i < statements.length; i += 1) {
        try {
          await pool.query(statements[i]);
        } catch (err) {
          // "You have an error in your SQL syntax near line 1" is useless when a
          // schema file has 400 lines. Name the statement and its position.
          err.scriptPosition = `${i + 1}/${statements.length}`;
          err.scriptStatement = statements[i].slice(0, 160);
          throw err;
        }
      }
      return { count: statements.length };
    }

    return { init, raw, query: (sql, p) => raw(sql, p).then(([r]) => r), insert, execute, tx, ping, bind, execScript, close: () => pool && pool.end() };
  },
};
