import { token, clearSession } from './session';

/** The single network layer. Browser URLs are always relative to this origin. */
const BASE = '/api';
const DEFAULT_TIMEOUT = 20000;
export class ApiError extends Error {
  constructor(message, { status, code, fields, requestId, hint, retryAfterSeconds } = {}) {
    super(message);
    this.name = 'ApiError';
    Object.assign(this, { status, code, fields, requestId, hint, retryAfterSeconds });
  }
}
export async function request(path, {
  method = 'GET', body, formData, signal, timeout = DEFAULT_TIMEOUT,
  headers = {}, raw = false, auth = true,
} = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), timeout);
  const cancel = () => controller.abort('cancelled');
  if (signal?.aborted) cancel();
  else signal?.addEventListener('abort', cancel, { once: true });
  const sentToken = auth ? token() : null;
  const init = { method, headers: { Accept: 'application/json', ...headers }, credentials: 'omit', signal: controller.signal };
  if (sentToken) init.headers.Authorization = `Bearer ${sentToken}`;
  if (formData) init.body = formData;
  else if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  try {
    const res = await fetch(`${BASE}${path}`, init);
    if (res.status === 204) return null;
    if (raw && res.ok) return await res.blob();
    let payload;
    try { payload = await res.json(); } catch {
      if (controller.signal.aborted) throw new Error('aborted');
      throw new ApiError('The server returned an unexpected response. Please try again.', { status: res.status, code: 'BAD_RESPONSE' });
    }
    if (!res.ok) {
      const error = payload?.error || {};
      // A failed login isn't an expired session. Nor may an OLD request's 401
      // erase a NEW token issued by a password change or another login.
      if (res.status === 401 && sentToken && sentToken === token()) {
        clearSession();
        window.dispatchEvent(new CustomEvent('placement:unauthorized', { detail: { message: error.message, code: error.code } }));
      }
      throw new ApiError(error.message || `Request failed (${res.status}).`, {
        status: res.status, code: error.code, fields: error.fields, hint: error.hint,
        requestId: error.requestId || payload?.requestId,
        retryAfterSeconds: error.retryAfterSeconds || Number(res.headers.get('Retry-After')) || undefined,
      });
    }
    return payload;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (controller.signal.reason === 'timeout') throw new ApiError('The server took too long to respond. Please try again.', { code: 'TIMEOUT' });
    if (controller.signal.reason === 'cancelled') {
      const e = new ApiError('Request cancelled.', { code: 'CANCELLED' }); e.cancelled = true; throw e;
    }
    throw new ApiError('Cannot reach the server. Check that the backend is running.', { code: 'NETWORK' });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}
export const api = {
  get: (p, o) => request(p, { ...o, method: 'GET' }),
  post: (p, body, o) => request(p, { ...o, method: 'POST', body }),
  put: (p, body, o) => request(p, { ...o, method: 'PUT', body }),
  patch: (p, body, o) => request(p, { ...o, method: 'PATCH', body }),
  del: (p, o) => request(p, { ...o, method: 'DELETE' }),
  upload: (p, formData, o) => request(p, { ...o, method: 'POST', formData }),
  download: (p, o) => request(p, { ...o, raw: true }),
};
export function fieldErrors(err) { return err instanceof ApiError && err.fields ? err.fields : {}; }
