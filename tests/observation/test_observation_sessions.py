"""Tests for the Observation Log storage module (backend/observation/observation_sessions.py)."""
import json
import os
import tempfile
import uuid

import pytest

from observation import observation_sessions


@pytest.fixture
def temp_data_dir(monkeypatch):
    """Point the Observation Log storage at an isolated temporary directory."""
    with tempfile.TemporaryDirectory() as tmpdir:
        monkeypatch.setattr(
            observation_sessions, 'OBSERVATION_SESSIONS_DIR', os.path.join(tmpdir, 'observation_sessions')
        )
        yield tmpdir


@pytest.fixture
def user_id():
    return str(uuid.uuid4())


def _create_session(user_id, **overrides):
    payload = {'date': '2026-07-14'}
    payload.update(overrides)
    return observation_sessions.create_session(user_id, 'tester', payload)


class TestStorage:
    """Directory handling, load/save round-trips and write safety."""

    def test_ensure_directories(self, temp_data_dir):
        """The data directory is created on demand."""
        observation_sessions.ensure_observation_sessions_directories()
        assert os.path.isdir(observation_sessions.OBSERVATION_SESSIONS_DIR)

    def test_sessions_file_naming(self, temp_data_dir, user_id):
        """Per-user files follow the <user_id>_sessions.json convention."""
        path = observation_sessions.get_user_sessions_file(user_id)
        assert os.path.basename(path) == f'{user_id}_sessions.json'

    def test_load_empty_returns_default_payload(self, temp_data_dir, user_id):
        """Loading a user with no file yields an empty, well-formed payload."""
        data = observation_sessions.load_user_sessions(user_id, username='tester')
        assert data['username'] == 'tester'
        assert data['sessions'] == []
        assert 'created_at' in data

    def test_save_and_reload_round_trip(self, temp_data_dir, user_id):
        """A saved payload reloads with the same sessions."""
        data = observation_sessions.load_user_sessions(user_id, username='tester')
        data['sessions'].append({'id': 'abc', 'date': '2026-01-02', 'entries': []})
        assert observation_sessions.save_user_sessions(user_id, data, username='tester') is True

        reloaded = observation_sessions.load_user_sessions(user_id)
        assert len(reloaded['sessions']) == 1
        assert reloaded['sessions'][0]['id'] == 'abc'

    def test_corrupted_file_is_backed_up_and_reset(self, temp_data_dir, user_id):
        """A corrupted JSON file is copied aside and an empty payload returned."""
        path = observation_sessions.get_user_sessions_file(user_id)
        with open(path, 'w', encoding='utf-8') as file_obj:
            file_obj.write('{not json')

        data = observation_sessions.load_user_sessions(user_id, username='tester')
        assert data['sessions'] == []

        backups = [
            name
            for name in os.listdir(observation_sessions.OBSERVATION_SESSIONS_DIR)
            if '.corrupted.' in name
        ]
        assert len(backups) == 1

    def test_non_dict_root_returns_default_payload(self, temp_data_dir, user_id):
        """A valid JSON file whose root is not an object is treated as empty."""
        path = observation_sessions.get_user_sessions_file(user_id)
        with open(path, 'w', encoding='utf-8') as file_obj:
            json.dump([1, 2, 3], file_obj)

        assert observation_sessions.load_user_sessions(user_id)['sessions'] == []

    def test_username_change_is_persisted_on_load(self, temp_data_dir, user_id):
        """Loading with a new username rewrites the stored metadata."""
        _create_session(user_id)
        observation_sessions.load_user_sessions(user_id, username='renamed')
        assert observation_sessions.load_user_sessions(user_id)['username'] == 'renamed'

    def test_save_rejects_invalid_payload_and_restores_backup(self, temp_data_dir, user_id):
        """A payload failing validation leaves the previous file intact."""
        _create_session(user_id)
        good = observation_sessions.load_user_sessions(user_id)

        broken = json.loads(json.dumps(good))
        broken['sessions'] = [{'date': '2026-01-01'}]  # missing 'id'
        assert observation_sessions.save_user_sessions(user_id, broken) is False

        # The original session survived the failed write
        assert len(observation_sessions.load_user_sessions(user_id)['sessions']) == 1

    def test_path_outside_directory_is_rejected(self, temp_data_dir):
        """The path sanitizer refuses anything escaping the sessions directory."""
        with pytest.raises(ValueError):
            observation_sessions._safe_sessions_path(os.path.join(temp_data_dir, 'elsewhere.json'))


class TestValidation:
    """validate_sessions_json contract."""

    def test_valid_file(self, temp_data_dir, user_id):
        """A file written by save_user_sessions validates."""
        _create_session(user_id)
        is_valid, message = observation_sessions.validate_sessions_json(
            observation_sessions.get_user_sessions_file(user_id)
        )
        assert is_valid is True
        assert message == ''

    @pytest.mark.parametrize(
        'payload, expected_fragment',
        [
            ([], 'not a dictionary'),
            ({'sessions': []}, 'username'),
            ({'username': 'x'}, 'sessions'),
            ({'username': 'x', 'sessions': ['nope']}, 'must be an object'),
            ({'username': 'x', 'sessions': [{'date': '2026-01-01'}]}, "missing 'id'"),
            ({'username': 'x', 'sessions': [{'id': 'a'}]}, "missing 'date'"),
            ({'username': 'x', 'sessions': [{'id': 'a', 'date': 'd', 'entries': 'no'}]}, "invalid 'entries'"),
        ],
    )
    def test_invalid_payloads(self, temp_data_dir, user_id, payload, expected_fragment):
        """Each structural defect is reported with a descriptive message."""
        observation_sessions.ensure_observation_sessions_directories()
        path = observation_sessions.get_user_sessions_file(user_id)
        with open(path, 'w', encoding='utf-8') as file_obj:
            json.dump(payload, file_obj)

        is_valid, message = observation_sessions.validate_sessions_json(path)
        assert is_valid is False
        assert expected_fragment in message

    def test_invalid_json(self, temp_data_dir, user_id):
        """Unparseable JSON is reported rather than raised."""
        observation_sessions.ensure_observation_sessions_directories()
        path = observation_sessions.get_user_sessions_file(user_id)
        with open(path, 'w', encoding='utf-8') as file_obj:
            file_obj.write('{')

        is_valid, message = observation_sessions.validate_sessions_json(path)
        assert is_valid is False
        assert 'Invalid JSON' in message


class TestSessionCrud:
    """create/get/update/delete of sessions."""

    def test_create_session_defaults(self, temp_data_dir, user_id):
        """A minimal session gets every optional field explicitly nulled."""
        session = _create_session(user_id)
        assert session is not None
        assert session['date'] == '2026-07-14'
        assert session['entries'] == []
        assert session['notes'] == ''
        for field in ('location_id', 'combination_id', 'start_time', 'end_time', 'sqm', 'seeing', 'transparency'):
            assert session[field] is None

    def test_create_session_requires_date(self, temp_data_dir, user_id):
        """A session without a date is refused."""
        assert observation_sessions.create_session(user_id, 'tester', {'notes': 'no date'}) is None

    def test_create_session_normalizes_fields(self, temp_data_dir, user_id):
        """Numeric fields are coerced and out-of-range values dropped."""
        session = _create_session(
            user_id,
            sqm='21.3',
            seeing='3',
            transparency=99,  # outside the 1-8 scale
            location_latitude='48.85',
            location_longitude='400',  # outside -180..180
            notes='  clear night  ',
        )
        assert session['sqm'] == pytest.approx(21.3)
        assert session['seeing'] == 3
        assert session['transparency'] is None
        assert session['location_latitude'] == pytest.approx(48.85)
        assert session['location_longitude'] is None
        assert session['notes'] == 'clear night'

    def test_get_session(self, temp_data_dir, user_id):
        """A session can be fetched by id, and an unknown id yields None."""
        session = _create_session(user_id)
        assert observation_sessions.get_session(user_id, session['id'])['date'] == '2026-07-14'
        assert observation_sessions.get_session(user_id, 'missing') is None

    def test_get_user_sessions_newest_date_first(self, temp_data_dir, user_id):
        """The list is ordered by observation date, most recent first."""
        _create_session(user_id, date='2026-01-05')
        _create_session(user_id, date='2026-03-20')
        _create_session(user_id, date='2026-02-11')

        dates = [session['date'] for session in observation_sessions.get_user_sessions(user_id)]
        assert dates == ['2026-03-20', '2026-02-11', '2026-01-05']

    def test_update_session(self, temp_data_dir, user_id):
        """Session-level fields are updated and the timestamp refreshed."""
        session = _create_session(user_id)
        updated = observation_sessions.update_session(
            user_id, session['id'], {'notes': 'fog rolled in', 'seeing': 5, 'start_time': '2026-07-14T22:10:00'}
        )
        assert updated['notes'] == 'fog rolled in'
        assert updated['seeing'] == 5
        assert updated['start_time'] == '2026-07-14T22:10:00'
        assert updated['updated_at'] >= session['updated_at']

    def test_update_session_ignores_unknown_and_frozen_fields(self, temp_data_dir, user_id):
        """Only whitelisted fields are writable; ids and entries are not."""
        session = _create_session(user_id)
        updated = observation_sessions.update_session(
            user_id, session['id'], {'id': 'hacked', 'entries': ['nope'], 'unknown': 1}
        )
        assert updated['id'] == session['id']
        assert updated['entries'] == []
        assert 'unknown' not in updated

    def test_update_session_keeps_previous_date_when_cleared(self, temp_data_dir, user_id):
        """Blanking the date would break sorting/validation, so the old value is kept."""
        session = _create_session(user_id)
        updated = observation_sessions.update_session(user_id, session['id'], {'date': '   '})
        assert updated['date'] == '2026-07-14'

    def test_update_missing_session(self, temp_data_dir, user_id):
        """Updating an unknown session yields None."""
        assert observation_sessions.update_session(user_id, 'missing', {'notes': 'x'}) is None

    def test_delete_session(self, temp_data_dir, user_id):
        """Deleting removes the session; deleting again reports failure."""
        session = _create_session(user_id)
        assert observation_sessions.delete_session(user_id, session['id']) is True
        assert observation_sessions.get_session(user_id, session['id']) is None
        assert observation_sessions.delete_session(user_id, session['id']) is False


class TestEntryCrud:
    """add/update/delete of per-target entries."""

    def test_add_entry_snapshot_fields(self, temp_data_dir, user_id):
        """The target snapshot and the actual-capture numbers are both stored."""
        session = _create_session(user_id)
        entry = observation_sessions.add_entry(
            user_id,
            session['id'],
            {
                'name': 'M31',
                'catalogue': 'Messier',
                'type': 'Galaxy',
                'constellation': 'Andromeda',
                'ra': 10.68,
                'dec': 41.27,
                'mag': 3.4,
                'size': '190x60',
                'catalogue_group_id': 'OBJ0001',
                'catalogue_aliases': {'Messier': 'M31', 'OpenNGC': 'NGC 224'},
                'alttime_file': 'obj0001',
                'frame_count': 60,
                'sub_exposure_seconds': 120,
                'integration_minutes': 120,
                'rating': 4.5,
                'notes': 'high clouds late on',
            },
        )
        assert entry['name'] == 'M31'
        assert entry['catalogue_aliases']['OpenNGC'] == 'NGC 224'
        assert entry['alttime_file'] == 'obj0001'
        assert entry['frame_count'] == 60
        assert entry['integration_minutes'] == pytest.approx(120.0)
        assert entry['rating'] == pytest.approx(4.5)
        # Astrodex links are the blueprint layer's job, never set by the storage module
        assert entry['astrodex_item_id'] is None
        assert entry['astrodex_picture_id'] is None

    def test_add_entry_requires_name(self, temp_data_dir, user_id):
        """An entry without a target name is refused."""
        session = _create_session(user_id)
        assert observation_sessions.add_entry(user_id, session['id'], {'frame_count': 5}) is None

    def test_add_entry_missing_session(self, temp_data_dir, user_id):
        """Adding to an unknown session yields None."""
        assert observation_sessions.add_entry(user_id, 'missing', {'name': 'M42'}) is None

    def test_add_entry_defaults_are_none(self, temp_data_dir, user_id):
        """Unsupplied numeric fields stay null rather than defaulting to zero."""
        session = _create_session(user_id)
        entry = observation_sessions.add_entry(user_id, session['id'], {'name': 'M42'})
        for field in ('frame_count', 'sub_exposure_seconds', 'integration_minutes', 'rating'):
            assert entry[field] is None
        assert entry['combination_used_components'] is None

    def test_update_entry(self, temp_data_dir, user_id):
        """The actual-capture fields are updatable."""
        session = _create_session(user_id)
        entry = observation_sessions.add_entry(user_id, session['id'], {'name': 'M42'})
        updated = observation_sessions.update_entry(
            user_id,
            session['id'],
            entry['id'],
            {'frame_count': 30, 'integration_minutes': 45.5, 'rating': 3, 'notes': 'core blown out'},
        )
        assert updated['frame_count'] == 30
        assert updated['integration_minutes'] == pytest.approx(45.5)
        assert updated['rating'] == pytest.approx(3.0)
        assert updated['notes'] == 'core blown out'

    def test_update_entry_keeps_target_snapshot_frozen(self, temp_data_dir, user_id):
        """Identity fields captured at add time are not writable afterwards."""
        session = _create_session(user_id)
        entry = observation_sessions.add_entry(user_id, session['id'], {'name': 'M42', 'catalogue': 'Messier'})
        updated = observation_sessions.update_entry(
            user_id, session['id'], entry['id'], {'name': 'M43', 'catalogue': 'Other'}
        )
        assert updated['name'] == 'M42'
        assert updated['catalogue'] == 'Messier'

    def test_update_entry_accepts_used_components_override(self, temp_data_dir, user_id):
        """A per-entry equipment override is stored as-is; a non-dict becomes None."""
        session = _create_session(user_id)
        entry = observation_sessions.add_entry(user_id, session['id'], {'name': 'M42'})

        override = {'telescope': True, 'camera': True, 'filter_ids': ['f1']}
        updated = observation_sessions.update_entry(
            user_id, session['id'], entry['id'], {'combination_used_components': override}
        )
        assert updated['combination_used_components'] == override

        cleared = observation_sessions.update_entry(
            user_id, session['id'], entry['id'], {'combination_used_components': 'not a dict'}
        )
        assert cleared['combination_used_components'] is None

    def test_update_entry_missing(self, temp_data_dir, user_id):
        """Unknown session or entry ids yield None."""
        session = _create_session(user_id)
        assert observation_sessions.update_entry(user_id, session['id'], 'missing', {'notes': 'x'}) is None
        assert observation_sessions.update_entry(user_id, 'missing', 'missing', {'notes': 'x'}) is None

    def test_delete_entry(self, temp_data_dir, user_id):
        """Deleting an entry removes it and leaves the session in place."""
        session = _create_session(user_id)
        entry = observation_sessions.add_entry(user_id, session['id'], {'name': 'M42'})

        assert observation_sessions.delete_entry(user_id, session['id'], entry['id']) is True
        assert observation_sessions.get_session(user_id, session['id'])['entries'] == []
        assert observation_sessions.delete_entry(user_id, session['id'], entry['id']) is False
        assert observation_sessions.delete_entry(user_id, 'missing', entry['id']) is False


class TestAstrodexLink:
    """link_entry_to_astrodex is a pure setter, never a synchroniser."""

    def test_link_sets_item_id(self, temp_data_dir, user_id):
        """Linking stores the item id and leaves the picture id untouched."""
        session = _create_session(user_id)
        entry = observation_sessions.add_entry(user_id, session['id'], {'name': 'M31', 'frame_count': 10})

        linked = observation_sessions.link_entry_to_astrodex(user_id, session['id'], entry['id'], 'item-1')
        assert linked['astrodex_item_id'] == 'item-1'
        assert linked['astrodex_picture_id'] is None

    def test_link_is_idempotent(self, temp_data_dir, user_id):
        """Re-linking the same item id is a harmless no-op update."""
        session = _create_session(user_id)
        entry = observation_sessions.add_entry(user_id, session['id'], {'name': 'M31'})

        observation_sessions.link_entry_to_astrodex(user_id, session['id'], entry['id'], 'item-1')
        linked = observation_sessions.link_entry_to_astrodex(user_id, session['id'], entry['id'], 'item-1')
        assert linked['astrodex_item_id'] == 'item-1'

    def test_item_only_link_never_clears_an_attached_picture(self, temp_data_dir, user_id):
        """A later item-only link must not orphan an already-attached picture."""
        session = _create_session(user_id)
        entry = observation_sessions.add_entry(user_id, session['id'], {'name': 'M31'})

        observation_sessions.link_entry_to_astrodex(user_id, session['id'], entry['id'], 'item-1', 'pic-1')
        linked = observation_sessions.link_entry_to_astrodex(user_id, session['id'], entry['id'], 'item-1')
        assert linked['astrodex_picture_id'] == 'pic-1'

    def test_link_requires_item_id_and_existing_entry(self, temp_data_dir, user_id):
        """A blank item id or an unknown entry yields None."""
        session = _create_session(user_id)
        entry = observation_sessions.add_entry(user_id, session['id'], {'name': 'M31'})
        assert observation_sessions.link_entry_to_astrodex(user_id, session['id'], entry['id'], '') is None
        assert observation_sessions.link_entry_to_astrodex(user_id, session['id'], 'missing', 'item-1') is None
        assert observation_sessions.link_entry_to_astrodex(user_id, 'missing', entry['id'], 'item-1') is None


class TestCreateSessionFromPlan:
    """Plan My Night import mapping and idempotency."""

    @staticmethod
    def _plan():
        return {
            'plan_date': '2026-08-01',
            'location_id': 'loc-1',
            'location_name': 'Backyard',
            'combination_id': 'combo-1',
            'combination_name': 'Refractor + ASI',
            'night_start': '2026-08-01T20:15:00+00:00',
            'night_end': '2026-08-02T04:45:00+00:00',
            'entries': [
                {
                    'id': 'plan-entry-1',
                    'name': 'M31',
                    'catalogue': 'Messier',
                    'type': 'Galaxy',
                    'constellation': 'Andromeda',
                    'ra': 10.68,
                    'dec': 41.27,
                    'mag': 3.4,
                    'size': '190x60',
                    'catalogue_group_id': 'OBJ0001',
                    'catalogue_aliases': {'Messier': 'M31'},
                    'alttime_file': 'obj0001',
                },
                {'id': 'plan-entry-2', 'name': 'M42', 'catalogue': 'Messier'},
            ],
        }

    def test_creates_session_seeded_from_plan(self, temp_data_dir, user_id):
        """Session-level location/combination/date come from the plan's frozen fields."""
        session = observation_sessions.create_session_from_plan(user_id, 'tester', self._plan())

        assert session['date'] == '2026-08-01'
        assert session['location_id'] == 'loc-1'
        assert session['location_name'] == 'Backyard'
        assert session['combination_id'] == 'combo-1'
        assert session['imported_from_plan_combination_id'] == 'combo-1'
        # The night's nautical-twilight window comes straight from the plan.
        assert session['start_time'] == '2026-08-01T20:15:00+00:00'
        assert session['end_time'] == '2026-08-02T04:45:00+00:00'
        assert [entry['name'] for entry in session['entries']] == ['M31', 'M42']
        assert session['entries'][0]['source_plan_entry_id'] == 'plan-entry-1'
        assert session['entries'][0]['alttime_file'] == 'obj0001'
        # Imported entries carry no capture numbers yet - that's what the user logs next
        assert session['entries'][0]['frame_count'] is None

    def test_default_plan_marker(self, temp_data_dir, user_id):
        """A plan with no combination is still traceable via the 'default' marker."""
        plan = self._plan()
        plan['combination_id'] = None
        session = observation_sessions.create_session_from_plan(user_id, 'tester', plan)
        assert session['imported_from_plan_combination_id'] == 'default'

    def test_falls_back_to_today_when_plan_has_no_date(self, temp_data_dir, user_id):
        """A plan missing plan_date still produces a dated session."""
        plan = self._plan()
        plan.pop('plan_date')
        session = observation_sessions.create_session_from_plan(user_id, 'tester', plan)
        assert len(session['date']) == 10

    def test_missing_night_window_leaves_times_unset(self, temp_data_dir, user_id):
        """A plan with no night_start/night_end still creates a session, times just stay null."""
        plan = self._plan()
        plan.pop('night_start')
        plan.pop('night_end')
        session = observation_sessions.create_session_from_plan(user_id, 'tester', plan)
        assert session['start_time'] is None
        assert session['end_time'] is None

    def test_merge_into_existing_session_is_idempotent(self, temp_data_dir, user_id):
        """Re-importing the same plan adds nothing; a new plan target is appended once."""
        session = observation_sessions.create_session_from_plan(user_id, 'tester', self._plan())

        merged = observation_sessions.create_session_from_plan(user_id, 'tester', self._plan(), session['id'])
        assert len(merged['entries']) == 2

        plan = self._plan()
        plan['entries'].append({'id': 'plan-entry-3', 'name': 'NGC 7000', 'catalogue': 'OpenNGC'})
        merged = observation_sessions.create_session_from_plan(user_id, 'tester', plan, session['id'])
        assert [entry['name'] for entry in merged['entries']] == ['M31', 'M42', 'NGC 7000']

    def test_merge_into_unknown_session(self, temp_data_dir, user_id):
        """Merging into a session that doesn't exist yields None."""
        assert observation_sessions.create_session_from_plan(user_id, 'tester', self._plan(), 'missing') is None

    def test_non_dict_plan(self, temp_data_dir, user_id):
        """A malformed plan payload yields None instead of raising."""
        assert observation_sessions.create_session_from_plan(user_id, 'tester', None) is None


class TestStats:
    """get_session_stats aggregation."""

    def test_empty_stats(self, temp_data_dir, user_id):
        """A user with no sessions reports all-zero counters and no average rating."""
        assert observation_sessions.get_session_stats(user_id) == {
            'total_sessions': 0,
            'total_entries': 0,
            'total_integration_minutes': 0,
            'average_rating': None,
        }

    def test_aggregates_across_sessions(self, temp_data_dir, user_id):
        """Integration minutes are summed and ratings averaged over every entry."""
        first = _create_session(user_id, date='2026-01-01')
        second = _create_session(user_id, date='2026-01-02')
        observation_sessions.add_entry(
            user_id, first['id'], {'name': 'M31', 'frame_count': 60, 'integration_minutes': 120, 'rating': 4}
        )
        observation_sessions.add_entry(
            user_id, first['id'], {'name': 'M42', 'frame_count': 20, 'integration_minutes': 30.5, 'rating': 5}
        )
        observation_sessions.add_entry(user_id, second['id'], {'name': 'M13'})

        stats = observation_sessions.get_session_stats(user_id)
        assert stats['total_sessions'] == 2
        assert stats['total_entries'] == 3
        assert stats['total_integration_minutes'] == pytest.approx(150.5)
        # Only the two rated entries count towards the average; the unrated one is excluded.
        assert stats['average_rating'] == pytest.approx(4.5)


class TestReferenceCounts:
    """Delete-guard / pre-delete scan helpers."""

    def test_count_sessions_for_combination(self, temp_data_dir, user_id):
        """Only the session-level combination_id is counted, across every user."""
        _create_session(user_id, combination_id='combo-1')
        _create_session(user_id, combination_id='combo-2')
        other_user = str(uuid.uuid4())
        _create_session(other_user, combination_id='combo-1')

        assert observation_sessions.count_sessions_for_combination('combo-1') == 2
        assert observation_sessions.count_sessions_for_combination('combo-2') == 1
        assert observation_sessions.count_sessions_for_combination('unknown') == 0
        assert observation_sessions.count_sessions_for_combination('') == 0

    def test_count_sessions_for_location(self, temp_data_dir, user_id):
        """Location references are counted the same way."""
        _create_session(user_id, location_id='loc-1')
        _create_session(user_id, location_id='loc-1')
        assert observation_sessions.count_sessions_for_location('loc-1') == 2
        assert observation_sessions.count_sessions_for_location('loc-2') == 0

    def test_counts_are_fail_open_on_unreadable_files(self, temp_data_dir, user_id):
        """An unparseable file is skipped rather than taking the whole scan down."""
        _create_session(user_id, combination_id='combo-1')
        broken_path = os.path.join(
            observation_sessions.OBSERVATION_SESSIONS_DIR, f'{uuid.uuid4()}_sessions.json'
        )
        with open(broken_path, 'w', encoding='utf-8') as file_obj:
            file_obj.write('{oops')

        assert observation_sessions.count_sessions_for_combination('combo-1') == 1

    def test_counts_without_directory(self, monkeypatch, temp_data_dir):
        """A missing data directory counts as zero references."""
        monkeypatch.setattr(
            observation_sessions, 'OBSERVATION_SESSIONS_DIR', os.path.join(temp_data_dir, 'never-created')
        )
        assert observation_sessions.count_sessions_for_combination('combo-1') == 0

    def test_load_all_users_sessions(self, temp_data_dir, user_id):
        """Every user's file is picked up by the all-users loader."""
        _create_session(user_id)
        other_user = str(uuid.uuid4())
        _create_session(other_user)

        collections = observation_sessions.load_all_users_sessions({user_id: 'tester'})
        assert {collection['user_id'] for collection in collections} == {user_id, other_user}
        assert all(len(collection['sessions']) == 1 for collection in collections)
