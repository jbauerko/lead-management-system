import { useSearchQuery } from '../hooks/useSearchQuery';
import { Link, useSearchParams } from 'react-router-dom';
import { useResource } from '../hooks/useResource';
import { Feedback, Pagination } from '../components/Feedback';
import { PageHeading, StatusBadge } from '../components/WorkPresentation';
import {
  type Lead,
  type Case,
  type WorkKind,
  PAGE_SIZE,
  categoryLabel,
  preview,
  getLead,
  pageFrom,
  date,
} from '../api/work';

/** Filters live in the URL so browser navigation restores the same inbox. */
export function FirmList({ kind, admin = false }: { kind: WorkKind; admin?: boolean }) {
  const [params, setParams] = useSearchParams();
  const page = pageFrom(params.get('page'));
  const { search, setSearch } = useSearchQuery();
  const query = new URLSearchParams({
    limit: String(PAGE_SIZE + 1),
    offset: String(page * PAGE_SIZE),
  });
  for (const key of ['q', 'status']) {
    if (params.get(key)) query.set(key, params.get(key)!);
  }
  const { data, error, reload } = useResource<(Lead | Case)[]>(`/${kind}?${query}`);
  function filter(key: string, value: string) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.delete('page');
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });
  }

  const statuses =
    kind === 'leads'
      ? { assigned: 'New', pending: 'Unmatched', accepted: 'Accepted', declined: 'Declined' }
      : { open: 'Open', in_progress: 'In progress', closed: 'Closed' };
  return (
    <section aria-label={admin ? 'All ' + kind : kind === 'leads' ? 'Firm inbox' : 'Firm cases'}>
      <PageHeading title={kind === 'leads' ? (admin ? 'Leads' : 'Inbox') : 'Cases'} />
      <form className="filter-bar" onSubmit={(event) => event.preventDefault()}>
        <div className="search-field">
          <label className="sr-only" htmlFor="search">
            Search inquiries
          </label>
          <input
            id="search"
            value={search}
            maxLength={200}
            onChange={(e) => setSearch(e.target.value)}
            type="search"
            placeholder="Search"
          />
        </div>
        <div>
          <label className="sr-only" htmlFor="status">
            Status
          </label>
          <select
            id="status"
            value={params.get('status') ?? ''}
            onChange={(e) => filter('status', e.target.value)}
          >
            <option value="">All statuses</option>
            {Object.entries(statuses).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </form>
      {!data ? (
        <Feedback error={error} retry={reload} />
      ) : !data.length ? (
        <div className="card empty-state">
          <h2>No matching {kind}</h2>
        </div>
      ) : (
        <div className="card table-card">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Plaintiff</th>
                  <th>Category</th>
                  <th>Region</th>
                  <th>{admin ? 'Assigned firm' : 'Received'}</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.slice(0, PAGE_SIZE).map((work) => {
                  const lead = getLead(work);
                  return (
                    <tr key={work.id}>
                      <td>
                        <Link
                          className="row-link"
                          aria-label={`${lead.name}: ${preview(lead.description)}`}
                          to={`/${admin ? 'admin' : 'firm'}/${kind}/${work.id}`}
                        >
                          {lead.name}
                        </Link>
                      </td>
                      <td>{categoryLabel(lead.category)}</td>
                      <td>{lead.region}</td>
                      <td>{admin ? (lead.firm?.name ?? 'Unassigned') : date(lead.created_at)}</td>
                      <td>
                        <StatusBadge status={work.status} audience={admin ? 'admin' : 'firm'} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {data && (page > 0 || data.length > PAGE_SIZE) && (
        <Pagination
          page={page}
          hasNext={data.length > PAGE_SIZE}
          onChange={(next) =>
            setParams((previous) => {
              const copy = new URLSearchParams(previous);
              copy.set('page', String(next));
              return copy;
            })
          }
        />
      )}
    </section>
  );
}
