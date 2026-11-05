"""Admin read models combine leads and cases without duplicating accepted work."""
from uuid import UUID
from app.schemas.admin import AdminWorkResponse
from sqlalchemy import select, union_all, literal, exists, or_
from sqlalchemy.orm import Session
from app.db.models import AuditEvent, Case, Lead, User


class AdminService:
    def __init__(self, session: Session):
        self.session = session

    def list_work(self, user: User, limit: int, offset: int, q: str | None = None,
                  firm_id: UUID | None = None, attention: bool = False) -> list[AdminWorkResponse]:
        if user.role != 'admin':
            raise PermissionError('Only admins may inspect work across firms')
        # Accepted leads are represented by their case, so each inquiry appears once.
        leads = select(Lead.id.label('id'), literal('leads').label('kind'), Lead.id.label('lead_id'),
                       Lead.status.label('status'), Lead.created_at.label('created_at')).where(
                           ~exists(select(Case.id).where(Case.lead_id == Lead.id)))
        cases = select(Case.id.label('id'), literal('cases').label('kind'), Case.lead_id,
                       Case.status, Case.created_at)
        work = union_all(leads, cases).subquery()
        query = select(work).join(Lead, Lead.id == work.c.lead_id)
        if q:
            query = query.where(or_(Lead.name.icontains(q, autoescape=True), Lead.email.icontains(q, autoescape=True), Lead.description.icontains(q, autoescape=True)))
        if firm_id:
            query = query.where(Lead.firm_id == firm_id)
        if attention:
            query = query.where(work.c.kind == 'leads', work.c.status.in_(['pending', 'declined']))
        rows = self.session.execute(query.order_by(work.c.created_at.desc(), work.c.id.desc()).limit(limit).offset(offset)).mappings().all()
        lead_ids = [row['lead_id'] for row in rows]
        by_id = {lead.id: lead for lead in self.session.scalars(select(Lead).where(Lead.id.in_(lead_ids))).all()} if rows else {}
        return [AdminWorkResponse.model_validate({**row, 'lead': by_id[row['lead_id']]}) for row in rows]

    def activity(self, user: User, limit: int, offset: int) -> list[AuditEvent]:
        if user.role != 'admin':
            raise PermissionError('Only admins may inspect activity')
        return list(self.session.scalars(select(AuditEvent).order_by(AuditEvent.created_at.desc(), AuditEvent.id.desc()).limit(limit).offset(offset)).all())
