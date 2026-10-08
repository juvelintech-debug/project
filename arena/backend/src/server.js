'use strict';

const config = require('./config');
const logger = require('./utils/logger');
const db = require('./db');
const { createApp } = require('./app');

async function start() {
  // Make sure the upload directory exists before the first request needs it.
  const fs = require('fs');
  fs.mkdirSync(config.paths.uploads, { recursive: true });

  const app = createApp();
  const server = app.listen(config.port, '0.0.0.0', () => {
    const actual = server.address();
    const port = typeof actual === 'object' && actual ? actual.port : config.port;
    logger.info(`${config.app.name} API listening`, {
      port,
      env: config.env,
      dbClient: db.clientName,
      uploads: config.paths.uploads,
      ai: config.ai.enabled ? (config.ai.apiKey ? 'configured' : 'no key — fallback mode') : 'disabled',
    });
  });

  /*
   * The database is verified, not assumed. If MySQL is unreachable the API
   * still serves requests so /api/health can explain the situation, and the
   * first data query retries the connection.
   */
  const connected = await db.init();
  if (connected) {
    const info = await db.ping().catch(() => ({}));
    logger.info('database connected', info);
  } else {
    logger.error('database unavailable at startup', {
      reason: db.lastConnectError,
      hint: db.clientName === 'mysql'
        ? 'Start MySQL, then: cd arena/backend && npm run db:create && npm run db:migrate && npm run db:seed'
        : 'Set DB_CLIENT=mysql in .env for a real deployment',
    });
  }

  const shutdown = (signal) => {
    logger.info(`received ${signal}, shutting down`);
    server.close(async () => {
      try { await db.close(); } catch { /* already closed */ }
      process.exit(0);
    });
    // Never hang forever on a stuck keep-alive connection.
    setTimeout(() => process.exit(1), 8000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => logger.error('unhandledRejection', { reason }));
  process.on('uncaughtException', (err) => {
    logger.error('uncaughtException — exiting', { err });
    setTimeout(() => process.exit(1), 100);
  });

  return server;
}

if (require.main === module) {
  start().catch((err) => {
    logger.error('failed to start server', { err: err.message, stack: err.stack });
    process.exit(1);
  });
}

module.exports = { start };
