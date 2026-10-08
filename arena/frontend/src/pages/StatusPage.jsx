import { useMeta } from '../context/MetaContext';
import { Card, EmptyState, Loading, Badge } from '../components/ui';
import { formatDate } from '../utils/format';

function Row({ label, value }) {
  return (
    <div className="detail">
      <div className="detail__label">{label}</div>
      <div className="detail__value">{value ?? '—'}</div>
    </div>
  );
}

/**
 * Diagnostics page — the first working screen of the application. It proves the
 * wiring the rest of the build depends on: the frontend can reach the API, the
 * API can reach MySQL, and the AI provider is or is not configured.
 */
export default function StatusPage() {
  const { meta, health, loading, error, refresh } = useMeta();

  if (loading) return <Loading label="Contacting the API…" blocks={4} />;
  if (error) {
    return (
      <Card title="API unreachable">
        <EmptyState
          icon="🔌"
          title="The frontend could not talk to the backend"
          body={error.message}
          action={<button type="button" className="btn btn--primary" onClick={refresh}>Try again</button>}
        />
      </Card>
    );
  }

  const db = health?.database || {};
  const ai = health?.ai || {};
  const dbOk = db.status === 'ok';

  return (
    <div className="col gap-4">
      <div className="grid grid--auto">
        <div className="stat">
          <span className="stat__label">API</span>
          <span className="stat__value" style={{ fontSize: '1.1rem' }}>Express {health?.uptimeSeconds != null ? `${Math.round(health.uptimeSeconds)}s up` : 'online'}</span>
          <span className="stat__hint">{health?.environment} · v{health?.version}</span>
        </div>
        <div className="stat">
          <span className="stat__label">Database</span>
          <span className="stat__value" style={{ fontSize: '1.1rem' }}>{dbOk ? 'Connected' : 'Not reachable'}</span>
          <span className="stat__hint">{db.client}{db.latencyMs != null ? ` · ${db.latencyMs} ms` : ''}</span>
        </div>
        <div className="stat">
          <span className="stat__label">AI provider</span>
          <span className="stat__value" style={{ fontSize: '1.1rem' }}>{ai.configured ? 'Configured' : 'Not configured'}</span>
          <span className="stat__hint">{ai.provider}{ai.configured ? ` · ${ai.model}` : ' · advisory features disabled'}</span>
        </div>
        <div className="stat">
          <span className="stat__label">Last checked</span>
          <span className="stat__value" style={{ fontSize: '1.1rem' }}>{formatDate(health?.timestamp, { withTime: true })}</span>
          <span className="stat__hint"><button type="button" className="btn btn--sm btn--secondary" onClick={refresh}>Refresh</button></span>
        </div>
      </div>

      <Card title="Database readiness" subtitle="Everything from Phase 2 onwards needs this connection.">
        <div className="detail-grid">
          <Row label="Status" value={<Badge tone={dbOk ? 'success' : 'danger'} dot={false}>{db.status}</Badge>} />
          <Row label="Client" value={db.client} />
          <Row label="Schema" value={db.database || '—'} />
          <Row label="Detail" value={db.message || db.error || db.reason || '—'} />
        </div>
        {!dbOk && (
          <div className="alert alert--warning mt-4">
            <span className="alert__icon" aria-hidden="true">⚠</span>
            <div className="alert__body">
              <div className="alert__title">MySQL is not running yet</div>
              <p className="text-small">Start a local MySQL/MariaDB server and run the setup commands from <code>arena/README.md</code>.
                The API stays up on purpose: auth, jobs and applications all need SQL, but the shell, diagnostics and error handling must not depend on them.</p>
            </div>
          </div>
        )}
      </Card>

      <Card title="Contract vocabulary" subtitle="Served by GET /api/meta — the UI renders these lists instead of hardcoding them, so labels can never drift from what the API accepts.">
        <div className="grid grid--3">
          <div>
            <div className="detail__label mb-2">Roles</div>
            <div className="chips">{meta?.roles?.map((r) => <Badge key={r} tone="brand" dot={false}>{r}</Badge>)}</div>
          </div>
          <div>
            <div className="detail__label mb-2">Company status</div>
            <div className="chips">{meta?.companyStatuses?.map((r) => <Badge key={r} dot={false}>{r}</Badge>)}</div>
          </div>
          <div>
            <div className="detail__label mb-2">Job status</div>
            <div className="chips">{meta?.jobStatuses?.map((r) => <Badge key={r} dot={false}>{r}</Badge>)}</div>
          </div>
        </div>
        <hr />
        <div className="detail__label mb-2">Application pipeline</div>
        <div className="chips">
          {meta?.applicationStatuses?.map((name, i) => (
            <span key={name} className="badge badge--dotless badge--neutral" title={`Pipeline step ${i + 1}`}>
              <span className="text-mono">{i + 1}</span> {name}
            </span>
          ))}
        </div>
        <div className="row row--between mt-4 text-small text-muted">
          <span>Upload limit: {meta?.limits?.maxResumeMb} MB · types {(meta?.limits?.allowedResumeTypes || []).join(', ')}</span>
          <span>AI quota: {meta?.limits?.aiDailyQuota}/student/day</span>
        </div>
      </Card>

      <Card title="Request trace" variant="flat">
        <p className="text-small text-muted">
          Every response carries a <code>requestId</code> and every error is normalised to
          <code>{' { error: { code, message, requestId } }'}</code>. The page you are looking at is rendered from live API responses —
          open DevTools → Network to see them.
        </p>
      </Card>
    </div>
  );
}
