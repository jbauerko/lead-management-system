import { useEffect, useRef } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

type PortalMode = 'plaintiff' | 'firm' | 'admin';
const navigation = {
  plaintiff: [
    { path: 'leads', label: 'Leads' },
    { path: 'cases', label: 'Cases' },
  ],
  firm: [
    { path: 'leads', label: 'Inbox' },
    { path: 'cases', label: 'Cases' },
  ],
  admin: [
    { path: 'overview', label: 'Overview' },
    { path: 'leads', label: 'Leads' },
    { path: 'cases', label: 'Cases' },
    { path: 'activity', label: 'Activity log' },
  ],
};

/** A stable sidebar keeps navigation and account context in the same place for every role. */
export function PortalLayout({ mode = 'plaintiff' }: { mode?: PortalMode }) {
  const { user, signOut } = useAuth();
  const account = useRef<HTMLDetailsElement>(null);

  // Native details supplies keyboard activation; add outside-click and Escape dismissal.
  useEffect(() => {
    function dismiss(event: PointerEvent) {
      if (account.current && !account.current.contains(event.target as Node)) {
        account.current.open = false;
      }
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape' && account.current?.open) {
        account.current.open = false;
        account.current.querySelector('summary')?.focus();
      }
    }
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, []);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <NavLink className="brand" to={`/${mode}`}>
          LMS
        </NavLink>
        <nav aria-label="Main navigation">
          {navigation[mode].map((item) => (
            <NavLink key={item.path} to={`/${mode}/${item.path}`}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-account">
          <details className="account-menu" ref={account}>
            <summary aria-label={`Account: ${user?.name}`}>
              <strong>{user?.name}</strong>
              <span aria-hidden="true">⌃</span>
            </summary>
            <div className="account-popover">
              <button onClick={signOut}>Sign out</button>
            </div>
          </details>
          <span>
            {user?.role === 'plaintiff'
              ? 'Plaintiff'
              : user?.role === 'admin'
                ? 'Admin'
                : user?.role === 'attorney'
                  ? 'Attorney'
                  : 'Paralegal'}
          </span>
          {user?.firm_name && <span>{user.firm_name}</span>}
        </div>
      </aside>
      <main id="main" className="workspace">
        <Outlet />
      </main>
    </div>
  );
}
