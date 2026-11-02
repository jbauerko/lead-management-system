import pytest
from sqlalchemy import select, func
from app.db.models import AuditEvent, Case, Lead, User
from app.db.seed import seed, demo_id
from tests.services import services
from app.services.errors import Conflict, NotFound


def setup(session):
    seed(session)
    lead = Lead(plaintiff_id=demo_id('plaintiff@example.com'), firm_id=demo_id('north'), name='Pat',
                email='pat@example.com', region='NY', category='personal_injury', description='Help', status='assigned')
    session.add(lead)
    session.commit()
    return lead.id


def user(session, email):
    return session.get(User, demo_id(email + '@example.com'))


def test_accept_and_case_access(session):
    lead_id = setup(session)
    staff = user(session, 'attorney')
    assert services(session)[0].review( staff, lead_id, accept=True).status == 'accepted'
    case = session.scalar(select(Case))
    for name in ('plaintiff', 'attorney', 'paralegal', 'admin'):
        viewer = user(session, name)
        assert services(session)[1].get( viewer, case.id).id == case.id
        assert len(services(session)[1].list( viewer, limit=50, offset=0)) == 1
    for name in ('plaintiff2', 'attorney2'):
        viewer = user(session, name)
        with pytest.raises(NotFound):
            services(session)[1].get( viewer, case.id)
        assert services(session)[1].list( viewer, limit=50, offset=0) == []
    with pytest.raises(Conflict):
        services(session)[0].review( staff, lead_id, accept=True)
    assert session.scalar(select(func.count()).select_from(Case)) == 1
    assert session.scalar(select(func.count()).select_from(AuditEvent)) == 1


def test_decline_and_review_permissions(session):
    lead_id = setup(session)
    for name in ('plaintiff', 'admin'):
        with pytest.raises(PermissionError):
            services(session)[0].review( user(session, name), lead_id, accept=False)
    with pytest.raises(NotFound):
        services(session)[0].review( user(session, 'attorney2'), lead_id, accept=True)
    staff = user(session, 'paralegal')
    assert services(session)[0].review( staff, lead_id, accept=False).status == 'declined'
    assert session.scalar(select(func.count()).select_from(Case)) == 0
    with pytest.raises(Conflict):
        services(session)[0].review( staff, lead_id, accept=True)


def test_concurrent_acceptance(connection, session):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier
    from sqlalchemy.orm import Session
    lead_id = setup(session)
    session.rollback()
    schema = connection.exec_driver_sql('SELECT current_schema()').scalar_one()
    connection.commit()
    barrier = Barrier(2)

    def accept():
        with connection.engine.connect() as conn:
            conn.exec_driver_sql(f'SET search_path TO "{schema}"')
            conn.commit()
            try:
                with Session(conn) as worker:
                    staff = user(worker, 'attorney')
                    barrier.wait(timeout=10)
                    try:
                        services(worker)[0].review( staff, lead_id, accept=True)
                        return 'accepted'
                    except Conflict:
                        return 'conflict'
            finally:
                conn.rollback()
                conn.exec_driver_sql('SET search_path TO public')
                conn.commit()

    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(accept) for _ in range(2)]
        assert sorted(f.result(timeout=20) for f in futures) == ['accepted', 'conflict']
    assert session.scalar(select(func.count()).select_from(Case)) == 1
    assert session.scalar(select(func.count()).select_from(AuditEvent)) == 1


def test_progress_notes_and_reassignment(session):

    from app.schemas.cases import CaseUpdate
    lead_id = setup(session)
    staff = user(session, 'attorney')
    admin = user(session, 'admin')
    services(session)[0].review( staff, lead_id, accept=True)
    case_id = session.scalar(select(Case.id))
    services(session)[1].update( staff, case_id, CaseUpdate(status='in_progress', progress='Reviewing documents'))
    note = services(session)[2].create( staff, case_id, 'Private strategy')
    note_id = note.id
    assert len(services(session)[2].list( staff, case_id, 50, 0)) == 1
    with pytest.raises(PermissionError):
        services(session)[2].list( user(session, 'plaintiff'), case_id, 50, 0)
    with pytest.raises(PermissionError):
        services(session)[0].reassign( staff, lead_id, demo_id('south'))
    services(session)[0].reassign( admin, lead_id, demo_id('south'))
    with pytest.raises(NotFound):
        services(session)[1].get( staff, case_id)
    with pytest.raises(NotFound):
        services(session)[2].create( staff, case_id, 'Forbidden')
    with pytest.raises(NotFound):
        services(session)[2].list( staff, case_id, 50, 0)
    new_staff = user(session, 'attorney2')
    assert services(session)[1].get( new_staff, case_id).progress == 'Reviewing documents'
    assert services(session)[2].list( new_staff, case_id, 50, 0) == []
    assert services(session)[2].list( admin, case_id, 50, 0)[0].id == note_id
    assert services(session)[1].get( user(session, 'plaintiff'), case_id).id == case_id
    assert len(services(session)[0].history( admin, lead_id, 50, 0)) == 3


def test_declined_resolution(session):

    lead_id = setup(session)
    services(session)[0].review( user(session, 'attorney'), lead_id, accept=False)
    assert services(session)[0].reassign( user(session, 'admin'), lead_id, demo_id('south')).status == 'assigned'
    assert services(session)[0].review( user(session, 'attorney2'), lead_id, accept=True).status == 'accepted'


def test_injected_audit_failure_rolls_back_acceptance(session):
    lead_id = setup(session)
    leads, cases, notes = services(session)

    class FailingAudit:
        def record(self, **values):
            raise RuntimeError('Audit unavailable')

    leads.audit = FailingAudit()
    with pytest.raises(RuntimeError, match='Audit unavailable'):
        leads.review(user(session, 'attorney'), lead_id, accept=True)
    assert session.get(Lead, lead_id).status == 'assigned'
    assert session.scalar(select(func.count()).select_from(Case)) == 0


def test_nested_service_calls_commit_once(session, monkeypatch):
    lead_id = setup(session)
    leads, cases, notes = services(session)
    leads.review(user(session, 'attorney'), lead_id, accept=True)
    case_id = session.scalar(select(Case.id))
    commits = []
    original_commit = session.commit
    def commit():
        commits.append(True)
        original_commit()
    monkeypatch.setattr(session, 'commit', commit)
    cases.reassign(user(session, 'admin'), case_id, demo_id('south'))
    assert len(commits) == 1
    assert session.get(Lead, lead_id).firm_id == demo_id('south')
