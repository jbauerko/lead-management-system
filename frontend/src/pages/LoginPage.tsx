import { returnTo } from '../auth/routes';
import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

/** Sign in, then return to a safe bookmark or the user’s normal landing page. */
export function LoginPage() {
  const auth = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('plaintiff@example.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const from: unknown = location.state?.from;

  if (auth.user) {
    return <Navigate to={returnTo(auth.user.role, from)} replace />;
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await auth.signIn({ email, password });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-container">
      <div className="login-card">
        <p className="eyebrow">Client portal</p>
        <h1>Welcome back</h1>
        <form onSubmit={submit}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button className="button button-primary" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="demo-hint">
          Demo plaintiff: plaintiff@example.com
          <br />
          Staff: attorney@example.com or paralegal@example.com
          <br />
          Password: demo-password
        </p>
      </div>
    </main>
  );
}
