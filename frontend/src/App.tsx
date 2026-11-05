import type { Role } from './api/client';
import { AdminDetail } from './pages/AdminDetail';
import { FirmList } from './pages/FirmList';
import { FirmDetail } from './pages/FirmDetail';
import { homeFor } from './auth/routes';
import { WorkList } from './pages/WorkList';
import { NewLead } from './pages/NewLead';
import { WorkDetail } from './pages/WorkDetail';
import { Navigate, Outlet, Route, Routes, useLocation, Link } from 'react-router-dom';
import { useAuth } from './auth/AuthProvider';
import { PortalLayout } from './components/PortalLayout';
import { LoginPage } from './pages/LoginPage';

/** These guards guide navigation; backend services enforce actual data access. */
function Guard({ roles }: { roles?: Role[] }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={homeFor(user.role)} replace />;
  }
  return <Outlet />;
}

function Workspace() {
  const { user } = useAuth();
  return <Navigate to={user ? homeFor(user.role) : '/login'} replace />;
}
/** Wait for session restoration before choosing any protected route. */
export function App() {
  const auth = useAuth();
  if (auth.loading) {
    return (
      <main className="container" role="status">
        Checking your sign-in…
      </main>
    );
  }
  if (auth.error) {
    return (
      <main className="container">
        <p role="alert">{auth.error}</p>
        <button className="button" onClick={auth.retry}>
          Try again
        </button>{' '}
        <button className="button" onClick={auth.signOut}>
          Return to sign in
        </button>
      </main>
    );
  }
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<Guard />}>
        <Route path="/workspace" element={<Workspace />} />
        <Route element={<Guard roles={['plaintiff']} />}>
          <Route path="/plaintiff" element={<PortalLayout />}>
            <Route index element={<Navigate to="leads" replace />} />
            <Route path="leads" element={<WorkList kind="leads" />} />
            <Route path="leads/new" element={<NewLead />} />
            <Route path="leads/:leadId" element={<WorkDetail kind="leads" />} />
            <Route path="cases" element={<WorkList kind="cases" />} />
            <Route path="cases/:caseId" element={<WorkDetail kind="cases" />} />
          </Route>
        </Route>
        <Route element={<Guard roles={['attorney', 'paralegal']} />}>
          <Route path="/firm" element={<PortalLayout mode="firm" />}>
            <Route index element={<Navigate to="leads" replace />} />
            <Route path="leads" element={<FirmList kind="leads" />} />
            <Route path="leads/:leadId" element={<FirmDetail kind="leads" />} />
            <Route path="cases" element={<FirmList kind="cases" />} />
            <Route path="cases/:caseId" element={<FirmDetail kind="cases" />} />
          </Route>
        </Route>
        <Route element={<Guard roles={['admin']} />}>
          <Route path="/admin" element={<PortalLayout mode="admin" />}>
            <Route index element={<Navigate to="leads" replace />} />
            <Route path="leads" element={<FirmList kind="leads" admin />} />
            <Route path="leads/:leadId" element={<AdminDetail kind="leads" />} />
            <Route path="cases" element={<FirmList kind="cases" admin />} />
            <Route path="cases/:caseId" element={<AdminDetail kind="cases" />} />
          </Route>
        </Route>
      </Route>
      <Route path="/" element={<Navigate to={auth.user ? '/workspace' : '/login'} replace />} />
      <Route
        path="*"
        element={
          <main className="container">
            <h1>Page not found</h1>
            <Link to="/">Return home</Link>
          </main>
        }
      />
    </Routes>
  );
}
