'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { ROLES } = require('../constants/vocabulary');
const { unauthorized } = require('./errors');

/** Identity + revocation counter only. Never put PII or credentials in a JWT. */
function signSession(user) {
  return jwt.sign({ sub: String(user.id), role: user.role, tv: Number(user.token_version) }, config.jwt.secret, {
    algorithm: 'HS256', expiresIn: config.jwt.expiresIn,
    issuer: config.jwt.issuer, audience: config.jwt.issuer,
    jwtid: crypto.randomBytes(16).toString('hex'),
  });
}

function invalid() {
  return unauthorized('We could not verify your sign-in. Please sign in again.', 'TOKEN_INVALID');
}

function verifySession(presented) {
  let decoded;
  try {
    decoded = jwt.verify(presented, config.jwt.secret, {
      algorithms: ['HS256'], issuer: config.jwt.issuer, audience: config.jwt.issuer,
    });
  } catch (err) {
    if (err?.name === 'TokenExpiredError') {
      throw unauthorized('Your session has expired. Please sign in again.', 'TOKEN_EXPIRED');
    }
    throw invalid();
  }
  if (!decoded || typeof decoded !== 'object'
      || typeof decoded.sub !== 'string' || !/^[1-9]\d*$/.test(decoded.sub)
      || !Number.isSafeInteger(Number(decoded.sub)) || Number(decoded.sub) > 4294967295
      || !ROLES.includes(decoded.role)
      || !Number.isSafeInteger(decoded.tv) || decoded.tv < 0
      || !Number.isSafeInteger(decoded.exp)
      || typeof decoded.jti !== 'string' || !decoded.jti) {
    throw invalid();
  }
  const expiration = new Date(decoded.exp * 1000);
  if (!Number.isFinite(expiration.getTime())) throw invalid();
  return {
    userId: Number(decoded.sub), role: decoded.role, tokenVersion: decoded.tv,
    jti: decoded.jti, expiresAt: expiration.toISOString(),
  };
}

/** Only a Bearer header is accepted — never a URL, cookie or body token. */
function bearerFrom(headerValue) {
  if (typeof headerValue !== 'string') return null;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(headerValue.trim());
  return match ? match[1] : null;
}
function secondsUntilExpiry(decoded) {
  return Math.max(0, Math.floor((new Date(decoded.expiresAt).getTime() - Date.now()) / 1000));
}
module.exports = { signSession, verifySession, bearerFrom, secondsUntilExpiry };
