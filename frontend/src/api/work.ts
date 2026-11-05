/** DTOs returned by the work endpoints. Private notes are always fetched separately. */
export type LeadStatus = 'pending' | 'assigned' | 'accepted' | 'declined';
export type CaseStatus = 'open' | 'in_progress' | 'closed';
export interface LeadCreate {
  name: string;
  email: string;
  region: string;
  category: string;
  description: string;
}
export interface Lead extends LeadCreate {
  id: string;
  status: LeadStatus;
  created_at: string;
  firm_id: string | null;
  firm: FirmSummary | null;
  case_id: string | null;
}
export interface Case {
  id: string;
  lead_id: string;
  status: CaseStatus;
  progress: string;
  created_at: string;
  lead: Lead;
}
export interface Document {
  id: string;
  lead_id: string;
  uploader_id: string;
  filename: string;
  size_bytes: number;
  created_at: string;
}
export type WorkKind = 'leads' | 'cases';
// Fetch one extra row to decide whether to show Next without a separate count query.
export const PAGE_SIZE = 20;
export const leadLabels: Record<LeadStatus, string> = {
  pending: 'Finding a firm',
  assigned: 'Under review',
  accepted: 'Accepted',
  declined: 'Awaiting admin review',
};
export const caseLabels: Record<CaseStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  closed: 'Closed',
};
export function categoryLabel(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
export function preview(value: string) {
  return value.length > 90 ? value.slice(0, 90) + '…' : value;
}
export function date(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export interface ActorSummary {
  id: string;
  name: string;
  email: string;
}
export interface FirmSummary {
  id: string;
  name: string;
}
export interface PrivateNote {
  author?: ActorSummary;
  authoring_firm?: FirmSummary;
  id: string;
  body: string;
  author_id: string;
  authoring_firm_id: string;
  created_at: string;
}

export interface AuditEvent {
  id: string;
  actor_id: string;
  actor: ActorSummary;
  action: string;
  changes: Record<string, { from: string | null; to: string | null }>;
  created_at: string;
}

/** A case keeps the original inquiry under `lead`; a lead is already that inquiry. */
export function getLead(work: Lead | Case): Lead {
  return 'lead' in work ? work.lead : work;
}

/** Ignore malformed page numbers in bookmarked URLs instead of sending bad offsets. */
export function pageFrom(value: string | null): number {
  const page = Number(value ?? 0);
  return Number.isSafeInteger(page) && page >= 0 && page < 100000 ? page : 0;
}
