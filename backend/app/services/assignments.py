from __future__ import annotations

from app.db.models import User
from app.services.transactions import Transactions
from app.services.firms import FirmService
from app.services.audit import AuditService
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.models import Case, Lead
from app.services.errors import NotFound
from app.services.transactions import transactional

class AssignmentService:
    """Keep lead and case assignment changes consistent.

    Required by instructions.md:
        Admins can resolve unmatched/declined leads and reassign leads or cases.
        The former firm loses future access. The new firm receives case information
        and plaintiff documents, but does not inherit the former firm's notes.
        Record who changed the assignment, what changed, and when.

    Assumptions we chose:
        Lead and case assignments cannot differ. Assignment requires an active
        target firm. A lead without a case becomes assigned and ready for review,
        even when the admin selects its existing firm; an existing case is kept.
        Repeating an unchanged assignment adds no history entry.

    Technical choices:
        Use one lead-row lock for reassignment, review, and staff writes. Change
        the assignment and audit event together; never rewrite note ownership.
    """

    def __init__(self, session: Session, transactions: Transactions, firms: FirmService, audit: AuditService):
        self.session = session
        self.transactions = transactions
        self.firms = firms
        self.audit = audit

    def lock(self, lead_id: UUID) -> Lead:
        """Let one operation change this lead at a time, using its latest saved values."""
        lead = self.session.scalar(select(Lead).where(Lead.id == lead_id).with_for_update(of=Lead).execution_options(populate_existing=True))
        if lead is None:
            raise NotFound('Lead not found')
        return lead

    @transactional
    def reassign(self, user: User, lead_id: UUID, firm_id: UUID, reason: str = "") -> Lead:
        if user.role != 'admin':
            raise PermissionError('Only admins may reassign work')
        lead = self.lock(lead_id)
        self.firms.require_active(firm_id)
        case = self.session.scalar(select(Case).where(Case.lead_id == lead.id))
        # Keep an existing case when moving it to another firm. For leads without
        # a case, assignment lets staff review them again—even at the same firm.
        new_status = 'accepted' if case else 'assigned'
        changes = {}
        for key, value in {'firm_id': firm_id, 'status': new_status}.items():
            old = getattr(lead, key)
            if old != value:
                changes[key] = {'from': str(old) if old is not None else None, 'to': str(value)}
                setattr(lead, key, value)
        # Private notes still belong to the firm that wrote them.
        # Only add history if the assignment or status actually changed.
        if changes:
            if reason.strip():
                changes["reason"] = {"from": None, "to": reason.strip()}
            self.audit.record(lead_id=lead.id, case_id=case.id if case else None,
                                   actor_id=user.id, action='assignment_changed', changes=changes)
        self.session.flush()
        self.session.refresh(lead)
        return lead

