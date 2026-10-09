import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError } from '../api/client';
import { clearSession, readSession, SESSION_KEY, token, writeSession } from '../api/session';
import { useToast } from '../components/Toast';

const AuthContext = createContext(null);
const sessionChanged = () => new ApiError('Your session changed during this request. Please try again.', { code: 'SESSION_CHANGED' });
const assertSession = (expected) => { if (!expected || token() !== expected) throw sessionChanged(); };
const validUser = (user) => user && Number.isInteger(user.id) && ['Student', 'Company', 'Admin'].includes(user.role) && user.status === 'Active';

export function AuthProvider({ children }) {
  const [account, setAccount] = useState(null); // never restored from cached roles
  const [status, setStatus] = useState(() => readSession() ? 'checking' : 'anonymous');
  const [error, setError] = useState(null);
  const [signingOut, setSigningOut] = useState(false);
  const [sessionMessage, setSessionMessage] = useState(null);
  const generation = useRef(0);
  const authIntent = useRef(0);
  const pending = useRef(null);
  const verifiedToken = useRef(null);
  const toast = useToast();

  const invalidate = useCallback(() => {
    generation.current += 1;
    pending.current?.abort();
    pending.current = null;
  }, []);
  const forget = useCallback((message = null) => {
    authIntent.current += 1; invalidate(); clearSession(); verifiedToken.current = null;
    setAccount(null); setError(null); setStatus('anonymous'); setSessionMessage(message);
  }, [invalidate]);

  const accept = useCallback((payload, { merge = false } = {}) => {
    if (!payload?.token || !validUser(payload.user)) throw new ApiError('The sign-in response was incomplete. Please try again.', { code: 'BAD_RESPONSE' });
    authIntent.current += 1; invalidate(); writeSession({ token: payload.token }); verifiedToken.current = payload.token;
    setAccount((previous) => {
      const { token: _token, ...safe } = payload;
      return merge ? { ...previous, ...safe, auth: payload.session } : { ...safe, auth: payload.session };
    });
    setStatus('authenticated'); setError(null); setSessionMessage(null);
    return payload.user;
  }, [invalidate]);

  const refresh = useCallback(async () => {
    const stored = token();
    if (!stored) {
      // Background focus checks must not cancel a pending public sign-in.
      invalidate(); verifiedToken.current = null; setAccount(null); setError(null); setStatus('anonymous'); return;
    }
    invalidate();
    const current = generation.current;
    const controller = new AbortController(); pending.current = controller;
    if (stored !== verifiedToken.current) { setAccount(null); setStatus('checking'); }
    try {
      const payload = await api.get('/auth/me', { signal: controller.signal });
      if (generation.current !== current || stored !== token()) return;
      if (!validUser(payload?.user)) throw new ApiError('The account response was incomplete. Please retry.', { code: 'BAD_RESPONSE' });
      verifiedToken.current = stored; setAccount(payload); setStatus('authenticated'); setError(null);
    } catch (err) {
      if (err.cancelled || generation.current !== current) return;
      if (err.status === 401) forget(err.message);
      else { setAccount(null); setError(err); setStatus('error'); } // retain token for recovery, don't grant access
    }
  }, [forget, invalidate]);

  useEffect(() => {
    refresh();
    const unauthorized = (event) => forget(event.detail?.message || 'Please sign in again.');
    const storage = (event) => { if (event.key === SESSION_KEY || event.key === null) refresh(); };
    const visible = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('placement:unauthorized', unauthorized);
    window.addEventListener('storage', storage);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', visible);
    return () => {
      invalidate();
      window.removeEventListener('placement:unauthorized', unauthorized);
      window.removeEventListener('storage', storage);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [forget, invalidate, refresh]);

  const expiresAt = account?.auth?.expiresAt;
  useEffect(() => {
    if (!expiresAt) return;
    const delay = new Date(expiresAt).getTime() - Date.now();
    if (!Number.isFinite(delay)) return;
    const timer = setTimeout(() => forget('Your session has expired. Please sign in again.'), Math.max(0, Math.min(delay, 2147483647)));
    return () => clearTimeout(timer);
  }, [expiresAt, forget]);

  const signIn = useCallback(async (path, body) => {
    const intent = ++authIntent.current; const original = token();
    const payload = await api.post(path, body, { auth: false });
    if (intent !== authIntent.current || original !== token()) throw sessionChanged();
    return accept(payload);
  }, [accept]);
  const login = useCallback((body) => signIn('/auth/login', body), [signIn]);
  const register = useCallback((body) => signIn('/auth/register', body), [signIn]);
  const logout = useCallback(async () => {
    if (signingOut) return;
    const original = token(); authIntent.current += 1; setSigningOut(true);
    try {
      await api.post('/auth/logout', {});
      if (original === token()) toast.success('Signed out. All previous sessions for this account were revoked.');
    } catch (err) {
      if (err.status !== 401 && original === token()) toast.warning('Signed out on this browser only. Server revocation could not be confirmed; copied tokens may remain valid until expiry.', { duration: 9000 });
    } finally {
      if (!token() || original === token()) forget();
      else await refresh(); // do not erase a different account's cross-tab login
      setSigningOut(false);
    }
  }, [forget, refresh, signingOut, toast]);
  const updateName = useCallback(async (fullName) => {
    const original = token(); const payload = await api.patch('/auth/me', { fullName });
    assertSession(original);
    if (!validUser(payload.user)) throw new ApiError('The account response was incomplete. Please retry.', { code: 'BAD_RESPONSE' });
    invalidate(); setAccount((previous) => previous?.user?.id === payload.user.id ? { ...previous, user: payload.user } : previous);
    return payload;
  }, [invalidate]);
  const changePassword = useCallback(async (body) => {
    const original = token(); const payload = await api.post('/auth/password', body);
    assertSession(original); accept(payload, { merge: true }); return payload;
  }, [accept]);

  const value = useMemo(() => ({ account, user: account?.user || null, status, error, sessionMessage, signingOut,
    login, register, logout, refresh, updateName, changePassword }),
  [account, status, error, sessionMessage, signingOut, login, register, logout, refresh, updateName, changePassword]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
