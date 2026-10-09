'use strict';

/**
 * Structured console logger with credential redaction.
 * Nothing that looks like a secret may reach stdout, a log file or the client.
 */

const SENSITIVE_KEYS = /^(password|password_hash|passwordHash|currentPassword|newPassword|confirmPassword|token|accessToken|refreshToken|authorization|cookie|secret|apiKey|api_key|jwt|session|otp|code)$/i;
const INLINE_PATTERNS = [
  /\b(Bearer)\s+[A-Za-z0-9._-]{8,}/gi,
  /\bAIza[0-9A-Za-z_-]{20,}/g,
  /["']?(password|passwd|secret|api[_-]?key|token)["']?\s*[:=]\s*["'][^"']{3,}["']/gi,
];

function redactText(value) {
  let out = String(value);
  out = out.replace(INLINE_PATTERNS[0], '$1 [redacted]');
  out = out.replace(INLINE_PATTERNS[1], '[redacted-key]');
  out = out.replace(INLINE_PATTERNS[2], (m, key) => `${key}=[redacted]`);
  out = out.replace(/\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}/g, '[redacted-hash]');
  out = out.replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[redacted-token]');
  return out;
}

function redact(value, depth = 0) {
  if (depth > 6) return '[deep]';
  if (value === null || value === undefined) return value;
  if (value instanceof Error) return { name: value.name, message: redactText(value.message), code: value.code };
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE_KEYS.test(k) ? '[redacted]' : redact(v, depth + 1);
    }
    return out;
  }
  if (typeof value === 'string') return redactText(value);
  return value;
}

function emit(level, message, meta) {
  const line = { t: new Date().toISOString(), level, msg: redactText(message) };
  if (meta !== undefined) line.data = redact(meta);
  const text = JSON.stringify(line);
  if (level === 'error') process.stderr.write(`${text}\n`);
  else process.stdout.write(`${text}\n`);
}

module.exports = {
  info: (m, d) => emit('info', m, d),
  warn: (m, d) => emit('warn', m, d),
  error: (m, d) => emit('error', m, d),
  debug: (m, d) => { if (process.env.DEBUG) emit('debug', m, d); },
  redact,
  redactText,
};
