import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useResource } from '../hooks/useResource';
import { type Lead, type Case, type WorkKind, getLead } from '../api/work';
import { Feedback } from '../components/Feedback';
import { Documents } from '../components/Documents';
import { PrivateNotes } from '../components/PrivateNotes';
import { Assignment } from '../components/Assignment';
import { AuditHistory } from '../components/AuditHistory';
import { PageHeading, StatusBadge, InquiryMeta } from '../components/WorkPresentation';

export function AdminDetail({ kind }: { kind: WorkKind }) {
  const { leadId, caseId } = useParams();
  const id = (kind === 'leads' ? leadId : caseId)!;
  const { data, error, reload } = useResource<Lead | Case>(`/${kind}/${id}`);
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState('');
  function refreshDetails() {
    setRevision((value) => value + 1);
    reload();
  }
  if (!data) return <Feedback error={error} retry={reload} />;
  const work = 'lead' in data ? data : null;
  const lead = getLead(data);
  const inspectionCaseId = work?.id ?? lead.case_id;
  return (
    <article>
      <Link className="back-link" to={`/admin/${kind}`}>
        ← All {kind}
      </Link>
      <PageHeading title={lead.name}>
        <StatusBadge status={work?.status ?? lead.status} audience="admin" />
      </PageHeading>
      <InquiryMeta lead={lead} />
      {message && (
        <p role="status" className="success">
          {message}
        </p>
      )}
      <div className="content-grid admin-detail-grid">
        <div className="card-stack">
          <Assignment
            key={`${id}:${revision}`}
            kind={kind}
            id={id}
            current={lead.firm}
            saved={() => {
              setMessage('Assignment saved.');
              refreshDetails();
            }}
          />
          {inspectionCaseId ? (
            <PrivateNotes
              key={`notes:${inspectionCaseId}:${revision}`}
              caseId={inspectionCaseId}
              readOnly
            />
          ) : (
            <section className="card">
              <h2>Private notes</h2>
              <p className="muted">No case notes.</p>
            </section>
          )}
          <details className="card">
            <summary>Inquiry & documents</summary>
            <p className="preserve-lines">{lead.description}</p>
            {work && <p>{work.progress || 'No progress update yet.'}</p>}
            <Documents leadId={lead.id} />
            {!work && lead.case_id && (
              <Link className="button" to={`/admin/cases/${lead.case_id}`}>
                Open case
              </Link>
            )}
          </details>
        </div>
        <AuditHistory key={`history:${lead.id}:${revision}`} leadId={lead.id} />
      </div>
    </article>
  );
}
