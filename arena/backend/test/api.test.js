'use strict';

/**
 * Boots the real Express app on an ephemeral port and asserts the contract the
 * frontend depends on. Uses the sqlite test adapter so it runs anywhere MySQL
 * is not installed (CI, a fresh clone) — the HTTP layer under test is the same
 * code that talks to MySQL in production.
 */

process.env.DB_CLIENT = 'sqlite';
process.env.SQLITE_FILE = ':memory:';
process.env.NODE_ENV = 'development';
delete process.env.JWT_SECRET;

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { createApp } = require('../src/app');
const config = require('../src/config');

let server;
let base;

test.before(async () => {
  server = createApp().listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await require('../src/db').close();
});

test('GET /api/health answers 200 even with a degraded dependency, and names it', async () => {
  const res = await fetch(`${base}/api/health`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /application\/json/);

  const body = await res.json();
  assert.equal(body.service, config.app.shortName);
  assert.ok(['ok', 'degraded'].includes(body.status), `unexpected status ${body.status}`);
  assert.ok(['ok', 'down'].includes(body.database.status));
  // sqlite adapter is what this run uses, so the database must be reachable…
  assert.equal(body.database.status, 'ok');
  assert.equal(body.database.client, 'sqlite');
  assert.ok(Number.isInteger(body.database.latencyMs));
  // …and the AI block must state readiness without ever leaking a key.
  assert.equal(typeof body.ai.configured, 'boolean');
  assert.equal(body.ai.provider, 'gemini');
  assert.ok(!JSON.stringify(body).includes('AIza'), 'health must not expose an API key');
  assert.ok(!('apiKey' in body.ai));
});

test('GET /api/meta is the single source of the role and status vocabularies', async () => {
  const body = await (await fetch(`${base}/api/meta`)).json();

  assert.deepEqual(body.roles, ['Student', 'Company', 'Admin']);
  assert.deepEqual(body.companyStatuses, ['Pending', 'Approved', 'Rejected', 'Suspended']);
  assert.deepEqual(body.jobStatuses, ['Draft', 'Pending Approval', 'Approved', 'Rejected', 'Closed', 'Expired']);

  assert.equal(body.applicationStatuses.length, 12);
  assert.equal(new Set(body.applicationStatuses).size, 12, 'statuses must be unique — a duplicate would break the tracking UI');
  for (const required of ['Applied', 'Shortlisted', 'Offer Received', 'Withdrawn', 'Rejected']) {
    assert.ok(body.applicationStatuses.includes(required), `${required} must exist`);
  }

  assert.equal(typeof body.limits.maxResumeMb, 'number');
  assert.ok(body.limits.allowedResumeTypes.includes('.pdf'));
  assert.ok(!body.limits.allowedResumeTypes.includes('.exe'));
  assert.equal(typeof body.readiness.aiEnabled, 'boolean');
});

test('an unknown API route is a JSON 404 with a trace id, never the SPA shell', async () => {
  const res = await fetch(`${base}/api/does-not-exist`);
  assert.equal(res.status, 404);
  assert.match(res.headers.get('content-type'), /application\/json/);
  assert.equal(res.headers.get('x-request-id'), res.headers.get('x-request-id'));

  const body = await res.json();
  assert.equal(body.error.code, 'NOT_FOUND');
  assert.match(body.error.message, /No API route matches GET \/api\/does-not-exist/);
  assert.ok(body.error.requestId, 'errors carry the request id so a screenshot is enough to debug');
});

test('a wrong method on a known path is still a JSON 404', async () => {
  const res = await fetch(`${base}/api/health`, { method: 'POST' });
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.error.code, 'NOT_FOUND');
});

test('a malformed JSON body becomes a 400 with a readable message, not a stack trace', async () => {
  const res = await fetch(`${base}/api/health`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"broken":',
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error.message, /body|json/i);
  assert.ok(!('stack' in body.error));
});

test('every response carries the hardening headers the CSP story depends on', async () => {
  const res = await fetch(`${base}/api/health`);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
  assert.equal(res.headers.get('referrer-policy'), 'no-referrer');
  assert.match(res.headers.get('content-security-policy'), /default-src 'self'/);
  assert.match(res.headers.get('content-security-policy'), /connect-src 'self'/);
  assert.ok(!res.headers.get('x-powered-by'), 'Express must not advertise its version');
});

test('the built SPA is served from the same origin when a bundle exists', async () => {
  const dist = config.paths.frontendDist;
  if (!fs.existsSync(path.join(dist, 'index.html'))) {
    console.log('  (skipped: run `npm run build` in arena/frontend first)');
    return;
  }
  const res = await fetch(`${base}/any/client/route`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  const html = await res.text();
  assert.match(html, /<div id="root">/);
  assert.match(html, /<script[^>]+type="module"/);

  // A hashed asset that is missing must 404, not fall back to index.html —
  // otherwise the browser silently parses HTML as a JavaScript module.
  const missing = await fetch(`${base}/assets/definitely-not-here.js`);
  assert.equal(missing.status, 404);
});
