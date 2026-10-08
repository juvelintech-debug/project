'use strict';

/**
 * Central configuration. Everything that varies per machine comes from the
 * environment (arena/backend/.env), so no credentials ever live in source.
 */

const fs = require('fs');
const path = require('path');

// Load .env from this folder regardless of the cwd the server was started from.
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const env = (key, fallback = '') => {
  const v = process.env[key];
  return v === undefined || v === '' ? fallback : v;
};
const bool = (key, fallback = false) => {
  const v = process.env[key];
  if (v === undefined || v === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
};
const int = (key, fallback) => {
  const v = parseInt(env(key, ''), 10);
  return Number.isFinite(v) ? v : fallback;
};

const NODE_ENV = env('NODE_ENV', 'development');
const isProd = NODE_ENV === 'production';

/* ── JWT secret ───────────────────────────────────────────────────────────────
 * Production must supply one explicitly. In development we generate a random
 * secret once and persist it to .env, otherwise every server restart would log
 * everyone out (tokens signed with the previous secret stop verifying).
 */
function resolveJwtSecret() {
  const fromEnv = env('JWT_SECRET');
  if (fromEnv) return fromEnv;

  if (isProd) {
    throw new Error(
      'JWT_SECRET must be set in the environment when NODE_ENV=production. ' +
        'Copy .env.example to .env and provide a long random value.'
    );
  }

  const generated = require('crypto').randomBytes(48).toString('hex');
  const envFile = path.join(__dirname, '..', '.env');
  try {
    const current = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '';
    const next = /^JWT_SECRET=.*$/m.test(current)
      ? current.replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${generated}`)
      : `${current.trimEnd()}\nJWT_SECRET=${generated}\n`.replace(/^\n+/, '');
    fs.writeFileSync(envFile, next, 'utf8');
    // eslint-disable-next-line no-console
    console.log('[config] no JWT_SECRET found — generated one and saved it to .env');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[config] could not persist a dev JWT secret to .env:', err.message);
  }
  return generated;
}

const config = {
  env: NODE_ENV,
  isProd,
  port: int('PORT', 4000),
  clientOrigin: env('CLIENT_ORIGIN', 'http://localhost:5173'),

  jwt: {
    secret: resolveJwtSecret(),
    expiresIn: env('JWT_EXPIRES_IN', '2h'),
  },

  db: {
    // 'mysql' → mysql2 pool against a real MySQL server (what you run locally).
    // 'sqlite' → sandbox/offline adapter used only for automated testing.
    client: env('DB_CLIENT', 'mysql').toLowerCase(),
    host: env('DB_HOST', '127.0.0.1'),
    port: int('DB_PORT', 3306),
    user: env('DB_USER', 'root'),
    password: env('DB_PASSWORD', ''),
    database: env('DB_NAME', 'placement_db'),
    connectionLimit: int('DB_POOL_SIZE', 10),
    // Only used by the sqlite test adapter.
    sqliteFile: env('SQLITE_FILE', ''),
  },

  paths: {
    root: path.join(__dirname, '..'),
    uploads: path.resolve(path.join(__dirname, '..', env('UPLOAD_DIR', './uploads'))),
    frontendDist: path.join(__dirname, '..', '..', 'frontend', 'dist'),
  },

  uploads: {
    maxBytes: int('MAX_RESUME_MB', 2) * 1024 * 1024,
    maxResumeMb: int('MAX_RESUME_MB', 2),
    allowedMime: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    allowedExt: ['.pdf', '.doc', '.docx'],
  },

  ai: {
    provider: env('AI_PROVIDER', 'gemini').toLowerCase(),
    enabled: bool('AI_ENABLED', true),
    apiKey: env('GEMINI_API_KEY', env('AI_API_KEY')),
    model: env('GEMINI_MODEL', 'gemini-2.5-flash'),
    timeoutMs: int('AI_TIMEOUT_MS', 25000),
    quotaPerStudent: int('AI_DAILY_QUOTA_PER_STUDENT', 25),
  },

  app: {
    name: 'AI-Powered Student Placement Management System',
    shortName: 'Placement Portal',
  },
};

module.exports = config;
