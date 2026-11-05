import type { ReactNode } from 'react';
import {
  categoryLabel,
  type Lead,
  type CaseStatus,
  caseLabels,
  type LeadStatus,
} from '../api/work';

export function StatusBadge({
  status,
  audience = 'plaintiff',
}: {
  status: string;
  audience?: 'plaintiff' | 'firm' | 'admin';
}) {
  const leadNames: Record<LeadStatus, string> = {
    pending: audience === 'admin' ? 'Unmatched' : 'Pending',
    assigned: audience === 'plaintiff' ? 'Pending' : 'New',
    accepted: 'Accepted',
    declined: 'Declined',
  };
  const label = caseLabels[status as CaseStatus] ?? leadNames[status as LeadStatus] ?? status;
  return <span className={`badge badge-${status}`}>{label}</span>;
}
export function PageHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="page-heading">
      <h1>{title}</h1>
      <div className="heading-actions">{children}</div>
    </header>
  );
}
export function InquiryMeta({ lead, staff = false }: { lead: Lead; staff?: boolean }) {
  return (
    <dl className="inline-meta">
      {staff && (
        <div>
          <dt>Email</dt>
          <dd>{lead.email}</dd>
        </div>
      )}
      <div>
        <dt>Region</dt>
        <dd>{lead.region}</dd>
      </div>
      {staff ? (
        <div>
          <dt>Category</dt>
          <dd>{categoryLabel(lead.category)}</dd>
        </div>
      ) : (
        <div>
          <dt>Firm</dt>
          <dd>{lead.firm?.name ?? 'Unassigned'}</dd>
        </div>
      )}
    </dl>
  );
}
/** Show the current lifecycle only; progress history below supplies dated updates. */
export function Lifecycle({ status }: { status: CaseStatus }) {
  const steps = ['Lead submitted', 'Accepted by firm', 'In progress', 'Resolved'];
  const current = status === 'closed' ? 3 : status === 'in_progress' ? 2 : 1;
  return (
    <ol className="lifecycle" aria-label="Case lifecycle">
      {steps.map((step, index) => (
        <li
          key={step}
          className={index <= current ? 'complete' : ''}
          aria-current={index === current ? 'step' : undefined}
        >
          {step}
        </li>
      ))}
    </ol>
  );
}
