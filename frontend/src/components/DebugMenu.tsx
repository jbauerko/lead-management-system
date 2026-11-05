/** Local demo reference, available on login and every portal with Ctrl+[. */
import { useEffect, useRef, useState } from 'react';
import { request } from '../api/client';
import { categoryLabel } from '../api/work';

interface DemoReference {
  password: string;
  accounts: { name: string; email: string; role: string; firm: string | null; active: boolean }[];
  mappings: { region: string; category: string; firm: string; active: boolean }[];
}

export function DebugMenu() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [data, setData] = useState<DemoReference>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let controller: AbortController | undefined;
    function toggle(event: KeyboardEvent) {
      if (!event.ctrlKey || (event.code !== 'BracketLeft' && event.key !== '[') || event.repeat)
        return;
      event.preventDefault();
      if (dialog.current?.open) {
        dialog.current.close();
        controller?.abort();
        return;
      }
      dialog.current?.showModal();
      // Reload on each open so database changes cannot leave a stale routing reference.
      controller?.abort();
      const currentRequest = new AbortController();
      controller = currentRequest;
      setLoading(true);
      setError('');
      request<DemoReference>('/debug/demo', { signal: currentRequest.signal })
        .then((result) => {
          if (!currentRequest.signal.aborted) setData(result);
        })
        .catch((error) => {
          if (!currentRequest.signal.aborted) setError(error.message);
        })
        .finally(() => {
          if (!currentRequest.signal.aborted) setLoading(false);
        });
    }
    window.addEventListener('keydown', toggle);
    return () => {
      window.removeEventListener('keydown', toggle);
      controller?.abort();
    };
  }, []);

  return (
    <dialog className="debug-dialog" ref={dialog} aria-labelledby="debug-title">
      <header className="section-heading">
        <h2 id="debug-title">Demo reference</h2>
        <button className="button" onClick={() => dialog.current?.close()}>
          Close
        </button>
      </header>
      {loading ? (
        <p role="status">Loading…</p>
      ) : error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : (
        data && (
          <>
            <h3>Accounts</h3>
            <p>
              Password: <code>{data.password}</code>
            </p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Firm</th>
                  </tr>
                </thead>
                <tbody>
                  {data.accounts.map((account) => (
                    <tr key={account.email}>
                      <td>
                        {account.email}
                        {!account.active && ' (inactive)'}
                      </td>
                      <td>{categoryLabel(account.role)}</td>
                      <td>{account.firm ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3 className="debug-section-title">Routing</h3>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Region</th>
                    <th>Category</th>
                    <th>Firm</th>
                  </tr>
                </thead>
                <tbody>
                  {data.mappings.map((mapping) => (
                    <tr key={`${mapping.region}:${mapping.category}`}>
                      <td>{mapping.region}</td>
                      <td>{categoryLabel(mapping.category)}</td>
                      <td>
                        {mapping.firm}
                        {!mapping.active && ' (inactive)'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="debug-footnote">
              Unmatched combinations wait for admin assignment. Inactive firms receive no new routed
              leads.
            </p>
          </>
        )
      )}
    </dialog>
  );
}
