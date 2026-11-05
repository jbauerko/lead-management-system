from tests.test_documents import client, auth, lead


def test_admin_overview_progress_and_assignment_reason(client):
    plaintiff = auth(client, 'plaintiff')
    staff = auth(client, 'attorney')
    admin = auth(client, 'admin')
    lead_id = lead(client, plaintiff)
    accepted = client.post(f'/api/leads/{lead_id}/accept', headers=staff).json()
    case_id = accepted['case_id']
    client.patch(f'/api/cases/{case_id}', headers=staff, json={'status': 'in_progress', 'progress': 'Shared evidence review'})
    client.post(f'/api/cases/{case_id}/notes', headers=staff, json={'body': 'Never share this strategy'})
    response = client.get(f'/api/cases/{case_id}/progress', headers=plaintiff)
    assert response.status_code == 200
    assert any(event['progress'] == 'Shared evidence review' for event in response.json())
    assert 'Never share' not in response.text and 'actor' not in response.text
    assert client.get(f'/api/cases/{case_id}/progress', headers=auth(client, 'plaintiff2')).status_code == 404
    work = client.get('/api/admin/work', headers=admin)
    assert work.status_code == 200
    assert len(work.json()) == 1 and work.json()[0]['kind'] == 'cases'
    assert work.json()[0]['id'] == case_id
    assert client.get('/api/admin/work?attention=true', headers=admin).json() == []
    assert client.get('/api/admin/work', headers=staff).status_code == 403
    assert client.get('/api/admin/activity', headers=plaintiff).status_code == 403
    target = next(f for f in client.get('/api/firms', headers=admin).json() if f['name'] == 'South Legal')
    moved = client.patch(f'/api/cases/{case_id}/assignment', headers=admin, json={'firm_id': target['id'], 'reason': 'Capacity balancing'})
    assert moved.status_code == 200
    activity = client.get('/api/admin/activity', headers=admin)
    assert activity.status_code == 200
    assert any(e['changes'].get('reason', {}).get('to') == 'Capacity balancing' for e in activity.json())
    assert client.get(f"/api/admin/work?firm_id={target['id']}", headers=admin).json()[0]['id'] == case_id
    assert client.get('/api/admin/work?q=nonexistent', headers=admin).json() == []
