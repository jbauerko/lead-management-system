from __future__ import annotations

from app.schemas.cases import CaseUpdate
from app.services.transactions import Transactions
from app.services.assignments import AssignmentService
from app.services.audit import AuditService
from uuid import UUID
from sqlalchemy import select, or_
from sqlalchemy.orm import Session
from app.db.models import Case, Lead, User
from app.services.access import lead_access
from app.services.errors import NotFound
from app.services.transactions import transactional

class CaseService:
    """Manage the work that starts when a firm accepts a lead.

    Required by instructions.md:
        Staff can update progress. Plaintiffs can view progress for their own
        cases. Admins oversee cases across firms and can reassign them; the old
        firm then loses future access and the new firm receives case information.

    Assumptions we chose:
        A lead has at most one case. The case always uses the lead's assignment,
        so moving either moves both. Only assigned firm staff update progress.
        Statuses are open, in_progress, and closed; any transition between them
        is allowed, including reopening. Progress is shared with the plaintiff.

    Technical choices:
        Read ownership through the lead rather than duplicate firm IDs. Updates
        lock that lead and save audit history in the same transaction. Case
        creation is an internal step of acceptance, not an independent operation.
    """

    def __init__(self, session: Session, transactions: Transactions, assignments: AssignmentService, audit: AuditService):
        self.session = session
        self.transactions = transactions
        self.assignments = assignments
        self.audit = audit

    def list(self, user: User, *, limit: int, offset: int, q: str | None = None, status: str | None = None) -> list[Case]:
        # Look up the assignment through the lead so there is only one firm ID to update.
        query = select(Case).join(Lead).where(lead_access(user))
        if q:
            query = query.where(or_(Lead.name.icontains(q, autoescape=True), Lead.email.icontains(q, autoescape=True), Lead.description.icontains(q, autoescape=True)))
        if status:
            query = query.where(Case.status == status)
        return list(self.session.scalars(query.order_by(Case.created_at.desc(), Case.id.desc()).limit(limit).offset(offset)).all())

    def get(self, user: User, case_id: UUID) -> Case:
        case = self.session.scalar(select(Case).join(Lead).where(Case.id == case_id, lead_access(user)))
        if case is None:
            raise NotFound('Case not found')
        return case

    def require_staff(self, user: User, case_id: UUID) -> tuple[Case, Lead]:
        if user.role not in ('attorney', 'paralegal'):
            raise PermissionError('Only firm staff may change cases')
        case = self.session.get(Case, case_id)
        if case is None:
            raise NotFound('Case not found')
        # Wait for any reassignment to finish before checking whether this firm
        # can still update progress or add notes.
        lead = self.assignments.lock(case.lead_id)
        if lead.firm_id != user.firm_id:
            raise NotFound('Case not found')
        # Another staff member may have saved changes while we waited.
        # Reload the case so we work with their latest progress.
        self.session.refresh(case)
        return case, lead

    @transactional
    def update(self, user: User, case_id: UUID, data: CaseUpdate) -> Case:
        case, lead = self.require_staff(user, case_id)
        changes = {key: {'from': getattr(case, key), 'to': value}
                   for key, value in data.model_dump().items() if getattr(case, key) != value}
        for key, value in data.model_dump().items():
            setattr(case, key, value)
        # Saving the same progress again should not clutter the history.
        if changes:
            self.audit.record(lead_id=lead.id, case_id=case.id, actor_id=user.id,
                                   action='case_updated', changes=changes)
        self.session.flush()
        self.session.refresh(case)
        return case

    def create_from_lead(self, lead: Lead) -> Case:
        """Create the case as part of accepting a lead.

        The caller must already hold the lead lock and own the transaction.
        Flush gives us the case ID for history without saving acceptance separately.
        The database also prevents a second case for the same lead.
        """
        case = Case(lead_id=lead.id)
        self.session.add(case)
        self.session.flush()
        return case

    @transactional
    def reassign(self, user: User, case_id: UUID, firm_id: UUID, reason: str = "") -> Case:
        if user.role != 'admin':
            raise PermissionError('Only admins may reassign work')
        case = self.get(user, case_id)
        # Update the lead assignment and let the case and files follow it.
        # Save both service calls together, rather than committing halfway through.
        self.assignments.reassign(user, case.lead_id, firm_id, reason)
        return case

    def progress_history(self, user: User, case_id: UUID, limit: int, offset: int):
        """Expose shared updates only; actor identities and private changes stay out."""
        self.get(user, case_id)
        from app.db.models import AuditEvent
        events = self.session.scalars(select(AuditEvent).where(
            AuditEvent.case_id == case_id, AuditEvent.action.in_(['lead_accepted', 'case_updated'])
        ).order_by(AuditEvent.created_at.desc(), AuditEvent.id.desc()).limit(limit).offset(offset)).all()
        return [{'id': event.id,
                 'progress': event.changes.get('progress', {}).get('to') or ('Case opened' if event.action == 'lead_accepted' else 'Case status updated'),
                 'status': event.changes.get('status', {}).get('to'), 'created_at': event.created_at}
                for event in events]
