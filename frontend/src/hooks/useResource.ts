import { useCallback, useEffect, useState } from 'react';
import { useApi } from '../api/useApi';

interface ResourceState<T> {
  path: string;
  data?: T;
  error?: string;
}

/** Load one API resource and discard requests from pages the user has left. */
export function useResource<T>(path: string) {
  const api = useApi();
  const [state, setState] = useState<ResourceState<T>>({ path });
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((current) => current + 1), []);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setState({ path });
      try {
        const data = await api<T>(path, { signal: controller.signal });
        if (!controller.signal.aborted) {
          setState({ path, data });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setState({
            path,
            error: error instanceof Error ? error.message : 'Unable to load this page.',
          });
        }
      }
    }

    void load();
    return () => controller.abort();
  }, [path, api, version]);

  // Effects run after rendering. Hide old data immediately when the URL changes.
  const current = state.path === path ? state : undefined;
  return { data: current?.data, error: current?.error, reload };
}
