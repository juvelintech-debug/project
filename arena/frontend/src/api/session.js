/**
 * Established Bearer-token architecture: storage is never sent automatically.
 * localStorage persists a session, but XSS can read it; CSP and text-only React
 * rendering reduce (not eliminate) that risk. Roles cached here are NOT trusted
 * for routing: AuthProvider always verifies returning sessions with /auth/me.
 */
export const SESSION_KEY = 'placement.session.v1';
let fallback = null;
let useMemory = false;

function safeSession(value) {
  if (!value || typeof value.token !== 'string' || !value.token) return null;
  return { token: value.token }; // don't persist profile/PII/permissions
}
export function readSession() {
  if (useMemory) return fallback;
  let raw;
  try { raw = localStorage.getItem(SESSION_KEY); } catch { useMemory = true; return fallback; }
  try { fallback = raw ? safeSession(JSON.parse(raw)) : null; } catch { fallback = null; }
  return fallback;
}
export function writeSession(session) {
  fallback = safeSession(session);
  try {
    if (fallback) localStorage.setItem(SESSION_KEY, JSON.stringify(fallback));
    else localStorage.removeItem(SESSION_KEY);
    useMemory = false;
  } catch {
    useMemory = true; // blocked storage: still send the current token, until reload
  }
}
export function clearSession() { writeSession(null); }
export function token() { return readSession()?.token || null; }
