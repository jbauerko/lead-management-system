from __future__ import annotations

from app.db.models import User
from app.services.transactions import Transactions
from uuid import UUID
from sqlalchemy.orm import Session
from app.db.models import Firm
from app.services.errors import Conflict

class FirmService:
    """Find firms eligible to receive work.

    Required by instructions.md:
        Route leads to firms and let admins choose firms when assigning work.

    Assumptions we chose:
        Firms have an active flag. Inactive firms cannot receive routing or admin
        assignments. Only admins can use the active-firm listing. Deactivation
        does not itself remove existing staff access or move existing work.

    Technical choices:
        Reuse the active-firm check for admin assignments and paginate the picker.
    """

    def __init__(self, session: Session, transactions: Transactions):
        self.session = session
        self.transactions = transactions

    def require_active(self, firm_id: UUID) -> Firm:
        """Only existing, active firms can receive new assignments."""
        firm = self.session.get(Firm, firm_id)
        if firm is None or not firm.active:
            raise Conflict('Target firm must exist and be active')
        return firm

    def list_active(self, user: User, limit: int, offset: int) -> list[Firm]:
        """List the active firms an admin can choose when assigning work."""
        from sqlalchemy import select
        if user.role != 'admin':
            raise PermissionError('Only admins may list firms')
        return list(self.session.scalars(select(Firm).where(Firm.active.is_(True))
            .order_by(Firm.name, Firm.id).limit(limit).offset(offset)).all())
