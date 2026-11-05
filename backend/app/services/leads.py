from __future__ import annotations

from app.db.models import AuditEvent
from app.services.transactions import Transactions
from app.services.cases import CaseService
from app.services.assignments import AssignmentService
from app.services.audit import AuditService
from uuid import UUID
from sqlalchemy import select, or_
from sqlalchemy.orm import Session
from app.db.models import Firm, Lead, RoutingRule, User
from app.schemas.leads import LeadCreate
from app.services.access import lead_access
from app.services.errors import Conflict, NotFound
from app.services.transactions import transactional

class LeadService:
    """Handle plaintiff inquiries and the firm's acceptance decision.

    Required by instructions.md:
        Plaintiffs submit contact details, region, category, and a description.
        Route each lead to one firm using region/category mappings; unmatched
        leads wait for an admin. Firm staff accept or decline. Acceptance creates
        a case; declined leads remain available for admin resolution.
        Plaintiffs see only their own work; staff see their assigned firm's work.

    Assumptions we chose:
        The signed-in plaintiff owns the inquiry, even if its contact email differs.
        Region/category keys are normalized before matching. Only assigned leads
        can be reviewed, and admins resolve declined leads by assigning them again.
        Admins cannot accept or decline on a firm's behalf. Repeated decisions
        return a conflict rather than repeating the original successful response.

    Technical choices:
        Lock the lead during review. Save its decision, new case, and audit event
        together so concurrent requests cannot create two cases.
    """

    def __init__(self, session: Session, transactions: Transactions, cases: CaseService, assignments: AssignmentService, audit: AuditService):
        self.session = session
        self.transactions = transactions
        self.cases = cases
        self.assignments = assignments
        self.audit = audit

    @transactional
    def submit(self, user: User, data: LeadCreate) -> Lead:
        if user.role != 'plaintiff':
            raise PermissionError('Only plaintiffs may submit leads')
        # The signed-in plaintiff owns the lead; the form only supplies contact details.
        values = data.model_dump()
        values['region'] = values['region'].upper()
        values['category'] = values['category'].lower()
        # Route to the active firm for this region and category.
        # If none matches, leave the lead pending for an admin to assign.
        rule = self.session.scalar(select(RoutingRule).join(Firm).where(
            RoutingRule.region == values['region'], RoutingRule.category == values['category'], Firm.active.is_(True)))
        lead = Lead(**values, plaintiff_id=user.id, firm_id=rule.firm_id if rule else None,
                    status='assigned' if rule else 'pending')
        self.session.add(lead)
        self.session.flush()
        self.audit.record(lead_id=lead.id, actor_id=user.id, action='lead_submitted', changes={
            'status': {'from': None, 'to': lead.status},
            'firm_id': {'from': None, 'to': str(lead.firm_id) if lead.firm_id else None}})
        self.session.flush()
        self.session.refresh(lead)
        return lead

    @transactional
    def review(self, user: User, lead_id: UUID, *, accept: bool) -> Lead:
        if user.role not in ('attorney', 'paralegal'):
            raise PermissionError('Only firm staff may review leads')
        # An admin might be moving this lead at the same time. Wait for the lock,
        # then check that it still belongs to the firm making this decision.
        lead = self.assignments.lock(lead_id)
        if lead is None or lead.firm_id != user.firm_id:
            raise NotFound('Lead not found')
        # Only assigned leads are ready for a decision. Declined leads need admin
        # follow-up, and accepted leads must not create another case.
        if lead.status != 'assigned':
            raise Conflict('Only assigned leads may be accepted or declined')
        lead.status = 'accepted' if accept else 'declined'
        # Declining keeps the lead for an admin to resolve. Accepting creates a case.
        # Save the decision, case, and history together—or save none of them.
        case = None
        if accept:
            case = self.cases.create_from_lead(lead)
        self.audit.record(lead_id=lead.id, actor_id=user.id,
                               case_id=case.id if case else None,
                               action='lead_accepted' if accept else 'lead_declined',
                               changes={'status': {'from': 'assigned', 'to': lead.status}})
        self.session.flush()
        self.session.refresh(lead)
        return lead

    def accept(self, user: User, lead_id: UUID) -> Lead:
        return self.review(user, lead_id, accept=True)

    def decline(self, user: User, lead_id: UUID) -> Lead:
        return self.review(user, lead_id, accept=False)

    def list(self, user: User, *, limit: int = 50, offset: int = 0, q: str | None = None, status: str | None = None, region: str | None = None, category: str | None = None) -> list[Lead]:
        # Start with leads this user can see, then search and paginate within them.
        query = select(Lead).where(lead_access(user))
        if q:
            query = query.where(or_(Lead.name.icontains(q, autoescape=True), Lead.email.icontains(q, autoescape=True), Lead.description.icontains(q, autoescape=True)))
        if status:
            query = query.where(Lead.status == status)
        if region:
            query = query.where(Lead.region == region.strip().upper())
        if category:
            query = query.where(Lead.category == category.strip().lower())
        return list(self.session.scalars(query.order_by(Lead.created_at.desc(), Lead.id.desc()).limit(limit).offset(offset)).all())

    def get(self, user: User, lead_id: UUID) -> Lead:
        lead = self.session.scalar(select(Lead).where(Lead.id == lead_id, lead_access(user)))
        # Use the same response for missing leads and leads this user cannot see.
        if lead is None:
            raise NotFound('Lead not found')
        return lead

    def reassign(self, user: User, lead_id: UUID, firm_id: UUID, reason: str = "") -> Lead:
        return self.assignments.reassign(user, lead_id, firm_id, reason)

    def history(self, user: User, lead_id: UUID, limit: int, offset: int) -> list[AuditEvent]:
        return self.audit.history(user, lead_id, limit, offset)
