'use strict';

// Real HTTP handlers + real SQL constraints, with clearly labelled test records.
process.env.DB_CLIENT = 'sqlite';
process.env.SQLITE_FILE = ':memory:';
process.env.NODE_ENV = 'development';
process.env.JWT_SECRET = 'authentication-test-secret-not-used-by-the-application';
process.env.AI_ENABLED = 'false';
process.env.GEMINI_API_KEY = '';
process.env.AI_API_KEY = '';
process.env.TRUST_PROXY_HOPS = '0';
process.env.LOGIN_MAX_ATTEMPTS = '6';
process.env.LOGIN_PER_IP_MAX_ATTEMPTS = '60';
process.env.REGISTER_PER_HOUR_PER_IP = '12';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../src/db');
const config = require('../src/config');
const { createApp } = require('../src/app');
const { signSession } = require('../src/utils/tokens');
const { loginThrottle, loginIpThrottle, signupThrottle } = require('../src/middleware/rateLimit');
const schema = fs.readFileSync(path.join(__dirname, '../../database/schema.sql'), 'utf8');
const seed = fs.readFileSync(path.join(__dirname, '../../database/seed_demo_data.sql'), 'utf8');
let server, base;
const credentials = {
  Student: { email: 'aarav.sharma@student.college.edu', password: 'Student@123' },
  Company: { email: 'careers@northwindtech.example', password: 'Company@123' },
  Pending: { email: 'talent@skylineconstructors.example', password: 'Company@123' },
  Admin: { email: 'admin@placementcell.edu', password: 'Admin@123' },
};
const student = (overrides = {}) => ({ role: 'Student', fullName: 'Test Student', email: 'test.student@example.test', password: 'Testing@123',
  rollNumber: 'TEST-001', program: 'B.Sc. Information Technology', graduationYear: 2027,
  confirmPassword: overrides.password ?? 'Testing@123', ...overrides });
const company = (overrides = {}) => ({ role: 'Company', companyName: 'Test Organisation', contactPerson: 'Test Recruiter',
  email: 'test.recruiter@example.test', password: 'Testing@123', confirmPassword: overrides.password ?? 'Testing@123', ...overrides });
async function call(url, { method = 'GET', body, token, headers = {} } = {}) {
  const res = await fetch(`${base}/api${url}`, { method,
    headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, body: await res.json(), headers: res.headers };
}
async function login(role) {
  const result = await call('/auth/login', { method: 'POST', body: credentials[role] });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.body;
}
function noSecrets(payload) {
  const text = JSON.stringify(payload);
  for (const key of ['password_hash', 'passwordHash', 'token_version', 'resume_path', 'logo_path', 'apiKey']) assert.ok(!text.includes(`"${key}"`), key);
  assert.ok(!/\$2[aby]\$\d\d\$/.test(text), 'a bcrypt hash must never be returned');
}

test.before(async () => {
  await db.init(); await db.execScript(schema);
  server = createApp().listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.beforeEach(async () => {
  await db.execScript(seed);
  loginThrottle.clear(); loginIpThrottle.clear(); signupThrottle.clear();
});
test.after(async () => { await new Promise((resolve) => server.close(resolve)); await db.close(); });

test('student registration atomically creates a hashed account, profile and welcome notification', async () => {
  const r = await call('/auth/register', { method: 'POST', body: student() });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.user.role, 'Student'); assert.equal(r.body.user.status, 'Active');
  assert.equal(r.body.student.batchStartYear, 2024); assert.equal(r.body.student.placementStatus, 'Unplaced');
  assert.equal(r.body.student.resume, null); assert.ok(r.body.user.createdAt);
  const user = await db.one('SELECT * FROM users WHERE email = ?', [student().email]);
  assert.notEqual(user.password_hash, student().password); assert.ok(await bcrypt.compare(student().password, user.password_hash));
  assert.ok(bcrypt.getRounds(user.password_hash) >= 10); assert.equal(user.token_version, 0);
  assert.equal(Number(await db.value('SELECT COUNT(*) FROM notifications WHERE user_id = ?', [user.id])), 1);
  const claims = jwt.verify(r.body.token, config.jwt.secret);
  assert.equal(claims.sub, String(user.id)); assert.equal(claims.tv, 0); assert.ok(claims.exp > claims.iat);
  assert.ok(!claims.email && !claims.password); noSecrets(r.body);
  assert.equal((await call('/student/profile', { token: r.body.token })).status, 200);
});

test('new companies always start Pending; client approval/status/version fields cannot promote them', async () => {
  const r = await call('/auth/register', { method: 'POST', body: company({ status: 'Approved', reviewedBy: 1, token_version: 123 }) });
  assert.equal(r.status, 201, JSON.stringify(r.body)); assert.equal(r.body.company.status, 'Pending');
  assert.equal(r.body.permissions.canPostJobs, false); assert.match(r.body.notice, /awaiting/);
  assert.equal((await call('/company/profile', { token: r.body.token })).status, 200);
  const blocked = await call('/company/overview', { token: r.body.token });
  assert.equal(blocked.status, 403); assert.equal(blocked.body.error.code, 'COMPANY_NOT_APPROVED'); noSecrets(r.body);
});

test('registration validation returns all field errors without creating any rows', async () => {
  const before = await db.value('SELECT COUNT(*) FROM users');
  const r = await call('/auth/register', { method: 'POST', body: student({ fullName: 'X', email: 'bad', password: 'tiny', rollNumber: '', graduationYear: 1990 }) });
  assert.equal(r.status, 422);
  for (const key of ['fullName', 'email', 'password', 'rollNumber', 'graduationYear']) assert.ok(r.body.error.fields[key], key);
  assert.equal(await db.value('SELECT COUNT(*) FROM users'), before);
});

test('Admin/unknown/structured roles cannot be registered', async () => {
  for (const role of ['Admin', 'aDmIn', 'Root', { name: 'Admin' }, { toString: null }, ['Admin']]) {
    const r = await call('/auth/register', { method: 'POST', body: student({ role }) });
    assert.equal(r.status, 422); assert.ok(r.body.error.fields.role);
  }
  assert.equal(Number(await db.value("SELECT COUNT(*) FROM users WHERE role = 'Admin'")), 1);
});

test('confirm-password mismatch is rejected before registration', async () => {
  const r = await call('/auth/register', { method: 'POST', body: student({ confirmPassword: 'Different@123' }) });
  assert.equal(r.status, 422); assert.ok(r.body.error.fields.confirmPassword);
  assert.equal(await db.one('SELECT id FROM users WHERE email = ?', [student().email]), null);
});

test('duplicate email is normalised and refused by the database', async () => {
  const r = await call('/auth/register', { method: 'POST', body: student({ email: ' AARAV.SHARMA@STUDENT.COLLEGE.EDU ' }) });
  assert.equal(r.status, 409); assert.ok(r.body.error.fields.email); assert.equal(r.body.error.code, 'ALREADY_REGISTERED');
});

test('duplicate roll number rolls back the newly inserted user and notification', async () => {
  const roll = await db.value('SELECT roll_number FROM students ORDER BY id LIMIT 1');
  const before = await db.value('SELECT COUNT(*) FROM notifications');
  const r = await call('/auth/register', { method: 'POST', body: student({ rollNumber: roll }) });
  assert.equal(r.status, 409); assert.ok(r.body.error.fields.rollNumber);
  assert.equal(await db.one('SELECT id FROM users WHERE email = ?', [student().email]), null);
  assert.equal(await db.value('SELECT COUNT(*) FROM notifications'), before);
});

test('duplicate company name rolls back the recruiter account', async () => {
  const name = await db.value('SELECT company_name FROM companies ORDER BY id LIMIT 1');
  const r = await call('/auth/register', { method: 'POST', body: company({ companyName: name }) });
  assert.equal(r.status, 409); assert.ok(r.body.error.fields.companyName);
  assert.equal(await db.one('SELECT id FROM users WHERE email = ?', [company().email]), null);
});

test('structured field values and invalid academic/URL/date data produce 422, not SQL failures', async () => {
  const cases = [
    { password: ['Testing@123'] }, { email: { value: 'a@b.test' } }, { fullName: '😊' },
    { cgpa: 11 }, { backlogCount: true }, { graduationYear: 2027.5 },
    { batchStartYear: 2030 }, { dateOfBirth: '2026-02-30' }, { dateOfBirth: '2099-01-01' },
    { linkedinUrl: 'javascript:alert(1)' }, { githubUrl: 'https://user:password@github.com/test' },
    { password: `A1${'अ'.repeat(30)}` },
  ];
  for (const overrides of cases) {
    const r = await call('/auth/register', { method: 'POST', body: student(overrides) });
    assert.equal(r.status, 422, JSON.stringify(overrides)); assert.ok(r.body.error.fields);
  }
});

test('each seeded role can sign in and receives only a whitelisted own-account payload', async () => {
  for (const role of ['Student', 'Company', 'Admin']) {
    const session = await login(role); assert.equal(session.user.role, role); assert.ok(session.user.lastLoginAt);
    assert.ok(session.session.expiresAt); noSecrets(session);
    const checked = await call('/auth/me', { token: session.token });
    assert.equal(checked.status, 200); assert.equal(checked.body.auth.role, role);
    assert.equal(checked.headers.get('cache-control'), 'no-store'); noSecrets(checked.body);
  }
});

test('incorrect and nonexistent credentials use the same message and code', async () => {
  const wrong = await call('/auth/login', { method: 'POST', body: { ...credentials.Student, password: 'Incorrect@123' } });
  const missing = await call('/auth/login', { method: 'POST', body: { email: 'no.account@example.test', password: 'Incorrect@123' } });
  assert.equal(wrong.status, 401); assert.equal(missing.status, 401);
  assert.equal(wrong.body.error.code, 'BAD_CREDENTIALS'); assert.equal(wrong.body.error.message, missing.body.error.message);
});

test('login accepts normalised email but rejects non-string passwords and SQL injection attempts', async () => {
  const r = await call('/auth/login', { method: 'POST', body: { ...credentials.Student, email: ` ${credentials.Student.email.toUpperCase()} ` } });
  assert.equal(r.status, 200);
  for (const body of [{ email: "'OR1=1--@example.test", password: 'Incorrect@123' }, { ...credentials.Student, password: 12345678 }, { ...credentials.Student, password: [credentials.Student.password] }]) {
    assert.equal((await call('/auth/login', { method: 'POST', body })).status, 401);
  }
});

test('all protected areas require a Bearer header, not a query/body token', async () => {
  const session = await login('Student');
  for (const url of ['/auth/me', '/student/profile', '/company/profile', '/admin/accounts']) {
    const r = await call(url); assert.equal(r.status, 401); assert.equal(r.body.error.code, 'NO_TOKEN');
    assert.equal(r.headers.get('www-authenticate'), 'Bearer');
  }
  assert.equal((await call(`/student/profile?token=${session.token}`)).status, 401);
  assert.equal((await call('/auth/password', { method: 'POST', body: { token: session.token } })).status, 401);
});

test('tampered and expired tokens receive distinct 401 codes', async () => {
  const session = await login('Student');
  const tampered = `${session.token.slice(0, -5)}aaaaa`;
  assert.equal((await call('/auth/me', { token: tampered })).body.error.code, 'TOKEN_INVALID');
  const expired = jwt.sign({ sub: String(session.user.id), role: 'Student', tv: 0 }, config.jwt.secret,
    { issuer: config.jwt.issuer, audience: config.jwt.issuer, expiresIn: -1, jwtid: 'test-expired' });
  const r = await call('/auth/me', { token: expired }); assert.equal(r.status, 401); assert.equal(r.body.error.code, 'TOKEN_EXPIRED');
});

test('role access matrix is enforced server-side', async () => {
  const areas = { Student: '/student/profile', Company: '/company/profile', Admin: '/admin/accounts' };
  for (const role of Object.keys(areas)) {
    const { token } = await login(role);
    for (const [allowed, route] of Object.entries(areas)) assert.equal((await call(route, { token })).status, role === allowed ? 200 : 403, `${role} -> ${route}`);
  }
});

test('a signed token claiming Admin cannot override the Student role stored in the database', async () => {
  const { user } = await login('Student');
  const token = signSession({ id: user.id, role: 'Admin', token_version: 0 });
  const r = await call('/admin/accounts', { token }); assert.equal(r.status, 403); assert.equal(r.body.error.code, 'ROLE_NOT_ALLOWED');
  assert.equal((await call('/auth/me', { token })).body.user.role, 'Student');
});

test('student/company ids from query parameters cannot select another owner’s profile or statistics', async () => {
  const s = await login('Student'); const c = await login('Company');
  assert.equal((await call('/student/profile?userId=1&studentId=2', { token: s.token })).body.user.id, s.user.id);
  assert.equal((await call('/company/profile?companyId=4&userId=1', { token: c.token })).body.company.id, c.company.id);
  assert.equal((await call('/student/profile/2', { token: s.token })).status, 404);
  const stats = await call('/student/overview?studentId=2', { token: s.token });
  assert.equal(stats.status, 200); assert.equal(stats.body.stats.applications, Number(await db.value('SELECT COUNT(*) FROM applications WHERE student_id = ?', [s.student.id])));
  const own = await call('/company/overview?companyId=4', { token: c.token });
  assert.equal(own.status, 200); assert.equal(own.body.stats.jobs, Number(await db.value('SELECT COUNT(*) FROM jobs WHERE company_id = ?', [c.company.id])));
});

test('own display-name updates cannot change another account, role, status, approval or password', async () => {
  const c = await login('Pending'); const adminBefore = await db.one("SELECT * FROM users WHERE role = 'Admin'");
  const r = await call('/auth/me', { method: 'PATCH', token: c.token, body: { fullName: 'Test Renamed Recruiter', id: adminBefore.id, role: 'Admin', status: 'Approved', password_hash: 'clear' } });
  assert.equal(r.status, 200); assert.equal(r.body.user.id, c.user.id); assert.equal(r.body.user.role, 'Company');
  assert.equal((await call('/company/profile', { token: c.token })).body.company.status, 'Pending');
  assert.equal((await db.one('SELECT * FROM users WHERE id = ?', [adminBefore.id])).full_name, adminBefore.full_name);
  assert.equal((await call('/auth/me', { method: 'PATCH', token: c.token, body: { fullName: 'X' } })).status, 422);
});

test('admin company approval unlocks recruiting immediately without approving any jobs', async () => {
  const c = await login('Pending'); const admin = await login('Admin');
  const jobsBefore = await db.query('SELECT id, status FROM jobs ORDER BY id');
  assert.equal((await call('/company/overview', { token: c.token })).status, 403);
  const r = await call(`/admin/companies/${c.company.id}/status`, { method: 'PATCH', token: admin.token, body: { status: 'Approved', note: 'Test verification completed' } });
  assert.equal(r.status, 200); assert.equal(r.body.company.status, 'Approved');
  const raw = await db.one('SELECT * FROM companies WHERE id = ?', [c.company.id]);
  assert.equal(raw.reviewed_by, admin.user.id); assert.ok(raw.reviewed_at);
  assert.equal((await call('/company/overview', { token: c.token })).status, 200);
  assert.equal((await call('/auth/me', { token: c.token })).body.permissions.canPostJobs, true);
  assert.deepEqual(await db.query('SELECT id, status FROM jobs ORDER BY id'), jobsBefore);
});

test('only Admin can review a company; rejecting/suspending needs an explanation and blocks recruiting', async () => {
  const c = await login('Company'); const admin = await login('Admin');
  assert.equal((await call(`/admin/companies/${c.company.id}/status`, { method: 'PATCH', token: c.token, body: { status: 'Approved' } })).status, 403);
  for (const status of ['Rejected', 'Suspended']) {
    assert.equal((await call(`/admin/companies/${c.company.id}/status`, { method: 'PATCH', token: admin.token, body: { status } })).status, 422);
    const r = await call(`/admin/companies/${c.company.id}/status`, { method: 'PATCH', token: admin.token, body: { status, note: 'Test compliance review failed' } });
    assert.equal(r.status, 200); assert.equal((await call('/company/overview', { token: c.token })).status, 403);
    assert.equal((await call('/company/profile', { token: c.token })).status, 200);
  }
});

test('logout revokes every concurrent token while a subsequent login works', async () => {
  const first = await login('Student'); const second = await login('Student');
  assert.notEqual(first.token, second.token);
  const r = await call('/auth/logout', { method: 'POST', token: first.token }); assert.equal(r.status, 200);
  for (const token of [first.token, second.token]) {
    const old = await call('/auth/me', { token }); assert.equal(old.status, 401); assert.equal(old.body.error.code, 'TOKEN_REVOKED');
  }
  assert.equal((await call('/auth/me', { token: (await login('Student')).token })).status, 200);
});

test('wrong current/weak/same/mismatched new passwords leave the stored credentials unchanged', async () => {
  const s = await login('Student'); const before = await db.one('SELECT password_hash, token_version FROM users WHERE id = ?', [s.user.id]);
  for (const body of [
    { currentPassword: 'Wrong@123', newPassword: 'NewTesting@123' },
    { currentPassword: credentials.Student.password, newPassword: 'short' },
    { currentPassword: credentials.Student.password, newPassword: credentials.Student.password },
    { currentPassword: credentials.Student.password, newPassword: 'NewTesting@123', confirmPassword: 'Other@123' },
  ]) assert.equal((await call('/auth/password', { method: 'POST', token: s.token, body })).status, 422);
  assert.deepEqual(await db.one('SELECT password_hash, token_version FROM users WHERE id = ?', [s.user.id]), before);
});

test('password change issues a fresh session, revokes old sessions and verifies only the new password', async () => {
  const s = await login('Student'); const other = await login('Student');
  const r = await call('/auth/password', { method: 'POST', token: s.token, body: { currentPassword: credentials.Student.password, newPassword: 'ChangedTesting@123', confirmPassword: 'ChangedTesting@123' } });
  assert.equal(r.status, 200, JSON.stringify(r.body)); noSecrets(r.body);
  assert.equal((await call('/auth/me', { token: r.body.token })).status, 200);
  for (const token of [s.token, other.token]) assert.equal((await call('/auth/me', { token })).body.error.code, 'TOKEN_REVOKED');
  assert.equal((await call('/auth/login', { method: 'POST', body: credentials.Student })).status, 401);
  assert.equal((await call('/auth/login', { method: 'POST', body: { ...credentials.Student, password: 'ChangedTesting@123' } })).status, 200);
});

test('passwords retain meaningful whitespace through registration, login and password change', async () => {
  const body = student({ password: ' Testing@123 ' });
  const s = await call('/auth/register', { method: 'POST', body }); assert.equal(s.status, 201);
  assert.equal((await call('/auth/login', { method: 'POST', body: { email: body.email, password: body.password } })).status, 200);
  const changed = await call('/auth/password', { method: 'POST', token: s.body.token, body: { currentPassword: body.password, newPassword: ' NewTesting@123 ' } });
  assert.equal(changed.status, 200, JSON.stringify(changed.body));
});

test('admin password reset is real, preserves account status and revokes existing sessions', async () => {
  const s = await login('Student'); const admin = await login('Admin');
  const route = `/admin/accounts/${s.user.id}/password`;
  assert.equal((await call(route, { method: 'POST', token: s.token, body: { newPassword: 'OfficeTesting@123' } })).status, 403);
  const r = await call(route, { method: 'POST', token: admin.token, body: { newPassword: 'OfficeTesting@123' } });
  assert.equal(r.status, 200); noSecrets(r.body); assert.match(r.body.notice, /does not send email/);
  assert.equal((await call('/auth/me', { token: s.token })).body.error.code, 'TOKEN_REVOKED');
  assert.equal((await call('/auth/login', { method: 'POST', body: { ...credentials.Student, password: 'OfficeTesting@123' } })).status, 200);
  assert.equal((await call(`/admin/accounts/${admin.user.id}/password`, { method: 'POST', token: admin.token, body: { newPassword: 'OfficeTesting@123' } })).status, 422);
});

test('suspension blocks both login and existing tokens; reactivation does not resurrect old tokens', async () => {
  const s = await login('Student'); const admin = await login('Admin'); const route = `/admin/accounts/${s.user.id}/status`;
  assert.equal((await call(route, { method: 'PATCH', token: admin.token, body: { status: 'Suspended' } })).status, 422);
  assert.equal((await call(route, { method: 'PATCH', token: admin.token, body: { status: 'Suspended', note: 'Test policy violation' } })).status, 200);
  assert.equal((await call('/auth/me', { token: s.token })).body.error.code, 'ACCOUNT_SUSPENDED');
  assert.equal((await call('/auth/login', { method: 'POST', body: credentials.Student })).body.error.code, 'ACCOUNT_SUSPENDED');
  assert.equal((await call('/auth/login', { method: 'POST', body: { ...credentials.Student, password: 'Wrong@123' } })).body.error.code, 'BAD_CREDENTIALS');
  assert.equal((await call(route, { method: 'PATCH', token: admin.token, body: { status: 'Active' } })).status, 200);
  assert.equal((await call('/auth/me', { token: s.token })).body.error.code, 'TOKEN_REVOKED');
  assert.ok((await login('Student')).token);
});

test('inactive/deleted accounts are refused immediately, even with a previously valid JWT', async () => {
  const s = await login('Student'); const admin = await login('Admin');
  assert.equal((await call(`/admin/accounts/${s.user.id}/status`, { method: 'PATCH', token: admin.token, body: { status: 'Inactive', note: 'Test account inactive' } })).status, 200);
  assert.equal((await call('/auth/me', { token: s.token })).body.error.code, 'ACCOUNT_INACTIVE');
  assert.equal((await call('/auth/login', { method: 'POST', body: credentials.Student })).body.error.code, 'ACCOUNT_INACTIVE');
  await db.execute('DELETE FROM users WHERE id = ?', [s.user.id]);
  assert.equal((await call('/auth/me', { token: s.token })).body.error.code, 'ACCOUNT_GONE');
});

test('admin cannot disable self or another admin, and a no-op status change does not create events', async () => {
  const admin = await login('Admin'); const s = await login('Student');
  assert.equal((await call(`/admin/accounts/${admin.user.id}/status`, { method: 'PATCH', token: admin.token, body: { status: 'Suspended', note: 'Test admin' } })).status, 403);
  const hash = await bcrypt.hash('TestAdmin@123', 10);
  const { insertId } = await db.insert("INSERT INTO users (role,email,password_hash,full_name) VALUES ('Admin',?,?,?)", ['other.admin@example.test', hash, 'Test Admin']);
  assert.equal((await call(`/admin/accounts/${insertId}/status`, { method: 'PATCH', token: admin.token, body: { status: 'Inactive', note: 'Test admin' } })).body.error.code, 'ADMIN_STATUS');
  const n = await db.value('SELECT COUNT(*) FROM notifications');
  const unchanged = await call(`/admin/accounts/${s.user.id}/status`, { method: 'PATCH', token: admin.token, body: { status: 'Active' } });
  assert.equal(unchanged.status, 200); assert.equal(unchanged.body.changed, false); assert.equal(await db.value('SELECT COUNT(*) FROM notifications'), n);
});

test('admin account search/filter/pagination use validated values and literal LIKE escaping', async () => {
  const { token } = await login('Admin');
  const r = await call('/admin/accounts?role=student&limit=2&offset=1', { token });
  assert.equal(r.status, 200); assert.equal(r.body.total, 8); assert.equal(r.body.accounts.length, 2);
  assert.ok(r.body.accounts.every((a) => a.role === 'Student')); noSecrets(r.body);
  assert.equal((await call('/admin/accounts?q=%25', { token })).body.total, 0);
  for (const query of ['limit=1.5', 'limit=0', 'offset=-1', 'role=Root', 'status=Approved']) assert.equal((await call(`/admin/accounts?${query}`, { token })).status, 422);
  assert.equal((await call('/admin/accounts/abc', { token })).status, 400);
  assert.equal((await call('/admin/accounts/4294967296', { token })).status, 400);
  assert.equal((await call('/admin/accounts/999999', { token })).status, 404);
  assert.equal((await call('/admin/companies?status=Pending', { token })).body.companies.length, 1);
});

test('role workspaces show real database counts and are independent of an AI service', async () => {
  const { token } = await login('Admin'); const r = await call('/admin/overview', { token });
  assert.equal(r.status, 200); assert.equal(r.body.stats.students, 8); assert.equal(r.body.stats.companies, 4); assert.equal(r.body.stats.pendingCompanies, 1);
  const s = await login('Student'); assert.equal((await call('/student/overview', { token: s.token })).status, 200);
  assert.equal(config.ai.enabled, false);
});

test('six failed attempts throttle the seventh; forged forwarded-IP headers cannot bypass it', async () => {
  const body = { ...credentials.Student, password: 'WrongTesting@123' };
  for (let i = 0; i < 6; i++) assert.equal((await call('/auth/login', { method: 'POST', body, headers: { 'X-Forwarded-For': `198.51.100.${i}` } })).status, 401);
  const r = await call('/auth/login', { method: 'POST', body, headers: { 'X-Forwarded-For': '203.0.113.20' } });
  assert.equal(r.status, 429); assert.equal(r.body.error.code, 'LOGIN_THROTTLED'); assert.ok(Number(r.headers.get('retry-after')) > 0);
});

test('a successful login clears the account failure bucket', async () => {
  const body = { ...credentials.Student, password: 'WrongTesting@123' };
  for (let i = 0; i < 5; i++) assert.equal((await call('/auth/login', { method: 'POST', body })).status, 401);
  await login('Student');
  for (let i = 0; i < 6; i++) assert.equal((await call('/auth/login', { method: 'POST', body })).status, 401);
  assert.equal((await call('/auth/login', { method: 'POST', body })).status, 429);
});

test('a simultaneous burst cannot bypass the failed-login limit', async () => {
  const results = await Promise.all(Array.from({ length: 10 }, () => call('/auth/login', { method: 'POST', body: { ...credentials.Student, password: 'WrongTesting@123' } })));
  assert.equal(results.filter((r) => r.status === 401).length, 6); assert.equal(results.filter((r) => r.status === 429).length, 4);
});

test('confirm password is required by the registration API, not just the React form', async () => {
  const r = await call('/auth/register', { method: 'POST', body: student({ confirmPassword: undefined }) });
  assert.equal(r.status, 422); assert.ok(r.body.error.fields.confirmPassword);
});
test('/me immediately reflects trusted database role/name changes without relying on token role claims', async () => {
  const s = await login('Student');
  await db.execute("UPDATE users SET role = 'Admin', full_name = ? WHERE id = ?", ['Test Updated Role', s.user.id]);
  const r = await call('/auth/me', { token: s.token });
  assert.equal(r.status, 200); assert.equal(r.body.user.role, 'Admin'); assert.equal(r.body.auth.role, 'Admin'); assert.equal(r.body.user.fullName, 'Test Updated Role');
  assert.ok(!r.body.student); noSecrets(r.body);
});
test('concurrent registration retries create only one complete user/profile pair', async () => {
  const results = await Promise.all(Array.from({ length: 3 }, () => call('/auth/register', { method: 'POST', body: student() })));
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409, 409]);
  const user = await db.one('SELECT id FROM users WHERE email = ?', [student().email]);
  assert.equal(Number(await db.value('SELECT COUNT(*) FROM students WHERE user_id = ?', [user.id])), 1);
  assert.equal(Number(await db.value('SELECT COUNT(*) FROM notifications WHERE user_id = ?', [user.id])), 1);
});
test('registration limit counts successful/duplicate attempts and returns Retry-After', async () => {
  for (let i = 0; i < 12; i++) {
    const r = await call('/auth/register', { method: 'POST', body: student({ email: credentials.Student.email }) }); assert.equal(r.status, 409);
  }
  const r = await call('/auth/register', { method: 'POST', body: student() }); assert.equal(r.status, 429); assert.equal(r.body.error.code, 'SIGNUP_THROTTLED');
  assert.ok(Number(r.headers.get('retry-after')) > 0);
});
test('unexpected query failures return a generic 500 without SQL, stacks or credentials', async () => {
  const original = db.one;
  try {
    db.one = async () => { throw new Error("SELECT password_hash FROM users failed; password='test-secret-only'"); };
    const r = await call('/auth/login', { method: 'POST', body: credentials.Student }); assert.equal(r.status, 500); assert.equal(r.body.error.code, 'INTERNAL');
    for (const forbidden of ['SELECT', 'password_hash', 'test-secret-only', 'stack']) assert.ok(!JSON.stringify(r.body).includes(forbidden));
  } finally { db.one = original; }
});
