/**
 * Navigation as data, filtered by role. Each phase adds its real routes here;
 * an entry only appears once the page behind it exists and works.
 */
export const NAV_BY_ROLE = {
  public: [
    { to: '/status', label: 'System status', icon: '📡', section: 'Diagnostics', end: false },
  ],
  student: [
    { to: '/status', label: 'System status', icon: '📡', section: 'Diagnostics' },
  ],
  company: [
    { to: '/status', label: 'System status', icon: '📡', section: 'Diagnostics' },
  ],
  admin: [
    { to: '/status', label: 'System status', icon: '📡', section: 'Diagnostics' },
  ],
};

export const PAGE_TITLES = {
  '/status': 'System status',
};
