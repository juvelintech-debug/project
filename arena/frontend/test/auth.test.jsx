import { beforeEach, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App';
import { AuthProvider } from '../src/context/AuthContext';
import { MetaProvider } from '../src/context/MetaContext';
import { ToastProvider } from '../src/components/Toast';
import { SESSION_KEY, clearSession, token, writeSession } from '../src/api/session';

// Component tests use HTTP doubles. The separate Playwright suite uses real API + SQL.
const meta = {
  app: { shortName: 'Placement Portal' }, roles: ['Student', 'Company', 'Admin'], accountStatuses: ['Active', 'Inactive', 'Suspended'],
  companyStatuses: ['Pending', 'Approved', 'Rejected', 'Suspended'], companySizes: ['1-50', 'Unspecified'],
  auth: { passwordPolicy: { minLength: 8, maxLength: 72, maxBytes: 72, requireLetter: true, requireNumber: true } }, readiness: {}, limits: {},
};
const respond = (body, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
function profile(role = 'Student', companyStatus = 'Approved') {
  return { token: 'verified-test-token', user: { id: 7, role, fullName: 'Test Person', email: 'test@example.test', status: 'Active' },
    student: role === 'Student' ? { id: 17, rollNumber: 'TEST-17', program: 'B.Sc. IT', graduationYear: 2027, placementStatus: 'Unplaced' } : undefined,
    company: role === 'Company' ? { id: 27, name: 'Test Company', status: companyStatus, contactPerson: 'Test Recruiter', contactEmail: 'test@example.test' } : undefined,
    notice: companyStatus === 'Pending' ? 'Your company is awaiting placement-office approval.' : null,
    auth: { expiresAt: new Date(Date.now() + 3600000).toISOString() }, session: { expiresAt: new Date(Date.now() + 3600000).toISOString() },
  };
}
function mockServer(session = profile(), override) {
  const fetch = vi.fn((url, init) => {
    const changed = override?.(url, init); if (changed) return changed;
    if (url === '/api/meta') return respond(meta);
    if (url === '/api/health') return respond({ status: 'ok', version: '1', database: { status: 'ok' }, ai: {} });
    if (url === '/api/auth/login' || url === '/api/auth/register') return respond(session, url.endsWith('register') ? 201 : 200);
    if (url === '/api/auth/me') return respond(session);
    if (url === '/api/auth/logout') return respond({ revoked: true });
    if (url === '/api/student/overview') return respond({ student: session.student, stats: { applications: 2, skills: 4, unreadNotifications: 1 } });
    if (url === '/api/company/profile') return respond(session);
    if (url === '/api/company/overview') return respond({ company: session.company, stats: { jobs: 2, approvedJobs: 1, applications: 3 } });
    if (url === '/api/admin/overview') return respond({ stats: { students: 8, companies: 4, pendingCompanies: 1, activeAccounts: 13 } });
    throw new Error(`Unexpected test request: ${url}`);
  });
  vi.stubGlobal('fetch', fetch); return fetch;
}
function mount(path) {
  return render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><ToastProvider><MetaProvider><AuthProvider><App /></AuthProvider></MetaProvider></ToastProvider></MemoryRouter>);
}
beforeEach(() => { localStorage.clear(); clearSession(); });

test('anonymous users are redirected away from protected pages before sensitive reads', async () => {
  const fetch = mockServer(); mount('/admin');
  expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeVisible();
  expect(fetch.mock.calls.some(([url]) => url === '/api/admin/overview')).toBe(false);
});
test('restored roles are verified with /auth/me instead of trusted from storage', async () => {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ token: 'test-token', user: { id: 1, role: 'Admin' } }));
  let resolveMe;
  const fetch = mockServer(profile(), (url) => url === '/api/auth/me' ? new Promise((resolve) => { resolveMe = resolve; }) : null);
  mount('/admin'); expect(screen.getByText('Checking your session…')).toBeVisible();
  resolveMe(new Response(JSON.stringify(profile()), { status: 200 }));
  expect(await screen.findByText('Access denied')).toBeVisible();
  expect(fetch.mock.calls.some(([url]) => url === '/api/admin/overview')).toBe(false);
});
test('student login redirects to a real role workspace and logout clears all cached identity', async () => {
  const fetch = mockServer(); const user = userEvent.setup(); mount('/login');
  await user.type(screen.getByLabelText(/Email address/), 'test@example.test'); await user.type(screen.getByLabelText(/^Password/), 'Testing@123');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(await screen.findByText('Your registered student profile')).toBeVisible(); expect(token()).toBe('verified-test-token');
  await user.click(screen.getByRole('button', { name: 'Sign out' }));
  expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeVisible(); expect(token()).toBeNull(); expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  expect(screen.queryByText('TEST-17')).not.toBeInTheDocument(); expect(fetch.mock.calls.some(([url]) => url === '/api/auth/logout')).toBe(true);
});
test('invalid login credentials show a useful error without granting access', async () => {
  mockServer(profile(), (url) => url === '/api/auth/login' ? respond({ error: { code: 'BAD_CREDENTIALS', message: 'Email or password is incorrect.' } }, 401) : null);
  const user = userEvent.setup(); mount('/login'); await user.type(screen.getByLabelText(/Email address/), 'test@example.test'); await user.type(screen.getByLabelText(/^Password/), 'Wrong@123');
  await user.click(screen.getByRole('button', { name: 'Sign in' })); expect(await screen.findByText('Email or password is incorrect.')).toBeVisible(); expect(token()).toBeNull();
});
test('expired sessions clear storage and show the expiration message at login', async () => {
  writeSession({ token: 'expired-test-token' });
  mockServer(profile(), (url) => url === '/api/auth/me' ? respond({ error: { code: 'TOKEN_EXPIRED', message: 'Your session has expired. Please sign in again.' } }, 401) : null);
  mount('/student'); expect(await screen.findByText('Your session has expired. Please sign in again.')).toBeVisible(); expect(token()).toBeNull();
});
test('session verification outages block access, retain the token, and allow recovery', async () => {
  writeSession({ token: 'test-token' }); let down = true;
  mockServer(profile(), (url) => url === '/api/auth/me' && down ? respond({ error: { code: 'DATABASE_UNAVAILABLE', message: 'Database unavailable.' } }, 503) : null);
  const user = userEvent.setup(); mount('/student'); expect(await screen.findByText('We couldn’t verify your session')).toBeVisible(); expect(token()).toBe('test-token');
  expect(screen.queryByText('Your registered student profile')).not.toBeInTheDocument(); down = false;
  await user.click(screen.getByRole('button', { name: 'Retry' })); expect(await screen.findByText('Your registered student profile')).toBeVisible();
});
test('pending companies see their own registration, without requesting approval-restricted data', async () => {
  writeSession({ token: 'test-token' }); const fetch = mockServer(profile('Company', 'Pending')); mount('/company');
  expect(await screen.findByText('Waiting for placement-office approval')).toBeVisible(); expect(screen.getByText('Test Company')).toBeVisible();
  expect(fetch.mock.calls.some(([url]) => url === '/api/company/overview')).toBe(false);
});
test('student registration validates confirmation and sends only a fixed self-service role', async () => {
  const fetch = mockServer(); const user = userEvent.setup(); mount('/register/student');
  await screen.findByRole('button', { name: 'Create student account' });
  await user.type(screen.getByLabelText(/Full name/), 'Test Person'); await user.type(screen.getByLabelText(/Email address/), 'test@example.test');
  await user.type(screen.getByLabelText(/^Password/), 'Testing@123'); await user.type(screen.getByLabelText(/Confirm password/), 'Mismatch@123');
  await user.type(screen.getByLabelText(/College roll number/), 'TEST-17'); await user.type(screen.getByLabelText(/Graduation year/), '2027');
  await user.click(screen.getByRole('button', { name: 'Create student account' })); expect(screen.getByText(/The two passwords must match\./)).toBeVisible();
  expect(fetch.mock.calls.some(([url]) => url === '/api/auth/register')).toBe(false);
  await user.clear(screen.getByLabelText(/Confirm password/)); await user.type(screen.getByLabelText(/Confirm password/), 'Testing@123');
  await user.click(screen.getByRole('button', { name: 'Create student account' })); await screen.findByText('Your registered student profile');
  const sent = JSON.parse(fetch.mock.calls.find(([url]) => url === '/api/auth/register')[1].body); expect(sent.role).toBe('Student'); expect(sent.confirmPassword).toBe(sent.password); expect(sent).not.toHaveProperty('status');
});
test('registration renders server field-level duplicate errors without signing in', async () => {
  const fetch = mockServer(profile(), (url) => url === '/api/auth/register' ? respond({ error: { message: 'Duplicate email.', fields: { email: 'That email already has an account.' } } }, 409) : null);
  const user = userEvent.setup(); mount('/register/company'); await screen.findByRole('button', { name: 'Register company' });
  for (const [label, value] of [[/Recruiter name/, 'Test Recruiter'], [/Company name/, 'Test Company'], [/Email address/, 'test@example.test'], [/^Password/, 'Testing@123'], [/Confirm password/, 'Testing@123']]) await user.type(screen.getByLabelText(label), value);
  await user.click(screen.getByRole('button', { name: 'Register company' })); expect(await screen.findByText(/That email already has an account/)).toBeVisible(); expect(token()).toBeNull();
  const sent = JSON.parse(fetch.mock.calls.find(([url]) => url === '/api/auth/register')[1].body); expect(sent.role).toBe('Company');
});
test('cross-tab logout removes protected content immediately', async () => {
  writeSession({ token: 'test-token' }); mockServer(); mount('/student'); await screen.findByText('Your registered student profile');
  clearSession(); window.dispatchEvent(new StorageEvent('storage', { key: SESSION_KEY }));
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeVisible()); expect(screen.queryByText('TEST-17')).not.toBeInTheDocument();
});
