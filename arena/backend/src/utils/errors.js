'use strict';

/**
 * Typed application errors.
 *
 * The message is what the *user* sees, so it must name the fix and reveal
 * nothing about the implementation. `detail` is internal (logged only).
 */
class ApiError extends Error {
  constructor(status, code, message, detail) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    if (detail) this.detail = detail;
  }
}

const badRequest = (message, code = 'BAD_REQUEST', detail) => new ApiError(400, code, message, detail);
/**
 * `hint` is the one internal field that *is* sent to the client: it tells an API
 * consumer how to fix the call (which header, which field). It is never used for
 * 500s, where the client gets a generic sentence and the detail goes to the log.
 */
const unauthorized = (message = 'Please sign in to continue.', code = 'UNAUTHENTICATED', hint) => {
  const err = new ApiError(401, code, message);
  if (hint) err.hint = hint;
  return err;
};
const forbidden = (message = 'You do not have access to that.', code = 'FORBIDDEN', hint) => {
  const err = new ApiError(403, code, message);
  if (hint) err.hint = hint;
  return err;
};
/** 404 vs 403 deliberately collapsed: never confirm that a record exists. */
const notFound = (message = 'That record could not be found.', code = 'NOT_FOUND') => new ApiError(404, code, message);
const conflict = (message, code = 'CONFLICT', detail) => new ApiError(409, code, message, detail);
const unprocessable = (message, code = 'VALIDATION', detail) => new ApiError(422, code, message, detail);
const tooLarge = (message, code = 'FILE_TOO_LARGE') => new ApiError(413, code, message);
const serviceUnavailable = (message, code = 'UNAVAILABLE', detail) => new ApiError(503, code, message, detail);

/** Rate limited. `retryAfterSeconds` becomes a Retry-After header. */
function tooManyRequests(message, retryAfterSeconds = 60, code = 'RATE_LIMITED') {
  const err = new ApiError(429, code, message);
  err.retryAfterSeconds = Math.max(1, Math.round(retryAfterSeconds));
  return err;
}

const DB_UNAVAILABLE_CODES = new Set([
  'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EHOSTUNREACH', 'EPIPE', 'PROTOCOL_CONNECTION_LOST',
  'ER_BAD_DB_ERROR', 'ER_NO_SUCH_TABLE', 'ER_ACCESS_DENIED_ERROR', 'ER_ACCESS_DENIED_NO_PASSWORD_ERROR', 'ER_NOT_SUPPORTED_AUTH_MODE',
]);

/**
 * True when a query failed because MySQL could not be reached or the schema is
 * missing — as opposed to a bug in our SQL. Auth answers 503 for the former
 * ("start your database server") and must never answer 503 for the latter.
 */
function isDbUnavailable(err) {
  if (!err) return false;
  if (DB_UNAVAILABLE_CODES.has(err.code)) return true;
  return /Cannot reach MySQL|no such table|database .* does not exist|connect ECONNREFUSED|Cannot enqueue/i.test(err.message || '');
}

/** MySQL 1062 → the friendly conflict the UI expects. */
function isDuplicateKey(err) {
  return !!err && (err.code === 'ER_DUP_ENTRY' || /UNIQUE constraint failed|Duplicate entry/i.test(err.message || ''));
}

/** True when the database refused a relationship rather than a value. */
function isForeignKeyError(err) {
  return !!err && (
    ['ER_NO_REFERENCED_ROW_2', 'ER_ROW_IS_REFERENCED_2'].includes(err.code)
    || /FOREIGN KEY constraint failed|a parent row|a child row/i.test(err.message || '')
  );
}

function isAuthSchemaMissing(err) {
  return !!err && /token_version/i.test(err.message || '')
    && (err.code === 'ER_BAD_FIELD_ERROR' || /no such column|unknown column/i.test(err.message || ''));
}

module.exports = { ApiError, isAuthSchemaMissing, isDbUnavailable, tooManyRequests, isForeignKeyError, badRequest, unauthorized, forbidden, notFound, conflict, unprocessable, tooLarge, serviceUnavailable, isDuplicateKey };
