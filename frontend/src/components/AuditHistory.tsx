import { useState } from 'react';
import { useResource } from '../hooks/useResource';
import { type AuditEvent, PAGE_SIZE } from '../api/work';
import { Feedback, Pagination } from './Feedback';
const actions: Record<string, string> = {
  lead_submitted: 'Lead submitted',
  lead_accepted: 'Lead accepted',
  lead_declined: 'Lead declined',
  case_updated: 'Case updated',
  assignment_changed: 'Assignment changed',
};
const fields: Record<string, string> = {
  firm_id: 'Assigned firm ID',
  status: 'Status',
  progress: 'Progress',
};
/** Keep recorded IDs and before/after values intact, even if a firm is later renamed. */
export function AuditHistory({ leadId }: { leadId: string }) {
  const [page, setPage] = useState(0);
  const { data, error, reload } = useResource<AuditEvent[]>(
    `/leads/${leadId}/history?limit=${PAGE_SIZE + 1}&offset=${page * PAGE_SIZE}`,
  );
  return (
    <section className="card history-card" aria-labelledby="history-heading">
      <div className="section-heading">
        <h2 id="history-heading">Assignment history</h2>
      </div>
      {!data ? (
        <Feedback error={error} retry={reload} />
      ) : !data.length ? (
        <p className="muted">No history on this page.</p>
      ) : (
        <ol className="timeline history-list">
          {data.slice(0, PAGE_SIZE).map((event) => (
            <li key={event.id}>
              <h3>{actions[event.action] ?? event.action}</h3>
              <p className="muted hint">
                {event.actor.name}
                <br />
                <time dateTime={event.created_at}>
                  {new Date(event.created_at).toLocaleString()}
                </time>
              </p>
              {event.changes.reason?.to && <p>{event.changes.reason.to}</p>}
              <details className="history-values">
                <summary>View changes</summary>
                <dl className="audit-changes">
                  {Object.entries(event.changes).map(([field, change]) => (
                    <div key={field}>
                      <dt>{fields[field] ?? field}</dt>
                      <dd>
                        <span className="preserve-lines">{change.from ?? 'None'}</span>
                        <span className="muted"> → </span>
                        <span className="preserve-lines">{change.to ?? 'None'}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </details>
            </li>
          ))}
        </ol>
      )}
      {data && (page > 0 || data.length > PAGE_SIZE) && (
        <Pagination page={page} hasNext={data.length > PAGE_SIZE} onChange={setPage} />
      )}
    </section>
  );
}
