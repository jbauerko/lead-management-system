from fastapi.testclient import TestClient
from sqlalchemy import select
from app.main import app
from app.db.session import get_session
from app.db.seed import seed
from app.db.models import AuditEvent


def test_routing_and_isolation(session):
    seed(session)
    session.commit()
    def override():
        yield session
    app.dependency_overrides[get_session] = override
    try:
        with TestClient(app) as client:
            def auth(email):
                r = client.post('/api/auth/login', json={'email': email, 'password': 'demo-password'})
                assert r.status_code == 200
                return {'Authorization': 'Bearer ' + r.json()['access_token']}
            assert client.get('/api/leads').status_code == 401
            assert client.get('/api/leads', headers={'Authorization': 'Bearer invalid'}).status_code == 401
            assert client.post('/api/auth/login', json={'email': 'admin@example.com', 'password': 'wrong'}).status_code == 401
            plaintiff = auth('plaintiff@example.com')
            payload = dict(name='Pat', email='pat@example.com', region='ny', category='PERSONAL_INJURY', description='Help')
            r = client.post('/api/leads', json=payload, headers=plaintiff)
            assert r.status_code == 201, r.text
            lead = r.json()
            assert lead['status'] == 'assigned'
            for email in ['plaintiff@example.com', 'attorney@example.com', 'paralegal@example.com', 'admin@example.com']:
                assert client.get('/api/leads/' + lead['id'], headers=auth(email)).status_code == 200
            for email in ['plaintiff2@example.com', 'attorney2@example.com']:
                headers = auth(email)
                assert client.get('/api/leads/' + lead['id'], headers=headers).status_code == 404
                assert client.get('/api/leads', headers=headers).json() == []
            assert client.post('/api/leads', json=payload, headers=auth('attorney@example.com')).status_code == 403
            unmatched = client.post('/api/leads', json={**payload, 'region': 'ZZ'}, headers=plaintiff).json()
            assert unmatched['status'] == 'pending' and unmatched['firm_id'] is None
            assert len(session.scalars(select(AuditEvent)).all()) == 2
    finally:
        app.dependency_overrides.clear()


def test_inbox_filters_preserve_firm_scope(session):
    seed(session)
    session.commit()
    def override():
        yield session
    app.dependency_overrides[get_session] = override
    try:
        with TestClient(app) as client:
            def auth(email):
                token = client.post('/api/auth/login', json={'email': email, 'password': 'demo-password'}).json()['access_token']
                return {'Authorization': 'Bearer ' + token}
            plaintiff = auth('plaintiff@example.com')
            client.post('/api/leads', headers=plaintiff, json={'name': 'Pat', 'email': 'pat@example.com', 'region': 'NY', 'category': 'personal_injury', 'description': 'Injury inquiry'})
            staff = auth('attorney@example.com')
            matching = client.get('/api/leads?region=ny&category=PERSONAL_INJURY&status=assigned&q=injury', headers=staff)
            assert matching.status_code == 200 and len(matching.json()) == 1
            assert client.get('/api/leads?region=CA', headers=staff).json() == []
            assert client.get('/api/leads?category=employment', headers=staff).json() == []
            assert client.get('/api/leads?region=NY', headers=auth('attorney2@example.com')).json() == []
    finally:
        app.dependency_overrides.clear()
