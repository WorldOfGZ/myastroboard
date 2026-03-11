"""Unit tests for backend cache scheduler (cache_scheduler.py)."""

import types

import pytest

import cache_scheduler as module


class DummyThread:
    def __init__(self, alive=False):
        self.started = False
        self.joined = False
        self._alive = alive

    def start(self):
        self.started = True

    def is_alive(self):
        return self._alive

    def join(self):
        self.joined = True


class DummyFile:
    def __init__(self):
        self.closed = False

    def fileno(self):
        return 1

    def write(self, _value):
        return None

    def flush(self):
        return None

    def close(self):
        self.closed = True


def test_start_starts_thread_when_lock_acquired(monkeypatch):
    scheduler = module.CacheScheduler(interval_seconds=1)
    scheduler.thread = DummyThread()
    monkeypatch.setattr(scheduler, "_acquire_lock", lambda: True)

    assert scheduler.start() is True
    assert scheduler.thread.started is True


def test_start_returns_false_when_lock_not_acquired(monkeypatch):
    scheduler = module.CacheScheduler(interval_seconds=1)
    scheduler.thread = DummyThread()
    monkeypatch.setattr(scheduler, "_acquire_lock", lambda: False)

    assert scheduler.start() is False
    assert scheduler.thread.started is False


def test_acquire_lock_success_windows_branch(monkeypatch, tmp_path):
    scheduler = module.CacheScheduler(interval_seconds=1)
    dummy_file = DummyFile()

    monkeypatch.setattr(module, "DATA_DIR_CACHE", str(tmp_path))
    monkeypatch.setattr(module.sys, "platform", "win32")
    monkeypatch.setattr("builtins.open", lambda *_args, **_kwargs: dummy_file)
    monkeypatch.setattr(module.msvcrt, "locking", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(module.os, "getpid", lambda: 1234)

    assert scheduler._acquire_lock() is True
    assert scheduler._has_lock is True
    assert scheduler._lock_file is dummy_file


def test_acquire_lock_failure_releases_file(monkeypatch, tmp_path):
    scheduler = module.CacheScheduler(interval_seconds=1)
    dummy_file = DummyFile()

    monkeypatch.setattr(module, "DATA_DIR_CACHE", str(tmp_path))
    monkeypatch.setattr(module.sys, "platform", "win32")
    monkeypatch.setattr("builtins.open", lambda *_args, **_kwargs: dummy_file)

    def _fail_lock(*_args, **_kwargs):
        raise OSError("locked")

    monkeypatch.setattr(module.msvcrt, "locking", _fail_lock)

    assert scheduler._acquire_lock() is False
    assert scheduler._lock_file is None
    assert dummy_file.closed is True


def test_release_lock_unlinks_file(monkeypatch, tmp_path):
    scheduler = module.CacheScheduler(interval_seconds=1)
    scheduler._lock_file = DummyFile()
    scheduler._has_lock = True

    deleted = []
    monkeypatch.setattr(module, "DATA_DIR_CACHE", str(tmp_path))
    monkeypatch.setattr(module.sys, "platform", "win32")
    monkeypatch.setattr(module.msvcrt, "locking", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(module.os.path, "exists", lambda _p: True)
    monkeypatch.setattr(module.os, "unlink", lambda p: deleted.append(p))

    scheduler._release_lock()

    assert scheduler._has_lock is False
    assert scheduler._lock_file is None
    assert len(deleted) == 1


def test_stop_sets_event_joins_and_releases(monkeypatch):
    scheduler = module.CacheScheduler(interval_seconds=1)
    scheduler.thread = DummyThread(alive=True)
    released = []
    monkeypatch.setattr(scheduler, "_release_lock", lambda: released.append(True))

    scheduler.stop()

    assert scheduler._stop_event.is_set() is True
    assert scheduler.thread.joined is True
    assert released == [True]


def test_update_all_caches_success(monkeypatch):
    scheduler = module.CacheScheduler(interval_seconds=1)
    called = []
    monkeypatch.setattr(module, "fully_initialize_caches", lambda: called.append(True))

    scheduler.update_all_caches()

    assert called == [True]


def test_update_all_caches_failure_raises(monkeypatch):
    scheduler = module.CacheScheduler(interval_seconds=1)

    def _raise():
        raise RuntimeError("boom")

    monkeypatch.setattr(module, "fully_initialize_caches", _raise)

    with pytest.raises(RuntimeError):
        scheduler.update_all_caches()


def test_run_exits_when_stop_event_is_set_after_first_wait(monkeypatch):
    scheduler = module.CacheScheduler(interval_seconds=1)
    calls = []

    monkeypatch.setattr(scheduler, "update_all_caches", lambda: calls.append("run"))

    class OneShotEvent:
        def __init__(self):
            self.wait_calls = 0

        def is_set(self):
            return False

        def wait(self, _interval):
            self.wait_calls += 1
            return True

        def set(self):
            return None

    scheduler._stop_event = OneShotEvent()
    scheduler._run()

    assert calls == ["run"]
