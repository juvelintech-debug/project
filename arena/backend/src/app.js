'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');

const config = require('./config');
const logger = require('./utils/logger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  /* Correlation id: the user can quote it, we can find it in the log. */
  app.use((req, res, next) => {
    req.id = req.headers['x-request-id'] || crypto.randomUUID().slice(0, 8);
    res.setHeader('X-Request-Id', req.id);
    next();
  });

  /* Baseline response headers. CSP is what keeps a stored XSS payload inert. */
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Production disallows embedding; dev must work in Arena's framed preview.
    if (config.isProd) res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self'",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        ...(config.isProd ? ["frame-ancestors 'none'"] : []),
      ].join('; ')
    );
    next();
  });

  /*
   * CORS: the SPA is normally same-origin (Vite proxies /api in dev, Express
   * serves the build in prod), so this exists only for a separately-hosted
   * client. Credentials are never allowed cross-origin because the token is
   * sent as a header, not a cookie.
   */
  app.use(cors({
    origin(origin, callback) {
      if (!origin || origin === config.clientOrigin) return callback(null, true);
      return callback(null, false);
    },
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  }));

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));

  if (!config.isProd) {
    app.use((req, res, next) => {
      const t0 = Date.now();
      res.on('finish', () => {
        logger.info(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - t0}ms`);
      });
      next();
    });
  }

  /* API */
  app.use('/api', (req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  app.use('/api', require('./routes/system'));
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/admin', require('./routes/admin'));
  app.use('/api/student', require('./routes/student'));
  app.use('/api/company', require('./routes/company'));

  /* Built SPA, if present (production single-process deploy). */
  const dist = config.paths.frontendDist;
  if (fs.existsSync(dist)) {
    app.use(express.static(dist, { index: false, maxAge: config.isProd ? '1h' : 0 }));
    // Client-side routes must fall through to index.html …
    app.get(/^\/(?!api(?:\/|$)).*/i, (req, res, next) => {
      // … but a URL that looks like a file must 404 instead. Serving index.html
      // for a missing hashed asset turns a 404 into a 200 text/html response that
      // the browser then fails to parse as a module — a silent, confusing bug.
      if (/\.[A-Za-z0-9]{1,8}$/.test(req.path)) return next();
      const indexFile = path.join(dist, 'index.html');
      if (!indexFile.startsWith(dist) || !fs.existsSync(indexFile)) return next();
      res.sendFile(indexFile);
    });
  }

  /* Anything still unmatched under /api is a genuine 404. */
  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
