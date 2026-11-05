import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { ApiError, getUser, login, type LoginRequest, type User } from '../api/client';

const TOKEN_KEY = 'lead-portal-token';

function readToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function saveToken(token: string | null): void {
  try {
    if (token) {
      sessionStorage.setItem(TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Login can still work in memory if the browser blocks session storage.
  }
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  signIn: (data: LoginRequest) => Promise<User>;
  signOut: () => void;
  retry: () => void;
}
const AuthContext = createContext<AuthState | null>(null);

/** Keep one login per browser tab and verify saved tokens with the backend. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(readToken);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const signOut = useCallback(() => {
    // Demo logout removes the local token; it does not revoke it on the server.
    saveToken(null);
    setToken(null);
    setUser(null);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }
    const savedToken = token;
    const controller = new AbortController();

    async function restoreSession() {
      setLoading(true);
      setError(null);
      try {
        const currentUser = await getUser(savedToken, controller.signal);
        if (!controller.signal.aborted) {
          setUser(currentUser);
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        if (error instanceof ApiError && error.status === 401) {
          signOut();
        } else {
          // Keep the saved token on an outage, so a retry does not require another login.
          setError('We could not check your sign-in. Please try again.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void restoreSession();
    return () => controller.abort();
  }, [token, attempt, signOut]);

  async function signIn(data: LoginRequest): Promise<User> {
    const result = await login(data);
    const currentUser = await getUser(result.access_token);
    // Load the user before saving the token so failed logins cannot leave partial state.
    saveToken(result.access_token);
    setUser(currentUser);
    setToken(result.access_token);
    return currentUser;
  }

  const value: AuthState = {
    user,
    token,
    loading,
    error,
    signIn,
    signOut,
    retry: () => setAttempt((current) => current + 1),
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const auth = useContext(AuthContext);
  if (!auth) {
    throw new Error('useAuth requires AuthProvider');
  }
  return auth;
}
