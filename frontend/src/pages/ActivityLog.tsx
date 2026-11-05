import { useSearchParams, Link } from 'react-router-dom';
import { type AuditEvent, PAGE_SIZE, pageFrom } from '../api/work';
import { useResource } from '../hooks/useResource';
import { Feedback, Pagination } from '../components/Feedback';
import { PageHeading } from '../components/WorkPresentation';
export function ActivityLog() {
  const [params, setParams] = useSearchParams();
  const page = pageFrom(params.get('page'));
  const { data, error, reload } = useResource<
    (AuditEvent & { lead_id: string; case_id: string | null })[]
  >(`/admin/activity?limit=${PAGE_SIZE + 1}&offset=${page * PAGE_SIZE}`);
  return (
    <section>
      <PageHeading title="Activity log" />
      {!data ? (
        <Feedback error={error} retry={reload} />
      ) : (
        <div className="card">
          <ol className="timeline">
            {data.slice(0, PAGE_SIZE).map((event) => (
              <li key={event.id}>
                <Link
                  className="row-link"
                  to={
                    event.case_id
                      ? `/admin/cases/${event.case_id}`
                      : `/admin/leads/${event.lead_id}`
                  }
                >
                  {event.action.replaceAll('_', ' ')}
                </Link>
                <p className="event-meta muted">
                  <span>{event.actor.name}</span>
                  <time dateTime={event.created_at}>
                    {new Date(event.created_at).toLocaleString()}
                  </time>
                </p>
                {event.changes.reason?.to && <p>{event.changes.reason.to}</p>}
              </li>
            ))}
          </ol>
          {!data.length && <p className="event-meta muted">No activity recorded yet.</p>}
        </div>
      )}
      {data && (page > 0 || data.length > PAGE_SIZE) && (
        <Pagination
          page={page}
          hasNext={data.length > PAGE_SIZE}
          onChange={(next) => setParams({ page: String(next) })}
        />
      )}
    </section>
  );
}
