"""Observation Log storage and business logic (v1.3).

A *session* is the private, chronological record of what actually happened on one
observing night: when it started/ended, from where, with which equipment, under which
sky, and - through its *entries* - which targets were captured with how many frames.

Deliberate divergences from the Astrodex module this file's storage mechanics are
copied from:

- Sessions are **permanently private**. There is no ``private_mode`` toggle and no
  cross-user merged view: this is a personal logbook, not a shared gallery.
- An entry is **its own record**, the source of truth for "what happened this session"
  (planned vs. actual frames/integration/rating/notes). It is never kept in sync with
  the Astrodex item/picture it points at - both links are one-shot, frozen references,
  exactly like Plan My Night's existing add-to-astrodex action.

This module never imports ``astrodex`` or ``plan_my_night`` at module scope. Resolving
an entry to an Astrodex item is the blueprint layer's job (see
``blueprints/observation_sessions.py``); this module only stores the resulting ids via
``link_entry_to_astrodex()``.
"""

import json
import os
import shutil
import threading
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from utils.constants import DATA_DIR
from utils.logging_config import get_logger

logger = get_logger(__name__)

# Per-user write locks to prevent race conditions on concurrent saves
_user_save_locks: Dict[str, threading.Lock] = {}
_user_save_locks_mutex = threading.Lock()


def _get_user_save_lock(user_id: str) -> threading.Lock:
    """Get or create a per-user lock for serializing session file writes."""
    with _user_save_locks_mutex:
        if user_id not in _user_save_locks:
            _user_save_locks[user_id] = threading.Lock()
        return _user_save_locks[user_id]


# Observation Log data directory (top-level, mirrors data/astrodex/)
OBSERVATION_SESSIONS_DIR = os.path.join(DATA_DIR, 'observation_sessions')

SESSIONS_FILE_SUFFIX = '_sessions.json'

# Session-level fields a PUT may change. The target snapshot fields on entries and every
# id/timestamp are deliberately absent: they are frozen at creation time.
SESSION_UPDATABLE_FIELDS = (
    'date',
    'location_id',
    'location_name',
    'location_latitude',
    'location_longitude',
    'location_elevation',
    'combination_id',
    'combination_name',
    'start_time',
    'end_time',
    'sqm',
    'seeing',
    'transparency',
    'notes',
)

# Entry-level fields a PUT may change - the "what actually happened" numbers only. The
# target identity snapshot (name/catalogue/ra/dec/...) is frozen at add time, matching
# Plan My Night entries, and the two astrodex_* pointers are set through
# link_entry_to_astrodex() rather than by a client payload.
ENTRY_UPDATABLE_FIELDS = (
    'frame_count',
    'sub_exposure_seconds',
    'integration_minutes',
    'rating',
    'notes',
    'combination_used_components',
)

# 7Timer's ASTRO scales, reused verbatim for unit consistency with the rest of the app
# (astroweather/seeing_forecast_7timer.py): seeing 1=best..8=worst, transparency
# 1=worst..8=best.
SKY_SCALE_MIN = 1
SKY_SCALE_MAX = 8


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_sessions_path(path: str) -> str:
    """Resolve *path* and verify it lives inside OBSERVATION_SESSIONS_DIR.

    This is the canonical sanitizer for path expressions in this module. The
    containment check uses realpath + startswith (rather than os.path.commonpath)
    because that is the pattern CodeQL's py/path-injection query recognises as a
    sanitizer barrier, and callers must use the *returned* resolved path.

    OBSERVATION_SESSIONS_DIR is read at call time (not cached) so test fixtures that
    monkeypatch it are honoured.

    Raises ValueError if the path would escape the directory (which also excludes the
    directory itself, never a valid file path).
    """
    base_real = os.path.realpath(OBSERVATION_SESSIONS_DIR)
    resolved = os.path.realpath(path)
    if not resolved.startswith(base_real + os.sep):
        raise ValueError(f'Path outside observation sessions directory: {path!r}')
    return resolved


def _coerce_optional_float(value: Any, minimum: Optional[float] = None, maximum: Optional[float] = None):
    """Best-effort float parse for a loosely-typed numeric field.

    Anything empty, unparseable or out of range becomes None rather than an error -
    same trust level Astrodex applies to its own free-text picture fields.
    """
    if value is None or value == '':
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    if minimum is not None and parsed < minimum:
        return None
    if maximum is not None and parsed > maximum:
        return None
    return parsed


def _coerce_optional_int(value: Any, minimum: Optional[int] = None, maximum: Optional[int] = None):
    """Best-effort int parse for a loosely-typed numeric field (see _coerce_optional_float)."""
    if value is None or value == '':
        return None
    try:
        parsed = int(float(value))
    except (TypeError, ValueError):
        return None
    if minimum is not None and parsed < minimum:
        return None
    if maximum is not None and parsed > maximum:
        return None
    return parsed


def _coerce_sky_scale(value: Any):
    """Coerce a seeing/transparency value onto 7Timer's shared 1-8 integer scale."""
    return _coerce_optional_int(value, SKY_SCALE_MIN, SKY_SCALE_MAX)


def _clean_text(value: Any, max_length: int = 5000) -> str:
    """Normalize a free-text field to a bounded string."""
    if value is None:
        return ''
    return str(value).strip()[:max_length]


def _optional_text(value: Any, max_length: int = 200):
    """Normalize an optional short label, mapping empty to None."""
    text = _clean_text(value, max_length)
    return text or None


def ensure_observation_sessions_directories() -> None:
    """Ensure the Observation Log data directory exists."""
    os.makedirs(OBSERVATION_SESSIONS_DIR, exist_ok=True)


def get_user_sessions_file(user_id: str) -> str:
    """Get the path to a user's observation sessions file using their UUID."""
    ensure_observation_sessions_directories()
    return _safe_sessions_path(os.path.join(OBSERVATION_SESSIONS_DIR, f'{user_id}{SESSIONS_FILE_SUFFIX}'))


def _default_payload(user_id: str, username: Optional[str] = None) -> Dict:
    return {
        'user_id': user_id,
        'username': username or 'unknown',
        'created_at': _now_iso(),
        'updated_at': _now_iso(),
        'sessions': [],
    }


def load_user_sessions(user_id: str, username: Optional[str] = None) -> Dict:
    """Load a user's observation sessions.

    Never raises to the caller: a corrupted file is backed up to
    ``.corrupted.<timestamp>`` and an empty payload is returned (the file is overwritten
    on the next save), mirroring ``astrodex.load_user_astrodex``.
    """
    try:
        file_path = get_user_sessions_file(user_id)
    except (ValueError, OSError) as error:
        logger.error(f'Cannot resolve sessions file for user {user_id}: {error}')
        return _default_payload(user_id, username)

    if not os.path.exists(file_path):
        return _default_payload(user_id, username)

    try:
        with open(file_path, 'r', encoding='utf-8') as file_obj:
            data = json.load(file_obj)
    except json.JSONDecodeError as error:
        logger.error(f'Error loading observation sessions for user {user_id}: {error}')
        logger.error('Corrupted file will be backed up and reset')
        backup_path = file_path + '.corrupted.' + datetime.now().strftime('%Y%m%d_%H%M%S')
        try:
            shutil.copy2(file_path, backup_path)
            logger.info(f'Backed up corrupted file to {backup_path}')
        except Exception as backup_error:
            logger.error(f'Failed to backup corrupted file: {backup_error}')
        return _default_payload(user_id, username)
    except Exception as error:
        logger.error(f'Error loading observation sessions for user {user_id}: {error}')
        return _default_payload(user_id, username)

    if not isinstance(data, dict):
        return _default_payload(user_id, username)

    data.setdefault('user_id', user_id)
    data.setdefault('created_at', _now_iso())
    data.setdefault('updated_at', _now_iso())
    if not isinstance(data.get('sessions'), list):
        data['sessions'] = []
    if username and data.get('username') != username:
        data['username'] = username
        data['user_id'] = user_id
        save_user_sessions(user_id, data, username=username)
    data.setdefault('username', username or 'unknown')

    return data


def validate_sessions_json(file_path: str) -> Tuple[bool, str]:
    """Validate that a file contains a well-formed observation sessions payload.

    Returns:
        Tuple of (is_valid, error_message)
    """
    try:
        safe_path = _safe_sessions_path(file_path)
        with open(safe_path, 'r', encoding='utf-8') as file_obj:
            data = json.load(file_obj)

        if not isinstance(data, dict):
            return False, 'JSON root is not a dictionary'

        if 'username' not in data:
            return False, "Missing 'username' field"

        if 'sessions' not in data or not isinstance(data['sessions'], list):
            return False, "Missing or invalid 'sessions' field"

        for index, session in enumerate(data['sessions']):
            if not isinstance(session, dict):
                return False, f'Session {index} must be an object'
            if not session.get('id'):
                return False, f"Session {index} missing 'id' field"
            if not session.get('date'):
                return False, f"Session {index} missing 'date' field"
            if not isinstance(session.get('entries', []), list):
                return False, f"Session {index} has an invalid 'entries' field"

        return True, ''
    except json.JSONDecodeError as error:
        return False, f'Invalid JSON: {error}'
    except Exception as error:
        return False, f'Validation error: {error}'


def save_user_sessions(user_id: str, sessions_data: Dict, username: Optional[str] = None) -> bool:
    """Save a user's observation sessions with the full atomic backup/recovery sequence.

    Process (identical to astrodex.save_user_astrodex):
      1. Back up the existing file
      2. Write to a temporary file
      3. Validate the temporary file
      4. Atomically replace the original
      5. Drop the backup on success, restore from it on failure
    """
    try:
        file_path = get_user_sessions_file(user_id)
    except (ValueError, OSError) as error:
        logger.error(f'Cannot resolve sessions file for user {user_id}: {error}')
        return False

    temp_path = file_path + '.tmp'
    backup_path = file_path + '.backup'

    with _get_user_save_lock(user_id):
        return _save_user_sessions_locked(user_id, username, sessions_data, file_path, temp_path, backup_path)


def _save_user_sessions_locked(
    user_id: str,
    username: Optional[str],
    sessions_data: Dict,
    file_path: str,
    temp_path: str,
    backup_path: str,
) -> bool:
    backup_created = False

    try:
        sessions_data['updated_at'] = _now_iso()
        sessions_data['user_id'] = user_id
        if username:
            sessions_data['username'] = username
        sessions_data.setdefault('username', username or 'unknown')
        sessions_data.setdefault('created_at', _now_iso())

        if os.path.exists(file_path):
            try:
                shutil.copy2(file_path, backup_path)
                backup_created = True
                logger.debug(f'Created backup: {backup_path}')
            except Exception as backup_error:
                logger.error(f'Failed to create backup for user {user_id}: {backup_error}')
                # Continue anyway - the atomic replace still provides some safety

        with open(temp_path, 'w', encoding='utf-8') as file_obj:
            json.dump(sessions_data, file_obj, indent=2, ensure_ascii=False)

        is_valid, error_message = validate_sessions_json(temp_path)
        if not is_valid:
            raise ValueError(f'JSON validation failed: {error_message}')

        os.replace(temp_path, file_path)
        logger.info(f'Successfully saved observation sessions for user {user_id}')

        if backup_created and os.path.exists(backup_path):
            try:
                os.remove(backup_path)
            except Exception as cleanup_error:  # pragma: no cover
                logger.warning(f'Failed to remove backup: {cleanup_error}')

        return True

    except Exception as error:
        logger.error(f'Error saving observation sessions for user {user_id}: {error}')

        if backup_created and os.path.exists(backup_path):
            try:
                shutil.copy2(backup_path, file_path)
                logger.info(f'Restored observation sessions from backup for user {user_id}')
            except Exception as restore_error:  # pragma: no cover
                logger.error(f'Failed to restore from backup: {restore_error}')

        for cleanup_path in (temp_path, backup_path):
            if os.path.exists(cleanup_path):
                try:
                    os.remove(cleanup_path)
                except Exception as cleanup_error:  # pragma: no cover
                    logger.warning(f'Failed to remove {cleanup_path}: {cleanup_error}')

        return False


def _iter_session_files() -> List[str]:
    """Return every observation sessions file path (all users), safely resolved."""
    if not os.path.isdir(OBSERVATION_SESSIONS_DIR):
        return []
    paths: List[str] = []
    for filename in os.listdir(OBSERVATION_SESSIONS_DIR):
        if not filename.endswith(SESSIONS_FILE_SUFFIX):
            continue
        try:
            paths.append(_safe_sessions_path(os.path.join(OBSERVATION_SESSIONS_DIR, filename)))
        except ValueError:  # pragma: no cover
            continue  # failed containment check — skip
    return paths


def load_all_users_sessions(usernames_by_id: Optional[Dict[str, str]] = None) -> List[Dict]:
    """Load every user's sessions.

    Used by the delete-guard scans below, not by any UI route - sessions are private and
    never shown across users.
    """
    ensure_observation_sessions_directories()
    usernames_by_id = usernames_by_id or {}

    collections: List[Dict] = []
    for filename in sorted(os.listdir(OBSERVATION_SESSIONS_DIR)):
        if not filename.endswith(SESSIONS_FILE_SUFFIX):
            continue
        user_id = filename[: -len(SESSIONS_FILE_SUFFIX)]
        data = load_user_sessions(user_id, usernames_by_id.get(user_id))
        collections.append(
            {
                'user_id': user_id,
                'username': data.get('username') or usernames_by_id.get(user_id) or 'unknown',
                'created_at': data.get('created_at'),
                'updated_at': data.get('updated_at'),
                'sessions': data.get('sessions', []),
            }
        )
    return collections


def _session_sort_key(session: Dict) -> Tuple[str, str]:
    """Sort key placing the most recent observation date (then creation) first."""
    return (str(session.get('date') or ''), str(session.get('created_at') or ''))


def get_user_sessions(user_id: str) -> List[Dict]:
    """Return the user's own sessions, newest observation date first."""
    data = load_user_sessions(user_id)
    sessions = [session for session in data.get('sessions', []) if isinstance(session, dict)]
    return sorted(sessions, key=_session_sort_key, reverse=True)


def get_session(user_id: str, session_id: str) -> Optional[Dict]:
    """Return one of the user's own sessions, or None when it doesn't exist."""
    for session in load_user_sessions(user_id).get('sessions', []):
        if isinstance(session, dict) and session.get('id') == session_id:
            return session
    return None


def _apply_session_fields(session: Dict, source: Dict, fields=SESSION_UPDATABLE_FIELDS) -> None:
    """Copy/normalize the session-level fields present in *source* onto *session*."""
    for field in fields:
        if field not in source:
            continue
        value = source[field]
        if field == 'date':
            session['date'] = _clean_text(value, 32)
        elif field in ('location_id', 'location_name', 'combination_id', 'combination_name'):
            session[field] = _optional_text(value)
        elif field == 'location_latitude':
            session[field] = _coerce_optional_float(value, -90, 90)
        elif field == 'location_longitude':
            session[field] = _coerce_optional_float(value, -180, 180)
        elif field == 'location_elevation':
            session[field] = _coerce_optional_float(value)
        elif field in ('start_time', 'end_time'):
            session[field] = _optional_text(value, 64)
        elif field == 'sqm':
            session[field] = _coerce_optional_float(value, 0, 30)
        elif field in ('seeing', 'transparency'):
            session[field] = _coerce_sky_scale(value)
        else:
            session[field] = _clean_text(value)


def create_session(user_id: str, username: str, session_data: Dict) -> Optional[Dict]:
    """Create a new observation session.

    ``date`` is required (an undated night is not a log entry); everything else is
    optional and may be filled in later through update_session().
    """
    data = load_user_sessions(user_id, username)

    session_date = _clean_text(session_data.get('date'), 32)
    if not session_date:
        logger.error('Session date is required')
        return None

    now = _now_iso()
    session: Dict[str, Any] = {
        'id': str(uuid.uuid4()),
        'date': session_date,
        'location_id': None,
        'location_name': None,
        'location_latitude': None,
        'location_longitude': None,
        'location_elevation': None,
        'combination_id': None,
        'combination_name': None,
        'start_time': None,
        'end_time': None,
        'sqm': None,
        'seeing': None,
        'transparency': None,
        'notes': '',
        'entries': [],
        'imported_from_plan_combination_id': _optional_text(session_data.get('imported_from_plan_combination_id')),
        'created_at': now,
        'updated_at': now,
    }
    _apply_session_fields(session, session_data)

    data.setdefault('sessions', []).append(session)

    if save_user_sessions(user_id, data, username=username):
        return session
    return None


def update_session(user_id: str, session_id: str, updates: Dict) -> Optional[Dict]:
    """Update session-level fields. Entries are edited through the entry functions."""
    data = load_user_sessions(user_id)

    for session in data.get('sessions', []):
        if not isinstance(session, dict) or session.get('id') != session_id:
            continue

        previous_date = session.get('date')
        _apply_session_fields(session, updates)
        # A blank date would make the session unsortable and fail validate_sessions_json;
        # an edit that tries to clear it keeps the previous value instead.
        if not session.get('date'):
            session['date'] = previous_date
        session['updated_at'] = _now_iso()

        if save_user_sessions(user_id, data):
            return session
        return None

    return None


def delete_session(user_id: str, session_id: str) -> bool:
    """Delete a session and all of its entries.

    Any Astrodex item/picture an entry pointed at is deliberately left untouched -
    the link is a soft, one-way reference (see the module docstring).
    """
    data = load_user_sessions(user_id)
    sessions = data.get('sessions', [])
    original_count = len(sessions)
    data['sessions'] = [
        session for session in sessions if not (isinstance(session, dict) and session.get('id') == session_id)
    ]

    if len(data['sessions']) < original_count:
        return save_user_sessions(user_id, data)
    return False


def _build_entry_payload(entry_data: Dict) -> Dict:
    """Build a new session entry from a client payload.

    The target identity fields mirror plan_my_night._build_target_payload() and are a
    frozen snapshot: they are never re-resolved against SkyTonight afterwards.
    """
    now = _now_iso()
    catalogue_aliases = entry_data.get('catalogue_aliases')
    used_components = entry_data.get('combination_used_components')

    return {
        'id': str(uuid.uuid4()),
        'name': _clean_text(entry_data.get('name'), 200),
        'catalogue': _clean_text(entry_data.get('catalogue'), 80),
        'type': _clean_text(entry_data.get('type'), 80),
        'constellation': _clean_text(entry_data.get('constellation'), 80),
        'ra': entry_data.get('ra'),
        'dec': entry_data.get('dec'),
        'mag': entry_data.get('mag'),
        'size': entry_data.get('size'),
        'catalogue_group_id': _clean_text(entry_data.get('catalogue_group_id'), 80),
        'catalogue_aliases': catalogue_aliases if isinstance(catalogue_aliases, dict) else {},
        'alttime_file': _optional_text(entry_data.get('alttime_file'), 120),
        'source_plan_entry_id': _optional_text(entry_data.get('source_plan_entry_id'), 80),
        'frame_count': _coerce_optional_int(entry_data.get('frame_count'), 0),
        'sub_exposure_seconds': _coerce_optional_float(entry_data.get('sub_exposure_seconds'), 0),
        'integration_minutes': _coerce_optional_float(entry_data.get('integration_minutes'), 0),
        'rating': _coerce_optional_float(entry_data.get('rating'), 0, 5),
        'notes': _clean_text(entry_data.get('notes')),
        'combination_used_components': used_components if isinstance(used_components, dict) else None,
        'astrodex_item_id': None,
        'astrodex_picture_id': None,
        'created_at': now,
        'updated_at': now,
    }


def add_entry(user_id: str, session_id: str, entry_data: Dict) -> Optional[Dict]:
    """Add one target entry to a session.

    Does **not** resolve Astrodex itself - the blueprint layer calls
    ``_ensure_astrodex_item_for_entry()`` + ``link_entry_to_astrodex()`` afterwards
    whenever the resulting entry has ``frame_count > 0`` and no ``astrodex_item_id`` yet.
    """
    data = load_user_sessions(user_id)

    for session in data.get('sessions', []):
        if not isinstance(session, dict) or session.get('id') != session_id:
            continue

        entry_name = _clean_text(entry_data.get('name'), 200)
        if not entry_name:
            logger.error('Entry name is required')
            return None

        entry = _build_entry_payload(entry_data)
        session.setdefault('entries', []).append(entry)
        session['updated_at'] = _now_iso()

        if save_user_sessions(user_id, data):
            return entry
        return None

    return None


def update_entry(user_id: str, session_id: str, entry_id: str, updates: Dict) -> Optional[Dict]:
    """Update the "what actually happened" fields of one entry.

    Like add_entry(), this never resolves Astrodex - see that function's docstring.
    """
    data = load_user_sessions(user_id)

    for session in data.get('sessions', []):
        if not isinstance(session, dict) or session.get('id') != session_id:
            continue

        for entry in session.get('entries', []):
            if not isinstance(entry, dict) or entry.get('id') != entry_id:
                continue

            for field in ENTRY_UPDATABLE_FIELDS:
                if field not in updates:
                    continue
                value = updates[field]
                if field == 'frame_count':
                    entry[field] = _coerce_optional_int(value, 0)
                elif field == 'sub_exposure_seconds':
                    entry[field] = _coerce_optional_float(value, 0)
                elif field == 'integration_minutes':
                    entry[field] = _coerce_optional_float(value, 0)
                elif field == 'rating':
                    entry[field] = _coerce_optional_float(value, 0, 5)
                elif field == 'combination_used_components':
                    entry[field] = value if isinstance(value, dict) else None
                else:
                    entry[field] = _clean_text(value)

            entry['updated_at'] = _now_iso()
            session['updated_at'] = entry['updated_at']

            if save_user_sessions(user_id, data):
                return entry
            return None

    return None


def delete_entry(user_id: str, session_id: str, entry_id: str) -> bool:
    """Remove one entry from a session (never touches its linked Astrodex item/picture)."""
    data = load_user_sessions(user_id)

    for session in data.get('sessions', []):
        if not isinstance(session, dict) or session.get('id') != session_id:
            continue

        entries = session.get('entries', [])
        original_count = len(entries)
        session['entries'] = [
            entry for entry in entries if not (isinstance(entry, dict) and entry.get('id') == entry_id)
        ]

        if len(session['entries']) < original_count:
            session['updated_at'] = _now_iso()
            return save_user_sessions(user_id, data)
        return False

    return False


def _entry_from_plan_entry(plan_entry: Dict) -> Dict:
    """Map one Plan My Night entry onto a fresh session entry payload."""
    entry = _build_entry_payload(
        {
            'name': plan_entry.get('name'),
            'catalogue': plan_entry.get('catalogue'),
            'type': plan_entry.get('type'),
            'constellation': plan_entry.get('constellation'),
            'ra': plan_entry.get('ra'),
            'dec': plan_entry.get('dec'),
            'mag': plan_entry.get('mag'),
            'size': plan_entry.get('size'),
            'catalogue_group_id': plan_entry.get('catalogue_group_id'),
            'catalogue_aliases': plan_entry.get('catalogue_aliases'),
            'alttime_file': plan_entry.get('alttime_file'),
            'source_plan_entry_id': plan_entry.get('id'),
        }
    )
    return entry


def create_session_from_plan(
    user_id: str,
    username: str,
    plan_payload: Dict,
    existing_session_id: Optional[str] = None,
) -> Optional[Dict]:
    """Seed a new session from a Plan My Night plan, or merge into an existing one.

    ``plan_payload`` is the ``plan`` dict from ``plan_my_night.get_plan_with_timeline()``
    - the caller (blueprint) is responsible for loading it. This module never imports
    plan_my_night: sessions know about plans, plans have no reason to know about sessions.

    Re-importing is idempotent: any plan entry whose id already appears as an entry's
    ``source_plan_entry_id`` in the target session is skipped.
    """
    if not isinstance(plan_payload, dict):
        return None

    plan_entries = [entry for entry in plan_payload.get('entries', []) if isinstance(entry, dict)]

    if existing_session_id:
        data = load_user_sessions(user_id, username)
        session = next(
            (
                item
                for item in data.get('sessions', [])
                if isinstance(item, dict) and item.get('id') == existing_session_id
            ),
            None,
        )
        if session is None:
            return None

        already_imported = {
            str(entry.get('source_plan_entry_id'))
            for entry in session.get('entries', [])
            if isinstance(entry, dict) and entry.get('source_plan_entry_id')
        }
        entries = session.setdefault('entries', [])
        for plan_entry in plan_entries:
            if str(plan_entry.get('id')) in already_imported:
                continue
            entries.append(_entry_from_plan_entry(plan_entry))

        session['updated_at'] = _now_iso()
        if save_user_sessions(user_id, data, username=username):
            return session
        return None

    session_date = _clean_text(plan_payload.get('plan_date'), 32) or datetime.now().strftime('%Y-%m-%d')
    session = create_session(
        user_id,
        username,
        {
            'date': session_date,
            'location_id': plan_payload.get('location_id'),
            'location_name': plan_payload.get('location_name'),
            'combination_id': plan_payload.get('combination_id'),
            'combination_name': plan_payload.get('combination_name'),
            'imported_from_plan_combination_id': plan_payload.get('combination_id') or 'default',
        },
    )
    if session is None:
        return None

    data = load_user_sessions(user_id, username)
    stored = next(
        (item for item in data.get('sessions', []) if isinstance(item, dict) and item.get('id') == session['id']),
        None,
    )
    if stored is None:  # pragma: no cover - the session was just written
        return None

    stored['entries'] = [_entry_from_plan_entry(plan_entry) for plan_entry in plan_entries]
    stored['updated_at'] = _now_iso()

    if save_user_sessions(user_id, data, username=username):
        return stored
    return None


def link_entry_to_astrodex(
    user_id: str,
    session_id: str,
    entry_id: str,
    astrodex_item_id: str,
    astrodex_picture_id: Optional[str] = None,
) -> Optional[Dict]:
    """Store the Astrodex item (and optionally picture) an entry resolved to.

    Pure storage-layer setter with no cross-module import: the blueprint calls it for
    two different triggers - automatically after an entry gains real capture evidence
    (item id only), and explicitly when the user attaches a picture (both ids).
    Idempotent: passing the same item id again is a harmless no-op.

    ``astrodex_picture_id`` is only ever *set*, never cleared by an item-only call, so a
    later frame-count edit cannot orphan an already-attached picture.
    """
    if not astrodex_item_id:
        return None

    data = load_user_sessions(user_id)

    for session in data.get('sessions', []):
        if not isinstance(session, dict) or session.get('id') != session_id:
            continue

        for entry in session.get('entries', []):
            if not isinstance(entry, dict) or entry.get('id') != entry_id:
                continue

            entry['astrodex_item_id'] = astrodex_item_id
            if astrodex_picture_id:
                entry['astrodex_picture_id'] = astrodex_picture_id
            entry['updated_at'] = _now_iso()
            session['updated_at'] = entry['updated_at']

            if save_user_sessions(user_id, data):
                return entry
            return None

    return None


def get_session_stats(user_id: str) -> Dict:
    """Aggregate the user's own sessions into the Observation Log's header counters.

    Deliberately minimal - full analytics (per month, per equipment, sky coverage) is
    v1.5 Session Analytics' job, not this module's.
    """
    sessions = load_user_sessions(user_id).get('sessions', [])

    total_entries = 0
    total_integration_minutes = 0.0
    total_frame_count = 0

    for session in sessions:
        if not isinstance(session, dict):
            continue
        for entry in session.get('entries', []):
            if not isinstance(entry, dict):
                continue
            total_entries += 1
            integration = _coerce_optional_float(entry.get('integration_minutes'), 0)
            if integration:
                total_integration_minutes += integration
            frames = _coerce_optional_int(entry.get('frame_count'), 0)
            if frames:
                total_frame_count += frames

    return {
        'total_sessions': len([session for session in sessions if isinstance(session, dict)]),
        'total_entries': total_entries,
        'total_integration_minutes': round(total_integration_minutes, 2),
        'total_frame_count': total_frame_count,
    }


def _count_sessions_matching(field: str, value: str) -> int:
    """Count sessions (all users) whose session-level *field* equals *value*.

    Fail-open on unreadable files (skipped), matching
    astrodex.count_pictures_for_combination / plan_my_night.count_plans_for_combination.
    """
    if not value:
        return 0
    count = 0
    for file_path in _iter_session_files():
        try:
            with open(file_path, 'r', encoding='utf-8') as file_obj:
                data = json.load(file_obj)
            for session in data.get('sessions', []):
                if isinstance(session, dict) and session.get(field) == value:
                    count += 1
        except Exception:
            continue  # unreadable file — skip, this is a best-effort count
    return count


def count_sessions_for_combination(combination_id: str) -> int:
    """Count sessions (all users) referencing an equipment combination - pre-delete check.

    Only the session-level ``combination_id`` is a guard target: an entry's
    ``combination_used_components`` override records *which parts* of that same
    combination were used, never a second combination id.

    Combinations are never cascade-deleted; deletion is blocked while any session
    references one (see equipment_profiles.delete_combination).
    """
    return _count_sessions_matching('combination_id', combination_id)


def count_sessions_for_location(location_id: str) -> int:
    """Count sessions (all users) referencing a location preset.

    Informational only: like Astrodex pictures, sessions are never cascade-deleted or
    orphan-flagged when a preset is removed - a session is a historical record, and its
    frozen ``location_name`` snapshot stays valid as display-only history.
    """
    return _count_sessions_matching('location_id', location_id)
