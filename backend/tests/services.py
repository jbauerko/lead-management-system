"""Explicit dependency composition for service integration tests."""
from app.services.transactions import Transactions
from app.services.firms import FirmService
from app.services.audit import AuditService
from app.services.assignments import AssignmentService
from app.services.cases import CaseService
from app.services.leads import LeadService
from app.services.notes import NoteService


def services(session):
    tx = Transactions(session)
    audit = AuditService(session, tx)
    assignments = AssignmentService(session, tx, FirmService(session, tx), audit)
    cases = CaseService(session, tx, assignments, audit)
    return LeadService(session, tx, cases, assignments, audit), cases, NoteService(session, tx, cases)
