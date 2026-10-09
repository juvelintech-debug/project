import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loading, ErrorState } from './ui';
import AccessDeniedPage from '../pages/AccessDeniedPage';
import { destinationFor, homeFor } from '../nav';

export function SessionProblem() {
  const { error, refresh, logout, signingOut } = useAuth();
  return <div className="session-problem">
    <h1 className="mb-4">We couldn’t verify your session</h1>
    <ErrorState error={error} onRetry={refresh} />
    <p className="text-muted mt-4">Protected information stays hidden until the server verifies your account. Your token is retained so you can retry after the connection recovers.</p>
    <button type="button" className="btn btn--secondary mt-4" disabled={signingOut} onClick={logout}>Sign out on this browser</button>
  </div>;
}
export default function ProtectedRoute({ roles }) {
  const { user, status } = useAuth(); const location = useLocation();
  if (status === 'checking') return <Loading label="Checking your session…" />;
  if (status === 'error') return <SessionProblem />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) return <AccessDeniedPage />;
  return <Outlet />;
}
export function PublicOnly() {
  const { user, status } = useAuth(); const location = useLocation();
  if (status === 'checking') return <div className="page-loading"><Loading label="Checking your session…" /></div>;
  if (status === 'error') return <SessionProblem />;
  if (user) return <Navigate to={destinationFor(user.role, location.state?.from)} replace />;
  return <Outlet />;
}
export function StartPage() {
  const { user, status } = useAuth();
  if (status === 'checking') return <Loading label="Checking your session…" />;
  if (status === 'error') return <SessionProblem />;
  return <Navigate to={homeFor(user?.role)} replace />;
}
