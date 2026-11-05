import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, func
from app.main import app
from app.db.session import get_session
from app.db.seed import seed, demo_id
from app.db.models import Case, Document, Firm
from app.api.dependencies import get_storage
from app.storage.local import LocalStorage

PDF = b'%PDF-1.7\nDemo PDF bytes\n%%EOF\n'


@pytest.fixture
def client(session, tmp_path):
    seed(session)
    session.commit()
    def override():
        yield session
    app.dependency_overrides[get_session] = override
    app.dependency_overrides[get_storage] = lambda: LocalStorage(tmp_path)
    try:
        with TestClient(app) as client:
            yield client
    finally:
        app.dependency_overrides.clear()


def auth(client, name):
    response = client.post('/api/auth/login', json={'email': name + '@example.com', 'password': 'demo-password'})
    assert response.status_code == 200
    return {'Authorization': 'Bearer ' + response.json()['access_token']}


def lead(client, headers):
    response = client.post('/api/leads', headers=headers, json=dict(name='Pat', email='pat@example.com',
        region='NY', category='personal_injury', description='Help'))
    assert response.status_code == 201
    return response.json()['id']


def test_document_lifecycle_and_reassignment(client, session):
    plaintiff, staff, admin = [auth(client, name) for name in ['plaintiff', 'attorney', 'admin']]
    lead_id = lead(client, plaintiff)
    path = f'/api/leads/{lead_id}/documents'
    assert client.post(path, files={'file': ('x.pdf', PDF)}).status_code == 401
    response = client.post(path, headers=plaintiff, files={'file': ('../../evidence.pdf', PDF, 'application/pdf')})
    assert response.status_code == 201, response.text
    document = response.json()
    assert document['filename'] == 'evidence.pdf' and 'storage_key' not in document
    download = f"/api/documents/{document['id']}/download"
    for viewer in [plaintiff, staff, admin]:
        response = client.get(download, headers=viewer)
        assert response.status_code == 200 and response.content == PDF
        assert response.headers['cache-control'] == 'no-store'
    outsider = auth(client, 'plaintiff2')
    assert client.get(path, headers=outsider).status_code == 404
    assert client.get(download, headers=outsider).status_code == 404
    assert client.post(path, headers=outsider, files={'file': ('x.pdf', PDF)}).status_code == 404
    assert client.post(f'/api/leads/{lead_id}/accept', headers=staff).status_code == 200
    case_id = str(session.scalar(select(Case.id)))
    accepted_lead = client.get(f'/api/leads/{lead_id}', headers=plaintiff).json()
    assert accepted_lead['case_id'] == case_id
    assert accepted_lead['firm']['name'] == 'North Legal'
    case_response = client.get(f'/api/cases/{case_id}', headers=plaintiff).json()
    assert case_response['lead']['id'] == lead_id
    assert case_response['lead']['firm']['name'] == 'North Legal'
    assert 'private_notes' not in case_response
    case_path = f'/api/cases/{case_id}/documents'
    assert client.get(case_path, headers=plaintiff).json()[0]['id'] == document['id']
    assert client.post(case_path, headers=staff, files={'file': ('firm.pdf', PDF)}).status_code == 201
    assert client.patch(f'/api/cases/{case_id}', headers=staff, json={'status': 'in_progress', 'progress': 'Review'}).status_code == 200
    assert client.post(f'/api/cases/{case_id}/notes', headers=staff, json={'body': 'Private'}).status_code == 201
    assert client.patch(f'/api/cases/{case_id}/assignment', headers=admin, json={'firm_id': str(demo_id('south'))}).status_code == 200
    moved = client.get(f'/api/cases/{case_id}', headers=plaintiff).json()
    assert moved['lead']['firm']['name'] == 'South Legal'
    assert moved['lead']['case_id'] == case_id
    new_staff = auth(client, 'attorney2')
    assert client.get(download, headers=staff).status_code == 404
    assert client.get(case_path, headers=staff).status_code == 404
    assert client.get(download, headers=new_staff).content == PDF
    assert len(client.get(case_path, headers=new_staff).json()) == 2
    assert client.get(f'/api/cases/{case_id}/notes', headers=new_staff).json() == []
    assert client.get(f'/api/cases/{case_id}/notes', headers=plaintiff).status_code == 403
    inspected_notes = client.get(f'/api/cases/{case_id}/notes', headers=admin).json()
    assert len(inspected_notes) == 1
    assert inspected_notes[0]['authoring_firm']['name'] == 'North Legal'
    assert inspected_notes[0]['author']['email'] == 'attorney@example.com'
    history = client.get(f'/api/leads/{lead_id}/history', headers=admin).json()
    assert any(event['actor']['email'] == 'admin@example.com' and event['action'] == 'assignment_changed' for event in history)
    assert client.get(f'/api/leads/{lead_id}/history', headers=admin).status_code == 200


def test_validation_and_firm_listing(client, session, tmp_path):
    plaintiff, admin = auth(client, 'plaintiff'), auth(client, 'admin')
    path = f'/api/leads/{lead(client, plaintiff)}/documents'
    for filename, content in [('x.txt', PDF), ('x.pdf', b'not a pdf'), ('x.pdf', b'')]:
        assert client.post(path, headers=plaintiff, files={'file': (filename, content)}).status_code == 422
    from app.core.config import get_settings
    settings = get_settings()
    previous = settings.pdf_max_bytes
    settings.pdf_max_bytes = 10
    try:
        assert client.post(path, headers=plaintiff, files={'file': ('x.pdf', PDF)}).status_code == 413
    finally:
        settings.pdf_max_bytes = previous
    assert session.scalar(select(func.count()).select_from(Document)) == 0
    assert list(tmp_path.iterdir()) == []
    assert client.get('/api/firms', headers=plaintiff).status_code == 403
    assert len(client.get('/api/firms', headers=admin).json()) == 2
    session.get(Firm, demo_id('south')).active = False
    session.commit()
    assert len(client.get('/api/firms', headers=admin).json()) == 1


def test_database_failure_removes_saved_file(client, session, tmp_path, monkeypatch):
    plaintiff = auth(client, 'plaintiff')
    path = f'/api/leads/{lead(client, plaintiff)}/documents'
    def fail():
        raise RuntimeError('commit failed')
    monkeypatch.setattr(session, 'commit', fail)
    with pytest.raises(RuntimeError, match='commit failed'):
        client.post(path, headers=plaintiff, files={'file': ('x.pdf', PDF)})
    assert list(tmp_path.iterdir()) == []
    assert session.scalar(select(func.count()).select_from(Document)) == 0
