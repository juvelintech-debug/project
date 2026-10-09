import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMeta } from '../context/MetaContext';
import { useToast } from '../components/Toast';
import { Card, Badge } from '../components/ui';
import { InputField, PasswordField, FormError, SubmitButton, passwordError, policyText } from '../components/AuthForm';
import { formatDate } from '../utils/format';

export default function AccountPage() {
  const { user, account, updateName, changePassword } = useAuth(); const { meta } = useMeta(); const toast = useToast();
  const policy = meta?.auth?.passwordPolicy;
  const [fullName, setFullName] = useState(user.fullName); const [nameBusy, setNameBusy] = useState(false); const [nameError, setNameError] = useState(null);
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordBusy, setPasswordBusy] = useState(false); const [passwordFailure, setPasswordFailure] = useState(null); const [fields, setFields] = useState({});
  useEffect(() => { setFullName(user.fullName); }, [user.fullName]);
  async function saveName(event) {
    event.preventDefault(); if (nameBusy) return; setNameError(null);
    if (Array.from(fullName.trim()).length < 2) { setNameError({ message: 'Full name must contain at least 2 characters.', fields: { fullName: 'Use at least 2 characters.' } }); return; }
    setNameBusy(true);
    try { const result = await updateName(fullName); toast.success(result.notice); } catch (err) { setNameError(err); } finally { setNameBusy(false); }
  }
  async function savePassword(event) {
    event.preventDefault(); if (passwordBusy || !policy) return; setPasswordFailure(null);
    const problems = {};
    if (!passwords.currentPassword) problems.currentPassword = 'Enter your current password.';
    const issue = passwordError(passwords.newPassword, policy); if (issue) problems.newPassword = issue;
    if (!passwords.confirmPassword || passwords.newPassword !== passwords.confirmPassword) problems.confirmPassword = 'The two new passwords must match.';
    setFields(problems); if (Object.keys(problems).length) return;
    setPasswordBusy(true);
    try { const result = await changePassword(passwords); setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' }); toast.success(result.notice); }
    catch (err) { setPasswordFailure(err); setFields(err.fields || {}); } finally { setPasswordBusy(false); }
  }
  return <div className="col gap-4">
    <div className="content__head"><div><h1>Your account</h1><p>Manage your sign-in details, without changing your role or permissions.</p></div><Badge size="lg">{user.role}</Badge></div>
    <Card title="Account identity"><div className="detail-grid">
      <div className="detail"><div className="detail__label">Email</div><div className="detail__value">{user.email}</div></div>
      <div className="detail"><div className="detail__label">Status</div><div className="detail__value"><Badge>{user.status}</Badge></div></div>
      <div className="detail"><div className="detail__label">Session expires</div><div className="detail__value">{formatDate(account.auth?.expiresAt, { withTime: true })}</div></div>
    </div></Card>
    <div className="grid grid--2">
      <Card title="Display name" subtitle="Only your own display name can be changed here.">
        <form className="form" noValidate onSubmit={saveName} aria-label="Display name">
          <FormError error={nameError} />
          <InputField name="fullName" label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required disabled={nameBusy} maxLength={150} error={nameError?.fields?.fullName} />
          <SubmitButton busy={nameBusy} label="Save display name" busyLabel="Saving…" />
        </form>
      </Card>
      <Card title="Change password" subtitle="This ends all previous sessions. This browser receives a new token.">
        <form className="form" noValidate onSubmit={savePassword} aria-label="Change password">
          <FormError error={passwordFailure} />
          {['currentPassword', 'newPassword', 'confirmPassword'].map((name) => <PasswordField key={name} name={name}
            label={{ currentPassword: 'Current password', newPassword: 'New password', confirmPassword: 'Confirm new password' }[name]}
            value={passwords[name]} onChange={(e) => setPasswords((p) => ({ ...p, [name]: e.target.value }))} disabled={passwordBusy}
            error={fields[name]} hint={name === 'newPassword' ? policyText(policy) : null} autoComplete={name === 'currentPassword' ? 'current-password' : 'new-password'} />)}
          <SubmitButton busy={passwordBusy || !policy} label="Change password" busyLabel={policy ? 'Updating…' : 'Loading requirements…'} />
        </form>
      </Card>
    </div>
    <p className="disclaimer">Sign out revokes every previous token issued to this account. On a shared computer, always sign out before leaving. If the server is unreachable, only this browser’s stored session can be cleared.</p>
  </div>;
}
