import { useCallback, useState } from 'react';
import { api } from '../api/client';
import { useMeta } from '../context/MetaContext';
import { useToast } from '../components/Toast';
import { Badge, Card, EmptyState, ErrorState, Field, Loading, Modal } from '../components/ui';
import { FormError, SubmitButton } from '../components/AuthForm';
import useResource from '../hooks/useResource';

function ReviewDialog({ company, onClose, onUpdated }) {
  const { meta } = useMeta(); const toast = useToast();
  const [status, setStatus] = useState('Approved'); const [note, setNote] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState(null);
  async function submit(event) {
    event.preventDefault(); if (busy) return; setError(null);
    if (status !== 'Approved' && note.trim().length < 5) { setError({ message: 'Explain the decision in at least 5 characters.', fields: { note: 'A reason is required.' } }); return; }
    setBusy(true);
    try { const result = await api.patch(`/admin/companies/${company.id}/status`, { status, note }); toast.success(result.notice); onUpdated(); onClose(); }
    catch (err) { setError(err); } finally { setBusy(false); }
  }
  return <Modal title={`Review ${company.name}`} onClose={() => !busy && onClose()}>
    <div className="detail-grid mb-4">
      <div className="detail"><span className="detail__label">Recruiter</span><span>{company.contactPerson}</span></div>
      <div className="detail"><span className="detail__label">Contact</span><span>{company.contactEmail}</span></div>
      <div className="detail"><span className="detail__label">Website</span><span>{company.website || 'Not recorded'}</span></div>
      <div className="detail"><span className="detail__label">Location</span><span>{[company.city, company.state].filter(Boolean).join(', ') || 'Not recorded'}</span></div>
    </div>
    {company.description && <p className="text-small mb-4">{company.description}</p>}
    <form className="form" noValidate onSubmit={submit} aria-label="Company review">
      <FormError error={error} />
      <Field name="reviewStatus" label="Review decision" error={error?.fields?.status}><select id="reviewStatus" className="select" value={status} onChange={(e) => setStatus(e.target.value)} disabled={busy}>
        {meta?.companyStatuses?.filter((value) => value !== 'Pending').map((value) => <option key={value}>{value}</option>)}
      </select></Field>
      <Field name="reviewNote" label="Review note / reason" error={error?.fields?.note} hint="Required for rejection or suspension. Shown to the recruiter."><textarea id="reviewNote" className="textarea" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} disabled={busy} /></Field>
      <p className="disclaimer">Approving a company does not approve any of its jobs. Suspending recruiting access does not erase placement history.</p>
      <SubmitButton busy={busy} label="Save review decision" busyLabel="Saving decision…" />
    </form>
  </Modal>;
}
export default function AdminCompaniesPage() {
  const { meta } = useMeta(); const [status, setStatus] = useState('Pending'); const [selected, setSelected] = useState(null);
  const loader = useCallback((signal) => api.get(`/admin/companies?${new URLSearchParams({ status })}`, { signal }), [status]);
  const { data, loading, error, reload } = useResource(loader);
  return <div className="col gap-4">
    <div className="content__head"><div><h1>Company approvals</h1><p>Office verification unlocks recruiting access. New registrations always start Pending.</p></div></div>
    <Card title="Review queue" actions={<button type="button" className="btn btn--sm btn--secondary" onClick={reload} disabled={loading}>Refresh</button>}>
      <Field name="companyStatusFilter" label="Company status"><select id="companyStatusFilter" className="select" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{meta?.companyStatuses?.map((value) => <option key={value}>{value}</option>)}</select></Field>
      <p className="text-small text-muted mt-2">Showing up to 100 most recent companies.</p>
    </Card>
    {loading ? <Loading label="Loading review queue…" /> : error ? <ErrorState error={error} onRetry={reload} /> : !data.companies.length ? <Card><EmptyState icon="✓" title="No companies in this view" body="New registrations appear here when they are submitted. Change the filter to review another status." /></Card> : <Card title={`${data.companies.length} companies`}>
      <div className="table-wrap"><table className="table"><thead><tr><th>Company</th><th>Recruiter</th><th>Company approval</th><th>Login account</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
        {data.companies.map((company) => <tr key={company.id}><td><div className="table__primary">{company.name}</div><div className="table__sub">{company.city || 'Location not recorded'}</div></td>
          <td>{company.contactPerson}<div className="table__sub">{company.contactEmail}</div></td><td><Badge>{company.status}</Badge></td><td><Badge>{company.accountStatus}</Badge></td>
          <td><button type="button" className="btn btn--sm btn--primary" onClick={() => setSelected(company)} aria-label={`Review ${company.name}`}>Review</button></td></tr>)}
      </tbody></table></div>
    </Card>}
    {selected && <ReviewDialog company={selected} onClose={() => setSelected(null)} onUpdated={reload} />}
  </div>;
}
