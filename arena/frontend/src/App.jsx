import { useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import AppShell from './components/AppShell';
import { PAGE_TITLES } from './nav';
import StatusPage from './pages/StatusPage';
import NotFoundPage from './pages/NotFoundPage';

/**
 * Route table.
 *
 * Phase 1 ships the shell + diagnostics only. Auth (Phase 3) will wrap these
 * routes in a RequireAuth/RoleGate and register the student, company and admin
 * workspaces; the shell and API client below are what those pages plug into.
 */
export default function App() {
  const location = useLocation();
  const [user] = useState(null); // set by AuthProvider from Phase 3

  const title = PAGE_TITLES[location.pathname] || 'Placement Portal';

  return (
    <AppShell user={user} title={title}>
      <Routes>
        <Route path="/" element={<Navigate to="/status" replace />} />
        <Route path="/status" element={<StatusPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppShell>
  );
}
