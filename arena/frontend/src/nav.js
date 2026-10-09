/** Canonical role casing comes from the database and /api/meta. */
const diagnostics = { to: '/status', label: 'System status', icon: '📡', section: 'Support' };
const account = { to: '/account', label: 'Account settings', icon: '⚙', section: 'Account' };
export const HOME_BY_ROLE = { Student: '/student', Company: '/company', Admin: '/admin' };
export const homeFor = (role) => HOME_BY_ROLE[role] || '/login';
export const NAV_BY_ROLE = {
  public: [
    { to: '/login', label: 'Sign in', icon: '→', section: 'Placement Portal' },
    { to: '/register/student', label: 'Student registration', icon: '🎓', section: 'Placement Portal' },
    { to: '/register/company', label: 'Recruiter registration', icon: '▤', section: 'Placement Portal' },
    diagnostics,
  ],
  Student: [{ to: '/student', label: 'Student dashboard', icon: '◈', section: 'Your workspace', end: true }, account, diagnostics],
  Company: [{ to: '/company', label: 'Company dashboard', icon: '◈', section: 'Your workspace', end: true }, account, diagnostics],
  Admin: [
    { to: '/admin', label: 'Admin dashboard', icon: '◈', section: 'Placement office', end: true },
    { to: '/admin/accounts', label: 'Manage accounts', icon: '♙', section: 'Placement office' },
    { to: '/admin/companies', label: 'Company approvals', icon: '✓', section: 'Placement office' },
    account, diagnostics,
  ],
};
export const PAGE_TITLES = {
  '/student': 'Student dashboard', '/company': 'Company dashboard', '/admin': 'Admin dashboard',
  '/admin/accounts': 'Manage accounts', '/admin/companies': 'Company approvals', '/account': 'Account settings', '/status': 'System status',
};

/** No open redirects, and no returning a student to an admin page after login. */
export function destinationFor(role, requested) {
  const allowed = (NAV_BY_ROLE[role] || []).map((item) => item.to);
  return typeof requested === 'string' && allowed.includes(requested) ? requested : homeFor(role);
}
