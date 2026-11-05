import { useRef, useState, type FormEvent } from 'react';
import { type Case, type CaseStatus, caseLabels } from '../api/work';
import { useApi } from '../api/useApi';

/** These fields are plaintiff-visible; internal discussion belongs in private notes. */
export function CaseProgress({ work, saved }: { work: Case; saved: () => void }) {
  const api = useApi();
  const [status, setStatus] = useState<CaseStatus>(work.status);
  const [progress, setProgress] = useState(work.progress);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [failure, setFailure] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending.current) {
      return;
    }
    pending.current = true;
    setBusy(true);
    setFailure('');
    try {
      await api(`/cases/${work.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, progress }),
      });
      saved();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'Unable to save progress.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="progress-panel">
      <h3>Case progress</h3>
      <form onSubmit={submit}>
        <label htmlFor="case-status">Case status</label>
        <select
          id="case-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as CaseStatus)}
        >
          {Object.entries(caseLabels).map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
        <label htmlFor="progress">Progress update</label>
        <textarea
          id="progress"
          rows={5}
          maxLength={20000}
          value={progress}
          onChange={(e) => setProgress(e.target.value)}
        />
        {failure && (
          <p role="alert" className="error">
            {failure}
          </p>
        )}
        <div>
          <button className="button button-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save progress'}
          </button>
        </div>
      </form>
    </section>
  );
}
