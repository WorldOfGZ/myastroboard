"""SkyTonight scheduler for internal dataset refresh and calculation orchestration."""

from __future__ import annotations

import os
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Callable, Dict, Optional
from zoneinfo import ZoneInfo

from logging_config import get_logger
from skytonight_storage import (
    append_scheduler_log,
    ensure_skytonight_directories,
    get_scheduler_trigger_file,
    has_calculation_results,
    load_scheduler_status,
    save_scheduler_status,
)
from sun_phases import SunService


logger = get_logger(__name__)

SKYTONIGHT_FALLBACK_INTERVAL_SECONDS = 6 * 60 * 60
SKYTONIGHT_MORNING_RUN_HOUR = 6
SKYTONIGHT_PRE_NIGHT_OFFSET = timedelta(hours=1)


@dataclass(frozen=True)
class SkyTonightSchedule:
    mode: str
    next_run: Optional[datetime]
    server_time_valid: bool
    reason: str
    server_time: datetime
    timezone: str


def _parse_local_datetime(value: str, timezone_name: str) -> Optional[datetime]:
    text = str(value or '').strip()
    if not text or text == 'Not found':
        return None
    try:
        parsed = datetime.strptime(text, '%Y-%m-%d %H:%M')
    except ValueError:
        return None
    return parsed.replace(tzinfo=ZoneInfo(timezone_name))


def _is_server_time_valid(current_time: datetime, timezone_name: str) -> bool:
    if current_time.year < 2024:
        return False
    try:
        ZoneInfo(timezone_name)
    except Exception:
        return False
    return True


def resolve_schedule(config: Dict[str, Any], now: Optional[datetime] = None) -> SkyTonightSchedule:
    """Resolve the next SkyTonight run according to scheduler requirements."""
    location = config.get('location', {}) if isinstance(config, dict) else {}
    timezone_name = str(location.get('timezone') or 'UTC')
    zone = ZoneInfo(timezone_name)
    current_time = now.astimezone(zone) if now else datetime.now(zone)
    valid_time = _is_server_time_valid(current_time, timezone_name)

    if not valid_time:
        return SkyTonightSchedule(
            mode='fallback-6h',
            next_run=current_time + timedelta(seconds=SKYTONIGHT_FALLBACK_INTERVAL_SECONDS),
            server_time_valid=False,
            reason='Server time or timezone is not trusted; using 6-hour fallback cadence.',
            server_time=current_time,
            timezone=timezone_name,
        )

    candidates = []

    morning_candidate = current_time.replace(
        hour=SKYTONIGHT_MORNING_RUN_HOUR,
        minute=0,
        second=0,
        microsecond=0,
    )
    if morning_candidate <= current_time:
        morning_candidate += timedelta(days=1)
    candidates.append(('daily-06:00', morning_candidate, 'Next daily 06:00 local run.'))

    latitude = location.get('latitude')
    longitude = location.get('longitude')
    if latitude is not None and longitude is not None:
        sun_service = SunService(latitude=latitude, longitude=longitude, timezone=timezone_name)
        for report in (sun_service.get_today_report(), sun_service.get_tomorrow_report()):
            dusk_time = _parse_local_datetime(report.astronomical_dusk, timezone_name)
            if dusk_time is None:
                continue
            candidate = dusk_time - SKYTONIGHT_PRE_NIGHT_OFFSET
            if candidate > current_time:
                candidates.append(
                    ('pre-astronomical-night', candidate, 'One hour before astronomical night.'),
                )

    selected_mode, selected_time, reason = min(candidates, key=lambda item: item[1])
    return SkyTonightSchedule(
        mode=selected_mode,
        next_run=selected_time,
        server_time_valid=True,
        reason=reason,
        server_time=current_time,
        timezone=timezone_name,
    )


class SkyTonightScheduler:
    """Internal scheduler that refreshes the SkyTonight dataset and writes shared status."""

    def __init__(
        self,
        config_loader: Callable[[], Dict[str, Any]],
        runner: Callable[[], Dict[str, Any]],
        app=None,
        cache_ready_event: Optional[threading.Event] = None,
    ):
        self.config_loader = config_loader
        self.runner = runner
        self.app = app
        self.running = False
        self.thread = None
        self.last_run: Optional[datetime] = None
        self.last_error: Optional[str] = None
        self.last_result: Dict[str, Any] = {}
        self.execution_start_time: Optional[datetime] = None
        self.is_executing = False
        self.current_mode = 'idle'
        self.current_reason = ''
        self._execution_lock = threading.Lock()
        self._scheduler_started = False
        self.last_execution_duration_seconds: Optional[int] = None
        # Optional event set by CacheScheduler after first successful update.
        # When present, the first automatic run is delayed until caches are warm.
        self._cache_ready_event: Optional[threading.Event] = cache_ready_event
        self._cache_ready_waited = False
        ensure_skytonight_directories()

        stored_status = load_scheduler_status(default={})
        last_run_text = str(stored_status.get('last_run') or '').strip()
        if last_run_text:
            try:
                self.last_run = datetime.fromisoformat(last_run_text)
            except ValueError:
                self.last_run = None

    def start(self):
        if self._scheduler_started:
            logger.warning('SkyTonight scheduler already started')
            return
        self._scheduler_started = True
        self.running = True
        self.thread = threading.Thread(target=self._run_loop, daemon=True)
        self.thread.start()
        logger.info('SkyTonight scheduler started')
        self._write_status()

    def stop(self):
        self.running = False
        if self.thread:
            self.thread.join(timeout=3)
        logger.info('SkyTonight scheduler stopped')
        self._write_status()

    def _run_loop(self):
        while self.running:
            config = self.config_loader()
            skytonight_config = config.get('skytonight', {}) if isinstance(config, dict) else {}
            if not bool(skytonight_config.get('enabled', False)):
                self.current_mode = 'disabled'
                self.current_reason = 'SkyTonight is disabled in configuration.'
                self._write_status()
                time.sleep(5)
                continue

            trigger_file = get_scheduler_trigger_file()
            manual_trigger = False
            if os.path.exists(trigger_file):
                try:
                    os.remove(trigger_file)
                    manual_trigger = True
                    logger.info('SkyTonight manual trigger detected')
                except Exception as error:
                    logger.error(f'Failed to remove SkyTonight trigger file: {error}')

            schedule = resolve_schedule(config)
            self.current_mode = schedule.mode
            self.current_reason = schedule.reason

            should_run = manual_trigger or self.last_run is None
            if not should_run and not has_calculation_results():
                logger.info(
                    'SkyTonight calculation results are missing; '
                    'triggering run regardless of last_run timestamp.'
                )
                should_run = True
            if not should_run and schedule.next_run is not None:
                should_run = schedule.server_time >= schedule.next_run

            if should_run and not self._execution_lock.locked():
                # On the first automatic run, wait for the cache scheduler to finish
                # its initial update so SkyTonight calculations use warm caches.
                if (
                    not manual_trigger
                    and not self._cache_ready_waited
                    and self._cache_ready_event is not None
                    and not self._cache_ready_event.is_set()
                ):
                    self._cache_ready_waited = True
                    logger.info(
                        'Waiting up to 5 minutes for initial cache update '
                        'before first SkyTonight run...'
                    )
                    ready = self._cache_ready_event.wait(timeout=300)
                    if not ready:
                        logger.warning(
                            'Cache ready timeout exceeded; proceeding with SkyTonight run anyway.'
                        )
                elif not self._cache_ready_waited:
                    self._cache_ready_waited = True
                # Set is_executing optimistically before the thread lands so the
                # status file never shows is_executing=False during pending start.
                self.is_executing = True
                self.execution_start_time = datetime.now().astimezone()
                threading.Thread(
                    target=self._execute_cycle,
                    kwargs={'manual_trigger': manual_trigger},
                    daemon=True,
                ).start()

            # Always write status every loop iteration so progress duration
            # stays live in the status file while execution is running.
            self._write_status(schedule=schedule)
            time.sleep(5)

    def _execute_cycle(self, manual_trigger: bool = False):
        config = self.config_loader()
        if not bool(config.get('skytonight', {}).get('enabled', False)):
            self.current_mode = 'disabled'
            self.current_reason = 'SkyTonight is disabled in configuration.'
            self._write_status()
            return

        if self._execution_lock.locked():
            logger.warning('SkyTonight execution already in progress, skipping new run')
            self.is_executing = False
            self.execution_start_time = None
            return

        with self._execution_lock:
            self.is_executing = True
            self.execution_start_time = datetime.now().astimezone()
            self.last_error = None
            self._write_status()

            try:
                logger.info('Starting SkyTonight execution cycle')
                if self.app is not None:
                    with self.app.app_context():
                        result = self.runner()
                else:
                    result = self.runner()

                self.last_result = result if isinstance(result, dict) else {'result': result}
                self.last_run = datetime.now().astimezone()
                self.current_mode = 'manual' if manual_trigger else 'scheduled'
                append_scheduler_log(
                    f"[{self.last_run.isoformat()}] SkyTonight run completed: {self.last_result}\n"
                )
                logger.info('SkyTonight execution cycle completed successfully')
            except Exception as error:
                self.last_error = str(error)
                self.last_result = {}
                failure_time = datetime.now().astimezone()
                append_scheduler_log(f'[{failure_time.isoformat()}] SkyTonight run failed: {error}\n')
                logger.error(f'SkyTonight execution cycle failed: {error}')
            finally:
                if self.execution_start_time:
                    self.last_execution_duration_seconds = int(
                        (datetime.now().astimezone() - self.execution_start_time).total_seconds()
                    )
                self.is_executing = False
                self.execution_start_time = None
                self._write_status()

    def _write_status(self, schedule: Optional[SkyTonightSchedule] = None):
        config = self.config_loader()
        enabled = bool(config.get('skytonight', {}).get('enabled', False))

        if schedule is None:
            schedule = resolve_schedule(config)

        if not enabled:
            schedule = SkyTonightSchedule(
                mode='disabled',
                next_run=None,
                server_time_valid=schedule.server_time_valid,
                reason='SkyTonight is disabled in configuration.',
                server_time=schedule.server_time,
                timezone=schedule.timezone,
            )

        execution_duration_seconds = None
        if self.is_executing and self.execution_start_time:
            execution_duration_seconds = int((datetime.now().astimezone() - self.execution_start_time).total_seconds())

        try:
            from skytonight_calculator import get_calculation_progress
            calc_progress = get_calculation_progress()
        except Exception:
            calc_progress = {}

        payload = {
            'running': self.running,
            'enabled': enabled,
            'last_run': self.last_run.isoformat() if self.last_run else None,
            'next_run': schedule.next_run.isoformat() if schedule.next_run else None,
            'is_executing': self.is_executing,
            'mode': schedule.mode,
            'reason': schedule.reason,
            'server_time_valid': schedule.server_time_valid,
            'server_time': schedule.server_time.isoformat(),
            'timezone': schedule.timezone,
            'last_error': self.last_error,
            'last_result': self.last_result,
            'progress': {
                'execution_duration_seconds': execution_duration_seconds,
                'last_execution_duration_seconds': self.last_execution_duration_seconds,
                **calc_progress,
            },
        }
        save_scheduler_status(payload)

    def get_status(self) -> Dict[str, Any]:
        config = self.config_loader()
        schedule = resolve_schedule(config)
        self._write_status(schedule=schedule)
        status = load_scheduler_status(default={})
        status.setdefault('running', self.running)
        status.setdefault('enabled', bool(config.get('skytonight', {}).get('enabled', False)))
        return status

    def trigger_now(self) -> Dict[str, Any]:
        if self._execution_lock.locked():
            return {'status': 'skipped', 'reason': 'execution already in progress'}
        threading.Thread(target=self._execute_cycle, kwargs={'manual_trigger': True}, daemon=True).start()
        return {'status': 'triggered'}