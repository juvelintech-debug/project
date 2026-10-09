import { useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import { FormError, InputField, PasswordField, SubmitButton } from '../components/AuthForm';
import { useAuth } from '../context/AuthContext';
import { useMeta } from '../context/MetaContext';
import { destinationFor } from '../nav';

export default function LoginPage() {
  const { login, sessionMessage } = useAuth(); const { meta } = useMeta();
  const navigate = useNavigate(); const location = useLocation();
  const submitting = useRef(false);
  const [form, setForm] = useState({ email: '', password: '' });
  const [fields, setFields] = useState({}); const [error, setError] = useState(null); const [busy, setBusy] = useState(false);
  const change = (event) => { const { name, value } = event.target; setForm((f) => ({ ...f, [name]: value })); setFields((f) => ({ ...f, [name]: null })); };
  async function submit(event) {
    event.preventDefault(); if (submitting.current) return;
    const problems = {};
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(form.email.trim())) problems.email = 'Enter a valid email address.';
    if (!form.password) problems.password = 'Enter your password.';
    setFields(problems); setError(null); if (Object.keys(problems).length) return;
    submitting.current = true; setBusy(true);
    try {
      const user = await login(form); setForm({ email: '', password: '' });
      navigate(destinationFor(user.role, location.state?.from), { replace: true });
    } catch (err) { setError(err); setFields(err.fields || {}); } finally { submitting.current = false; setBusy(false); }
  }
  return <AuthLayout title="Welcome back" subtitle="Sign in to your placement workspace. Your account determines your access.">
    {sessionMessage && <div className="alert alert--warning mb-4" role="status">{sessionMessage}</div>}
    <form className="form" noValidate onSubmit={submit} aria-label="Sign in">
      <FormError error={error} />
      <InputField label="Email address" name="email" type="email" value={form.email} onChange={change} required error={fields.email} disabled={busy} autoComplete="username" maxLength={190} />
      <PasswordField label="Password" name="password" value={form.password} onChange={change} error={fields.password} disabled={busy} autoComplete="current-password" />
      <SubmitButton busy={busy} label="Sign in" busyLabel="Signing in…" />
    </form>
    <details className="auth__help mt-4"><summary>Forgot your password?</summary><p className="text-small text-muted mt-2">Contact the placement office to verify your identity and collect a temporary password. This portal does not send email reset links.</p></details>
    <div className="auth__footer">New here? <Link to="/register/student">Register as a student</Link><br /><Link to="/register/company">Register your company</Link></div>
    {meta?.demoMode && <details className="auth__help mt-5"><summary>Seed/demo sign-in details</summary>
      <p className="text-small text-muted mt-2">These accounts are fake and exist only after loading the demo seed.</p>
      <dl className="demo-logins">
        <dt>Student</dt><dd>aarav.sharma@student.college.edu<br /><code>Student@123</code></dd>
        <dt>Company</dt><dd>careers@northwindtech.example<br /><code>Company@123</code></dd>
        <dt>Admin</dt><dd>admin@placementcell.edu<br /><code>Admin@123</code></dd>
      </dl>
    </details>}
  </AuthLayout>;
}
