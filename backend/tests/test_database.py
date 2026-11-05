import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from app.db.models import Case, Firm, Lead, RoutingRule, User
from app.db.seed import demo_id, seed


def test_seed_is_repeatable_and_preserves_changes(session):
    seed(session)
    firm = session.get(Firm, demo_id('north'))
    firm.name = 'Edited name'
    seed(session)
    assert firm.name == 'Edited name'
    assert session.scalar(select(func.count()).select_from(Firm)) == 2
    assert session.scalar(select(func.count()).select_from(User)) == 7
    assert session.scalar(select(func.count()).select_from(RoutingRule)) == 10


@pytest.mark.parametrize('role,firm', [('attorney', None), ('paralegal', None), ('admin', 'north'), ('plaintiff', 'north'), ('invalid', None)])
def test_membership_constraints(session, role, firm):
    seed(session)
    with pytest.raises(IntegrityError), session.begin_nested():
        session.add(User(name='Invalid', email='invalid@example.com', role=role,
                         firm_id=demo_id(firm) if firm else None))
        session.flush()


def test_case_insensitive_email(session):
    seed(session)
    with pytest.raises(IntegrityError), session.begin_nested():
        session.add(User(name='Duplicate', email='PLAINTIFF@example.com', role='plaintiff'))
        session.flush()


def test_unique_routing_pair(session):
    seed(session)
    with pytest.raises(IntegrityError), session.begin_nested():
        session.add(RoutingRule(region='NY', category='personal_injury', firm_id=demo_id('south')))
        session.flush()


def test_one_case_per_lead(session):
    seed(session)
    lead = Lead(plaintiff_id=demo_id('plaintiff@example.com'), firm_id=demo_id('north'),
                name='Pat', email='plaintiff@example.com', region='NY', category='personal_injury',
                description='Demo inquiry', status='accepted')
    session.add(lead)
    session.flush()
    session.add(Case(lead_id=lead.id))
    session.flush()
    with pytest.raises(IntegrityError), session.begin_nested():
        session.add(Case(lead_id=lead.id))
        session.flush()
