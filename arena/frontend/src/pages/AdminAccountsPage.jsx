import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useMeta } from '../context/MetaContext';
import { useToast } from '../components/Toast';
import { Badge, Card, EmptyState, ErrorState, Field, Loading, Modal } from '../components/ui';
import { FormError, PasswordField, SubmitButton, passwordError, policyText } from '../components/AuthForm';
import useResource from '../hooks/useResource';
import { formatDate } from '../utils/format';

function AccountDialog({ entry, onClose, onUpdated }) {
  const { user } = useAuth(); const { meta } = useMeta(); const toast = useToast();
  const [status, setStatus] = useState(entry.status); const [note, setNote] = useState('');
  const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [error, setError] = useState(null); const [busy, setBusy] = useState(false);
  const loader = useCallback((signal) => api.get(`/admin/accounts/${entry.id}`, { signal }), [entry.id]);
  const detail = useResource(loader); const policy = meta?.auth?.passwordPolicy;
  async function save(event, resetPassword = false) {
    event.preventDefault(); if (busy) return; setError(null);
    if (resetPassword) {
      const issue = policy && passwordError(password, policy);
      if (!policy || issue || password !== confirm) { setError({ message: issue || 'The passwords must match.', fields: { newPassword: issue, confirmPassword: password !== confirm ? 'Passwords must match.' : null } }); return; }
    } else if (status !== 'Active' && note.trim().length < 5) { setError({ message: 'Give a reason of at least 5 characters.', fields: { note: 'Give a clear reason.' } }); return; }
    setBusy(true);
    try {
      const result = resetPassword ? await api.post(`/admin/accounts/${entry.id}/password`, { newPassword: password })
        : await api.patch(`/admin/accounts/${entry.id}/status`, { status, note });
      setPassword(''); setConfirm(''); toast.success(result.notice); onUpdated(); onClose();
    } catch (err) { setError(err); } finally { setBusy(false); }
  }
  return <Modal title={`Manage ${entry.fullName}`} onClose={() => !busy && onClose()} wide>
    <div className="col gap-4">
      <div className="row"><Badge>{entry.role}</Badge><span>{entry.email}</span></div>
      {detail.loading ? <Loading label="Reading account…" /> : detail.error ? <ErrorState error={detail.error} onRetry={detail.reload} /> : <div className="detail-grid">
        <div className="detail"><span className="detail__label">Created</span><span>{formatDate(detail.data.user.createdAt)}</span></div>
        {detail.data.student && <div className="detail"><span className="detail__label">Student profile</span><span>{detail.data.student.rollNumber} · {detail.data.student.program}</span></div>}
        {detail.data.company && <div className="detail"><span className="detail__label">Company</span><span>{detail.data.company.name} · {detail.data.company.status}</span></div>}
      </div>}
      <FormError error={error} />
      {entry.id === user.id ? <div className="alert alert--info">This is your own account. <Link to="/account" onClick={onClose}>Use account settings</Link> to change your password.</div> : <>
        {entry.role !== 'Admin' ? <form className="form" noValidate onSubmit={(e) => save(e)} aria-label="Account status">
          <Field name="accountStatus" label="Account status" error={error?.fields?.status}><select id="accountStatus" className="select" value={status} onChange={(e) => setStatus(e.target.value)} disabled={busy}>
            {meta?.accountStatuses?.map((value) => <option key={value}>{value}</option>)}
          </select></Field>
          <Field name="accountNote" label="Reason / note" error={error?.fields?.note} hint="Required when making an account inactive or suspended. The holder receives this note.">
            <textarea id="accountNote" className="textarea" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} disabled={busy} />
          </Field>
          <SubmitButton busy={busy} label="Update account status" busyLabel="Updating…" />
        </form> : <p className="disclaimer">Admin accounts cannot be disabled through this portal.</p>}
        <hr />
        <form className="form" noValidate onSubmit={(e) => save(e, true)} aria-label="Reset account password">
          <h3>Placement-office password reset</h3><p className="text-small text-muted">Verify identity first. Deliver the temporary password in person. No email is sent, and all previous sessions are revoked.</p>
          <PasswordField name="newPassword" label="Temporary password" value={password} onChange={(e) => setPassword(e.target.value)} hint={policyText(policy)} disabled={busy} error={error?.fields?.newPassword} />
          <PasswordField name="confirmPassword" label="Confirm temporary password" value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={busy} error={error?.fields?.confirmPassword} />
          <SubmitButton busy={busy || !policy} label="Reset password" busyLabel="Resetting…" />
        </form>
      </>}
    </div>
  </Modal>;
}
export default function AdminAccountsPage() {
  const { meta } = useMeta(); const [filters, setFilters] = useState({ q: '', role: '', status: '' });
  const [query, setQuery] = useState({ q: '', role: '', status: '', offset: 0 }); const [selected, setSelected] = useState(null);
  const loader = useCallback((signal) => api.get(`/admin/accounts?${new URLSearchParams({ ...query, limit: 25 })}`, { signal }), [query]);
  const { data, error, loading, reload } = useResource(loader);
  return <div className="col gap-4">
    <div className="content__head"><div><h1>Manage accounts</h1><p>Account status controls sign-in. Company approval is a separate gate.</p></div></div>
    <Card title="Find an account"><form className="filters" onSubmit={(e) => { e.preventDefault(); setQuery({ ...filters, offset: 0 }); }} aria-label="Account filters">
      <Field name="accountSearch" label="Search"><input className="input" id="accountSearch" value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} maxLength={190} placeholder="Name, email, roll number or company" /></Field>
      <Field name="roleFilter" label="Role"><select className="select" id="roleFilter" value={filters.role} onChange={(e) => setFilters((f) => ({ ...f, role: e.target.value }))}><option value="">All roles</option>{meta?.roles?.map((role) => <option key={role}>{role}</option>)}</select></Field>
      <Field name="statusFilter" label="Status"><select className="select" id="statusFilter" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}><option value="">All statuses</option>{meta?.accountStatuses?.map((value) => <option key={value}>{value}</option>)}</select></Field>
      <button className="btn btn--primary" type="submit" disabled={loading}>Apply filters</button>
    </form></Card>
    {loading ? <Loading label="Loading accounts…" /> : error ? <ErrorState error={error} onRetry={reload} /> : <Card title={`${data.total} matching accounts`} actions={<button type="button" className="btn btn--sm btn--secondary" onClick={reload}>Refresh</button>}>
      {!data.accounts.length ? <EmptyState title="No matching accounts" body="Try a different search or filter." /> : <div className="table-wrap"><table className="table"><thead><tr><th>Account</th><th>Role</th><th>Status</th><th>Profile</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
        {data.accounts.map((entry) => <tr key={entry.id}><td><div className="table__primary">{entry.fullName}</div><div className="table__sub">{entry.email}</div></td><td><Badge>{entry.role}</Badge></td><td><Badge>{entry.status}</Badge></td>
          <td>{entry.rollNumber || entry.companyName || 'Placement office'}{entry.companyStatus && <div><Badge>{entry.companyStatus}</Badge></div>}</td><td><button type="button" className="btn btn--sm btn--secondary" onClick={() => setSelected(entry)} aria-label={`Manage ${entry.fullName}`}>Manage</button></td></tr>)}
      </tbody></table></div>}
      <div className="row row--between mt-4"><span className="text-small text-muted">{data.total ? query.offset + 1 : 0}–{Math.min(query.offset + data.accounts.length, data.total)} of {data.total}</span>
        <div className="btn-group"><button type="button" className="btn btn--sm btn--secondary" disabled={query.offset === 0} onClick={() => setQuery((q) => ({ ...q, offset: Math.max(0, q.offset - 25) }))}>Previous</button>
          <button type="button" className="btn btn--sm btn--secondary" disabled={query.offset + 25 >= data.total} onClick={() => setQuery((q) => ({ ...q, offset: q.offset + 25 }))}>Next</button></div>
      </div>
    </Card>}
    {selected && <AccountDialog entry={selected} onClose={() => setSelected(null)} onUpdated={reload} />}
  </div>;
}
