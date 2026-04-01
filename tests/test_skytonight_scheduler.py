"""Tests for SkyTonight scheduler schedule resolution."""

from datetime import datetime
from zoneinfo import ZoneInfo

from skytonight_scheduler import SkyTonightScheduler, resolve_schedule


def _base_config():
    return {
        'location': {
            'name': 'Paris',
            'latitude': 48.866669,
            'longitude': 2.33333,
            'elevation': 35,
            'timezone': 'Europe/Paris',
        },
        'skytonight': {'enabled': True},
    }


def test_resolve_schedule_uses_fallback_for_invalid_time():
    config = _base_config()
    now = datetime(2020, 1, 1, 12, 0, tzinfo=ZoneInfo('Europe/Paris'))
    schedule = resolve_schedule(config, now=now)

    assert schedule.server_time_valid is False
    assert schedule.mode == 'fallback-6h'
    assert schedule.next_run is not None


def test_resolve_schedule_prefers_soonest_valid_candidate():
    config = _base_config()
    now = datetime(2026, 6, 1, 4, 0, tzinfo=ZoneInfo('Europe/Paris'))
    schedule = resolve_schedule(config, now=now)

    assert schedule.server_time_valid is True
    assert schedule.next_run is not None
    assert schedule.next_run > now
    assert schedule.mode in {'daily-06:00', 'pre-astronomical-night'}


def test_resolve_schedule_keeps_timezone_from_config():
    config = _base_config()
    now = datetime(2026, 4, 1, 22, 0, tzinfo=ZoneInfo('Europe/Paris'))
    schedule = resolve_schedule(config, now=now)

    assert schedule.timezone == 'Europe/Paris'


def test_disabled_scheduler_does_not_execute_runner(monkeypatch):
    stored_status = {}
    calls = []

    def _save_status(payload):
        stored_status.clear()
        stored_status.update(payload)
        return True

    monkeypatch.setattr('skytonight_scheduler.save_scheduler_status', _save_status)
    monkeypatch.setattr('skytonight_scheduler.load_scheduler_status', lambda default=None: dict(stored_status or (default or {})))

    scheduler = SkyTonightScheduler(
        config_loader=lambda: {
            'location': {
                'name': 'Paris',
                'latitude': 48.866669,
                'longitude': 2.33333,
                'timezone': 'Europe/Paris',
            },
            'skytonight': {'enabled': False},
        },
        runner=lambda: calls.append('ran'),
    )

    scheduler._execute_cycle()
    status = scheduler.get_status()

    assert calls == []
    assert status['enabled'] is False
    assert status['mode'] == 'disabled'
    assert status['next_run'] is None