import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);

let seq = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) { clearTimeout(timer); timers.current.delete(id); }
  }, []);

  const push = useCallback((message, { type = 'info', title, duration } = {}) => {
    const id = ++seq;
    setToasts((list) => [...list.slice(-3), { id, type, title, message }]);
    timers.current.set(id, setTimeout(() => dismiss(id), duration ?? (type === 'error' ? 8000 : 4500)));
    return id;
  }, [dismiss]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const value = useMemo(() => ({
    push,
    dismiss,
    success: (m, o) => push(m, { ...o, type: 'success' }),
    error: (m, o) => push(m, { ...o, type: 'error' }),
    info: (m, o) => push(m, { ...o, type: 'info' }),
    warning: (m, o) => push(m, { ...o, type: 'warning' }),
  }), [push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.type}`}>
            <span aria-hidden="true">{t.type === 'success' ? '✓' : t.type === 'error' ? '!' : t.type === 'warning' ? '⚠' : 'i'}</span>
            <div className="flex-1 min-w-0">
              {t.title && <div className="text-strong">{t.title}</div>}
              <div>{t.message}</div>
            </div>
            <button type="button" className="toast__close" onClick={() => dismiss(t.id)} aria-label="Dismiss notification">×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
