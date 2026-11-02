"""Request-scoped dependency graph. All services share one session and transaction owner."""
from fastapi import Depends
from sqlalchemy.orm import Session
from app.db.session import get_session
from app.services.transactions import Transactions
from app.services.audit import AuditService
from app.services.firms import FirmService
from app.services.assignments import AssignmentService
from app.services.cases import CaseService
from app.services.leads import LeadService
from app.services.notes import NoteService


def get_transactions(session: Session = Depends(get_session)) -> Transactions:
    return Transactions(session)


def get_audit_service(session: Session = Depends(get_session), tx: Transactions = Depends(get_transactions)) -> AuditService:
    return AuditService(session, tx)


def get_firm_service(session: Session = Depends(get_session), tx: Transactions = Depends(get_transactions)) -> FirmService:
    return FirmService(session, tx)


def get_assignment_service(session: Session = Depends(get_session), tx: Transactions = Depends(get_transactions),
                           firms: FirmService = Depends(get_firm_service), audit: AuditService = Depends(get_audit_service)) -> AssignmentService:
    return AssignmentService(session, tx, firms, audit)


def get_case_service(session: Session = Depends(get_session), tx: Transactions = Depends(get_transactions),
                     assignments: AssignmentService = Depends(get_assignment_service), audit: AuditService = Depends(get_audit_service)) -> CaseService:
    return CaseService(session, tx, assignments, audit)


def get_lead_service(session: Session = Depends(get_session), tx: Transactions = Depends(get_transactions),
                     cases: CaseService = Depends(get_case_service), assignments: AssignmentService = Depends(get_assignment_service),
                     audit: AuditService = Depends(get_audit_service)) -> LeadService:
    return LeadService(session, tx, cases, assignments, audit)


def get_note_service(session: Session = Depends(get_session), tx: Transactions = Depends(get_transactions),
                     cases: CaseService = Depends(get_case_service)) -> NoteService:
    return NoteService(session, tx, cases)

from pathlib import Path
from app.core.config import get_settings
from app.storage.local import LocalStorage, Storage
from app.services.documents import DocumentService


def get_storage() -> LocalStorage:
    return LocalStorage(Path(get_settings().pdf_storage_path))


def get_document_service(session: Session = Depends(get_session), tx: Transactions = Depends(get_transactions),
                         leads: LeadService = Depends(get_lead_service), cases: CaseService = Depends(get_case_service),
                         assignments: AssignmentService = Depends(get_assignment_service), storage: Storage = Depends(get_storage)) -> DocumentService:
    return DocumentService(session, tx, leads, cases, assignments, storage, get_settings().pdf_max_bytes)
