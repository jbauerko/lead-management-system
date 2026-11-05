from tests.test_documents import client
from app.core.config import get_settings


def test_demo_reference_is_opt_in_and_reads_current_mappings(client, monkeypatch):
    monkeypatch.setattr(get_settings(), 'demo_debug_enabled', False)
    assert client.get('/api/debug/demo').status_code == 404
    monkeypatch.setattr(get_settings(), 'demo_debug_enabled', True)
    response = client.get('/api/debug/demo')
    assert response.status_code == 200
    assert response.headers['cache-control'] == 'no-store'
    data = response.json()
    assert data['password'] == get_settings().demo_password
    assert any(a['email'] == 'attorney2@example.com' and a['firm'] == 'South Legal' for a in data['accounts'])
    assert any(m['region'] == 'NY' and m['category'] == 'personal_injury' and m['firm'] == 'North Legal' for m in data['mappings'])
    assert not any(m['region'] == 'NY' and m['category'] == 'employment' for m in data['mappings'])
