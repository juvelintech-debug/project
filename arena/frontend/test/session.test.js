import { beforeEach, expect, test, vi } from 'vitest';
import { SESSION_KEY, readSession, writeSession, clearSession, token } from '../src/api/session';
beforeEach(() => { localStorage.clear(); clearSession(); });
test('persists only the token, never cached permissions/profile data', () => {
  writeSession({ token: 'test-token', user: { id: 7, role: 'Admin', email: 'test@example.test' }, password: 'Test@123' });
  expect(JSON.parse(localStorage.getItem(SESSION_KEY))).toEqual({ token: 'test-token' });
  expect(token()).toBe('test-token'); clearSession(); expect(readSession()).toBeNull();
});
test('malformed or missing stored sessions are treated as signed out', () => {
  for (const raw of ['invalid JSON', 'null', '{}', '{"token":8}', '{"token":""}']) {
    localStorage.setItem(SESSION_KEY, raw); expect(readSession()).toBeNull();
  }
});
test('blocked storage still supports a working in-memory token and logout', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked'); });
  writeSession({ token: 'memory-test-token' }); expect(token()).toBe('memory-test-token');
  clearSession(); expect(token()).toBeNull();
});
