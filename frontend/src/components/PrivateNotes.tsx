import { useRef, useState, type FormEvent } from 'react';
import { useApi } from '../api/useApi';
import { useResource } from '../hooks/useResource';
import { type PrivateNote, PAGE_SIZE, date } from '../api/work';
import { Feedback, Pagination } from './Feedback';

/** Staff write their firm’s notes; admins use this component only for inspection. */
export function PrivateNotes({ caseId, readOnly = false }: { caseId: string; readOnly?: boolean }) {
  const api = useApi();
  const [page, setPage] = useState(0);
  const { data, error, reload } = useResource<PrivateNote[]>(
    `/cases/${caseId}/notes?limit=${PAGE_SIZE + 1}&offset=${page * PAGE_SIZE}`,
  );
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [failure, setFailure] = useState('');
  const [success, setSuccess] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending.current) {
      return;
    }
    setFailure('');
    setSuccess('');
    if (!body.trim()) {
      setFailure('Write a note before saving.');
      return;
    }
    pending.current = true;
    setBusy(true);
    try {
      await api(`/cases/${caseId}/notes`, { method: 'POST', body: JSON.stringify({ body }) });
      setBody('');
      setPage(0);
      reload();
      setSuccess('Private note saved.');
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'Unable to save note.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="card notes-card" aria-labelledby="notes-heading">
      <div className="section-heading">
        <h2 id="notes-heading">Private notes</h2>
      </div>
      <p className="privacy-label">{readOnly ? 'All authoring firms' : 'Firm only'}</p>
      {failure && (
        <p role="alert" className="error">
          {failure}
        </p>
      )}
      {success && (
        <p role="status" className="success">
          {success}
        </p>
      )}
      {!data ? (
        <Feedback error={error} retry={reload} />
      ) : !data.length ? (
        <p className="muted">
          {readOnly ? 'No private notes on this page.' : 'No notes from your firm on this page.'}
        </p>
      ) : (
        <ul className="note-list">
          {data.slice(0, PAGE_SIZE).map((note) => (
            <li key={note.id}>
              <div className="note-meta">
                <div>
                  {note.author && <span>{note.author.name}</span>}
                  {note.authoring_firm && <span className="muted">{note.authoring_firm.name}</span>}
                </div>
                <time className="muted" dateTime={note.created_at}>
                  {date(note.created_at)}
                </time>
              </div>
              <p className="preserve-lines">{note.body}</p>
            </li>
          ))}
        </ul>
      )}
      {!readOnly && (
        <form onSubmit={submit}>
          <label htmlFor="note-body">New private note</label>
          <textarea
            id="note-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={20000}
            rows={4}
            required
          />
          <div>
            <button className="button" disabled={busy}>
              {busy ? 'Saving note…' : 'Save private note'}
            </button>
          </div>
        </form>
      )}
      {data && (page > 0 || data.length > PAGE_SIZE) && (
        <Pagination page={page} hasNext={data.length > PAGE_SIZE} onChange={setPage} />
      )}
    </section>
  );
}
