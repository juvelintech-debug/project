import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Card, Badge, ErrorState, Loading } from '../components/ui';
import useResource from '../hooks/useResource';
import { formatDate } from '../utils/format';

function Detail({ label, children }) { return <div className="detail"><div className="detail__label">{label}</div><div className="detail__value">{children ?? '—'}</div></div>; }
const statsFor = {
  Student: [['skills', 'Recorded skills'], ['applications', 'Your applications'], ['unreadNotifications', 'Unread notices']],
  Company: [['jobs', 'Your job postings'], ['approvedJobs', 'Approved postings'], ['applications', 'Applications to your jobs']],
  Admin: [['students', 'Student profiles'], ['companies', 'Companies'], ['pendingCompanies', 'Awaiting company approval'], ['activeAccounts', 'Active accounts']],
};
export default function WorkspacePage({ role }) {
  const { user, account, refresh } = useAuth();
  const companyStatus = account.company?.status;
  const loader = useCallback(async (signal) => {
    if (role === 'Company') {
      const profile = await api.get('/company/profile', { signal });
      if (profile.company.status !== 'Approved') return profile;
      const overview = await api.get('/company/overview', { signal });
      return { ...profile, stats: overview.stats };
    }
    return api.get(role === 'Student' ? '/student/overview' : '/admin/overview', { signal });
  }, [role, user.id, companyStatus]);
  const { data, error, loading, reload } = useResource(loader);
  const doRefresh = () => { refresh(); reload(); };
  const pending = role === 'Company' && data?.company?.status !== 'Approved';
  return <div className="col gap-4">
    <div className="workspace-welcome">
      <div><span className="workspace-welcome__eyebrow">{role === 'Admin' ? 'Placement office' : 'Your placement workspace'}</span><h1>Hello, {user.fullName.split(' ')[0]}.</h1>
        <p>{role === 'Admin' ? 'Keep account access and recruiter verification under control.' : role === 'Company' ? 'Your company registration and recruiting access, in one place.' : 'Your account is verified. This workspace shows only your own records.'}</p></div>
      <Badge tone="brand" size="lg" dot={false}>{role}</Badge>
    </div>
    <div className="row row--between"><p className="text-small text-muted">Live database records · no hiring decisions made by AI</p><button type="button" className="btn btn--sm btn--secondary" onClick={doRefresh} disabled={loading}>Refresh{role === 'Company' ? ' approval status' : ''}</button></div>
    {loading ? <Loading label="Loading your workspace…" /> : error ? <ErrorState error={error} onRetry={reload} /> : <>
      {pending && <div className={`alert alert--${data.company.status === 'Pending' ? 'warning' : 'danger'}`} role="status"><div className="alert__body">
        <div className="alert__title">{data.company.status === 'Pending' ? 'Waiting for placement-office approval' : `Company ${data.company.status.toLowerCase()}`}</div>
        <p>{data.notice}</p>{data.company.reviewNote && <p className="mt-2">Office note: {data.company.reviewNote}</p>}
        <p className="text-small mt-2">You can use your account settings. Recruiting data is blocked by the API until approval.</p>
      </div></div>}
      {data?.stats && <div className="grid grid--auto">{statsFor[role].map(([key, label]) => <div className="stat" key={key}><span className="stat__label">{label}</span><span className="stat__value">{data.stats[key]}</span><span className="stat__hint">From the placement database</span></div>)}</div>}
      {role === 'Student' && <Card title="Your registered student profile"><div className="detail-grid">
        <Detail label="Full name">{user.fullName}</Detail><Detail label="College roll number">{data.student.rollNumber}</Detail><Detail label="Program">{data.student.program}</Detail>
        <Detail label="Department">{data.student.department}</Detail><Detail label="Graduation year">{data.student.graduationYear}</Detail><Detail label="Placement status"><Badge>{data.student.placementStatus}</Badge></Detail>
        <Detail label="CGPA">{data.student.cgpa ?? 'Not recorded'}</Detail><Detail label="Resume record">{data.student.resume?.fileName || 'No resume recorded'}</Detail>
      </div></Card>}
      {role === 'Company' && <Card title={data.company.name} subtitle="Your own company registration."><div className="detail-grid">
        <Detail label="Approval status"><Badge>{data.company.status}</Badge></Detail><Detail label="Recruiting access">{pending ? 'Blocked until approval' : 'Approved company'}</Detail>
        <Detail label="Recruiter">{data.company.contactPerson}</Detail><Detail label="Contact email">{data.company.contactEmail}</Detail>
        <Detail label="Location">{[data.company.city, data.company.state].filter(Boolean).join(', ') || 'Not recorded'}</Detail><Detail label="Website">{data.company.website || 'Not recorded'}</Detail>
        <Detail label="Last reviewed">{formatDate(data.company.reviewedAt, { withTime: true })}</Detail>
      </div><p className="disclaimer mt-4">Company approval does not approve its job postings. Each job needs a separate placement-office review before student visibility.</p></Card>}
      {role === 'Admin' && <div className="grid grid--2">
        <Card title="Account access" subtitle="Review accounts, suspend access, or reset a password after identity verification."><Link className="btn btn--primary" to="/admin/accounts">Manage accounts</Link></Card>
        <Card title="Company verification" subtitle="Review recruiter registrations. The API enforces approval before recruiting access."><Link className="btn btn--primary" to="/admin/companies">Review companies</Link></Card>
      </div>}
      <Card title="Account settings" variant="flat"><div className="row row--between"><p className="text-small text-muted">{user.email} · <Badge>{user.status}</Badge></p><Link className="btn btn--secondary" to="/account">Manage my account</Link></div></Card>
    </>}
  </div>;
}
