'use strict';

const express = require('express');
const db = require('../db');
const service = require('../services/authService');
const { authenticate, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { badRequest } = require('../utils/errors');
const router = express.Router();
router.use(authenticate, requireRole('Admin'));

function id(value) {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > 4294967295) {
    throw badRequest('Use a valid positive account or company id.');
  }
  return Number(value);
}

router.get('/overview', asyncHandler(async (req, res) => {
  const [students, companies, pendingCompanies, activeAccounts] = await Promise.all([
    db.value('SELECT COUNT(*) FROM students'), db.value('SELECT COUNT(*) FROM companies'),
    db.value("SELECT COUNT(*) FROM companies WHERE status = 'Pending'"),
    db.value("SELECT COUNT(*) FROM users WHERE status = 'Active'"),
  ]);
  res.json({ stats: { students: Number(students), companies: Number(companies), pendingCompanies: Number(pendingCompanies), activeAccounts: Number(activeAccounts) } });
}));
router.get('/accounts', asyncHandler(async (req, res) => res.json(await service.listAccounts(req.query))));
router.get('/accounts/:id', asyncHandler(async (req, res) => res.json(await service.readAccountById(id(req.params.id)))));
router.patch('/accounts/:id/status', asyncHandler(async (req, res) => {
  res.json(await service.setAccountStatus({ actorId: req.user.id, targetId: id(req.params.id), status: req.body?.status, note: req.body?.note }));
}));
router.post('/accounts/:id/password', asyncHandler(async (req, res) => {
  res.json(await service.resetAccountPassword({ actorId: req.user.id, targetId: id(req.params.id), newPassword: req.body?.newPassword }));
}));
router.get('/companies', asyncHandler(async (req, res) => res.json(await service.listCompanies(req.query))));
router.patch('/companies/:id/status', asyncHandler(async (req, res) => {
  res.json(await service.reviewCompany({ actorId: req.user.id, companyId: id(req.params.id), status: req.body?.status, note: req.body?.note }));
}));
module.exports = router;
