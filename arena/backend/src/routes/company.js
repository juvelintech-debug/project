'use strict';

const express = require('express');
const db = require('../db');
const { authenticate, requireRole, attachProfile, requireApprovedCompany } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const service = require('../services/authService');
const router = express.Router();
router.use(authenticate, requireRole('Company'));

// Pending/rejected companies can read their own registration and account settings.
router.get('/profile', asyncHandler(async (req, res) => res.json(await service.readAccount(req.user.id))));
// Recruiting data is protected by the server-side approval gate, not a hidden button.
router.get('/overview', attachProfile, requireApprovedCompany, asyncHandler(async (req, res) => {
  const [jobs, approvedJobs, applications] = await Promise.all([
    db.value('SELECT COUNT(*) FROM jobs WHERE company_id = ?', [req.profile.id]),
    db.value("SELECT COUNT(*) FROM jobs WHERE company_id = ? AND status = 'Approved'", [req.profile.id]),
    db.value('SELECT COUNT(*) FROM applications a JOIN jobs j ON j.id = a.job_id WHERE j.company_id = ?', [req.profile.id]),
  ]);
  res.json({ company: service.publicCompany(req.profile), stats: { jobs: Number(jobs), approvedJobs: Number(approvedJobs), applications: Number(applications) } });
}));
module.exports = router;
