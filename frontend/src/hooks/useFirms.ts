import { useEffect, useState } from 'react';
import { useApi } from '../api/useApi';
import type { FirmSummary } from '../api/work';

/** Load every active-firm page so the assignment picker works beyond 100 firms. */
export function useFirms() {
  const api = useApi();
  const [data, setData] = useState<FirmSummary[]>();
  const [error, setError] = useState<string>();
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setData(undefined);
    setError(undefined);
    async function load() {
      const firms: FirmSummary[] = [];
      for (let offset = 0; ; offset += 100) {
        const page = await api<FirmSummary[]>(`/firms?limit=100&offset=${offset}`, {
          signal: controller.signal,
        });
        firms.push(...page);
        if (page.length < 100) {
          break;
        }
      }
      if (!controller.signal.aborted) {
        setData(firms);
      }
    }
    load().catch((error) => {
      if (!controller.signal.aborted) {
        setError(error instanceof Error ? error.message : 'Unable to load firms.');
      }
    });
    return () => controller.abort();
  }, [api, version]);
  return { data, error, reload: () => setVersion((n) => n + 1) };
}
