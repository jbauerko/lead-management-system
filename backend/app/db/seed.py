"""Non-destructive demo fixtures. Run with python -m app.db.seed after migrations."""
from uuid import NAMESPACE_URL, uuid5
from sqlalchemy.orm import Session
from app.db.models import Firm, User, RoutingRule
from app.db.session import SessionLocal


def demo_id(key: str):
    return uuid5(NAMESPACE_URL, f'lead-management-demo:{key}')


DEMO_USERS = {
    'plaintiff@example.com': ('Pat Plaintiff', 'plaintiff', None),
    'plaintiff2@example.com': ('Alex Plaintiff', 'plaintiff', None),
    'attorney@example.com': ('Taylor Attorney', 'attorney', 'north'),
    'paralegal@example.com': ('Morgan Paralegal', 'paralegal', 'north'),
    'attorney2@example.com': ('Jordan Attorney', 'attorney', 'south'),
    'paralegal2@example.com': ('Casey Paralegal', 'paralegal', 'south'),
    'admin@example.com': ('Sam Admin', 'admin', None),
}


def seed(session: Session) -> None:
    """Insert missing fixtures only; preserve edits and let caller own the transaction."""
    for key, name in [('north', 'North Legal'), ('south', 'South Legal')]:
        if session.get(Firm, demo_id(key)) is None:
            session.add(Firm(id=demo_id(key), name=name))
    session.flush()
    for email, (name, role, firm) in DEMO_USERS.items():
        if session.get(User, demo_id(email)) is None:
            session.add(User(id=demo_id(email), name=name, email=email, role=role,
                             firm_id=demo_id(firm) if firm else None))
    session.flush()
    for region, category, firm in [
        ('NY', 'personal_injury', 'north'),
        ('CA', 'employment', 'south'),
        ('TX', 'personal_injury', 'south'),
        ('FL', 'housing', 'south'),
        ('IL', 'employment', 'north'),
        ('NJ', 'family_law', 'north'),
        ('PA', 'consumer', 'south'),
        ('MA', 'medical_malpractice', 'north'),
        ('GA', 'workers_compensation', 'south'),
        ('WA', 'immigration', 'north'),
    ]:
        key = f'routing:{region}:{category}'
        if session.get(RoutingRule, demo_id(key)) is None:
            session.add(RoutingRule(id=demo_id(key), region=region, category=category, firm_id=demo_id(firm)))
    session.flush()


if __name__ == '__main__':
    with SessionLocal.begin() as session:
        seed(session)
    print('Demo firms, users, and routing mappings ready.')
