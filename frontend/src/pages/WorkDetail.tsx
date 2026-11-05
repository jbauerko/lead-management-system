import { Link, useLocation, useParams } from 'react-router-dom';
import { type Lead, type Case, type WorkKind, categoryLabel, getLead } from '../api/work';
import { useResource } from '../hooks/useResource';
import { Feedback } from '../components/Feedback';
import { Documents } from '../components/Documents';
import { PageHeading, StatusBadge, InquiryMeta, Lifecycle } from '../components/WorkPresentation';
import { ProgressTimeline } from '../components/ProgressTimeline';
/** Plaintiffs see shared progress and documents, never firm-private notes. */
export function WorkDetail({ kind }: { kind: WorkKind }) {
  const { leadId, caseId } = useParams();
  const location = useLocation();
  const { data, error, reload } = useResource<Lead | Case>(
    `/${kind}/${kind === 'leads' ? leadId : caseId}`,
  );
  if (!data) return <Feedback error={error} retry={reload} />;
  const work = 'lead' in data ? data : null;
  const lead = getLead(data);
  return (
    <article>
      <Link className="back-link" to={`/plaintiff/${kind}`}>
        ← All {kind}
      </Link>
      <PageHeading title={categoryLabel(lead.category)}>
        <StatusBadge status={work?.status ?? lead.status} />
      </PageHeading>
      <InquiryMeta lead={lead} />
      {location.state?.submitted && (
        <p role="status" className="success">
          Your inquiry was submitted successfully.
        </p>
      )}
      {work ? (
        <>
          <Lifecycle status={work.status} />
          <div className="content-grid">
            <ProgressTimeline caseId={work.id} />
            <Documents key={lead.id} leadId={lead.id} />
          </div>
        </>
      ) : (
        <>
          {lead.case_id && (
            <Link className="button button-primary" to={`/plaintiff/cases/${lead.case_id}`}>
              Open case
            </Link>
          )}
          <div className="content-grid">
            <section className="card">
              <h2>Your inquiry</h2>
              <p className="preserve-lines">{lead.description}</p>
              <dl className="inline-meta">
                <div>
                  <dt>Name</dt>
                  <dd>{lead.name}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{lead.email}</dd>
                </div>
              </dl>
            </section>
            <Documents key={lead.id} leadId={lead.id} />
          </div>
        </>
      )}
    </article>
  );
}
