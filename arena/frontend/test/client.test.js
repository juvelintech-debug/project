import { beforeEach, expect, test, vi } from 'vitest';
import { api } from '../src/api/client';
import { clearSession, writeSession, token } from '../src/api/session';
const response = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
beforeEach(() => { localStorage.clear(); clearSession(); });
test('uses relative URLs and the established Bearer header, without cookies', async () => {
  writeSession({ token: 'test-token' }); const fetch = vi.fn().mockResolvedValue(response(200, { ok: true })); vi.stubGlobal('fetch', fetch);
  await api.get('/auth/me'); expect(fetch.mock.calls[0][0]).toBe('/api/auth/me');
  expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer test-token'); expect(fetch.mock.calls[0][1].credentials).toBe('omit');
});
test('invalid login credentials do not revoke an unrelated stored session', async () => {
  writeSession({ token: 'current-token' }); const unauthorized = vi.fn(); window.addEventListener('placement:unauthorized', unauthorized);
  const fetch = vi.fn().mockResolvedValue(response(401, { error: { code: 'BAD_CREDENTIALS', message: 'Email or password is incorrect.' } })); vi.stubGlobal('fetch', fetch);
  await expect(api.post('/auth/login', { email: 'test@example.test', password: 'Incorrect@123' }, { auth: false })).rejects.toMatchObject({ code: 'BAD_CREDENTIALS' });
  expect(fetch.mock.calls[0][1].headers.Authorization).toBeUndefined(); expect(token()).toBe('current-token'); expect(unauthorized).not.toHaveBeenCalled();
  window.removeEventListener('placement:unauthorized', unauthorized);
});
test('401 on the current token clears storage and broadcasts the reason', async () => {
  writeSession({ token: 'expired-token' }); const unauthorized = vi.fn(); window.addEventListener('placement:unauthorized', unauthorized);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(401, { error: { code: 'TOKEN_EXPIRED', message: 'Session expired.' } })));
  await expect(api.get('/auth/me')).rejects.toMatchObject({ code: 'TOKEN_EXPIRED' }); expect(token()).toBeNull();
  expect(unauthorized.mock.calls[0][0].detail.code).toBe('TOKEN_EXPIRED'); window.removeEventListener('placement:unauthorized', unauthorized);
});
test('a stale request cannot clear a newly issued token', async () => {
  writeSession({ token: 'old-token' }); let finish;
  vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => { finish = resolve; })));
  const request = api.get('/auth/me'); writeSession({ token: 'new-token' });
  finish(response(401, { error: { code: 'TOKEN_REVOKED', message: 'Old token revoked.' } }));
  await expect(request).rejects.toMatchObject({ status: 401 }); expect(token()).toBe('new-token');
});
test('outages keep the token and expose only the safe error envelope', async () => {
  writeSession({ token: 'test-token' });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(503, { error: { code: 'DATABASE_UNAVAILABLE', message: 'Database unavailable.', hint: 'Start MySQL.' } })));
  await expect(api.get('/auth/me')).rejects.toMatchObject({ status: 503, hint: 'Start MySQL.' }); expect(token()).toBe('test-token');
});
test('network failures, timeout and caller cancellation are distinct', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection failed')));
  await expect(api.get('/auth/me')).rejects.toMatchObject({ code: 'NETWORK' });
  vi.stubGlobal('fetch', vi.fn((_path, init) => new Promise((_resolve, reject) => {
    if (init.signal.aborted) reject(new Error('aborted'));
    else init.signal.addEventListener('abort', () => reject(new Error('aborted')));
  })));
  await expect(api.get('/auth/me', { timeout: 5 })).rejects.toMatchObject({ code: 'TIMEOUT' });
  const controller = new AbortController(); controller.abort();
  await expect(api.get('/auth/me', { signal: controller.signal })).rejects.toMatchObject({ code: 'CANCELLED', cancelled: true });
});
