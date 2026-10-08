import { useMeta } from '../context/MetaContext';

const TONE_FOR = { ok: 'success', down: 'danger', degraded: 'warning' };

/**
 * Always-visible readiness strip. It is deliberately derived from the backend's
 * own answers (/api/health) so a reviewer can trust it: if the database or the
 * AI provider is unreachable, that is stated here instead of failing silently
 * inside a page.
 */
export default function SystemStatus({ compact = false }) {
  const { health, loading, error, refresh } = useMeta();

  if (loading) return <span className="text-muted text-small">Checking services…</span>;

  const checks = [
    { key: 'api', label: 'API', status: 'ok' },
    { key: 'database', label: 'Database', status: health?.database?.status, hint: health?.database?.reason },
    { key: 'ai', label: 'AI', status: health?.ai?.configured ? 'ok' : 'degraded', hint: health?.ai?.configured ? null : 'no provider key configured' },
  ];
  const unhealthy = checks.filter((c) => c.status !== 'ok');
  const overall = error ? 'down' : unhealthy.length === 0 ? 'ok' : unhealthy.some((c) => c.status === 'down') ? 'down' : 'degraded';
  const tone = TONE_FOR[overall] || 'neutral';

  return (
    <div className="row gap-2">
      <span className={`badge badge--${tone}`}>
        {overall === 'ok' ? 'All services ready' : overall === 'degraded' ? 'Running with limits' : 'Service unavailable'}
      </span>
      {!compact && unhealthy.map((c) => (
        <span key={c.key} className="badge badge--dotless badge--neutral" title={c.hint || ''}>
          {c.label}: {c.status}
        </span>
      ))}
      <button type="button" className="btn btn--sm btn--ghost" onClick={refresh} title="Re-check now">↻</button>
    </div>
  );
}
