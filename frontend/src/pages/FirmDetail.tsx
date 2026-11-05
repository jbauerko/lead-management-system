import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useApi } from '../api/useApi';
import { useResource } from '../hooks/useResource';
import { type Lead, type Case, type WorkKind, getLead } from '../api/work';
import { Feedback } from '../components/Feedback';
import { Documents } from '../components/Documents';
import { PrivateNotes } from '../components/PrivateNotes';
import { CaseProgress } from '../components/CaseProgress';
import { ProgressTimeline } from '../components/ProgressTimeline';
import { PageHeading, StatusBadge, InquiryMeta } from '../components/WorkPresentation';

export function FirmDetail({ kind }: { kind: WorkKind }) {
  const { leadId, caseId } = useParams();
  const api = useApi();
  const navigate = useNavigate();
  const { data, error, reload } = useResource<Lead | Case>(
    `/${kind}/${kind === 'leads' ? leadId : caseId}`,
  );
  const [decision, setDecision] = useState<'accept' | 'decline' | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [failure, setFailure] = useState('');
  const [success, setSuccess] = useState('');
  const [revision, setRevision] = useState(0);
  async function review() {
    if (!decision || pending.current) return;
    pending.current = true;
    setBusy(true);
    setFailure('');
    try {
      const lead = await api<Lead>(`/leads/${leadId}/${decision}`, { method: 'POST' });
      setDecision(null);
      if (lead.case_id) navigate(`/firm/cases/${lead.case_id}`, { replace: true });
      else {
        setSuccess('Lead declined. It remains available for an admin to resolve.');
        reload();
      }
    } catch (error) {
      setFailure(
        error instanceof ApiError && error.status === 404
          ? 'This lead is unavailable or has been reassigned. Return to your inbox.'
          : error instanceof Error
            ? error.message
            : 'Unable to record decision.',
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  if (!data)
    return (
      <section>
        <Link className="back-link" to={`/firm/${kind}`}>
          ← Back to {kind === 'leads' ? 'inbox' : 'cases'}
        </Link>
        <Feedback
          error={error ? `${error} This work may have been reassigned.` : undefined}
          retry={reload}
        />
      </section>
    );
  const work = 'lead' in data ? data : null;
  const lead = getLead(data);
  return (
    <article>
      <Link className="back-link" to={`/firm/${kind}`}>
        ← Back to {kind === 'leads' ? 'inbox' : 'cases'}
      </Link>
      <PageHeading title={lead.name}>
        {work ? (
          <button className="button button-primary" onClick={() => setEditing((value) => !value)}>
            {editing ? 'Cancel update' : 'Post update'}
          </button>
        ) : (
          <StatusBadge status={lead.status} audience="firm" />
        )}
      </PageHeading>
      <InquiryMeta lead={lead} staff />
      {success && (
        <p role="status" className="success">
          {success}
        </p>
      )}
      {work ? (
        <>
          {editing && (
            <CaseProgress
              work={work}
              saved={() => {
                setEditing(false);
                setSuccess('Case progress saved.');
                setRevision((value) => value + 1);
                reload();
              }}
            />
          )}
          <div className="content-grid">
            <div className="card">
              <Documents key={lead.id} leadId={lead.id} />
              <ProgressTimeline key={`${work.id}:${revision}`} caseId={work.id} embedded />
            </div>
            <PrivateNotes key={work.id} caseId={work.id} />
          </div>
        </>
      ) : (
        <>
          <section className="card">
            <h2>Plaintiff’s description</h2>
            <p className="preserve-lines">{lead.description}</p>
          </section>
          {lead.status === 'assigned' && (
            <section className="decision-bar">
              {!decision ? (
                <div className="actions">
                  <button className="button" onClick={() => setDecision('decline')}>
                    Decline lead
                  </button>
                  <button className="button button-primary" onClick={() => setDecision('accept')}>
                    Accept lead
                  </button>
                </div>
              ) : (
                <>
                  <p>
                    {decision === 'accept'
                      ? 'Accept this inquiry and create a case?'
                      : 'Decline this inquiry and leave it for admin resolution?'}
                  </p>
                  <div className="actions">
                    <button className="button" disabled={busy} onClick={() => setDecision(null)}>
                      Cancel
                    </button>
                    <button className="button button-primary" disabled={busy} onClick={review}>
                      {busy
                        ? 'Recording…'
                        : decision === 'accept'
                          ? 'Confirm acceptance'
                          : 'Confirm decline'}
                    </button>
                  </div>
                </>
              )}
              {failure && (
                <p role="alert" className="error">
                  {failure}
                </p>
              )}
            </section>
          )}
          {lead.status === 'declined' && (
            <p className="muted">
              An admin must resolve or reassign this inquiry before another firm decision.
            </p>
          )}
          {lead.case_id && (
            <Link className="button" to={`/firm/cases/${lead.case_id}`}>
              Open case
            </Link>
          )}
          <div className="lead-documents">
            <Documents key={lead.id} leadId={lead.id} />
          </div>
        </>
      )}
    </article>
  );
}
