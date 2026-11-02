from __future__ import annotations

from uuid import UUID
from app.db.models import User
from app.schemas.audit import AuditChanges
from app.services.transactions import Transactions
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.models import AuditEvent, Lead
from app.services.errors import NotFound

class AuditService:
    """Record changes so an admin can understand what happened.

    Required by instructions.md:
        Assignment and important status changes have inspectable history showing
        who made the change, what changed, and when.

    Assumptions we chose:
        Only admins inspect history. We record submission, review, reassignment,
        and case status/progress changes, but skip unchanged saves. Note contents,
        document bytes, and secrets are excluded; note creation and document
        uploads are not currently audited.

    Technical choices:
        Add events to the caller's transaction without committing separately.
        History is append-only through the service API, not a database-enforced
        immutable log. Actor IDs and timestamps come from persisted records.
    """

    def __init__(self, session: Session, transactions: Transactions):
        self.session = session
        self.transactions = transactions

    def record(self, *, lead_id: UUID, actor_id: UUID, action: str, changes: AuditChanges, case_id: UUID | None = None) -> None:
        # Let the calling operation save this event along with its other changes.
        # Include changed fields, but leave out private note text and secrets.
        self.session.add(AuditEvent(lead_id=lead_id, actor_id=actor_id, action=action, changes=changes, case_id=case_id))

    def history(self, user: User, lead_id: UUID, limit: int, offset: int) -> list[AuditEvent]:
        if user.role != 'admin':
            raise PermissionError('Only admins may inspect audit history')
        if self.session.get(Lead, lead_id) is None:
            raise NotFound('Lead not found')
        return list(self.session.scalars(select(AuditEvent).where(AuditEvent.lead_id == lead_id)
                               .order_by(AuditEvent.created_at.desc(), AuditEvent.id.desc()).limit(limit).offset(offset)).all())

