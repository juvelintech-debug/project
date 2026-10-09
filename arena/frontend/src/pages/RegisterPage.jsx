import { useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import { FormError, InputField, PasswordField, SubmitButton, passwordError, policyText } from '../components/AuthForm';
import { Field, ErrorState, Loading } from '../components/ui';
import { useMeta } from '../context/MetaContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { homeFor } from '../nav';

const empty = { fullName: '', email: '', password: '', confirmPassword: '', rollNumber: '', program: 'B.Sc. Information Technology',
  batchStartYear: '', graduationYear: '', contactPerson: '', companyName: '', website: '', city: '', state: '', contactPhone: '', companySize: '' };

/** Shared form primitives, but two distinct fixed-role registration workflows. */
export default function RegisterPage({ role }) {
  const recruiter = role === 'Company'; const { meta, error: metaError, loading, refresh } = useMeta();
  const { register } = useAuth(); const toast = useToast(); const navigate = useNavigate();
  const submitting = useRef(false);
  const [form, setForm] = useState(empty); const [fields, setFields] = useState({}); const [error, setError] = useState(null); const [busy, setBusy] = useState(false);
  const policy = meta?.auth?.passwordPolicy;
  const change = (event) => { const { name, value } = event.target; setForm((f) => ({ ...f, [name]: value })); setFields((f) => ({ ...f, [name]: null })); };
  const input = (name, label, options = {}) => <InputField name={name} label={label} value={form[name]} onChange={change} error={fields[name]} disabled={busy} {...options} />;
  function validate() {
    const issues = {};
    const required = recruiter ? { contactPerson: 'Recruiter name', companyName: 'Company name' } : { fullName: 'Full name', rollNumber: 'Roll number', program: 'Program', graduationYear: 'Graduation year' };
    for (const [key, label] of Object.entries(required)) if (!form[key].trim()) issues[key] = `${label} is required.`;
    for (const key of recruiter ? ['contactPerson', 'companyName'] : ['fullName']) if (form[key].trim() && Array.from(form[key].trim()).length < 2) issues[key] = 'Use at least 2 characters.';
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(form.email.trim())) issues.email = 'Enter a valid email address.';
    const passwordIssue = passwordError(form.password, policy); if (passwordIssue) issues.password = passwordIssue;
    if (!form.confirmPassword || form.confirmPassword !== form.password) issues.confirmPassword = 'The two passwords must match.';
    if (!recruiter) {
      if (form.rollNumber.trim().length < 3) issues.rollNumber = 'Use at least 3 characters.';
      const graduation = Number(form.graduationYear); const batch = Number(form.batchStartYear);
      if (!Number.isInteger(graduation) || graduation < 2000 || graduation > 2100) issues.graduationYear = 'Enter a whole year between 2000 and 2100.';
      if (form.batchStartYear && (!Number.isInteger(batch) || batch < 1990 || batch > graduation)) issues.batchStartYear = 'Start year must be 1990 or later and not after graduation.';
    } else if (form.website.trim()) {
      try { const url = new URL(form.website.trim()); if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) throw new Error(); }
      catch { issues.website = 'Use a complete http:// or https:// URL without credentials.'; }
    }
    return issues;
  }
  async function submit(event) {
    event.preventDefault(); if (submitting.current || !policy) return;
    const issues = validate(); setFields(issues); setError(null); if (Object.keys(issues).length) return;
    submitting.current = true; setBusy(true);
    const keys = recruiter ? ['contactPerson', 'companyName', 'website', 'city', 'state', 'contactPhone', 'companySize']
      : ['fullName', 'rollNumber', 'program', 'batchStartYear', 'graduationYear'];
    const body = Object.fromEntries(['email', 'password', 'confirmPassword', ...keys].map((key) => [key, form[key]]));
    try {
      const user = await register({ ...body, role });
      setForm(empty); toast.success(recruiter ? 'Company registered. Recruiting access awaits placement-office approval.' : 'Student account created. You are signed in.');
      navigate(homeFor(user.role), { replace: true });
    } catch (err) { setError(err); setFields(err.fields || {}); } finally { submitting.current = false; setBusy(false); }
  }
  return <AuthLayout wide title={recruiter ? 'Register your company' : 'Create your student account'}
    subtitle={recruiter ? 'Introduce your organisation to the placement office. Recruiting access starts only after approval.' : 'A secure login linked to your own academic profile.'}>
    <nav className="auth__tabs" aria-label="Registration type">
      <NavLink to="/register/student" className={({ isActive }) => `auth__tab${isActive ? ' is-active' : ''}`} aria-disabled={busy} onClick={(e) => busy && e.preventDefault()}>Student</NavLink>
      <NavLink to="/register/company" className={({ isActive }) => `auth__tab${isActive ? ' is-active' : ''}`} aria-disabled={busy} onClick={(e) => busy && e.preventDefault()}>Company / recruiter</NavLink>
    </nav>
    {loading ? <Loading label="Loading registration requirements…" /> : metaError || !policy ? <ErrorState error={metaError || { message: 'Registration requirements could not be loaded.' }} onRetry={refresh} /> :
      <form className="form" noValidate onSubmit={submit} aria-label={recruiter ? 'Company registration' : 'Student registration'}>
        <FormError error={error} />
        {recruiter ? <>{input('contactPerson', 'Recruiter name', { required: true, autoComplete: 'name', maxLength: 150 })}{input('companyName', 'Company name', { required: true, autoComplete: 'organization', maxLength: 150 })}</>
          : input('fullName', 'Full name', { required: true, autoComplete: 'name', maxLength: 150 })}
        {input('email', 'Email address', { type: 'email', required: true, autoComplete: 'username', maxLength: 190 })}
        <div className="form__row">
          <PasswordField name="password" label="Password" value={form.password} onChange={change} disabled={busy} error={fields.password} hint={policyText(policy)} />
          <PasswordField name="confirmPassword" label="Confirm password" value={form.confirmPassword} onChange={change} disabled={busy} error={fields.confirmPassword} />
        </div>
        {recruiter ? <>
          {input('website', 'Company website', { type: 'url', placeholder: 'https://your-company.example', maxLength: 255 })}
          <div className="form__row">{input('city', 'City', { autoComplete: 'address-level2', maxLength: 80 })}{input('state', 'State', { autoComplete: 'address-level1', maxLength: 80 })}</div>
          <div className="form__row">{input('contactPhone', 'Contact phone', { type: 'tel', autoComplete: 'tel', maxLength: 20 })}
            <Field name="companySize" label="Company size" error={fields.companySize}><select className="select" id="companySize" name="companySize" value={form.companySize} onChange={change} disabled={busy}>
              <option value="">Not specified</option>{meta.companySizes?.filter((size) => size !== 'Unspecified').map((size) => <option key={size}>{size}</option>)}
            </select></Field>
          </div>
          <div className="alert alert--info">Registration never approves a company or a job. The placement office reviews them separately.</div>
        </> : <>
          <div className="form__row">{input('rollNumber', 'College roll number', { required: true, maxLength: 30 })}{input('program', 'Program', { required: true, maxLength: 60 })}</div>
          <div className="form__row">{input('batchStartYear', 'Batch start year', { type: 'number', min: 1990, max: 2100, step: 1, hint: 'Optional; defaults to graduation year minus 3.' })}
            {input('graduationYear', 'Graduation year', { required: true, type: 'number', min: 2000, max: 2100, step: 1 })}
          </div>
        </>}
        <SubmitButton busy={busy} label={recruiter ? 'Register company' : 'Create student account'} busyLabel="Creating account…" />
        <p className="text-small text-muted">Placement-office accounts are created by an authorised administrator bootstrap, never through public registration.</p>
      </form>}
    <div className="auth__footer">Already have an account? <Link to="/login">Sign in</Link></div>
  </AuthLayout>;
}
