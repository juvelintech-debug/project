'use strict';

const express = require('express');
const config = require('../config');
const db = require('../db');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

const { version } = require('../../package.json');
const V = require('../constants/vocabulary');
const { MAX } = require('../utils/validate');

const startedAt = Date.now();

/**
 * GET /api/health — liveness + dependency status.
 *
 * Always answers 200 when the HTTP layer is up, even if MySQL is down, and
 * reports the database separately. A 503 on a down database would make the
 * frontend show "network error" and hide the real cause from the student.
 */
router.get('/health', asyncHandler(async (req, res) => {
  const t0 = Date.now();
  let database = { status: 'unknown' };
  try {
    const info = await db.ping();
    database = { status: 'ok', ...info, latencyMs: Date.now() - t0 };
  } catch (err) {
    // Report what we tried, not just that it failed: the difference between
    // "server not running", "wrong password" and "schema missing" decides what
    // the reader does next, and all three look identical in a generic 500.
    database = {
      status: 'down',
      client: config.db.client,
      database: config.db.database,
      host: `${config.db.host}:${config.db.port}`,
      reason: err.message,
      hint: err.hint,
    };
  }

  res.json({
    status: database.status === 'ok' ? 'ok' : 'degraded',
    service: config.app.shortName,
    version,
    environment: config.env,
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    database,
    ai: {
      enabled: config.ai.enabled && !!config.ai.apiKey,
      configured: !!config.ai.apiKey,
      provider: config.ai.provider,
      model: config.ai.model,
      // Never reports the key itself, only whether one exists.
      note: config.ai.enabled ? (config.ai.apiKey ? 'ready' : 'no API key — deterministic fallbacks in use') : 'disabled by configuration',
    },
    timestamp: new Date().toISOString(),
  });
}));

/**
 * GET /api/meta — static capability descriptor the SPA needs to boot.
 * Role names, status vocabularies and limits come from the server so the UI
 * never hard-codes a business value in two places.
 */
router.get('/meta', (req, res) => {
  res.json({
    app: config.app,
    // Every list below mirrors an ENUM column in database/schema.sql; the
    // `schema.test.js` suite fails the build if the two ever disagree, which is
    // why the SPA can trust these values instead of hardcoding its own copy.
    roles: V.ROLES,
    accountStatuses: V.ACCOUNT_STATUSES,
    companyStatuses: V.COMPANY_STATUSES,
    jobStatuses: V.JOB_STATUSES,
    applicationStatuses: V.APPLICATION_STATUSES,
    applicationStatusGuards: {
      companyEditable: V.COMPANY_EDITABLE_APPLICATION_STATUSES,
      studentEditable: V.STUDENT_EDITABLE_APPLICATION_STATUSES,
      terminal: V.TERMINAL_APPLICATION_STATUSES,
    },
    placementStatuses: V.PLACEMENT_STATUSES,
    skillProficiencies: V.SKILL_PROFICIENCIES,
    studentGenders: V.STUDENT_GENDERS,
    companySizes: V.COMPANY_SIZES,
    interviewStatuses: V.INTERVIEW_STATUSES,
    interviewModes: V.INTERVIEW_MODES,
    jobTypes: V.JOB_TYPES,
    workModes: V.WORK_MODES,
    salaryUnits: V.SALARY_UNITS,
    notificationTypes: V.NOTIFICATION_TYPES,
    aiActivityTypes: V.AI_ACTIVITY_TYPES,
    aiStatuses: V.AI_STATUSES,
    limits: {
      maxResumeMb: config.uploads.maxResumeMb,
      allowedResumeTypes: config.uploads.allowedExt,
      aiDailyQuota: config.ai.quotaPerStudent,
      maxNameLength: MAX.name,
      maxCoverLetterChars: MAX.text,
    },
    readiness: {
      aiEnabled: config.ai.enabled && !!config.ai.apiKey,
      aiProvider: config.ai.provider,
    },
  });
});

module.exports = router;
