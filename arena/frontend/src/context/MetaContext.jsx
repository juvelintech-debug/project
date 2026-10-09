import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';

/**
 * App-wide server facts: the /api/meta vocabulary (roles, status enums, upload
 * limits) and the live /api/health snapshot. Pages read the vocabulary instead
 * of hardcoding it, so a label can never drift from what the backend accepts;
 * `ai.enabled` is what gates the AI buttons (plus the per-call response).
 */
const MetaContext = createContext(null);

export function MetaProvider({ children }) {
  const [meta, setMeta] = useState(null);
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [m, h] = await Promise.allSettled([api.get('/meta', { auth: false }), api.get('/health', { auth: false })]);
    if (m.status === 'fulfilled') setMeta(m.value);
    if (h.status === 'fulfilled') setHealth(h.value);
    setError(m.status === 'rejected' ? m.reason : null);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const value = useMemo(() => ({
    meta,
    health,
    error,
    loading,
    refresh,
    /** false until /api/meta says the backend has an AI provider configured */
    aiAvailable: Boolean(meta?.readiness?.aiEnabled),
    limits: meta?.limits || {},
  }), [meta, health, error, loading, refresh]);

  return <MetaContext.Provider value={value}>{children}</MetaContext.Provider>;
}

export function useMeta() {
  const ctx = useContext(MetaContext);
  if (!ctx) throw new Error('useMeta must be used inside <MetaProvider>');
  return ctx;
}
