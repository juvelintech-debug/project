'use strict';

const { ApiError } = require('../utils/errors');
const logger = require('../utils/logger');

/** Wrap async route handlers so rejections reach the error middleware. */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** 404 for unmatched API routes — a real response, never an HTML dump. */
function notFoundHandler(req, res) {
  const requestId = req.id;
  // Same envelope as every other error so the client only has one shape to
  // parse — including the trace id, which is what makes a screenshot useful.
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `No API route matches ${req.method} ${req.originalUrl}`, requestId },
    requestId,
  });
}

/**
 * The single place that decides what an error looks like on the wire.
 * Never leaks: SQL text, table names, stack traces, file paths, provider errors.
 */
function errorHandler(err, req, res, _next) {
  const status = err instanceof ApiError ? err.status : Number(err?.status || err?.statusCode) || 500;
  const requestId = req.id;

  if (status >= 500) logger.error('request failed', { requestId, method: req.method, path: req.path, err });
  else logger.warn('request refused', { requestId, method: req.method, path: req.path, status, code: err.code, message: err.message });

  // Multipart / body-parser errors carry the user-facing fix already.
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: { code: 'FILE_TOO_LARGE', message: 'That file is larger than the allowed limit.', requestId }, requestId });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'BAD_JSON', message: 'The request body was not valid JSON.', requestId }, requestId });
  }

  const body = {
    error: {
      code: err instanceof ApiError ? err.code : status >= 500 ? 'INTERNAL' : 'BAD_REQUEST',
      message: status >= 500 ? 'Something went wrong on our side. Please try again.' : err.message,
      requestId,
    },
    requestId,
  };
  if (err?.fields) body.error.fields = err.fields;
  if (err?.hint) body.error.hint = err.hint;

  res.status(status).json(body);
}

module.exports = { asyncHandler, errorHandler, notFoundHandler };
