import { useCallback } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { ApiError, request } from './client';

/** Add the current login to requests and return to sign-in when it expires. */
export function useApi() {
  const { token, signOut } = useAuth();
  return useCallback(
    async <T>(path: string, options: RequestInit = {}): Promise<T> => {
      try {
        return await request<T>(path, options, token ?? undefined);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          signOut();
        }
        throw error;
      }
    },
    [token, signOut],
  );
}
