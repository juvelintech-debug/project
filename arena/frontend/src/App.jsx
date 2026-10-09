import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import AppShell from './components/AppShell';
import ProtectedRoute, { PublicOnly, StartPage } from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';
import { PAGE_TITLES } from './nav';
import StatusPage from './pages/StatusPage';
import NotFoundPage from './pages/NotFoundPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AccountPage from './pages/AccountPage';
import WorkspacePage from './pages/WorkspacePage';
import AdminAccountsPage from './pages/AdminAccountsPage';
import AdminCompaniesPage from './pages/AdminCompaniesPage';
import AccessDeniedPage from './pages/AccessDeniedPage';

function Shell() {
  const { user, logout, signingOut } = useAuth(); const location = useLocation();
  return <AppShell user={user} onLogout={logout} signingOut={signingOut} title={PAGE_TITLES[location.pathname] || 'Placement Portal'}>
    <Outlet key={user?.id || 'public'} />
  </AppShell>;
}
export default function App() {
  return <Routes>
    <Route element={<PublicOnly />}>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<Navigate to="/register/student" replace />} />
      <Route path="/register/student" element={<RegisterPage role="Student" key="student-registration" />} />
      <Route path="/register/company" element={<RegisterPage role="Company" key="company-registration" />} />
    </Route>
    <Route element={<Shell />}>
      <Route path="/" element={<StartPage />} />
      <Route path="/status" element={<StatusPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/account" element={<AccountPage />} />
        <Route path="/access-denied" element={<AccessDeniedPage />} />
      </Route>
      <Route element={<ProtectedRoute roles={['Student']} />}>
        <Route path="/student" element={<WorkspacePage role="Student" />} />
      </Route>
      <Route element={<ProtectedRoute roles={['Company']} />}>
        <Route path="/company" element={<WorkspacePage role="Company" />} />
      </Route>
      <Route element={<ProtectedRoute roles={['Admin']} />}>
        <Route path="/admin" element={<WorkspacePage role="Admin" />} />
        <Route path="/admin/accounts" element={<AdminAccountsPage />} />
        <Route path="/admin/companies" element={<AdminCompaniesPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Route>
  </Routes>;
}
