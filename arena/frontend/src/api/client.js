import { token, clearSession } from './session';

/**
 * The only place the frontend touches the network.
 * Relative URLs → same origin (Vite proxies /api in dev, Express serves the
 * build in prod). Nothing here knows a port, a database, or an AI key.
 */

const BASE = '/api';
const DEFAULT_TIMEOUT = 20000;

export class ApiError extends Error {
  constructor(message, { status, code, fields, requestId, hint } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.requestId = requestId;
    this.hint = hint;
  }
}

/** Broadcast so the app can bounce the user to /login on revocation. */
function emitUnauthorized() {
  window.dispatchEvent(new CustomEvent('placement:unauthorized'));
}

export async function request(path, {
  method = 'GET',
  body,
  formData,
  signal,
  timeout = DEFAULT_TIMEOUT,
  headers = {},
  raw = false,
} = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), timeout);
  if (signal) signal.addEventListener('abort', () => controller.abort('cancelled'), { once: true });

  const init = { method, headers: { Accept: 'application/json', ...headers } };
  const t = token();
  if (t) init.headers.Authorization = `Bearer ${t}`;

  if (formData) init.body = formData;
  else if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, signal: controller.signal, credentials: 'same-origin' });
  } catch (err) {
    clearTimeout(timer);
    if (err?.message === 'timeout' || controller.signal.reason === 'timeout') {
      throw new ApiError('The server took too long to respond. Please try again.', { code: 'TIMEOUT' });
    }
    if (controller.signal.reason === 'cancelled') {
      const e = new ApiError('Request cancelled.', { code: 'CANCELLED' });
      e.cancelled = true;
      throw e;
    }
    throw new ApiError('Cannot reach the server. Check that the backend is running.', { code: 'NETWORK' });
  }
  clearTimeout(timer);

  if (res.status === 204) return null;

  if (raw) {
    if (!res.ok) throw new ApiError('Download failed.', { status: res.status });
    return res.blob();
  }

  const text = await res.text();
  let payload = null;
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = { message: text.slice(0, 200) }; }
  }

  if (!res.ok) {
    const err = payload?.error || {};
    if (res.status === 401) {
      clearSession();
      emitUnauthorized();
    }
    throw new ApiError(err.message || `Request failed (${res.status}).`, {
      status: res.status,
      code: err.code,
      fields: err.fields,
      hint: err.hint,
      requestId: err.requestId || payload?.requestId,
    });
  }
  return payload;
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

/** Turn a thrown error into a field-level map for forms. */
export function fieldErrors(err) {
  if (err instanceof ApiError && err.fields) return err.fields;
  return {};
}
