import { useSearchQuery } from '../hooks/useSearchQuery';
import { Link, useSearchParams } from 'react-router-dom';
import { useResource } from '../hooks/useResource';
import { useFirms } from '../hooks/useFirms';
import { type Lead, type WorkKind, PAGE_SIZE, pageFrom, categoryLabel } from '../api/work';
import { PageHeading, StatusBadge } from '../components/WorkPresentation';
import { Feedback, Pagination } from '../components/Feedback';
interface AdminWork {
  id: string;
  kind: WorkKind;
  lead: Lead;
  status: string;
  created_at: string;
}
export function AdminOverview() {
  const [params, setParams] = useSearchParams();
  const page = pageFrom(params.get('page'));
  const { search, setSearch } = useSearchQuery();
  const firms = useFirms();
  const query = new URLSearchParams(params);
  query.delete('page');
  query.set('limit', String(PAGE_SIZE + 1));
  query.set('offset', String(page * PAGE_SIZE));
  const { data, error, reload } = useResource<AdminWork[]>(`/admin/work?${query}`);
  function filter(key: string, value: string) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.delete('page');
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });
  }

  return (
    <section>
      <PageHeading title="Leads & cases">
        <span className="muted">All firms</span>
      </PageHeading>
      <form className="filter-bar" onSubmit={(event) => event.preventDefault()}>
        <div className="search-field">
          <label className="sr-only" htmlFor="overview-search">
            Search leads and cases
          </label>
          <input
            id="overview-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            maxLength={200}
            type="search"
            placeholder="Search"
          />
        </div>
        <div>
          <label className="sr-only" htmlFor="firm-filter">
            Firm
          </label>
          <select
            id="firm-filter"
            value={params.get('firm_id') ?? ''}
            onChange={(e) => filter('firm_id', e.target.value)}
          >
            <option value="">All firms</option>
            {firms.data?.map((firm) => (
              <option key={firm.id} value={firm.id}>
                {firm.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="sr-only" htmlFor="attention-filter">
            Attention
          </label>
          <select
            id="attention-filter"
            value={params.get('attention') ?? ''}
            onChange={(e) => filter('attention', e.target.value)}
          >
            <option value="">All work</option>
            <option value="true">Needs attention</option>
          </select>
        </div>
      </form>
      {firms.error && (
        <p className="error" role="alert">
          {firms.error}
        </p>
      )}
      {!data ? (
        <Feedback error={error} retry={reload} />
      ) : !data.length ? (
        <div className="card empty-state">
          <p>No matching leads or cases.</p>
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
                  <th>Assigned firm</th>
                  <th>Status</th>
                  <th>
                    <span className="sr-only">Assignment</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.slice(0, PAGE_SIZE).map((work) => (
                  <tr key={`${work.kind}:${work.id}`}>
                    <td>
                      <Link className="row-link" to={`/admin/${work.kind}/${work.id}`}>
                        {work.lead.name}
                      </Link>
                    </td>
                    <td>{categoryLabel(work.lead.category)}</td>
                    <td>{work.lead.region}</td>
                    <td>{work.lead.firm?.name ?? 'Unassigned'}</td>
                    <td>
                      <StatusBadge status={work.status} audience="admin" />
                    </td>
                    <td className="cell-actions">
                      <Link
                        className={`button ${['pending', 'declined'].includes(work.status) ? 'button-primary' : ''}`}
                        to={`/admin/${work.kind}/${work.id}`}
                      >
                        {work.status === 'pending'
                          ? 'Assign'
                          : work.status === 'declined'
                            ? 'Resolve'
                            : 'Reassign'}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {data && (page > 0 || data.length > PAGE_SIZE) && (
        <Pagination
          page={page}
          hasNext={data.length > PAGE_SIZE}
          onChange={(next) => filter('page', String(next))}
        />
      )}
    </section>
  );
}
