import { useCallback, useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { NAV_BY_ROLE } from '../nav';
import { useMeta } from '../context/MetaContext';
import SystemStatus from './SystemStatus';

/**
 * The responsive application frame: collapsible sidebar, topbar with the live
 * service strip, and a content region every page renders into. Navigation is
 * data-driven (see src/nav.js) and filtered by role.
 */
export default function AppShell({ user, onLogout, title, children }) {
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();
  const { health } = useMeta();

  useEffect(() => { setNavOpen(false); }, [location.pathname]);

  const role = user?.role || 'public';
  const items = NAV_BY_ROLE[role] || NAV_BY_ROLE.public;
  const sections = [...new Set(items.map((i) => i.section))];

  const closeNav = useCallback(() => setNavOpen(false), []);

  return (
      <div className={`app-shell${navOpen ? ' nav-open' : ''}`}>
        <aside className="sidebar" aria-label="Primary navigation">
          <div className="sidebar__brand">
            <div className="sidebar__logo" aria-hidden="true">SP</div>
            <div className="min-w-0">
              <div className="sidebar__title">Placement Portal</div>
              <div className="sidebar__subtitle">{role === 'public' ? 'Career Services' : `${role} workspace`}</div>
            </div>
          </div>

          <nav className="sidebar__nav">
            {sections.map((section) => (
              <div key={section}>
                <div className="sidebar__section">{section}</div>
                {items.filter((i) => i.section === section).map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) => `nav-link${isActive ? ' is-active' : ''}`}
                    onClick={closeNav}
                    end={item.end}
                  >
                    <span className="nav-link__icon" aria-hidden="true">{item.icon}</span>
                    <span className="min-w-0 truncate">{item.label}</span>
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>

          <div className="sidebar__footer">
            {user
              ? <div className="row row--between"><span className="truncate">{user.fullName}</span>
                  <button type="button" className="btn btn--sm btn--ghost" style={{ color: '#fff' }} onClick={onLogout}>Sign out</button></div>
              : <span>v{health?.version || '1'} · demo build</span>}
          </div>
        </aside>

        <div className="backdrop" onClick={closeNav} aria-hidden="true" />

        <div className="main">
          <header className="topbar">
            <button type="button" className="hamburger" onClick={() => setNavOpen((v) => !v)} aria-label="Toggle navigation" aria-expanded={navOpen}>☰</button>
            <div className="min-w-0"><div className="topbar__title truncate">{title}</div></div>
            <div className="topbar__spacer" />
            <div className="hide-sm"><SystemStatus compact /></div>
            {user && (
              <div className="topbar__user">
                <span className="avatar" aria-hidden="true">{(user.fullName || '?').slice(0, 1).toUpperCase()}</span>
                <span className="hide-sm text-small text-muted truncate">{user.email}</span>
              </div>
            )}
          </header>
          <main className="content" id="main">{children}</main>
        </div>
      </div>
  );
}
