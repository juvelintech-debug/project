'use strict';

/**
 * "Who is calling?" and "are they allowed to?" for every protected route.
 *
 * Two middlewares, used in this order:
 *
 *   authenticate   reads the Bearer token, verifies it, then re-reads the
 *                  account from the database and checks the account is still
 *                  allowed in and that the token has not been revoked.
 *   requireRole    compares req.user.role against the roles the route allows.
 *
 * The database read is not laziness — it is the whole point. A JWT alone can
 * only tell you who someone *was* when they signed in; the row tells you who
 * they are now. Suspension, role change, deletion and logout therefore take
 * effect on the very next request, not at token expiry.
 */

const db = require('../db');
const { bearerFrom, verifySession, secondsUntilExpiry } = require('../utils/tokens');
const {
  unauthorized, forbidden, conflict, serviceUnavailable, isDbUnavailable,
} = require('../utils/errors');
const { asyncHandler } = require('./errorHandler');

const SELECT_SESSION_USER = `
  SELECT id, role, email, full_name, status, token_version, last_login_at, created_at
    FROM users
   WHERE id = ?
   LIMIT 1
`;

function missingToken() {
  return unauthorized('Please sign in to continue.', 'NO_TOKEN',
    'Send "Authorization: Bearer <token>".');
}

/**
 * Loads the account behind a bearer token.
 * Throws a 401-family ApiError for anything that should bounce the client back
 * to the sign-in screen, and a 503 when the database itself is unreachable —
 * "MySQL is down" must never look like "your password is wrong".
 */
async function resolveSession(req) {
  const presented = bearerFrom(req.headers.authorization);
  if (!presented) throw missingToken();

  const decoded = verifySession(presented);

  let row;
  try {
    row = await db.one(SELECT_SESSION_USER, [decoded.userId]);
  } catch (err) {
    if (isDbUnavailable(err)) {
      const e = serviceUnavailable(
        'Sign-in is unavailable right now because the placement database cannot be reached.',
        'DATABASE_UNAVAILABLE',
      );
      e.hint = 'Start MySQL, then run: cd arena/backend && npm run db:migrate (fresh database), or npm run db:upgrade:auth (existing Phase 2 database)';
      throw e;
    }
    throw err;
  }

  if (!row) {
    throw unauthorized('That account no longer exists. Please contact the placement office.', 'ACCOUNT_GONE');
  }
  if (row.status !== 'Active') {
    throw unauthorized(
      row.status === 'Suspended'
        ? 'This account has been suspended by the placement office. Please contact them for the reason.'
        : 'This account is currently inactive, so it cannot be used. Please contact the placement office.',
      row.status === 'Suspended' ? 'ACCOUNT_SUSPENDED' : 'ACCOUNT_INACTIVE',
    );
  }
  if (Number(row.token_version) !== decoded.tokenVersion) {
    // Signed out, password changed, or an admin intervened — either way this
    // exact token is dead and the client must ask for credentials again.
    throw unauthorized('For your security this session was ended. Please sign in again.', 'TOKEN_REVOKED');
  }

  return {
    user: {
      id: Number(row.id),
      role: row.role,
      email: row.email,
      fullName: row.full_name,
      status: row.status,
      lastLoginAt: row.last_login_at,
      createdAt: row.created_at,
    },
    session: {
      tokenVersion: Number(row.token_version),
      jti: decoded.jti,
      expiresAt: decoded.expiresAt,
      expiresIn: secondsUntilExpiry(decoded),
    },
  };
}

const authenticate = asyncHandler(async (req, res, next) => {
  const { user, session } = await resolveSession(req);
  req.user = user;
  req.session = session;
  return next();
});

/**
 * Attaches the caller's role profile (student row / company row) in one query,
 * so a page does not need a second round trip and every role-scoped route can
 * enforce "students see only their own data" from a single known-good object.
 */
const attachProfile = asyncHandler(async (req, res, next) => {
  if (!req.user) throw unauthorized();
  if (req.user.role === 'Student') {
    req.profile = await db.one('SELECT * FROM students WHERE user_id = ? LIMIT 1', [req.user.id]);
  } else if (req.user.role === 'Company') {
    req.profile = await db.one('SELECT * FROM companies WHERE user_id = ? LIMIT 1', [req.user.id]);
  } else {
    req.profile = null;
  }
  if (req.user.role !== 'Admin' && !req.profile) throw conflict('Your role profile is missing. Contact the placement office.', 'PROFILE_MISSING');
  return next();
});

/**
 * Role gate. Never infers permission from the request body or a query string —
 * only from req.user, which came out of the database a moment ago.
 */
function requireRole(...roles) {
  const allowed = roles.flat();
  return (req, res, next) => {
    if (!req.user) return next(unauthorized('Please sign in to continue.', 'NO_TOKEN'));
    if (allowed.includes(req.user.role)) return next();
    return next(forbidden(
      `That action is for ${allowed.map((r) => `the ${r} area`).join(' or ')}. Your account is a ${req.user.role} account.`,
      'ROLE_NOT_ALLOWED',
    ));
  };
}

/**
 * Companies may sign in and look around, but nothing that reaches students is
 * allowed before the placement office approves them. Kept separate from
 * requireRole because the difference is the whole point of the workflow.
 */
const requireApprovedCompany = (req, res, next) => {
  if (!req.user) return next(unauthorized());
  if (req.user.role === 'Admin') return next();
  if (req.user.role !== 'Company') {
    return next(forbidden('Only a recruiter account can do that.', 'ROLE_NOT_ALLOWED'));
  }
  const status = req.profile?.status;
  if (status === 'Approved') return next();
  const reason = status === 'Rejected'
    ? (req.profile?.rejection_reason || 'The placement office rejected this company registration.')
    : status === 'Suspended'
      ? 'Your company account has been suspended by the placement office.'
      : 'Your company is still waiting for approval by the placement office.';
  return next(forbidden(
    `${reason} Recruiting access is blocked until the company is approved.`,
    'COMPANY_NOT_APPROVED',
  ));
};

module.exports = {
  authenticate,
  attachProfile,
  requireRole,
  requireApprovedCompany,
  resolveSession,
  SELECT_SESSION_USER,
};
