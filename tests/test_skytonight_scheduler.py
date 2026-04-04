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
    # Use an April date where a proper astronomical night exists in Paris
    now = datetime(2026, 4, 1, 4, 0, tzinfo=ZoneInfo('Europe/Paris'))
    schedule = resolve_schedule(config, now=now)

    assert schedule.server_time_valid is True
    assert schedule.next_run is not None
    assert schedule.next_run > now
    assert schedule.mode in {'post-astronomical-night', 'pre-astronomical-night'}


def test_resolve_schedule_keeps_timezone_from_config():
    config = _base_config()
    now = datetime(2026, 4, 1, 22, 0, tzinfo=ZoneInfo('Europe/Paris'))
    schedule = resolve_schedule(config, now=now)

    assert schedule.timezone == 'Europe/Paris'


def test_resolve_schedule_post_night_candidate_is_after_dawn():
    """At 06:05, resolve_schedule should offer a post-night slot after astronomical dawn.

    This demonstrates why a committed_next_run is required: the freshly-computed
    next_run is always in the future, so comparing server_time against it would
    never fire — we must track the previously committed time.
    """
    config = _base_config()
    just_past_six = datetime(2026, 4, 3, 6, 5, tzinfo=ZoneInfo('Europe/Paris'))
    schedule = resolve_schedule(config, now=just_past_six)

    assert schedule.next_run is not None
    assert schedule.next_run > just_past_six
    assert schedule.mode in {'post-astronomical-night', 'pre-astronomical-night'}


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


def test_missed_run_recovery_on_startup(monkeypatch):
    """Missed-run recovery: if the app restarts after triggering a run (status
    already shows tonight's next_run) but before the run completed (last_run
    not updated), the startup block should restore the missed post-night slot
    so the loop fires on the first iteration.

    Scenario mirrors the real incident:
      - last_run  = 2026-04-03 23:14 (previous night's run)
      - persisted next_run = 2026-04-04 21:05 (tonight's pre-night, advanced
        when the morning run was triggered but the app crashed mid-execution)
      - server restarts at 2026-04-04 07:40
      - expected: _committed_next_run is restored to the missed ~06:20 slot so
        the loop check (server_time >= committed) fires immediately.
    """
    import threading
    from zoneinfo import ZoneInfo

    stored_status = {
        'last_run': '2026-04-03T23:14:53.097410+02:00',
        'next_run': '2026-04-04T21:05:00+02:00',
    }
    run_calls = []

    def _save_status(payload):
        stored_status.clear()
        stored_status.update(payload)

    def _load_status(default=None):
        return dict(stored_status) if stored_status else (default or {})

    def _has_results():
        return True  # pretend April 3 results exist (no forced re-run)

    def _ensure_dirs():
        pass

    def _trigger_file():
        return '/tmp/nonexistent_trigger_skytonight'

    monkeypatch.setattr('skytonight_scheduler.save_scheduler_status', _save_status)
    monkeypatch.setattr('skytonight_scheduler.load_scheduler_status', _load_status)
    monkeypatch.setattr('skytonight_scheduler.has_calculation_results', _has_results)
    monkeypatch.setattr('skytonight_scheduler.ensure_skytonight_directories', _ensure_dirs)
    monkeypatch.setattr('skytonight_scheduler.get_scheduler_trigger_file', _trigger_file)
    monkeypatch.setattr('skytonight_scheduler.append_scheduler_log', lambda msg: None)

    stop_event = threading.Event()

    def runner():
        run_calls.append('ran')
        stop_event.set()
        return {'dataset_generated': True}

    scheduler = SkyTonightScheduler(
        config_loader=lambda: {
            'location': {
                'name': 'Paris',
                'latitude': 48.866669,
                'longitude': 2.33333,
                'timezone': 'Europe/Paris',
            },
            'skytonight': {'enabled': True},
        },
        runner=runner,
    )

    scheduler.start()
    fired = stop_event.wait(timeout=15)
    scheduler.stop()

    assert fired, (
        'Missed-run recovery did not trigger the run within 15 s. '
        'The post-night slot (06:20) should have been restored and fired immediately on startup.'
    )
    assert run_calls, 'Runner was never called despite missed-run recovery.'