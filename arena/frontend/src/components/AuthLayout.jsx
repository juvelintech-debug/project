import { Link } from 'react-router-dom';
import { useMeta } from '../context/MetaContext';

export default function AuthLayout({ title, subtitle, children, wide = false }) {
  const { meta } = useMeta();
  return (
    <div className="auth">
      <aside className="auth__aside">
        <Link className="auth__brand" to="/login"><span className="sidebar__logo">SP</span><span>Placement Portal</span></Link>
        <span className="auth__eyebrow">Your next chapter starts here</span>
        <h1>One campus.<br />A world of possibilities.</h1>
        <p>A shared space for students, recruiters, and the placement office. The right access, for the right people.</p>
        <div className="auth__points">
          <div className="auth__point"><span aria-hidden="true">01</span><span><strong>Students</strong><br />Your own profile. Your placement journey.</span></div>
          <div className="auth__point"><span aria-hidden="true">02</span><span><strong>Recruiters</strong><br />Verified companies, office-approved opportunities.</span></div>
          <div className="auth__point"><span aria-hidden="true">03</span><span><strong>Placement office</strong><br />Account access and company approval, under your control.</span></div>
        </div>
        <p className="text-small">AI assistance is advisory. People make every hiring decision.</p>
      </aside>
      <main className="auth__panel" id="main">
        <div className={`auth__card${wide ? ' auth__card--wide' : ''}`}>
          <Link to="/login" className="auth__mobile-brand">Placement Portal</Link>
          {meta?.demoMode && <div className="alert alert--warning mb-4" role="note">Seed/demo environment. These are not real records. Use test details only.</div>}
          <h1>{title}</h1>
          <p className="text-muted mt-2 mb-5">{subtitle}</p>
          {children}
          <div className="auth__legal">Passwords stay hashed on the server. <Link to="/status">Check system status</Link></div>
        </div>
      </main>
    </div>
  );
}
