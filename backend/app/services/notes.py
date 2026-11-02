from __future__ import annotations

from uuid import UUID
from app.db.models import User
from app.services.transactions import Transactions
from app.services.cases import CaseService
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.models import PrivateNote
from app.services.transactions import transactional

class NoteService:
    """Keep firm-private notes separate from plaintiff-visible progress.

    Required by instructions.md:
        Staff can add private notes. Notes retain their authoring firm's ownership
        after reassignment. Plaintiffs cannot see them, the new firm does not
        inherit them, and authorized admins can inspect them. The old firm loses
        future case access; no old-firm archive interface is required.

    Assumptions we chose:
        Authors belong to one firm, which owns every note they create. All demo
        admins may inspect notes. Staff need both current case access and matching
        note ownership to read a note. Notes cannot be edited or deleted here.

    Technical choices:
        Derive author and firm from the authenticated user, never request fields.
        Check assignment under the shared lead lock before creating a note.
    """

    def __init__(self, session: Session, transactions: Transactions, cases: CaseService):
        self.session = session
        self.transactions = transactions
        self.cases = cases

    @transactional
    def create(self, user: User, case_id: UUID, body: str) -> PrivateNote:
        case, lead = self.cases.require_staff(user, case_id)
        # Use the signed-in staff member as the author and their firm as the owner.
        # Moving the case later does not change who owns this note.
        note = PrivateNote(case_id=case.id, author_id=user.id, authoring_firm_id=user.firm_id, body=body)
        self.session.add(note)
        self.session.flush()
        self.session.refresh(note)
        return note

    def list(self, user: User, case_id: UUID, limit: int, offset: int) -> list[PrivateNote]:
        if user.role == 'plaintiff':
            raise PermissionError('Private notes are restricted to staff and admins')
        # Check current case access first; the old firm loses access after reassignment.
        self.cases.get(user, case_id)
        query = select(PrivateNote).where(PrivateNote.case_id == case_id)
        # The new firm sees its own notes, not the previous firm’s. Admins can see both.
        if user.role != 'admin':
            query = query.where(PrivateNote.authoring_firm_id == user.firm_id)
        return list(self.session.scalars(query.order_by(PrivateNote.created_at.desc(), PrivateNote.id.desc()).limit(limit).offset(offset)).all())

