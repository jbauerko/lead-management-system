import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/** Apply search after a short pause, without requiring a separate submit button. */
export function useSearchQuery() {
  const [params, setParams] = useSearchParams();
  const savedSearch = params.get('q') ?? '';
  const [search, setSearch] = useState(savedSearch);

  // Back/forward navigation restores the input as well as the results.
  useEffect(() => setSearch(savedSearch), [savedSearch]);
  useEffect(() => {
    if (search.trim() === savedSearch) return;
    const timeout = setTimeout(() => {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.delete('page');
          if (search.trim()) next.set('q', search.trim());
          else next.delete('q');
          return next;
        },
        { replace: true },
      );
    }, 300);
    return () => clearTimeout(timeout);
  }, [search, savedSearch, setParams]);
  return { search, setSearch };
}
