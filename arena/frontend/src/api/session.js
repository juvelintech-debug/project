/**
 * Session storage for the JWT.
 *
 * localStorage is used deliberately over a cookie so the token is never sent
 * automatically by the browser to a cross-site endpoint (no CSRF surface); the
 * trade-off — XSS could read it — is why the CSP forbids inline scripts and
 * every server-supplied string is rendered as text, never HTML.
 */
const KEY = 'placement.session.v1';

export function readSession() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || typeof s.token !== 'string' || !s.user) return null;
    return s;
  } catch {
    return null;
  }
}

export function writeSession(session) {
  try {
    if (session) localStorage.setItem(KEY, JSON.stringify(session));
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode / quota — the app still works, just not across reloads */
  }
}

export function clearSession() {
  writeSession(null);
}

export function token() {
  return readSession()?.token || null;
}
