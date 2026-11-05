import { Link, useSearchParams } from 'react-router-dom';
import { useResource } from '../hooks/useResource';
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
import { Feedback, Pagination } from '../components/Feedback';
import { PageHeading, StatusBadge } from '../components/WorkPresentation';

/** Use the original inquiry's category as the title; the intake has no separate title field. */
export function WorkList({ kind }: { kind: WorkKind }) {
  const [params, setParams] = useSearchParams();
  const page = pageFrom(params.get('page'));
  const { data, error, reload } = useResource<(Lead | Case)[]>(
    `/${kind}?limit=${PAGE_SIZE + 1}&offset=${page * PAGE_SIZE}`,
  );
  return (
    <section aria-label={kind === 'leads' ? 'Your leads' : 'Your cases'}>
      <PageHeading title={kind === 'leads' ? 'Leads' : 'Cases'}>
        {kind === 'leads' && (
          <Link className="button button-primary" to="/plaintiff/leads/new">
            Submit a lead
          </Link>
        )}
      </PageHeading>
      {!data ? (
        <Feedback error={error} retry={reload} />
      ) : !data.length ? (
        <div className="card empty-state">
          <h2>{page ? 'No more results' : kind === 'leads' ? 'No leads yet' : 'No cases yet'}</h2>
          {kind === 'leads' && (
            <Link className="button" to="/plaintiff/leads/new">
              Submit your first lead
            </Link>
          )}
        </div>
      ) : (
        <div className="card table-card">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Region</th>
                  <th>{kind === 'leads' ? 'Submitted' : 'Firm'}</th>
                  <th>Status</th>
                  <th>
                    <span className="sr-only">Open work</span>
                  </th>
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
                          aria-label={`${categoryLabel(lead.category)}: ${preview(lead.description)}`}
                          to={`/plaintiff/${kind}/${work.id}`}
                        >
                          {categoryLabel(lead.category)}
                        </Link>
                      </td>
                      <td>{lead.region}</td>
                      <td>
                        {kind === 'leads'
                          ? date(lead.created_at)
                          : (lead.firm?.name ?? 'Unassigned')}
                      </td>
                      <td>
                        <StatusBadge status={work.status} />
                      </td>
                      <td className="cell-actions">
                        {kind === 'leads' && lead.case_id && (
                          <Link className="button" to={`/plaintiff/cases/${lead.case_id}`}>
                            View case
                          </Link>
                        )}
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
          onChange={(next) => setParams({ page: String(next) })}
        />
      )}
    </section>
  );
}
