'use strict';

const express = require('express');
const db = require('../db');
const { authenticate, requireRole, attachProfile } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const service = require('../services/authService');
const router = express.Router();
router.use(authenticate, requireRole('Student'));

// No student id parameter: a student can only ask for their own account.
router.get('/profile', asyncHandler(async (req, res) => res.json(await service.readAccount(req.user.id))));
router.get('/overview', attachProfile, asyncHandler(async (req, res) => {
  const [applications, skills, unreadNotifications] = await Promise.all([
    db.value('SELECT COUNT(*) FROM applications WHERE student_id = ?', [req.profile.id]),
    db.value('SELECT COUNT(*) FROM student_skills WHERE student_id = ?', [req.profile.id]),
    db.value('SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0', [req.user.id]),
  ]);
  res.json({ student: service.publicStudent(req.profile), stats: { applications: Number(applications), skills: Number(skills), unreadNotifications: Number(unreadNotifications) } });
}));
module.exports = router;
