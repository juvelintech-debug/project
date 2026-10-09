import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../../backend/package.json', import.meta.url));
const jwt = require('jsonwebtoken');
const KEY = 'placement.session.v1';
const demo = {
  Student: { email: 'aarav.sharma@student.college.edu', password: 'Student@123' },
  Admin: { email: 'admin@placementcell.edu', password: 'Admin@123' },
};
const identity = (kind) => `${kind}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
async function signIn(page, role = 'Student') {
  await page.goto('/login'); await page.getByLabel('Email address', { exact: true }).fill(demo[role].email);
  await page.getByLabel('Password', { exact: true }).fill(demo[role].password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(role === 'Admin' ? '/admin' : '/student');
}
async function storedToken(page) { return page.evaluate((key) => JSON.parse(localStorage.getItem(key))?.token, KEY); }
async function registerStudent(page) {
  const id = identity('student');
  await page.goto('/register/student');
  await page.getByLabel('Full name', { exact: true }).fill('E2E Test Student');
  await page.getByLabel('Email address', { exact: true }).fill(`${id}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill('Testing@123');
  await page.getByLabel('Confirm password', { exact: true }).fill('Testing@123');
  await page.getByLabel('College roll number', { exact: true }).fill(id.slice(0, 30));
  await page.getByLabel('Graduation year', { exact: true }).fill('2027');
  await page.getByRole('button', { name: 'Create student account' }).click();
  await expect(page).toHaveURL('/student'); return { email: `${id}@example.test`, password: 'Testing@123' };
}

test('public pages, health/meta and mobile password controls work', async ({ page, request }) => {
  const health = await request.get('/api/health'); expect(health.status()).toBe(200); expect((await health.json()).database.client).toBe('sqlite');
  const meta = await (await request.get('/api/meta')).json(); expect(meta.roles).toEqual(['Student', 'Company', 'Admin']);
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await page.getByRole('button', { name: 'Show password', exact: true }).click(); await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Hide password', exact: true }).click();
  await page.goto('/register/student'); await expect(page.getByRole('button', { name: 'Create student account' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.goto('/register/company'); await expect(page.getByRole('button', { name: 'Register company' })).toBeVisible();
  await page.goto('/status'); await expect(page.getByText('Database readiness', { exact: true })).toBeVisible();
});

test('anonymous users cannot enter any protected role workspace', async ({ page, request }) => {
  for (const path of ['/student', '/company', '/admin', '/admin/accounts']) {
    await page.goto(path); await expect(page).toHaveURL(/\/login$/);
  }
  for (const path of ['/api/auth/me', '/api/student/profile', '/api/company/overview', '/api/admin/accounts']) expect((await request.get(path)).status()).toBe(401);
});

test('student signup creates a real SQL-backed session, survives refresh, and sends one submission', async ({ page }) => {
  const errors = []; page.on('pageerror', (err) => errors.push(err.message));
  let posts = 0; page.on('request', (req) => { if (req.url().endsWith('/api/auth/register') && req.method() === 'POST') posts += 1; });
  const user = await registerStudent(page); await expect(page.getByText('Your registered student profile', { exact: true })).toBeVisible();
  const token = await storedToken(page); const me = await page.request.get('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
  const data = await me.json(); expect(data.user.email).toBe(user.email); expect(data.user.role).toBe('Student'); expect(data.student.id).toBeGreaterThan(0);
  expect(JSON.stringify(data)).not.toContain('password_hash'); expect(posts).toBe(1);
  await page.reload(); await expect(page.getByText('Your registered student profile', { exact: true })).toBeVisible();
  expect(await storedToken(page)).toBe(token); expect(errors).toEqual([]);
});

test('company signup stays pending until a real admin review; the same token gains approved access', async ({ page, browser }) => {
  const id = identity('company'); const companyName = `E2E Test Company ${id}`;
  await page.goto('/register/company'); await page.getByLabel('Recruiter name', { exact: true }).fill('E2E Test Recruiter');
  await page.getByLabel('Company name', { exact: true }).fill(companyName); await page.getByLabel('Email address', { exact: true }).fill(`${id}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill('Testing@123'); await page.getByLabel('Confirm password', { exact: true }).fill('Testing@123');
  await page.getByLabel('Company website', { exact: true }).fill('https://company.example'); await page.getByRole('button', { name: 'Register company' }).click();
  await expect(page).toHaveURL('/company'); await expect(page.getByText('Waiting for placement-office approval', { exact: true })).toBeVisible();
  const token = await storedToken(page); const headers = { Authorization: `Bearer ${token}` };
  expect((await page.request.get('/api/company/overview', { headers })).status()).toBe(403);
  const adminContext = await browser.newContext({ baseURL: new URL(page.url()).origin }); const admin = await adminContext.newPage();
  try {
    await signIn(admin, 'Admin'); await admin.getByRole('link', { name: 'Company approvals', exact: true }).click();
    await admin.getByRole('button', { name: `Review ${companyName}`, exact: true }).click();
    await admin.getByLabel('Review note / reason', { exact: true }).fill('E2E test verification approved');
    await admin.getByRole('button', { name: 'Save review decision' }).click(); await expect(admin.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Refresh approval status' }).click();
    await expect(page.getByText('Approved company', { exact: true })).toBeVisible();
    expect((await page.request.get('/api/company/overview', { headers })).status()).toBe(200);
    expect((await (await page.request.get('/api/auth/me', { headers })).json()).permissions.canPostJobs).toBe(true);
  } finally { await adminContext.close(); }
});

test('student navigation and backend authorization reject admin access despite forged cached role data', async ({ page }) => {
  await signIn(page); const token = await storedToken(page);
  await expect(page.getByRole('link', { name: 'Manage accounts', exact: true })).toHaveCount(0);
  expect((await page.request.get('/api/admin/accounts', { headers: { Authorization: `Bearer ${token}` } })).status()).toBe(403);
  await page.evaluate(({ key, token }) => localStorage.setItem(key, JSON.stringify({ token, user: { id: 1, role: 'Admin' } })), { key: KEY, token });
  await page.goto('/admin'); await expect(page.getByText('Access denied', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Go to my dashboard' }).click(); await expect(page).toHaveURL('/student');
});

test('logout clears browser state, revokes the copied token, and prevents back/refresh access', async ({ page }) => {
  await signIn(page); const token = await storedToken(page);
  await page.getByRole('link', { name: 'Account settings', exact: true }).click(); await expect(page).toHaveURL(/\/account$/);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click(); await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBeNull();
  const revoked = await page.request.get('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } }); expect(revoked.status()).toBe(401); expect((await revoked.json()).error.code).toBe('TOKEN_REVOKED');
  await page.goBack(); await expect(page).toHaveURL(/\/login$/); await page.reload(); await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});

test('display-name/password forms save real data and rotate the session token', async ({ page }) => {
  await registerStudent(page); await page.getByRole('link', { name: 'Account settings', exact: true }).click();
  await page.getByLabel('Full name', { exact: true }).fill('E2E Updated Name'); await page.getByRole('button', { name: 'Save display name' }).click();
  await expect(page.getByText('Display name updated.', { exact: true })).toBeVisible();
  const old = await storedToken(page); const changedPassword = 'NewTesting@123';
  await page.getByLabel('Current password', { exact: true }).fill('Testing@123'); await page.getByLabel('New password', { exact: true }).fill(changedPassword);
  await page.getByLabel('Confirm new password', { exact: true }).fill(changedPassword); await page.getByRole('button', { name: 'Change password', exact: true }).click();
  await expect.poll(() => storedToken(page)).not.toBe(old);
  expect((await page.request.get('/api/auth/me', { headers: { Authorization: `Bearer ${old}` } })).status()).toBe(401);
  await page.reload(); await expect(page.getByLabel('Full name', { exact: true })).toHaveValue('E2E Updated Name');
});

test('expired signed JWTs return the user to login with a clear expiration message', async ({ page, request }) => {
  const session = await (await request.post('/api/auth/login', { data: demo.Student })).json();
  const claims = jwt.decode(session.token);
  const expired = jwt.sign({ sub: claims.sub, role: claims.role, tv: claims.tv }, 'e2e-test-only-secret-not-for-real-deployments',
    { issuer: claims.iss, audience: claims.aud, jwtid: 'expired-e2e-test', expiresIn: -1 });
  await page.goto('/login'); await page.evaluate(({ key, token }) => localStorage.setItem(key, JSON.stringify({ token })), { key: KEY, token: expired });
  await page.goto('/student'); await expect(page).toHaveURL(/\/login$/); await expect(page.getByText('Your session has expired. Please sign in again.', { exact: true })).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBeNull();
});

test('network failure during refresh blocks access but can recover without losing the token', async ({ page, context }) => {
  await signIn(page); const token = await storedToken(page);
  await context.route('**/api/auth/me', (route) => route.abort()); await page.reload();
  await expect(page.getByRole('heading', { name: 'We couldn’t verify your session' })).toBeVisible(); expect(await storedToken(page)).toBe(token);
  await context.unroute('**/api/auth/me'); await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByText('Your registered student profile', { exact: true })).toBeVisible();
});

test('invalid credentials and duplicate registration show real API errors, never a fake session', async ({ page }) => {
  await page.goto('/login'); await page.getByLabel('Email address', { exact: true }).fill(demo.Student.email); await page.getByLabel('Password', { exact: true }).fill('WrongTesting@123');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await expect(page.getByText('Email or password is incorrect.', { exact: true })).toBeVisible();
  await page.goto('/register/student'); await page.getByLabel('Full name', { exact: true }).fill('E2E Duplicate Test');
  await page.getByLabel('Email address', { exact: true }).fill(demo.Student.email); await page.getByLabel('Password', { exact: true }).fill('Testing@123');
  await page.getByLabel('Confirm password', { exact: true }).fill('Testing@123'); await page.getByLabel('College roll number', { exact: true }).fill(identity('dup').slice(0, 30));
  await page.getByLabel('Graduation year', { exact: true }).fill('2027'); await page.getByRole('button', { name: 'Create student account' }).click();
  await expect(page.getByLabel('Email address', { exact: true })).toHaveAttribute('aria-invalid', 'true'); expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBeNull();
});

test('admin account filters, status controls and password reset work through the real forms', async ({ page, browser }) => {
  const registered = await registerStudent(page); const old = await storedToken(page);
  const adminContext = await browser.newContext({ baseURL: new URL(page.url()).origin }); const admin = await adminContext.newPage();
  try {
    await signIn(admin, 'Admin'); await admin.getByRole('complementary', { name: 'Primary navigation' }).getByRole('link', { name: 'Manage accounts', exact: true }).click();
    await admin.getByLabel('Search', { exact: true }).fill(registered.email); await admin.getByRole('button', { name: 'Apply filters' }).click();
    await expect(admin.getByText('1 matching accounts', { exact: true })).toBeVisible();
    await admin.getByRole('button', { name: 'Manage E2E Test Student', exact: true }).click();
    await admin.getByRole('combobox', { name: 'Account status', exact: true }).selectOption('Inactive'); await admin.getByLabel('Reason / note', { exact: true }).fill('E2E account verification hold');
    await admin.getByRole('button', { name: 'Update account status' }).click(); await expect(admin.getByRole('dialog')).toHaveCount(0);
    const blocked = await page.request.get('/api/auth/me', { headers: { Authorization: `Bearer ${old}` } }); expect(blocked.status()).toBe(401); expect((await blocked.json()).error.code).toBe('ACCOUNT_INACTIVE');
    await admin.getByRole('button', { name: 'Manage E2E Test Student', exact: true }).click(); await admin.getByRole('combobox', { name: 'Account status', exact: true }).selectOption('Active');
    await admin.getByRole('button', { name: 'Update account status' }).click(); await expect(admin.getByRole('dialog')).toHaveCount(0);
    await admin.getByRole('button', { name: 'Manage E2E Test Student', exact: true }).click();
    await admin.getByLabel('Temporary password', { exact: true }).fill('OfficeTest@123'); await admin.getByLabel('Confirm temporary password', { exact: true }).fill('OfficeTest@123');
    await admin.getByRole('button', { name: 'Reset password', exact: true }).click(); await expect(admin.getByRole('dialog')).toHaveCount(0);
    await page.goto('/login'); await page.getByLabel('Email address', { exact: true }).fill(registered.email); await page.getByLabel('Password', { exact: true }).fill('OfficeTest@123');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await expect(page).toHaveURL('/student');
  } finally { await adminContext.close(); }
});

test('mobile workspace navigation, account page and sign-out remain usable without overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await signIn(page);
  await expect(page.getByText('Your registered student profile', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Toggle navigation', exact: true }).click(); await page.getByRole('link', { name: 'Account settings', exact: true }).click();
  await expect(page).toHaveURL('/account'); await expect(page.getByRole('button', { name: 'Change password', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Toggle navigation', exact: true }).click(); await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});
