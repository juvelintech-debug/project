'use strict';
process.env.JWT_SECRET = 'token-test-secret-not-a-production-credential';
process.env.NODE_ENV = 'development';
const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const config = require('../src/config');
const { bearerFrom, signSession, verifySession, secondsUntilExpiry } = require('../src/utils/tokens');
const payload = { sub: '7', role: 'Student', tv: 0 };
const options = { issuer: config.jwt.issuer, audience: config.jwt.issuer, expiresIn: '2h', jwtid: 'test-session' };
function refused(token, code = 'TOKEN_INVALID') {
  assert.throws(() => verifySession(token), (err) => err.status === 401 && err.code === code);
}
test('issued JWT has pinned algorithm, issuer, audience, expiry and minimal claims', () => {
  const token = signSession({ id: 7, role: 'Student', token_version: 3 });
  assert.equal(jwt.decode(token, { complete: true }).header.alg, 'HS256');
  const result = verifySession(token); assert.equal(result.userId, 7); assert.equal(result.tokenVersion, 3);
  assert.ok(secondsUntilExpiry(result) > 0); assert.ok(result.jti);
  assert.deepEqual(Object.keys(jwt.decode(token)).sort(), ['aud', 'exp', 'iat', 'iss', 'jti', 'role', 'sub', 'tv'].sort());
});
test('missing/malformed/unsigned/bad-signature tokens are rejected', () => {
  for (const token of [null, '', 'not.a.jwt', jwt.sign(payload, '', { algorithm: 'none', ...options }), jwt.sign(payload, 'another-test-key', options)]) refused(token);
});
test('other HMAC algorithms, issuers and audiences are rejected', () => {
  for (const changes of [{ algorithm: 'HS384' }, { issuer: 'other-app' }, { audience: 'other-audience' }]) refused(jwt.sign(payload, config.jwt.secret, { ...options, ...changes }));
});
test('expired tokens produce TOKEN_EXPIRED', () => refused(jwt.sign(payload, config.jwt.secret, { ...options, expiresIn: -1 }), 'TOKEN_EXPIRED'));
test('claims must contain a positive integer subject, canonical role, version, expiry and id', () => {
  for (const changes of [{ sub: '0' }, { sub: '1e3' }, { sub: '4294967296' }, { sub: '7.2' }, { role: 'root' }, { tv: '0' }, { tv: -1 }, { tv: undefined }]) refused(jwt.sign({ ...payload, ...changes }, config.jwt.secret, options));
  const { expiresIn: _expiration, ...withoutExpiry } = options;
  refused(jwt.sign(payload, config.jwt.secret, withoutExpiry));
  const { jwtid: _id, ...withoutId } = options;
  refused(jwt.sign(payload, config.jwt.secret, withoutId));
});
test('Bearer parsing never accepts cookie/body/query schemes or multiple tokens', () => {
  assert.equal(bearerFrom(' bearer abc.def.ghi  '), 'abc.def.ghi');
  for (const bad of [undefined, ['Bearer a'], 'Basic abc', 'Bearer a b', 'Bearer', 'abc']) assert.equal(bearerFrom(bad), null);
});

test('signed expiration values outside the representable Date range are a 401, never an internal exception', () => {
  const { expiresIn: _expiry, ...withoutExpiry } = options;
  refused(jwt.sign({ ...payload, exp: Number.MAX_SAFE_INTEGER }, config.jwt.secret, withoutExpiry));
});
