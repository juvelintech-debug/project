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
const unauthorized = (message = 'Please sign in to continue.', code = 'UNAUTHENTICATED') => new ApiError(401, code, message);
const forbidden = (message = 'You do not have access to that.', code = 'FORBIDDEN') => new ApiError(403, code, message);
/** 404 vs 403 deliberately collapsed: never confirm that a record exists. */
const notFound = (message = 'That record could not be found.', code = 'NOT_FOUND') => new ApiError(404, code, message);
const conflict = (message, code = 'CONFLICT', detail) => new ApiError(409, code, message, detail);
const unprocessable = (message, code = 'VALIDATION', detail) => new ApiError(422, code, message, detail);
const tooLarge = (message, code = 'FILE_TOO_LARGE') => new ApiError(413, code, message);
const serviceUnavailable = (message, code = 'UNAVAILABLE', detail) => new ApiError(503, code, message, detail);

/** MySQL 1062 → the friendly conflict the UI expects. */
function isDuplicateKey(err) {
  return !!err && (err.code === 'ER_DUP_ENTRY' || /UNIQUE constraint failed|Duplicate entry/i.test(err.message || ''));
}

module.exports = { ApiError, badRequest, unauthorized, forbidden, notFound, conflict, unprocessable, tooLarge, serviceUnavailable, isDuplicateKey };
