import { useState } from 'react';
import { Field } from './ui';

export function FormError({ error }) {
  if (!error) return null;
  return <div className="alert alert--danger" role="alert"><div className="alert__body">
    <p>{error.message}</p>
    {error.retryAfterSeconds && <p className="text-small mt-2">Try again in about {Math.ceil(error.retryAfterSeconds / 60)} minute(s).</p>}
    {error.hint && <p className="text-small mt-2">{error.hint}</p>}
    {error.requestId && <p className="text-mono text-small mt-2">Reference: {error.requestId}</p>}
  </div></div>;
}
export function InputField({ name, label, value, onChange, error, hint, required, type = 'text', disabled, ...props }) {
  return <Field label={label} name={name} required={required} error={error} hint={hint}>
    <input id={name} name={name} type={type} value={value ?? ''} onChange={onChange}
      className={`input${error ? ' is-invalid' : ''}`} disabled={disabled} aria-label={label} aria-required={required} aria-invalid={Boolean(error)}
      aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined} {...props} />
  </Field>;
}
export function PasswordField({ name, label, value, onChange, error, hint, required = true, disabled, autoComplete = 'new-password' }) {
  const [visible, setVisible] = useState(false);
  return <Field label={label} name={name} required={required} error={error} hint={hint}>
    <div className="input-group">
      <input id={name} name={name} type={visible ? 'text' : 'password'} value={value} onChange={onChange}
        className={`input${error ? ' is-invalid' : ''}`} disabled={disabled} autoComplete={autoComplete} aria-label={label} aria-required={required}
        aria-invalid={Boolean(error)} aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined} />
      <button type="button" className="btn btn--secondary" disabled={disabled} aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
        aria-pressed={visible} onClick={() => setVisible((v) => !v)}>{visible ? 'Hide' : 'Show'}</button>
    </div>
  </Field>;
}
export function SubmitButton({ busy, label, busyLabel }) {
  return <button type="submit" className="btn btn--primary" disabled={busy}>{busy && <span className="btn__spinner" aria-hidden="true" />}{busy ? busyLabel || 'Please wait…' : label}</button>;
}
export function passwordError(value, policy) {
  if (!value) return 'Password is required.';
  if (Array.from(value).length < policy.minLength) return `Use at least ${policy.minLength} characters.`;
  if (new TextEncoder().encode(value).length > policy.maxBytes) return `Use at most ${policy.maxBytes} UTF-8 bytes.`;
  if (policy.requireLetter && !/[A-Za-z]/.test(value)) return 'Include at least one letter.';
  if (policy.requireNumber && !/\d/.test(value)) return 'Include at least one number.';
  return null;
}
export function policyText(policy) {
  return policy ? `${policy.minLength}+ characters, letters and numbers; maximum ${policy.maxBytes} UTF-8 bytes.` : 'Loading password requirements…';
}
