"""Persistence models. Authorization and workflow transitions belong in services."""
from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import BigInteger, CheckConstraint, DateTime, column, ForeignKey, Index, JSON, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class IdentityMixin:
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Firm(IdentityMixin, Base):
    __tablename__ = 'firms'
    name: Mapped[str] = mapped_column(String(200))
    active: Mapped[bool] = mapped_column(default=True)


class User(IdentityMixin, Base):
    __tablename__ = 'users'
    __table_args__ = (
        CheckConstraint("role IN ('plaintiff', 'attorney', 'paralegal', 'admin')", name='user_role'),
        CheckConstraint("(role IN ('attorney', 'paralegal') AND firm_id IS NOT NULL) OR (role IN ('plaintiff', 'admin') AND firm_id IS NULL)", name='user_firm_membership'),
        Index('ix_users_email_lower', func.lower(column('email')), unique=True),
    )
    name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(320))
    role: Mapped[str] = mapped_column(String(20))
    firm_id: Mapped[UUID | None] = mapped_column(ForeignKey('firms.id'), index=True)
    active: Mapped[bool] = mapped_column(default=True)


class RoutingRule(IdentityMixin, Base):
    __tablename__ = 'routing_rules'
    __table_args__ = (UniqueConstraint('region', 'category', name='uq_routing_region_category'),)
    region: Mapped[str] = mapped_column(String(100))
    category: Mapped[str] = mapped_column(String(100))
    firm_id: Mapped[UUID] = mapped_column(ForeignKey('firms.id'), index=True)


class Lead(IdentityMixin, Base):
    __tablename__ = 'leads'
    __table_args__ = (
        CheckConstraint("status IN ('pending', 'assigned', 'accepted', 'declined')", name='lead_status'),
        CheckConstraint("status = 'pending' OR firm_id IS NOT NULL", name='lead_assignment_required'),
        Index('ix_leads_firm_status_created', 'firm_id', 'status', 'created_at', 'id'),
        Index('ix_leads_plaintiff_created', 'plaintiff_id', 'created_at', 'id'),
        Index('ix_leads_status_created', 'status', 'created_at', 'id'),
    )
    plaintiff_id: Mapped[UUID] = mapped_column(ForeignKey('users.id'))
    firm_id: Mapped[UUID | None] = mapped_column(ForeignKey('firms.id'))
    name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(320))
    region: Mapped[str] = mapped_column(String(100))
    category: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default='pending')


class Case(IdentityMixin, Base):
    """Assignment and plaintiff are inherited from the lead: one source of truth."""
    __tablename__ = 'cases'
    __table_args__ = (
        CheckConstraint("status IN ('open', 'in_progress', 'closed')", name='case_status'),
        Index('ix_cases_status_created', 'status', 'created_at', 'id'),
    )
    lead_id: Mapped[UUID] = mapped_column(ForeignKey('leads.id'), unique=True)
    status: Mapped[str] = mapped_column(String(20), default='open')
    progress: Mapped[str] = mapped_column(Text, default='')


class PrivateNote(IdentityMixin, Base):
    __tablename__ = 'private_notes'
    __table_args__ = (Index('ix_notes_case_firm_created', 'case_id', 'authoring_firm_id', 'created_at', 'id'),)
    case_id: Mapped[UUID] = mapped_column(ForeignKey('cases.id'))
    author_id: Mapped[UUID] = mapped_column(ForeignKey('users.id'), index=True)
    authoring_firm_id: Mapped[UUID] = mapped_column(ForeignKey('firms.id'), index=True)
    body: Mapped[str] = mapped_column(Text)


class Document(IdentityMixin, Base):
    """Lead attachment persists through case creation and reassignment."""
    __tablename__ = 'documents'
    __table_args__ = (
        CheckConstraint('size_bytes > 0', name='document_positive_size'),
        Index('ix_documents_lead_created', 'lead_id', 'created_at', 'id'),
    )
    lead_id: Mapped[UUID] = mapped_column(ForeignKey('leads.id'))
    uploader_id: Mapped[UUID] = mapped_column(ForeignKey('users.id'), index=True)
    storage_key: Mapped[str] = mapped_column(String(500), unique=True)
    filename: Mapped[str] = mapped_column(String(255))
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    content_type: Mapped[str] = mapped_column(String(100), default='application/pdf')


class AuditEvent(IdentityMixin, Base):
    """Service-owned append-only history; changes contain non-sensitive field values."""
    __tablename__ = 'audit_events'
    __table_args__ = (Index('ix_audit_lead_created', 'lead_id', 'created_at', 'id'),)
    lead_id: Mapped[UUID] = mapped_column(ForeignKey('leads.id'))
    actor_id: Mapped[UUID] = mapped_column(ForeignKey('users.id'), index=True)
    case_id: Mapped[UUID | None] = mapped_column(ForeignKey('cases.id'), index=True)
    action: Mapped[str] = mapped_column(String(100))
    changes: Mapped[dict] = mapped_column(JSON)
