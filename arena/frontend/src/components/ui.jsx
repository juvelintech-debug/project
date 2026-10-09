/** Small shared primitives — kept intentionally tiny so pages stay readable. */
import { useEffect, useRef } from 'react';

export function Card({ title, subtitle, actions, children, footer, variant, id, as: Tag = 'section' }) {
  return (
    <Tag className={`card${variant ? ` card--${variant}` : ''}`} id={id}>
      {(title || actions) && (
        <header className="card__head">
          <div className="min-w-0">
            {title && <h2>{title}</h2>}
            {subtitle && <p className="text-muted text-small">{subtitle}</p>}
          </div>
          {actions && <div className="card__tools">{actions}</div>}
        </header>
      )}
      <div className="card__body">{children}</div>
      {footer && <footer className="card__foot">{footer}</footer>}
    </Tag>
  );
}

const STATUS_TONE = {
  neutral: 'neutral', info: 'info', pending: 'warning', approved: 'success',
  active: 'success', accepted: 'success', completed: 'success', closed: 'neutral',
  rejected: 'danger', suspended: 'danger', withdrawn: 'danger', expired: 'neutral',
  shortlisted: 'info', 'interview scheduled': 'warning', 'interview completed': 'info',
  'offer received': 'success', declined: 'danger', 'not shortlisted': 'neutral',
  draft: 'neutral', 'under review': 'warning', applied: 'info',
  student: 'brand', company: 'info', admin: 'danger',
};

export function statusTone(status) {
  if (!status) return 'neutral';
  return STATUS_TONE[String(status).toLowerCase()] || 'neutral';
}

export function Badge({ children, tone, dot = true, size }) {
  if (children == null || children === '') return null;
  const cls = `badge badge--${tone || statusTone(children)}${dot ? '' : ' badge--dotless'}${size ? ` badge--${size}` : ''}`;
  return <span className={cls}>{children}</span>;
}

export function EmptyState({ icon = '📭', title, body, action }) {
  return (
    <div className="empty">
      <div className="empty__icon" aria-hidden="true">{icon}</div>
      <div className="empty__title">{title}</div>
      {body && <div className="empty__body">{body}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Loading({ label = 'Loading…', blocks }) {
  if (blocks) {
    return (
      <div className="grid grid--auto" aria-hidden="true">
        {Array.from({ length: blocks }).map((_, i) => <div key={i} className="skeleton skeleton-card" />)}
      </div>
    );
  }
  return (
    <div className="loading-inline" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="alert alert--danger" role="alert">
      <span className="alert__icon" aria-hidden="true">!</span>
      <div className="alert__body">
        <div className="alert__title">Something went wrong</div>
        <div>{error?.message || 'Unexpected error.'}</div>
        {error?.hint && <p className="text-small mt-2">{error.hint}</p>}
        {error?.requestId && <div className="text-mono text-small mt-2">ref: {error.requestId}</div>}
      </div>
      {onRetry && <button type="button" className="btn btn--sm btn--secondary" onClick={onRetry}>Retry</button>}
    </div>
  );
}

export function Modal({ title, onClose, children, footer, wide }) {
  const boxRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusable = () => Array.from(boxRef.current?.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]') || []);
    (focusable()[0] || boxRef.current)?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current?.(); }
      if (event.key === 'Tab') {
        const items = focusable(); const first = items[0]; const last = items.at(-1);
        if (!first) { event.preventDefault(); boxRef.current?.focus(); }
        else if (event.shiftKey && (document.activeElement === first || document.activeElement === boxRef.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className={`modal${wide ? ' modal--wide' : ''}`} role="dialog" aria-modal="true" aria-label={title || 'Dialog'}
           ref={boxRef} tabIndex={-1}>
        <header className="modal__head">
          <h3>{title}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="modal__body">{children}</div>
        {footer && <footer className="modal__foot">{footer}</footer>}
      </div>
    </div>
  );
}

export function Progress({ value, max = 100, tone, label }) {
  const pct = Math.max(0, Math.min(100, Math.round((Number(value) / (Number(max) || 1)) * 100)));
  return (
    <div>
      {label && <div className="row row--between mb-2 text-small"><span>{label}</span><span className="text-strong">{pct}%</span></div>}
      <div className={`progress${tone ? ` progress--${tone}` : ''}`} role="progressbar"
           aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label || 'progress'}>
        <div className="progress__bar" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Bars({ items, emptyLabel = 'No data yet.' }) {
  if (!items?.length) return <p className="text-muted text-small">{emptyLabel}</p>;
  const max = Math.max(1, ...items.map((i) => Number(i.value) || 0));
  return (
    <div className="bars">
      {items.map((item) => (
        <div className="bars__row" key={item.label}>
          <span className="truncate" title={item.label}>{item.label}</span>
          <span className="bars__track"><span className="bars__fill" style={{ width: `${((Number(item.value) || 0) / max) * 100}%` }} /></span>
          <span className="bars__value">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

export function Field({ label, name, error, hint, required, children, className }) {
  return (
    <div className={`field${className ? ` ${className}` : ''}`}>
      {label && (
        <label className="field__label" htmlFor={name}>
          {label}{required && <span className="field__required" aria-hidden="true">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <span className="field__hint" id={`${name}-hint`}>{hint}</span>}
      {error && <span className="field__error" id={`${name}-error`} role="alert">⚠ {error}</span>}
    </div>
  );
}
