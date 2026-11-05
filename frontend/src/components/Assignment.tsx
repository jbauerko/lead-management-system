import { useRef, useState, type FormEvent } from 'react';
import { useApi } from '../api/useApi';
import { useFirms } from '../hooks/useFirms';
import type { FirmSummary, WorkKind } from '../api/work';
import { Feedback } from './Feedback';

/** Show the chosen firm before sending the transfer; the backend checks eligibility again. */
export function Assignment({
  kind,
  id,
  current,
  saved,
}: {
  kind: WorkKind;
  id: string;
  current: FirmSummary | null;
  saved: () => void;
}) {
  const api = useApi();
  const firms = useFirms();
  const [selected, setSelected] = useState('');
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [failure, setFailure] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!selected || pending.current) {
      return;
    }
    // Choosing a firm is not a transfer until the admin confirms.
    if (!confirm) {
      setConfirm(true);
      return;
    }
    pending.current = true;
    setBusy(true);
    setFailure('');
    try {
      await api(`/${kind}/${id}/assignment`, {
        method: 'PATCH',
        body: JSON.stringify({ firm_id: selected, reason }),
      });
      setConfirm(false);
      saved();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'Unable to update assignment.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="card assignment-card">
      <h2>Reassign</h2>
      {!firms.data ? (
        <Feedback error={firms.error} retry={firms.reload} />
      ) : !firms.data.length ? (
        <p role="status">No active firms are available. Activate a firm before assigning work.</p>
      ) : (
        <form onSubmit={submit}>
          <label htmlFor="assignment-firm">Assign to firm</label>
          <select
            id="assignment-firm"
            required
            disabled={busy}
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              setConfirm(false);
              setFailure('');
            }}
          >
            <option value="">Choose an active firm</option>
            {firms.data.map((firm) => (
              <option key={firm.id} value={firm.id}>
                {firm.name}
                {firm.id === current?.id ? ' (current)' : ''}
              </option>
            ))}
          </select>
          <label htmlFor="assignment-reason">Reason</label>
          <input
            id="assignment-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={2000}
            placeholder="Why is this work being reassigned?"
          />
          {confirm && (
            <p role="status">
              Confirm assignment to {firms.data.find((firm) => firm.id === selected)?.name}?
            </p>
          )}
          {failure && (
            <p role="alert" className="error">
              {failure}
            </p>
          )}
          <div className="actions">
            <button className="button button-primary" disabled={busy || !selected}>
              {busy ? 'Saving assignment…' : confirm ? 'Confirm assignment' : 'Review assignment'}
            </button>
            {confirm && (
              <button
                className="button"
                type="button"
                disabled={busy}
                onClick={() => setConfirm(false)}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
