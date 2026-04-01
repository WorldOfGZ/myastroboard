"""Plan My Night storage and business logic."""

import copy
import csv
import json
import os
import shutil
import uuid
import io
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

import skytonight_targets
from constants import DATA_DIR
from logging_config import get_logger

logger = get_logger(__name__)

PLAN_DIR = os.path.join(DATA_DIR, 'projects')


def _now() -> datetime:
    return datetime.now().astimezone()


def _to_iso(value: datetime) -> str:
    return value.astimezone().isoformat()


def _parse_datetime(value: Any) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value.astimezone()

    text = str(value).strip()
    if not text:
        return None

    try:
        return datetime.fromisoformat(text).astimezone()
    except ValueError:
        pass

    # Legacy moon endpoint format: YYYY-MM-DD HH:MM
    try:
        return datetime.strptime(text, '%Y-%m-%d %H:%M').astimezone()
    except ValueError:
        return None


def ensure_plan_directory() -> None:
    os.makedirs(PLAN_DIR, exist_ok=True)


def get_user_plan_file(user_id: str) -> str:
    ensure_plan_directory()
    return os.path.join(PLAN_DIR, f'{user_id}_plan_my_night.json')


def _default_payload(user_id: str, username: Optional[str] = None) -> Dict:
    return {
        'user_id': user_id,
        'username': username or 'unknown',
        'created_at': _to_iso(_now()),
        'updated_at': _to_iso(_now()),
        'plan': None,
    }


def load_user_plan(user_id: str, username: Optional[str] = None) -> Dict:
    file_path = get_user_plan_file(user_id)
    if not os.path.exists(file_path):
        return _default_payload(user_id, username)

    try:
        with open(file_path, 'r', encoding='utf-8') as file_obj:
            payload = json.load(file_obj)
    except json.JSONDecodeError as error:
        logger.error(f'Error loading plan for user {user_id}: {error}')
        backup_path = file_path + '.corrupted.' + datetime.now().strftime('%Y%m%d_%H%M%S')
        try:
            shutil.copy2(file_path, backup_path)
        except Exception as backup_error:
            logger.error(f'Failed to backup corrupted plan file {file_path}: {backup_error}')
        return _default_payload(user_id, username)
    except Exception as error:
        logger.error(f'Error loading plan for user {user_id}: {error}')
        return _default_payload(user_id, username)

    if not isinstance(payload, dict):
        return _default_payload(user_id, username)

    payload.setdefault('user_id', user_id)
    if username:
        payload['username'] = username
    payload.setdefault('username', username or 'unknown')
    payload.setdefault('created_at', _to_iso(_now()))
    payload.setdefault('updated_at', _to_iso(_now()))

    plan = payload.get('plan')
    if plan is not None and not isinstance(plan, dict):
        payload['plan'] = None

    return payload


def validate_plan_json(file_path: str) -> Tuple[bool, str]:
    try:
        with open(file_path, 'r', encoding='utf-8') as file_obj:
            payload = json.load(file_obj)

        if not isinstance(payload, dict):
            return False, 'JSON root must be an object'

        if 'user_id' not in payload:
            return False, "Missing 'user_id'"

        plan = payload.get('plan')
        if plan is not None:
            if not isinstance(plan, dict):
                return False, "'plan' must be an object or null"
            if not isinstance(plan.get('entries', []), list):
                return False, "'plan.entries' must be a list"

            for index, entry in enumerate(plan.get('entries', [])):
                if not isinstance(entry, dict):
                    return False, f'Entry {index} must be an object'
                if not entry.get('id'):
                    return False, f'Entry {index} missing id'
                if not entry.get('name'):
                    return False, f'Entry {index} missing name'
        return True, ''
    except json.JSONDecodeError as error:
        return False, f'Invalid JSON: {error}'
    except Exception as error:
        return False, f'Validation failed: {error}'


def save_user_plan(user_id: str, payload: Dict, username: Optional[str] = None) -> bool:
    file_path = get_user_plan_file(user_id)
    temp_path = file_path + '.tmp'
    backup_path = file_path + '.backup'
    backup_created = False

    try:
        ensure_plan_directory()
        payload['user_id'] = user_id
        if username:
            payload['username'] = username
        payload.setdefault('username', username or 'unknown')
        payload.setdefault('created_at', _to_iso(_now()))
        payload['updated_at'] = _to_iso(_now())

        if os.path.exists(file_path):
            try:
                shutil.copy2(file_path, backup_path)
                backup_created = True
            except Exception as backup_error:
                logger.error(f'Failed to backup plan file for user {user_id}: {backup_error}')

        with open(temp_path, 'w', encoding='utf-8') as file_obj:
            json.dump(payload, file_obj, indent=2, ensure_ascii=False)

        is_valid, error_message = validate_plan_json(temp_path)
        if not is_valid:
            raise ValueError(error_message)

        os.replace(temp_path, file_path)

        if backup_created and os.path.exists(backup_path):
            os.remove(backup_path)

        return True
    except Exception as error:
        logger.error(f'Error saving plan for user {user_id}: {error}')

        if backup_created and os.path.exists(backup_path):
            try:
                os.replace(backup_path, file_path)
            except Exception as restore_error:
                logger.error(f'Failed to restore plan backup for user {user_id}: {restore_error}')

        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception as cleanup_error:
                logger.warning(f'Failed to clean temp plan file for user {user_id}: {cleanup_error}')

        if backup_created and os.path.exists(backup_path):
            try:
                os.remove(backup_path)
            except Exception:
                pass

        return False


def _normalize_name(name: str) -> str:
    return skytonight_targets.normalize_object_name(name)


def _target_group_id(catalogue: str, name: str) -> str:
    entry = skytonight_targets.get_lookup_entry(catalogue, name)
    return str(entry.get('group_id', '') or '')


def _target_aliases(catalogue: str, name: str) -> Dict[str, str]:
    entry = skytonight_targets.get_lookup_entry(catalogue, name)
    aliases = entry.get('aliases', {}) if isinstance(entry, dict) else {}
    return aliases if isinstance(aliases, dict) else {}


def _entry_matches(entry: Dict, catalogue: str, name: str) -> bool:
    requested_group = _target_group_id(catalogue, name)
    if requested_group and entry.get('catalogue_group_id') == requested_group:
        return True

    requested_normalized = _normalize_name(name)
    if requested_normalized and requested_normalized == _normalize_name(entry.get('name', '')):
        return True

    aliases = entry.get('catalogue_aliases', {})
    if isinstance(aliases, dict):
        for alias_name in aliases.values():
            if requested_normalized and requested_normalized == _normalize_name(alias_name):
                return True

    return False


def is_target_in_current_plan(user_id: str, username: str, catalogue: str, name: str) -> bool:
    payload = load_user_plan(user_id, username)
    plan = payload.get('plan')
    if not plan:
        return False
    if get_plan_state(plan) != 'current':
        return False

    for entry in plan.get('entries', []):
        if _entry_matches(entry, catalogue, name):
            return True

    return False


def _parse_hhmm_to_minutes(value: str) -> Optional[int]:
    text = str(value or '').strip()
    if not text:
        return None
    parts = text.split(':')
    if len(parts) != 2:
        return None
    try:
        hours = int(parts[0])
        minutes = int(parts[1])
    except ValueError:
        return None
    if hours < 0 or minutes < 0 or minutes > 59:
        return None
    total = (hours * 60) + minutes
    return max(0, min(total, 24 * 60))


def _minutes_to_hhmm(minutes: int) -> str:
    safe_minutes = max(0, int(minutes))
    hours = safe_minutes // 60
    remainder = safe_minutes % 60
    return f'{hours:02d}:{remainder:02d}'


def get_plan_state(plan: Optional[Dict], now_dt: Optional[datetime] = None) -> str:
    if not plan:
        return 'none'

    now_value = now_dt or _now()
    night_end = _parse_datetime(plan.get('night_end'))
    if night_end and now_value > night_end:
        return 'previous'

    return 'current'


def _build_target_payload(item_data: Dict, catalogue: str) -> Dict:
    item_name = str(item_data.get('name') or item_data.get('id') or item_data.get('target name') or '').strip()
    group_id = _target_group_id(catalogue, item_name)
    aliases = _target_aliases(catalogue, item_name)

    planned_minutes = 60
    planned_minutes_value = item_data.get('planned_minutes')
    if planned_minutes_value is not None:
        try:
            planned_minutes = int(str(planned_minutes_value))
        except (TypeError, ValueError):
            planned_minutes = 60

    return {
        'id': str(uuid.uuid4()),
        'name': item_name,
        'catalogue': catalogue,
        'source_type': str(item_data.get('source_type') or '').strip() or 'report',
        'target_name': str(item_data.get('target name') or '').strip(),
        'type': str(item_data.get('type') or '').strip(),
        'constellation': str(item_data.get('constellation') or '').strip(),
        'ra': item_data.get('ra') or item_data.get('right ascension'),
        'dec': item_data.get('dec') or item_data.get('declination'),
        'mag': item_data.get('mag') or item_data.get('visual magnitude'),
        'size': item_data.get('size'),
        'foto': item_data.get('foto') or item_data.get('fraction of time observable'),
        'alttime_file': str(item_data.get('alttime_file') or '').strip(),
        'catalogue_group_id': group_id,
        'catalogue_aliases': aliases,
        'planned_minutes': max(0, min(planned_minutes, 24 * 60)),
        'planned_duration': _minutes_to_hhmm(planned_minutes),
        'done': bool(item_data.get('done', False)),
        'created_at': _to_iso(_now()),
        'updated_at': _to_iso(_now()),
    }


def create_or_add_target(
    user_id: str,
    username: str,
    item_data: Dict,
    catalogue: str,
    night_start: Any,
    night_end: Any,
    duration_hours: float = 0.0,
) -> Tuple[bool, str, Optional[Dict], Optional[Dict]]:
    payload = load_user_plan(user_id, username)
    plan = payload.get('plan')
    now_dt = _now()

    state = get_plan_state(plan, now_dt)
    if state == 'previous':
        return False, 'previous_plan_locked', payload, None

    night_start_dt = _parse_datetime(night_start)
    night_end_dt = _parse_datetime(night_end)
    if not night_start_dt or not night_end_dt or night_end_dt <= night_start_dt:
        return False, 'invalid_night_window', payload, None

    if not plan:
        plan = {
            'plan_date': night_start_dt.date().isoformat(),
            'night_start': _to_iso(night_start_dt),
            'night_end': _to_iso(night_end_dt),
            'duration_hours': float(duration_hours or 0.0),
            'created_at': _to_iso(now_dt),
            'updated_at': _to_iso(now_dt),
            'entries': [],
        }
        payload['plan'] = plan

    entries = plan.setdefault('entries', [])
    item_name = str(item_data.get('name') or item_data.get('id') or item_data.get('target name') or '').strip()

    for entry in entries:
        if _entry_matches(entry, catalogue, item_name):
            return True, 'already_in_plan', payload, entry

    target = _build_target_payload(item_data, catalogue)
    entries.append(target)
    plan['updated_at'] = _to_iso(now_dt)

    if not save_user_plan(user_id, payload, username=username):
        return False, 'save_failed', payload, None

    return True, 'added', payload, target


def clear_plan(user_id: str, username: str) -> bool:
    payload = load_user_plan(user_id, username)
    payload['plan'] = None
    return save_user_plan(user_id, payload, username=username)


def remove_target(user_id: str, username: str, entry_id: str) -> bool:
    payload = load_user_plan(user_id, username)
    plan = payload.get('plan')
    if not plan:
        return False

    if get_plan_state(plan) == 'previous':
        return False

    entries = plan.get('entries', [])
    before = len(entries)
    plan['entries'] = [entry for entry in entries if entry.get('id') != entry_id]

    if len(plan['entries']) == before:
        return False

    plan['updated_at'] = _to_iso(_now())
    return save_user_plan(user_id, payload, username=username)


def update_target(user_id: str, username: str, entry_id: str, updates: Dict) -> Optional[Dict]:
    payload = load_user_plan(user_id, username)
    plan = payload.get('plan')
    if not plan:
        return None

    if get_plan_state(plan) == 'previous':
        return None

    entries = plan.get('entries', [])
    target_entry = next((entry for entry in entries if entry.get('id') == entry_id), None)
    if not target_entry:
        return None

    if 'done' in updates:
        target_entry['done'] = bool(updates.get('done'))

    if 'planned_duration' in updates:
        parsed_minutes = _parse_hhmm_to_minutes(str(updates.get('planned_duration')))
        if parsed_minutes is not None:
            target_entry['planned_minutes'] = parsed_minutes
            target_entry['planned_duration'] = _minutes_to_hhmm(parsed_minutes)

    if 'planned_minutes' in updates:
        planned_minutes_value = updates.get('planned_minutes')
        try:
            parsed_minutes = int(str(planned_minutes_value))
            target_entry['planned_minutes'] = max(0, min(parsed_minutes, 24 * 60))
            target_entry['planned_duration'] = _minutes_to_hhmm(target_entry['planned_minutes'])
        except (TypeError, ValueError):
            pass

    target_entry['updated_at'] = _to_iso(_now())
    plan['updated_at'] = _to_iso(_now())

    if not save_user_plan(user_id, payload, username=username):
        return None

    return target_entry


def reorder_target(user_id: str, username: str, entry_id: str, new_index: int) -> bool:
    payload = load_user_plan(user_id, username)
    plan = payload.get('plan')
    if not plan:
        return False

    if get_plan_state(plan) == 'previous':
        return False

    entries = plan.get('entries', [])
    current_index = next((index for index, entry in enumerate(entries) if entry.get('id') == entry_id), None)
    if current_index is None:
        return False

    bounded_new_index = max(0, min(int(new_index), len(entries) - 1))
    if bounded_new_index == current_index:
        return True

    entry = entries.pop(current_index)
    entries.insert(bounded_new_index, entry)
    plan['updated_at'] = _to_iso(_now())

    return save_user_plan(user_id, payload, username=username)


def get_plan_with_timeline(user_id: str, username: str) -> Dict:
    payload = load_user_plan(user_id, username)
    plan = payload.get('plan')
    if not plan:
        return {
            'state': 'none',
            'plan': None,
            'timeline': {
                'progress_percent': 0.0,
                'is_inside_night': False,
                'current_target_id': None,
            },
            'current_banner': None,
        }

    plan_copy = copy.deepcopy(plan)
    state = get_plan_state(plan_copy)

    entries = plan_copy.get('entries', [])
    night_start = _parse_datetime(plan_copy.get('night_start'))
    night_end = _parse_datetime(plan_copy.get('night_end'))

    now_dt = _now()
    progress_percent = 0.0
    is_inside_night = False
    current_target_id = None

    if night_start and night_end and night_end > night_start:
        total_seconds = (night_end - night_start).total_seconds()
        if total_seconds > 0:
            elapsed_seconds = (now_dt - night_start).total_seconds()
            progress_percent = max(0.0, min(100.0, (elapsed_seconds / total_seconds) * 100.0))
        is_inside_night = night_start <= now_dt <= night_end

        cursor = night_start
        for entry in entries:
            planned_minutes = int(entry.get('planned_minutes') or 0)
            start_dt = cursor
            end_dt = cursor
            if planned_minutes > 0:
                end_dt = cursor + timedelta(minutes=planned_minutes)
            if end_dt > night_end:
                end_dt = night_end

            entry['timeline_start'] = _to_iso(start_dt)
            entry['timeline_end'] = _to_iso(end_dt)

            if is_inside_night and not entry.get('done') and start_dt <= now_dt <= end_dt:
                current_target_id = entry.get('id')

            cursor = end_dt

    current_entry = next((entry for entry in entries if entry.get('id') == current_target_id), None)

    return {
        'state': state,
        'plan': plan_copy,
        'timeline': {
            'progress_percent': round(progress_percent, 2),
            'is_inside_night': is_inside_night,
            'current_target_id': current_target_id,
        },
        'current_banner': current_entry,
    }


def serialize_plan_csv(plan_payload: Dict, labels: Optional[Dict[str, str]] = None) -> str:
    labels = labels or {}
    def _label(key: str, fallback: str) -> str:
        return str(labels.get(key) or fallback)

    plan = plan_payload.get('plan')
    if not plan:
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            _label('order', 'order'),
            _label('name', 'name'),
            _label('catalogue', 'catalogue'),
            _label('target_name', 'target_name'),
            _label('source_type', 'source_type'),
            _label('type', 'type'),
            _label('constellation', 'constellation'),
            _label('ra', 'ra'),
            _label('dec', 'dec'),
            _label('mag', 'mag'),
            _label('size', 'size'),
            _label('foto', 'foto'),
            _label('planned_duration', 'planned_duration'),
            _label('planned_minutes', 'planned_minutes'),
            _label('timeline_start', 'timeline_start'),
            _label('timeline_end', 'timeline_end'),
            _label('alttime_file', 'alttime_file'),
            _label('done', 'done'),
        ])
        return output.getvalue()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        _label('order', 'order'),
        _label('name', 'name'),
        _label('catalogue', 'catalogue'),
        _label('target_name', 'target_name'),
        _label('source_type', 'source_type'),
        _label('type', 'type'),
        _label('constellation', 'constellation'),
        _label('ra', 'ra'),
        _label('dec', 'dec'),
        _label('mag', 'mag'),
        _label('size', 'size'),
        _label('foto', 'foto'),
        _label('planned_duration', 'planned_duration'),
        _label('planned_minutes', 'planned_minutes'),
        _label('timeline_start', 'timeline_start'),
        _label('timeline_end', 'timeline_end'),
        _label('alttime_file', 'alttime_file'),
        _label('done', 'done'),
    ])

    for index, entry in enumerate(plan.get('entries', []), start=1):
        writer.writerow([
            index,
            str(entry.get('name', '')),
            str(entry.get('catalogue', '')),
            str(entry.get('target_name', '')),
            str(entry.get('source_type', '')),
            str(entry.get('type', '')),
            str(entry.get('constellation', '')),
            str(entry.get('ra', '')),
            str(entry.get('dec', '')),
            str(entry.get('mag', '')),
            str(entry.get('size', '')),
            str(entry.get('foto', '')),
            str(entry.get('planned_duration', '00:00')),
            str(entry.get('planned_minutes', '')),
            str(entry.get('timeline_start', '')),
            str(entry.get('timeline_end', '')),
            str(entry.get('alttime_file', '')),
            _label('done_yes', 'yes') if entry.get('done') else _label('done_no', 'no'),
        ])

    return output.getvalue()
