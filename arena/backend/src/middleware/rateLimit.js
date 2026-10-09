'use strict';

/** Single-process throttles; counters expire in memory and reset on restart. */
const config = require('../config');
const { tooManyRequests } = require('../utils/errors');
const normaliseEmail = (value) => typeof value === 'string' ? value.trim().toLowerCase().slice(0, 190) : '_no_email';
const clientIp = (req) => req.ip || req.socket?.remoteAddress || 'unknown';

/**
 * Reserve a slot BEFORE starting the handler. Counting only on `finish` lets a
 * burst of simultaneous password guesses slip through. Successful logins can
 * reset their account bucket; database outages do not consume the budget.
 */
function createThrottle({ name, windowMinutes, max, keyFor, countWhen, maxKeys = 5000 }) {
  const buckets = new Map();
  const windowMs = windowMinutes * 60 * 1000;
  function middleware(req, res, next) {
    const key = keyFor(req);
    const now = Date.now();
    let entry = buckets.get(key);
    if (!entry || entry.resetAt <= now) {
      if (buckets.size >= maxKeys) {
        for (const [k, v] of buckets) if (v.resetAt <= now && v.inFlight === 0) buckets.delete(k);
        if (!buckets.has(key) && buckets.size >= maxKeys) {
          return next(tooManyRequests('Sign-in traffic is high right now. Please try again shortly.', 60));
        }
      }
      entry = { count: 0, inFlight: 0, resetAt: now + windowMs };
      buckets.set(key, entry);
    }
    if (entry.count + entry.inFlight >= max) {
      const seconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      return next(tooManyRequests(
        name === 'login'
          ? 'Too many failed sign-in attempts. Please wait before trying again, or contact the placement office.'
          : 'Too many registration attempts from this network. Please try again later.',
        seconds, name === 'login' ? 'LOGIN_THROTTLED' : 'SIGNUP_THROTTLED',
      ));
    }
    entry.inFlight += 1;
    let settled = false;
    function finish(completed) {
      if (settled) return;
      settled = true;
      entry.inFlight -= 1;
      if (completed && countWhen(req, res)) entry.count += 1;
    }
    res.once('finish', () => finish(true));
    res.once('close', () => finish(false));
    return next();
  }
  middleware.keyFor = keyFor;
  middleware.reset = (key) => buckets.delete(key);
  middleware.clear = () => buckets.clear();
  middleware.peek = (key) => {
    const entry = buckets.get(key);
    return entry && entry.resetAt > Date.now()
      ? { count: entry.count, inFlight: entry.inFlight }
      : { count: 0, inFlight: 0 };
  };
  return middleware;
}

const failedLogin = (_req, res) => res.statusCode >= 400 && res.statusCode < 500;
const loginIpThrottle = createThrottle({
  name: 'login', windowMinutes: config.security.loginWindowMinutes,
  max: config.security.loginPerIpMaxAttempts,
  keyFor: (req) => `login-ip|${clientIp(req)}`, countWhen: failedLogin,
});
const loginThrottle = createThrottle({
  name: 'login', windowMinutes: config.security.loginWindowMinutes,
  max: config.security.loginMaxAttempts,
  keyFor: (req) => `login|${normaliseEmail(req.body?.email)}|${clientIp(req)}`,
  countWhen: failedLogin,
});
const signupThrottle = createThrottle({
  name: 'signup', windowMinutes: 60, max: config.security.registerPerHourPerIp,
  keyFor: (req) => `signup|${clientIp(req)}`,
  // Duplicates also require hashing/DB work; validation errors and outages don't.
  countWhen: (_req, res) => res.statusCode < 300 || res.statusCode === 409,
});
module.exports = { createThrottle, loginThrottle, loginIpThrottle, signupThrottle, normaliseEmail, clientIp };
