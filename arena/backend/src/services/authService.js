'use strict';

/** Credentials are hashed here; all ids come from authenticated server state. */
const bcrypt = require('bcryptjs');
const config = require('../config');
const db = require('../db');
const V = require('../constants/vocabulary');
const v = require('../utils/validate');
const { signSession } = require('../utils/tokens');
const { conflict, forbidden, notFound, unauthorized, unprocessable, isDuplicateKey } = require('../utils/errors');

// A nonexistent account still pays the bcrypt comparison cost. Never disclose
// which half of an email/password pair was wrong.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password-9', config.security.bcryptRounds);
const USER_COLUMNS = 'id, role, email, full_name, status, last_login_at, created_at, updated_at';

function fieldError(field, message) {
  const err = unprocessable(message);
  err.fields = { [field]: message };
  return err;
}
function validateForm(spec, body) {
  const form = v.collect(spec, body);
  form.throwIfInvalid();
  return form.values;
}
function selfServiceRole(expected) {
  return (value) => {
    if (value == null || value === '') return { value: expected };
    if (typeof value === 'string' && value.trim().toLowerCase() === expected.toLowerCase()) return { value: expected };
    return { error: 'Only Student and Company accounts can be registered, using their respective forms. Admin accounts are provisioned by the college.' };
  };
}
const text = (label, max, min = 1) => ({ label, fn: v.required, options: { max, min } });
const optional = (label, max) => ({ label, fn: v.optional, options: { max } });
const choice = (label, allowed, required = true) => ({ label, fn: v.oneOf, options: { allowed, required } });

function assertConfirmation(body, password, field = 'confirmPassword', required = false) {
  if (required && (typeof body?.[field] !== 'string' || !body[field])) throw fieldError(field, 'Confirm your password.');
  if (body?.[field] !== undefined && body[field] !== password) throw fieldError(field, 'The two passwords do not match.');
}
function assertUrls(values, fields) {
  for (const field of fields) {
    if (!values[field]) continue;
    try {
      const url = new URL(values[field]);
      if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) throw new Error();
    } catch { throw fieldError(field, 'Use a complete http:// or https:// web address without credentials.'); }
  }
}
function duplicateError(err) {
  if (!isDuplicateKey(err)) throw err;
  const hint = `${err.key || ''} ${err.sqlMessage || ''} ${err.message || ''}`;
  const field = /uq_students_roll|roll_number/.test(hint) ? 'rollNumber'
    : /uq_company_name|company_name/.test(hint) ? 'companyName' : 'email';
  const message = field === 'rollNumber' ? 'That roll number is already registered. Contact the placement office if it is yours.'
    : field === 'companyName' ? 'That company name is already registered. Contact the office rather than creating a duplicate.'
      : 'That email address already has an account. Sign in instead.';
  const e = conflict(message, 'ALREADY_REGISTERED');
  e.fields = { [field]: message };
  throw e;
}
async function notify(t, userId, type, title, message) {
  await t.insert('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)',
    [userId, type, title, Array.from(message).slice(0, 500).join('')]);
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    role: row.role,
    email: row.email,
    fullName: row.full_name,
    status: row.status,
    lastLoginAt: row.last_login_at ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

function publicStudent(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    rollNumber: row.roll_number,
    program: row.program,
    department: row.department,
    batchStartYear: Number(row.batch_start_year),
    graduationYear: Number(row.graduation_year),
    cgpa: row.cgpa === null || row.cgpa === undefined ? null : Number(row.cgpa),
    backlogCount: Number(row.backlog_count ?? 0),
    gender: row.gender ?? null,
    dateOfBirth: row.date_of_birth ?? null,
    phone: row.phone ?? null,
    city: row.city ?? null,
    state: row.state ?? null,
    linkedinUrl: row.linkedin_url ?? null,
    githubUrl: row.github_url ?? null,
    bio: row.bio ?? null,
    higherStudies: Boolean(Number(row.higher_studies ?? 0)),
    placementStatus: row.placement_status,
    // The stored filename stays server-side; the client learns only that a
    // resume exists, what it was called when uploaded, and how big it is.
    resume: row.resume_path
      ? { fileName: row.resume_original_name, sizeBytes: Number(row.resume_size_bytes ?? 0), uploadedAt: row.resume_uploaded_at ?? null }
      : null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

function publicCompany(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    name: row.company_name,
    status: row.status,
    website: row.website ?? null,
    industry: row.industry ?? null,
    companySize: row.company_size ?? null,
    city: row.city ?? null,
    state: row.state ?? null,
    country: row.country ?? null,
    contactPerson: row.contact_person,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone ?? null,
    description: row.description ?? null,
    reviewedAt: row.reviewed_at ?? null,
    reviewNote: row.review_note ?? null,
    rejectionReason: row.rejection_reason ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}


function companyApprovalNotice(status, reason) {
  if (status === 'Approved') return null;
  if (status === 'Rejected') return `The placement office rejected this registration: ${reason || 'contact the office for details'}.`;
  if (status === 'Suspended') return 'Recruiting access is suspended. Contact the placement office.';
  return 'Your company is awaiting placement-office approval. You can sign in, but recruiting access remains blocked.';
}
function companyPermissions(company) {
  const approved = company?.status === 'Approved';
  return { canPostJobs: approved, canViewApplicants: approved, approved };
}
async function profilePayload(t, user) {
  const out = { user: publicUser(user) };
  if (user.role === 'Student') {
    const row = await t.one('SELECT * FROM students WHERE user_id = ? LIMIT 1', [user.id]);
    if (!row) throw conflict('The student profile for this account is missing. Contact the placement office.', 'PROFILE_MISSING');
    out.student = publicStudent(row);
  } else if (user.role === 'Company') {
    const row = await t.one('SELECT * FROM companies WHERE user_id = ? LIMIT 1', [user.id]);
    if (!row) throw conflict('The company profile for this account is missing. Contact the placement office.', 'PROFILE_MISSING');
    out.company = publicCompany(row);
    out.permissions = companyPermissions(row);
    out.notice = companyApprovalNotice(row.status, row.rejection_reason);
  }
  return out;
}

const studentSpec = {
  role: { fn: selfServiceRole('Student') },
  fullName: text('Full name', v.MAX.name, 2),
  email: { fn: v.email }, password: { fn: v.password },
  rollNumber: text('Roll number', 30, 3), program: text('Program', 60),
  department: optional('Department', 80),
  graduationYear: { label: 'Graduation year', fn: v.number, options: { min: 2000, max: 2100, integer: true } },
  batchStartYear: { label: 'Batch start year', fn: v.number, options: { min: 1990, max: 2100, integer: true, required: false } },
  cgpa: { label: 'CGPA', fn: v.number, options: { min: 0, max: 10, required: false } },
  backlogCount: { label: 'Active backlogs', fn: v.number, options: { min: 0, max: 30, integer: true, required: false } },
  gender: choice('Gender', V.STUDENT_GENDERS, false),
  dateOfBirth: { label: 'Date of birth', fn: v.dateOnly, options: { required: false, maxDate: 'today' } },
  phone: optional('Phone', 20), city: optional('City', 80), state: optional('State', 80),
  linkedinUrl: optional('LinkedIn URL', 255), githubUrl: optional('GitHub URL', 255), bio: optional('Career summary', 4000),
};
const companySpec = {
  role: { fn: selfServiceRole('Company') },
  email: { fn: v.email }, password: { fn: v.password },
  contactPerson: text('Contact person', v.MAX.name, 2), companyName: text('Company name', 150, 2),
  website: optional('Website', 255), industry: optional('Industry', 80),
  companySize: choice('Company size', V.COMPANY_SIZES, false),
  city: optional('City', 80), state: optional('State', 80),
  contactPhone: optional('Contact phone', 20), description: optional('About the company', 4000),
};

async function registerStudent(body) {
  const values = validateForm(studentSpec, body);
  assertConfirmation(body, values.password, 'confirmPassword', true);
  assertUrls(values, ['linkedinUrl', 'githubUrl']);
  const batch = values.batchStartYear ?? values.graduationYear - 3;
  if (batch > values.graduationYear) throw fieldError('batchStartYear', 'Batch start year cannot be after graduation year.');
  const hash = await bcrypt.hash(values.password, config.security.bcryptRounds);
  try {
    return await db.tx(async (t) => {
      const { insertId: id } = await t.insert('INSERT INTO users (role, email, password_hash, full_name) VALUES (?, ?, ?, ?)',
        ['Student', values.email, hash, values.fullName]);
      await t.insert(`INSERT INTO students (user_id, roll_number, program, department, batch_start_year, graduation_year,
          cgpa, backlog_count, gender, date_of_birth, phone, city, state, linkedin_url, github_url, bio)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, values.rollNumber, values.program, values.department ?? 'Information Technology', batch, values.graduationYear,
        values.cgpa ?? null, values.backlogCount ?? 0, values.gender ?? null, values.dateOfBirth ?? null,
        values.phone ?? null, values.city ?? null, values.state ?? null, values.linkedinUrl ?? null, values.githubUrl ?? null, values.bio ?? null]);
      await notify(t, id, 'System', 'Welcome to the placement portal', 'Your student account has been created.');
      const user = await t.one(`SELECT ${USER_COLUMNS}, token_version FROM users WHERE id = ?`, [id]);
      return { token: signSession(user), ...await profilePayload(t, user), notice: 'Student account created. You are signed in.' };
    });
  } catch (err) { duplicateError(err); }
}
async function registerCompany(body) {
  const values = validateForm(companySpec, body);
  assertConfirmation(body, values.password, 'confirmPassword', true);
  assertUrls(values, ['website']);
  const hash = await bcrypt.hash(values.password, config.security.bcryptRounds);
  try {
    return await db.tx(async (t) => {
      const { insertId: id } = await t.insert('INSERT INTO users (role, email, password_hash, full_name) VALUES (?, ?, ?, ?)',
        ['Company', values.email, hash, values.contactPerson]);
      // Approval fields/status from the request are deliberately ignored.
      await t.insert(`INSERT INTO companies (user_id, company_name, description, website, industry, company_size,
          city, state, contact_person, contact_email, contact_phone, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')`,
      [id, values.companyName, values.description ?? null, values.website ?? null, values.industry ?? null,
        values.companySize ?? 'Unspecified', values.city ?? null, values.state ?? null, values.contactPerson, values.email, values.contactPhone ?? null]);
      await notify(t, id, 'System', 'Company registered — awaiting approval', 'The placement office must approve this company before recruiting access is enabled.');
      const user = await t.one(`SELECT ${USER_COLUMNS}, token_version FROM users WHERE id = ?`, [id]);
      return { token: signSession(user), ...await profilePayload(t, user) };
    });
  } catch (err) { duplicateError(err); }
}

async function login(body = {}) {
  const mail = v.email(body?.email);
  const password = typeof body?.password === 'string' ? body.password : '';
  if (mail.error || !password || Buffer.byteLength(password, 'utf8') > 72) {
    throw unauthorized('Email or password is incorrect.', 'BAD_CREDENTIALS');
  }
  const user = await db.one(`SELECT ${USER_COLUMNS}, password_hash, token_version FROM users WHERE email = ? LIMIT 1`, [mail.value]);
  const matches = await bcrypt.compare(password, user?.password_hash || DUMMY_HASH);
  if (!user || !matches) throw unauthorized('Email or password is incorrect.', 'BAD_CREDENTIALS');
  if (user.status !== 'Active') throw forbidden('This account is inactive or suspended. Contact the placement office.',
    user.status === 'Suspended' ? 'ACCOUNT_SUSPENDED' : 'ACCOUNT_INACTIVE');
  // Do not issue a new-version token after a concurrent password reset/logout.
  const result = await db.execute(`UPDATE users SET last_login_at = NOW() WHERE id = ? AND status = 'Active'
    AND password_hash = ? AND token_version = ?`, [user.id, user.password_hash, user.token_version]);
  if (!result.affectedRows) throw unauthorized('Your account changed during sign-in. Please try again.', 'TOKEN_REVOKED');
  const fresh = await db.one(`SELECT ${USER_COLUMNS}, password_hash, token_version FROM users WHERE id = ?`, [user.id]);
  if (!fresh || fresh.status !== 'Active' || fresh.password_hash !== user.password_hash || fresh.token_version !== user.token_version) {
    throw unauthorized('Your account changed during sign-in. Please try again.', 'TOKEN_REVOKED');
  }
  return { token: signSession(fresh), ...await profilePayload(db, fresh) };
}
async function logout(userId) {
  await db.execute('UPDATE users SET token_version = token_version + 1, updated_at = NOW() WHERE id = ?', [userId]);
  return { revoked: true }; // account-wide: all concurrently logged-in devices
}
async function readAccount(userId) {
  const user = await db.one(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, [userId]);
  if (!user) throw unauthorized('That account no longer exists.', 'ACCOUNT_GONE');
  return profilePayload(db, user);
}
async function updateOwnProfile(userId, body) {
  const values = validateForm({ fullName: text('Full name', v.MAX.name, 2) }, body);
  await db.execute('UPDATE users SET full_name = ?, updated_at = NOW() WHERE id = ?', [values.fullName, userId]);
  const user = await db.one(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, [userId]);
  return { user: publicUser(user), notice: 'Display name updated.' };
}
async function changePassword(userId, body = {}) {
  const values = validateForm({
    currentPassword: { fn: (value) => typeof value === 'string' && value.length && Buffer.byteLength(value, 'utf8') <= 72
      ? { value } : { error: 'Enter your current password (up to 72 UTF-8 bytes).' } },
    newPassword: { label: 'New password', fn: v.password },
  }, body);
  assertConfirmation(body, values.newPassword);
  const user = await db.one('SELECT id, password_hash, token_version FROM users WHERE id = ?', [userId]);
  if (!user) throw unauthorized('That account no longer exists.', 'ACCOUNT_GONE');
  if (!await bcrypt.compare(values.currentPassword, user.password_hash)) throw fieldError('currentPassword', 'That is not your current password.');
  if (values.newPassword === values.currentPassword) throw fieldError('newPassword', 'Choose a different password from the one you use now.');
  const hash = await bcrypt.hash(values.newPassword, config.security.bcryptRounds);
  return db.tx(async (t) => {
    const changed = await t.execute(`UPDATE users SET password_hash = ?, token_version = token_version + 1, updated_at = NOW()
      WHERE id = ? AND password_hash = ? AND token_version = ? AND status = 'Active'`, [hash, userId, user.password_hash, user.token_version]);
    if (!changed.affectedRows) throw conflict('Your credentials changed during this request. Sign in again.', 'CREDENTIALS_CHANGED');
    await notify(t, userId, 'System', 'Your password was changed', 'All previous sessions were ended. Contact the placement office if this was not you.');
    const fresh = await t.one(`SELECT ${USER_COLUMNS}, token_version FROM users WHERE id = ?`, [userId]);
    return { token: signSession(fresh), user: publicUser(fresh), notice: 'Password changed. All previous sessions were ended.' };
  });
}

// Admin-only readers/mutations. The router authenticates AND requires Admin.
function likeParam(value) { return `%${value.replace(/[!%_]/g, (c) => `!${c}`)}%`; }
async function listAccounts(query = {}) {
  const values = validateForm({
    role: choice('Role', V.ROLES, false), status: choice('Status', V.ACCOUNT_STATUSES, false), q: optional('Search', 190),
    limit: { label: 'Page size', fn: v.number, options: { min: 1, max: 100, integer: true } },
    offset: { label: 'Offset', fn: v.number, options: { min: 0, max: 1000000, integer: true } },
  }, { ...query, limit: query.limit ?? 25, offset: query.offset ?? 0 });
  const where = []; const params = [];
  if (values.role) { where.push('u.role = ?'); params.push(values.role); }
  if (values.status) { where.push('u.status = ?'); params.push(values.status); }
  if (values.q) {
    where.push("(u.email LIKE ? ESCAPE '!' OR u.full_name LIKE ? ESCAPE '!' OR s.roll_number LIKE ? ESCAPE '!' OR c.company_name LIKE ? ESCAPE '!')");
    params.push(...Array(4).fill(likeParam(values.q)));
  }
  const joins = ' LEFT JOIN students s ON s.user_id = u.id LEFT JOIN companies c ON c.user_id = u.id';
  const filter = where.length ? ` WHERE ${where.join(' AND ')}` : '';
  const total = Number(await db.value(`SELECT COUNT(*) FROM users u${joins}${filter}`, params));
  // Only validated bounded integers are interpolated (MySQL LIMIT compatibility).
  const accounts = await db.query(`SELECT u.id, u.role, u.email, u.full_name, u.status, u.last_login_at, u.created_at,
    s.roll_number, c.company_name, c.status AS company_status FROM users u${joins}${filter}
    ORDER BY u.id DESC LIMIT ${values.limit} OFFSET ${values.offset}`, params);
  return { total, limit: values.limit, offset: values.offset, accounts: accounts.map((row) => ({
    ...publicUser(row), rollNumber: row.roll_number ?? null, companyName: row.company_name ?? null, companyStatus: row.company_status ?? null,
  })) };
}
async function readAccountById(id) {
  const user = await db.one(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, [id]);
  if (!user) throw notFound('Account not found.');
  return profilePayload(db, user);
}
async function setAccountStatus({ actorId, targetId, status, note }) {
  const values = validateForm({ status: choice('Account status', V.ACCOUNT_STATUSES), note: optional('Reason', 500) }, { status, note });
  if (actorId === targetId) throw forbidden('You cannot disable or change the status of your own account.', 'SELF_STATUS');
  if (values.status !== 'Active' && (!values.note || values.note.length < 5)) throw fieldError('note', 'Give a reason of at least 5 characters.');
  return db.tx(async (t) => {
    const target = await t.one(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, [targetId]);
    if (!target) throw notFound('Account not found.');
    if (target.role === 'Admin' && values.status !== 'Active') throw forbidden('Admin accounts cannot be disabled from this screen.', 'ADMIN_STATUS');
    if (target.status === values.status) return { account: publicUser(target), changed: false, notice: 'No change: that status is already set.' };
    await t.execute('UPDATE users SET status = ?, token_version = token_version + 1, updated_at = NOW() WHERE id = ?', [values.status, targetId]);
    await notify(t, targetId, 'System', `Account ${values.status}`, values.note || 'The placement office reactivated your account. Please sign in again.');
    return { account: publicUser({ ...target, status: values.status }), changed: true, sessionsRevoked: true, notice: 'Account status updated. Previous sessions are revoked.' };
  });
}
async function resetAccountPassword({ actorId, targetId, newPassword }) {
  const values = validateForm({ newPassword: { label: 'New password', fn: v.password } }, { newPassword });
  if (actorId === targetId) throw fieldError('newPassword', 'Use your own account settings to change your password.');
  const hash = await bcrypt.hash(values.newPassword, config.security.bcryptRounds);
  return db.tx(async (t) => {
    const user = await t.one(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, [targetId]);
    if (!user) throw notFound('Account not found.');
    await t.execute('UPDATE users SET password_hash = ?, token_version = token_version + 1, updated_at = NOW() WHERE id = ?', [hash, targetId]);
    await notify(t, targetId, 'System', 'Placement-office password reset', 'Collect your temporary password from the placement office, then change it from Account settings.');
    return { account: publicUser(user), notice: 'Password reset and previous sessions revoked. Deliver the temporary password in person; this app does not send email.' };
  });
}
async function listCompanies(query = {}) {
  const values = validateForm({ status: choice('Company status', V.COMPANY_STATUSES, false) }, query);
  const rows = await db.query(`SELECT c.*, u.status AS account_status FROM companies c JOIN users u ON u.id = c.user_id
    ${values.status ? 'WHERE c.status = ?' : ''} ORDER BY c.id DESC LIMIT 100`, values.status ? [values.status] : []);
  return { companies: rows.map((row) => ({ ...publicCompany(row), accountStatus: row.account_status })) };
}
async function reviewCompany({ actorId, companyId, status, note }) {
  const values = validateForm({ status: choice('Review result', V.COMPANY_STATUSES.filter((s) => s !== 'Pending')), note: optional('Review note', 500) }, { status, note });
  if (values.status !== 'Approved' && (!values.note || values.note.length < 5)) throw fieldError('note', 'Give a reason of at least 5 characters.');
  return db.tx(async (t) => {
    const company = await t.one('SELECT * FROM companies WHERE id = ?', [companyId]);
    if (!company) throw notFound('Company not found.');
    await t.execute(`UPDATE companies SET status = ?, reviewed_by = ?, reviewed_at = NOW(), review_note = ?,
      rejection_reason = ?, updated_at = NOW() WHERE id = ?`,
    [values.status, actorId, values.note, values.status === 'Rejected' ? values.note : null, companyId]);
    await notify(t, company.user_id, values.status === 'Approved' ? 'Account Approved' : values.status === 'Rejected' ? 'Account Rejected' : 'System',
      `Company ${values.status}`, values.note || 'Your company has been approved. Job postings still require their own approval.');
    return { company: publicCompany(await t.one('SELECT * FROM companies WHERE id = ?', [companyId])), notice: `Company ${values.status.toLowerCase()}. No job approvals were changed.` };
  });
}

module.exports = { registerStudent, registerCompany, login, logout, readAccount, updateOwnProfile, changePassword,
  listAccounts, readAccountById, setAccountStatus, resetAccountPassword, listCompanies, reviewCompany,
  publicUser, publicStudent, publicCompany, companyApprovalNotice, companyPermissions };
