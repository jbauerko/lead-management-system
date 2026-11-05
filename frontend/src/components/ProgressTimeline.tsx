import { useState } from 'react';
import { useResource } from '../hooks/useResource';
import { PAGE_SIZE, date } from '../api/work';
import { Feedback, Pagination } from './Feedback';
interface ProgressUpdate {
  id: string;
  progress: string;
  status: string | null;
  created_at: string;
}
/** This endpoint contains shared progress only, never private notes or audit identities. */
export function ProgressTimeline({
  caseId,
  embedded = false,
}: {
  caseId: string;
  embedded?: boolean;
}) {
  const [page, setPage] = useState(0);
  const { data, error, reload } = useResource<ProgressUpdate[]>(
    `/cases/${caseId}/progress?limit=${PAGE_SIZE + 1}&offset=${page * PAGE_SIZE}`,
  );
  return (
    <section className={embedded ? 'progress-timeline' : 'card progress-timeline'}>
      <h2>{embedded ? 'Progress shared with plaintiff' : 'Progress updates'}</h2>
      {!data ? (
        <Feedback error={error} retry={reload} />
      ) : !data.length ? (
        <p className="muted">No progress updates yet.</p>
      ) : (
        <ol className="timeline">
          {data.slice(0, PAGE_SIZE).map((event) => (
            <li key={event.id}>
              <p className="preserve-lines">{event.progress}</p>
              <time dateTime={event.created_at}>{date(event.created_at)}</time>
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
