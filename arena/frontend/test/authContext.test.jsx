import { act, renderHook, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { ToastProvider } from '../src/components/Toast';
import { clearSession, SESSION_KEY, token, writeSession } from '../src/api/session';

// Async session lifecycle tests use HTTP doubles, not a live API.
const payload = (id = 1, role = 'Student', value = 'test-token-one') => ({
  token: value, user: { id, role, fullName: `Test Account ${id}`, status: 'Active' },
  auth: { expiresAt: new Date(Date.now() + 3600000).toISOString() },
  session: { expiresAt: new Date(Date.now() + 3600000).toISOString() },
});
const response = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const wrapper = ({ children }) => <ToastProvider><AuthProvider>{children}</AuthProvider></ToastProvider>;
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
async function replaceSession(value) {
  await act(async () => { writeSession({ token: value }); window.dispatchEvent(new StorageEvent('storage', { key: SESSION_KEY })); });
}
beforeEach(() => { localStorage.clear(); clearSession(); });

test('a delayed earlier signup cannot overwrite the latest explicit login', async () => {
  const first = deferred(); const second = deferred();
  vi.stubGlobal('fetch', vi.fn((url) => url.endsWith('register') ? first.promise : second.promise));
  const { result } = renderHook(useAuth, { wrapper }); let early, late;
  act(() => { early = result.current.register({}).catch((err) => err); late = result.current.login({}); });
  await act(async () => { second.resolve(response(payload(2, 'Admin', 'new-test-token'))); await late; });
  await act(async () => { first.resolve(response(payload())); expect((await early).code).toBe('SESSION_CHANGED'); });
  expect(result.current.user.id).toBe(2); expect(result.current.user.role).toBe('Admin'); expect(token()).toBe('new-test-token');
});

test('an old display-name response cannot replace a different cross-tab account', async () => {
  const edit = deferred(); writeSession({ token: 'test-token-one' });
  vi.stubGlobal('fetch', vi.fn((url, init) => init.method === 'PATCH' ? edit.promise : Promise.resolve(response(token() === 'new-test-token' ? payload(2, 'Admin', 'new-test-token') : payload()))));
  const { result } = renderHook(useAuth, { wrapper }); await waitFor(() => expect(result.current.status).toBe('authenticated'));
  let pending; act(() => { pending = result.current.updateName('Test Changed').catch((err) => err); });
  await replaceSession('new-test-token'); await waitFor(() => expect(result.current.user?.id).toBe(2));
  await act(async () => { edit.resolve(response({ user: { ...payload().user, fullName: 'Old Changed Name' } })); expect((await pending).code).toBe('SESSION_CHANGED'); });
  expect(result.current.user.id).toBe(2); expect(result.current.user.fullName).not.toBe('Old Changed Name');
});

test('a delayed password rotation never overwrites another account session', async () => {
  const change = deferred(); writeSession({ token: 'test-token-one' });
  vi.stubGlobal('fetch', vi.fn((url) => url.endsWith('password') ? change.promise : Promise.resolve(response(token() === 'new-test-token' ? payload(2, 'Admin', 'new-test-token') : payload()))));
  const { result } = renderHook(useAuth, { wrapper }); await waitFor(() => expect(result.current.status).toBe('authenticated'));
  let pending; act(() => { pending = result.current.changePassword({}).catch((err) => err); });
  await replaceSession('new-test-token'); await waitFor(() => expect(result.current.user?.id).toBe(2));
  await act(async () => { change.resolve(response(payload(1, 'Student', 'old-rotation-token'))); expect((await pending).code).toBe('SESSION_CHANGED'); });
  expect(token()).toBe('new-test-token'); expect(result.current.user.id).toBe(2);
});

test('a late logout response cannot clear a different cross-tab login', async () => {
  const logout = deferred(); writeSession({ token: 'test-token-one' });
  vi.stubGlobal('fetch', vi.fn((url) => url.endsWith('logout') ? logout.promise : Promise.resolve(response(token() === 'new-test-token' ? payload(2, 'Admin', 'new-test-token') : payload()))));
  const { result } = renderHook(useAuth, { wrapper }); await waitFor(() => expect(result.current.status).toBe('authenticated'));
  let pending; act(() => { pending = result.current.logout(); });
  await replaceSession('new-test-token'); await waitFor(() => expect(result.current.user?.id).toBe(2));
  await act(async () => { logout.resolve(response({ revoked: true })); await pending; });
  expect(result.current.status).toBe('authenticated'); expect(result.current.user.id).toBe(2); expect(token()).toBe('new-test-token');
});

test('failed server logout still clears local state but warns that copied tokens may remain valid', async () => {
  writeSession({ token: 'test-token-one' });
  vi.stubGlobal('fetch', vi.fn((url) => Promise.resolve(url.endsWith('logout') ? response({ error: { message: 'Database unavailable.' } }, 503) : response(payload()))));
  const { result } = renderHook(useAuth, { wrapper }); await waitFor(() => expect(result.current.status).toBe('authenticated'));
  await act(async () => { await result.current.logout(); });
  expect(token()).toBeNull(); expect(result.current.user).toBeNull(); expect(result.current.status).toBe('anonymous');
  expect(screen.getByText(/Server revocation could not be confirmed/)).toBeVisible();
});
