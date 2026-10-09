'use strict';

/**
 * /api/auth/* — sign up, sign in, sign out, the current account, own password.
 *
 * These are the only routes a visitor can use before they have a token, so each
 * one answers in a form the React forms can render without translating:
 * a human sentence, plus `fields` keyed by input name when the problem is
 * field-specific.
 */

const express = require('express');

const authService = require('../services/authService');
const { authenticate } = require('../middleware/auth');
const { loginThrottle, loginIpThrottle, signupThrottle } = require('../middleware/rateLimit');
const { asyncHandler } = require('../middleware/errorHandler');
const { verifySession, secondsUntilExpiry } = require('../utils/tokens');

const router = express.Router();

/** Adds "when does this session stop working", so the SPA can warn instead of failing mid-form. */
function withLifetime(payload, token) {
  const decoded = verifySession(token);
  return { ...payload, session: { expiresAt: decoded.expiresAt, expiresIn: secondsUntilExpiry(decoded) } };
}

/**
 * POST /api/auth/register
 *
 * One endpoint for both self-service roles; `role` chooses which form to fill
 * out. `Admin` is refused by the validator, so nobody can register their way
 * into the placement office — that account has to exist first, because the seed
 * or a human created it.
 */
router.post('/register', signupThrottle, asyncHandler(async (req, res) => {
  const role = typeof req.body?.role === 'string' ? req.body.role.trim().toLowerCase() : 'student';
  const payload = role === 'company'
    ? await authService.registerCompany(req.body)
    : await authService.registerStudent(req.body);
  res.status(201).json(withLifetime(payload, payload.token));
}));

/**
 * POST /api/auth/login
 *
 * The throttles bound failed guesses per account/network and per network.
 * Successful sign-ins reset the account failure bucket.
 */
router.post('/login', loginIpThrottle, loginThrottle, asyncHandler(async (req, res) => {
  const payload = await authService.login(req.body);
  loginThrottle.reset(loginThrottle.keyFor(req));
  res.json(withLifetime(payload, payload.token));
}));

/**
 * POST /api/auth/logout — a real server-side revoke.
 *
 * Raises users.token_version, which invalidates the token being used and every
 * other token issued to this account. An already-dead token receives 401; the
 * client clears its copy in either case.
 */
router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  const result = await authService.logout(req.user.id);
  res.json({ ...result, notice: 'You have been signed out on this device and every other one.' });
}));

/**
 * GET /api/auth/me (and legacy /session alias) — who am I, and what may I do?
 *
 * The SPA calls this on boot. It is the only way a returning user learns their
 * role and, for a recruiter, that their company is still awaiting approval —
 * the UI must not decide that by itself from whatever is in localStorage.
 */
router.get(['/me', '/session'], authenticate, asyncHandler(async (req, res) => {
  const account = await authService.readAccount(req.user.id);
  res.json({
    ...account,
    // Server-verified identity, never the role cached by the browser.
    auth: { userId: req.user.id, role: req.user.role, expiresAt: req.session.expiresAt, expiresIn: req.session.expiresIn },
  });
}));

/**
 * PATCH /api/auth/me (and legacy /session alias) — display name only.
 *
 * Deliberately narrow: the service reads one field from the body, so `role`,
 * `status` or `id` cannot be smuggled in here. Academic/company editing belongs to later phases; profile readers have
 * separate ownership rules.
 */
router.patch(['/me', '/session'], authenticate, asyncHandler(async (req, res) => {
  res.json(await authService.updateOwnProfile(req.user.id, req.body));
}));

/**
 * POST /api/auth/password — change own password.
 *
 * Requires the current password and revokes every other session. The response
 * carries a fresh token so the device that just proved the password stays
 * signed in. There is no emailed reset link in this project because nothing
 * sends mail; the placement office sets a temporary password instead.
 */
router.post('/password', authenticate, asyncHandler(async (req, res) => {
  const payload = await authService.changePassword(req.user.id, req.body);
  res.json(withLifetime(payload, payload.token));
}));

module.exports = router;
