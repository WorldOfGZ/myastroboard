"""API tests for Astrodex catalogue alias switching."""
import os
import sys
import types

import pytest

backend_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'backend')
sys.path.insert(0, backend_path)

import astrodex  # type: ignore[import-not-found]
import catalogue_aliases  # type: ignore[import-not-found]
from auth import user_manager  # type: ignore[import-not-found]

if 'psutil' not in sys.modules:
    sys.modules['psutil'] = types.ModuleType('psutil')

from app import app  # type: ignore[import-not-found]


@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        user = user_manager.get_user_by_username('admin')
        assert user is not None
        with client.session_transaction() as session:
            session['user_id'] = user.user_id
            session['username'] = user.username
            session['role'] = user.role
        yield client


def _fake_alias_entry(catalogue: str, object_name: str) -> dict:
    entry = {
        'group_id': 'OBJ000001',
        'aliases': {
            'GaryImm': 'M81',
            'OpenNGC': 'NGC 3031'
        }
    }

    if catalogue == 'GaryImm' and object_name == 'M81':
        return entry
    if catalogue == 'OpenNGC' and object_name == 'NGC 3031':
        return entry
    return {}


def test_switch_catalogue_name_api(client, monkeypatch):
    """Test switching displayed name via API endpoint."""
    monkeypatch.setattr(catalogue_aliases, 'get_alias_entry', _fake_alias_entry)

    user = user_manager.get_user_by_username('admin')
    item = astrodex.create_astrodex_item(
        user.user_id,
        {'name': 'M81', 'type': 'Galaxy', 'catalogue': 'GaryImm'},
        username=user.username
    )
    assert item is not None

    response = client.post(
        f"/api/astrodex/items/{item['id']}/catalogue-name",
        json={'catalogue': 'OpenNGC'}
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload['status'] == 'success'
    assert payload['item']['name'] == 'NGC 3031'
    assert payload['item']['catalogue'] == 'OpenNGC'


def test_switch_catalogue_name_api_missing_catalogue(client):
    """Test missing catalogue field is rejected."""
    response = client.post('/api/astrodex/items/bad-id/catalogue-name', json={})
    assert response.status_code == 400
    payload = response.get_json()
    assert payload['error'] == 'Target catalogue is required'
