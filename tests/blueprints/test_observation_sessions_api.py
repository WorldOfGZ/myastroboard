"""API tests for the Observation Log blueprint (/api/observation-sessions/*)."""
import os
import sys
import tempfile
import types
import uuid

import pytest

from observation import astrodex
from observation import observation_sessions
from utils.auth import user_manager

if 'psutil' not in sys.modules:
    sys.modules['psutil'] = types.ModuleType('psutil')

from app import app
from blueprints import observation_sessions as observation_sessions_bp_module


@pytest.fixture
def isolated_storage(monkeypatch):
    """Point both Observation Log and Astrodex storage at temporary directories."""
    with tempfile.TemporaryDirectory() as tmpdir:
        monkeypatch.setattr(
            observation_sessions, 'OBSERVATION_SESSIONS_DIR', os.path.join(tmpdir, 'observation_sessions')
        )
        monkeypatch.setattr(astrodex, 'ASTRODEX_DIR', os.path.join(tmpdir, 'astrodex'))
        monkeypatch.setattr(astrodex, 'ASTRODEX_IMAGES_DIR', os.path.join(tmpdir, 'astrodex', 'images'))
        yield tmpdir


@pytest.fixture
def client(isolated_storage):
    """Admin-authenticated test client with isolated storage."""
    app.config['TESTING'] = True
    with app.test_client() as test_client:
        user = user_manager.get_user_by_username('admin')
        assert user is not None
        with test_client.session_transaction() as session:
            session['user_id'] = user.user_id
            session['username'] = user.username
            session['role'] = user.role
        yield test_client


@pytest.fixture
def admin_user_id():
    user = user_manager.get_user_by_username('admin')
    assert user is not None
    return user.user_id


def _create_session(client, **overrides):
    payload = {'date': '2026-07-14'}
    payload.update(overrides)
    response = client.post('/api/observation-sessions', json=payload)
    assert response.status_code == 201
    return response.get_json()['data']


def _add_entry(client, session_id, **overrides):
    payload = {'name': 'M31', 'catalogue': 'Messier'}
    payload.update(overrides)
    return client.post(f'/api/observation-sessions/{session_id}/entries', json=payload)


class TestAuth:
    """Authentication and role gating."""

    def test_routes_require_login(self):
        """Every route rejects an unauthenticated caller."""
        app.config['TESTING'] = True
        with app.test_client() as anonymous:
            assert anonymous.get('/api/observation-sessions').status_code == 401
            assert anonymous.post('/api/observation-sessions', json={'date': '2026-01-01'}).status_code == 401
            assert anonymous.delete('/api/observation-sessions/x').status_code == 401

    def test_mutations_require_user_role(self, isolated_storage):
        """A read-only account can list sessions but not create them."""
        app.config['TESTING'] = True
        username = f'ro_{uuid.uuid4().hex[:8]}'
        user_manager.create_user(username, 'test123', 'read-only')

        with app.test_client() as read_only:
            with read_only.session_transaction() as session:
                session['username'] = username
                session['role'] = 'read-only'

            assert read_only.get('/api/observation-sessions').status_code == 200
            assert read_only.post('/api/observation-sessions', json={'date': '2026-01-01'}).status_code == 403


class TestSessionRoutes:
    """CRUD over sessions."""

    def test_list_empty(self, client):
        """An empty log still returns the envelope with zeroed stats."""
        payload = client.get('/api/observation-sessions').get_json()
        assert payload['sessions'] == []
        assert payload['stats']['total_sessions'] == 0

    def test_create_and_list(self, client):
        """A created session appears in the list, newest date first."""
        _create_session(client, date='2026-01-05')
        _create_session(client, date='2026-03-20')

        payload = client.get('/api/observation-sessions').get_json()
        assert [session['date'] for session in payload['sessions']] == ['2026-03-20', '2026-01-05']
        assert payload['stats']['total_sessions'] == 2

    def test_create_requires_date(self, client):
        """A session without a date is a 400."""
        response = client.post('/api/observation-sessions', json={'notes': 'undated'})
        assert response.status_code == 400
        assert 'date' in response.get_json()['error']

    def test_get_single_session(self, client):
        """A single session is returned as a bare object; unknown ids are 404."""
        session = _create_session(client)
        response = client.get(f"/api/observation-sessions/{session['id']}")
        assert response.status_code == 200
        assert response.get_json()['id'] == session['id']
        assert client.get('/api/observation-sessions/missing').status_code == 404

    def test_update_session(self, client):
        """Session-level fields are updatable through PUT."""
        session = _create_session(client)
        response = client.put(
            f"/api/observation-sessions/{session['id']}", json={'notes': 'clear', 'seeing': 2, 'transparency': 7}
        )
        assert response.status_code == 200
        data = response.get_json()['data']
        assert data['notes'] == 'clear'
        assert data['seeing'] == 2
        assert data['transparency'] == 7

    def test_update_unknown_session(self, client):
        """Updating an unknown session is a 404."""
        assert client.put('/api/observation-sessions/missing', json={'notes': 'x'}).status_code == 404

    def test_delete_session(self, client):
        """Deleting removes the session; deleting again is a 404."""
        session = _create_session(client)
        assert client.delete(f"/api/observation-sessions/{session['id']}").status_code == 200
        assert client.delete(f"/api/observation-sessions/{session['id']}").status_code == 404

    def test_sessions_are_private_to_their_owner(self, client, admin_user_id):
        """Another user's session is invisible, not just unlisted."""
        other_user = str(uuid.uuid4())
        other_session = observation_sessions.create_session(other_user, 'other', {'date': '2026-05-05'})

        assert client.get('/api/observation-sessions').get_json()['sessions'] == []
        assert client.get(f"/api/observation-sessions/{other_session['id']}").status_code == 404


class TestSessionResolution:
    """Server-side resolution of location and combination references."""

    def test_unknown_combination_is_dropped(self, client):
        """A combination the user has no access to never lands on the session."""
        session = _create_session(client, combination_id='not-a-real-combination')
        assert session['combination_id'] is None
        assert session['combination_name'] is None

    def test_custom_location_label(self, client):
        """A free-text 'somewhere else' label is kept with its typed coordinates."""
        session = _create_session(
            client,
            location_name='Col du Galibier',
            location_latitude=45.06,
            location_longitude=6.4,
        )
        assert session['location_id'] is None
        assert session['location_name'] == 'Col du Galibier'
        assert session['location_latitude'] == pytest.approx(45.06)

    def test_unknown_location_id_without_label_clears_location(self, client):
        """An unresolvable preset id with no fallback label resolves to no location."""
        session = _create_session(client, location_id='nope')
        assert session['location_id'] is None
        assert session['location_name'] is None

    def test_location_untouched_when_update_omits_it(self, client):
        """Editing an unrelated field must not disturb an existing location snapshot."""
        session = _create_session(client, location_name='Backyard')
        updated = client.put(f"/api/observation-sessions/{session['id']}", json={'notes': 'x'}).get_json()['data']
        assert updated['location_name'] == 'Backyard'

    def test_sqm_prefilled_from_location_preset(self, client, monkeypatch):
        """A new session inherits the chosen preset's configured SQM when none is given."""
        preset = {'id': 'preset-1', 'name': 'Dark Site', 'latitude': 44.0, 'longitude': 5.0, 'elevation': 900, 'sqm': 21.6}
        monkeypatch.setattr(observation_sessions_bp_module, 'load_config', lambda: {'locations': [preset]})
        monkeypatch.setattr(observation_sessions_bp_module, 'get_locations_for_user', lambda config, user: [preset])
        monkeypatch.setattr(
            observation_sessions_bp_module, 'get_location_by_id', lambda config, location_id: preset
        )

        session = _create_session(client, location_id='preset-1')
        assert session['location_name'] == 'Dark Site'
        assert session['sqm'] == pytest.approx(21.6)


class TestEntryRoutes:
    """CRUD over per-target entries."""

    def test_add_entry(self, client):
        """An entry is created with its frozen target snapshot."""
        session = _create_session(client)
        response = _add_entry(client, session['id'], type='Galaxy', constellation='Andromeda')
        assert response.status_code == 201
        entry = response.get_json()['data']
        assert entry['name'] == 'M31'
        assert entry['type'] == 'Galaxy'

    def test_add_entry_requires_name(self, client):
        """An entry without a target name is a 400."""
        session = _create_session(client)
        response = client.post(f"/api/observation-sessions/{session['id']}/entries", json={'frame_count': 5})
        assert response.status_code == 400

    def test_add_entry_unknown_session(self, client):
        """Adding to an unknown session is a 404."""
        assert _add_entry(client, 'missing').status_code == 404

    def test_rating_validation(self, client):
        """A rating outside 0-5 or off the 0.5 grid is rejected with a 400."""
        session = _create_session(client)
        assert _add_entry(client, session['id'], rating=7).status_code == 400
        assert _add_entry(client, session['id'], rating=3.3).status_code == 400
        assert _add_entry(client, session['id'], rating='abc').status_code == 400
        assert _add_entry(client, session['id'], rating=3.5).status_code == 201

    def test_update_entry(self, client):
        """Actual-capture fields are updatable; a bad rating is still a 400."""
        session = _create_session(client)
        entry = _add_entry(client, session['id']).get_json()['data']

        response = client.put(
            f"/api/observation-sessions/{session['id']}/entries/{entry['id']}",
            json={'frame_count': 42, 'integration_minutes': 84, 'notes': 'good'},
        )
        assert response.status_code == 200
        assert response.get_json()['data']['frame_count'] == 42

        bad = client.put(
            f"/api/observation-sessions/{session['id']}/entries/{entry['id']}", json={'rating': 9}
        )
        assert bad.status_code == 400

    def test_update_unknown_entry(self, client):
        """Updating an unknown entry is a 404."""
        session = _create_session(client)
        assert client.put(
            f"/api/observation-sessions/{session['id']}/entries/missing", json={'notes': 'x'}
        ).status_code == 404

    def test_delete_entry(self, client):
        """Deleting an entry succeeds once, then 404s."""
        session = _create_session(client)
        entry = _add_entry(client, session['id']).get_json()['data']
        url = f"/api/observation-sessions/{session['id']}/entries/{entry['id']}"
        assert client.delete(url).status_code == 200
        assert client.delete(url).status_code == 404


class TestAutomaticAstrodexLink:
    """Item-level catalogue membership is automatic, never a button (§0 of the plan)."""

    def test_entry_with_frames_creates_astrodex_item(self, client, admin_user_id):
        """Adding an entry with frame_count > 0 registers its target in Astrodex."""
        session = _create_session(client)
        entry = _add_entry(client, session['id'], frame_count=30).get_json()['data']

        assert entry['astrodex_item_id']
        item = astrodex.get_astrodex_item(admin_user_id, entry['astrodex_item_id'])
        assert item is not None
        assert item['name'] == 'M31'

    def test_entry_without_frames_creates_nothing(self, client, admin_user_id):
        """No capture evidence means no automatic Astrodex registration."""
        session = _create_session(client)
        entry = _add_entry(client, session['id']).get_json()['data']

        assert entry['astrodex_item_id'] is None
        assert astrodex.load_user_astrodex(admin_user_id).get('items') == []

    def test_update_to_positive_frame_count_links(self, client):
        """Editing frame_count up to > 0 triggers the same automatic link."""
        session = _create_session(client)
        entry = _add_entry(client, session['id']).get_json()['data']

        updated = client.put(
            f"/api/observation-sessions/{session['id']}/entries/{entry['id']}", json={'frame_count': 5}
        ).get_json()['data']
        assert updated['astrodex_item_id']

    def test_existing_astrodex_item_is_reused_not_duplicated(self, client, admin_user_id):
        """A target already in Astrodex resolves to that item instead of creating a second one."""
        existing = astrodex.create_astrodex_item(
            admin_user_id, {'name': 'M31', 'type': 'Galaxy', 'catalogue': 'Messier'}, username='admin'
        )
        assert existing is not None

        session = _create_session(client)
        entry = _add_entry(client, session['id'], frame_count=10).get_json()['data']

        assert entry['astrodex_item_id'] == existing['id']
        assert len(astrodex.load_user_astrodex(admin_user_id)['items']) == 1

    def test_link_is_never_auto_reversed(self, client):
        """Editing frame_count back to 0 keeps the item link - once catalogued, always catalogued."""
        session = _create_session(client)
        entry = _add_entry(client, session['id'], frame_count=30).get_json()['data']
        item_id = entry['astrodex_item_id']
        assert item_id

        cleared = client.put(
            f"/api/observation-sessions/{session['id']}/entries/{entry['id']}", json={'frame_count': 0}
        ).get_json()['data']
        assert cleared['frame_count'] == 0
        assert cleared['astrodex_item_id'] == item_id

    def test_link_failure_does_not_break_the_route(self, client, monkeypatch):
        """An Astrodex failure degrades to an unlinked entry rather than a 500."""
        monkeypatch.setattr(
            observation_sessions_bp_module.astrodex,
            'find_item_in_astrodex',
            lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError('boom')),
        )
        session = _create_session(client)
        response = _add_entry(client, session['id'], frame_count=10)
        assert response.status_code == 201
        assert response.get_json()['data']['astrodex_item_id'] is None

    def test_deleting_an_entry_never_touches_astrodex(self, client, admin_user_id):
        """The Astrodex link is a soft reference: removing the entry keeps the item."""
        session = _create_session(client)
        entry = _add_entry(client, session['id'], frame_count=30).get_json()['data']

        client.delete(f"/api/observation-sessions/{session['id']}/entries/{entry['id']}")
        assert astrodex.get_astrodex_item(admin_user_id, entry['astrodex_item_id']) is not None

    def test_deleting_a_session_never_touches_astrodex(self, client, admin_user_id):
        """Same for deleting the whole session."""
        session = _create_session(client)
        entry = _add_entry(client, session['id'], frame_count=30).get_json()['data']

        client.delete(f"/api/observation-sessions/{session['id']}")
        assert astrodex.get_astrodex_item(admin_user_id, entry['astrodex_item_id']) is not None


class TestFromPlan:
    """POST /api/observation-sessions/from-plan"""

    @staticmethod
    def _plan_result(state='previous'):
        return {
            'state': state,
            'plan': {
                'plan_date': '2026-08-01',
                'location_id': None,
                'location_name': 'Backyard',
                'combination_id': 'combo-1',
                'combination_name': 'Refractor',
                'entries': [
                    {'id': 'plan-1', 'name': 'M31', 'catalogue': 'Messier'},
                    {'id': 'plan-2', 'name': 'M42', 'catalogue': 'Messier'},
                ],
            },
        }

    def test_import_from_previous_plan(self, client, monkeypatch):
        """A 'previous' plan is importable - that's when logging actually happens."""
        monkeypatch.setattr(
            observation_sessions_bp_module.plan_my_night,
            'get_plan_with_timeline',
            lambda *args, **kwargs: self._plan_result('previous'),
        )
        response = client.post('/api/observation-sessions/from-plan', json={'combination_id': 'combo-1'})
        assert response.status_code == 201
        session = response.get_json()['data']
        assert [entry['name'] for entry in session['entries']] == ['M31', 'M42']
        assert session['imported_from_plan_combination_id'] == 'combo-1'

    def test_import_from_current_plan(self, client, monkeypatch):
        """A 'current' plan works too."""
        monkeypatch.setattr(
            observation_sessions_bp_module.plan_my_night,
            'get_plan_with_timeline',
            lambda *args, **kwargs: self._plan_result('current'),
        )
        assert client.post('/api/observation-sessions/from-plan', json={}).status_code == 201

    def test_no_plan_is_404(self, client, monkeypatch):
        """Only 'none' (nothing to import) is refused."""
        monkeypatch.setattr(
            observation_sessions_bp_module.plan_my_night,
            'get_plan_with_timeline',
            lambda *args, **kwargs: {'state': 'none', 'plan': None},
        )
        assert client.post('/api/observation-sessions/from-plan', json={}).status_code == 404

    def test_empty_plan_is_404(self, client, monkeypatch):
        """A plan with no targets has nothing to import either."""
        result = self._plan_result()
        result['plan']['entries'] = []
        monkeypatch.setattr(
            observation_sessions_bp_module.plan_my_night, 'get_plan_with_timeline', lambda *a, **k: result
        )
        assert client.post('/api/observation-sessions/from-plan', json={}).status_code == 404

    def test_merge_into_existing_session(self, client, monkeypatch):
        """Re-importing into the same session is idempotent."""
        monkeypatch.setattr(
            observation_sessions_bp_module.plan_my_night,
            'get_plan_with_timeline',
            lambda *args, **kwargs: self._plan_result(),
        )
        first = client.post('/api/observation-sessions/from-plan', json={}).get_json()['data']
        merged = client.post(
            '/api/observation-sessions/from-plan', json={'session_id': first['id']}
        ).get_json()['data']
        assert len(merged['entries']) == 2

    def test_merge_into_unknown_session_is_404(self, client, monkeypatch):
        """A session_id that doesn't resolve is a 404, not a silent new session."""
        monkeypatch.setattr(
            observation_sessions_bp_module.plan_my_night,
            'get_plan_with_timeline',
            lambda *args, **kwargs: self._plan_result(),
        )
        response = client.post('/api/observation-sessions/from-plan', json={'session_id': 'missing'})
        assert response.status_code == 404


class TestAttachPicture:
    """POST .../entries/<entry_id>/astrodex-picture - the manual half of the linkage."""

    def test_attach_picture_creates_item_and_picture(self, client, admin_user_id):
        """Attaching resolves the item (creating it if needed) and stores both ids."""
        session = _create_session(client, location_name='Backyard')
        entry = _add_entry(
            client, session['id'], frame_count=20, sub_exposure_seconds=180, integration_minutes=60
        ).get_json()['data']

        response = client.post(
            f"/api/observation-sessions/{session['id']}/entries/{entry['id']}/astrodex-picture",
            json={'filename': 'photo.jpg'},
        )
        assert response.status_code == 200
        payload = response.get_json()
        assert payload['astrodex_item_id']
        assert payload['astrodex_picture_id']

        item = astrodex.get_astrodex_item(admin_user_id, payload['astrodex_item_id'])
        picture = item['pictures'][0]
        assert picture['filename'] == 'photo.jpg'
        assert picture['date'] == '2026-07-14'
        # frames/exposition_time/integration_minutes are plain numbers (v1.3+), carried
        # straight over from the entry's own frame_count/sub_exposure_seconds/integration_minutes.
        assert picture['frames'] == 20
        assert picture['exposition_time'] == 180
        assert picture['integration_minutes'] == 60
        assert picture['location_name'] == 'Backyard'

        stored = client.get(f"/api/observation-sessions/{session['id']}").get_json()
        assert stored['entries'][0]['astrodex_picture_id'] == payload['astrodex_picture_id']

    def test_attach_picture_without_frame_count(self, client):
        """A photo can be attached before any numbers were logged."""
        session = _create_session(client)
        entry = _add_entry(client, session['id']).get_json()['data']
        assert entry['astrodex_item_id'] is None

        response = client.post(
            f"/api/observation-sessions/{session['id']}/entries/{entry['id']}/astrodex-picture",
            json={'filename': 'photo.jpg'},
        )
        assert response.status_code == 200
        assert response.get_json()['astrodex_item_id']

    def test_attach_picture_requires_filename(self, client):
        """A body without a filename is a 400."""
        session = _create_session(client)
        entry = _add_entry(client, session['id']).get_json()['data']
        response = client.post(
            f"/api/observation-sessions/{session['id']}/entries/{entry['id']}/astrodex-picture", json={}
        )
        assert response.status_code == 400

    def test_attach_picture_unknown_targets(self, client):
        """Unknown session or entry ids are 404s."""
        session = _create_session(client)
        assert client.post(
            f"/api/observation-sessions/{session['id']}/entries/missing/astrodex-picture",
            json={'filename': 'x.jpg'},
        ).status_code == 404
        assert client.post(
            '/api/observation-sessions/missing/entries/missing/astrodex-picture', json={'filename': 'x.jpg'}
        ).status_code == 404

    def test_attach_picture_rejects_bad_rating_override(self, client):
        """An explicit rating override is validated like everywhere else."""
        session = _create_session(client)
        entry = _add_entry(client, session['id']).get_json()['data']
        response = client.post(
            f"/api/observation-sessions/{session['id']}/entries/{entry['id']}/astrodex-picture",
            json={'filename': 'photo.jpg', 'rating': 42},
        )
        assert response.status_code == 400

    def test_attach_picture_rejects_bad_exposition_time_override(self, client):
        """An explicit exposition_time override must be a whole number of seconds."""
        session = _create_session(client)
        entry = _add_entry(client, session['id']).get_json()['data']
        response = client.post(
            f"/api/observation-sessions/{session['id']}/entries/{entry['id']}/astrodex-picture",
            json={'filename': 'photo.jpg', 'exposition_time': '120x30s'},
        )
        assert response.status_code == 400
