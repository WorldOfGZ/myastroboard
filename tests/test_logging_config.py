"""Unit tests for backend logging configuration helpers."""

import logging

import pytest

import logging_config as module


class DummyRotatingHandler(logging.Handler):
    """Minimal rotating handler replacement for tests."""

    def __init__(self, *args, **kwargs):
        super().__init__()
        self.args = args
        self.kwargs = kwargs


@pytest.fixture(autouse=True)
def _reset_logging_module_state(monkeypatch):
    module._loggers.clear()
    monkeypatch.setattr(module, "LOG_LEVEL", "INFO")
    yield
    module._loggers.clear()


def test_get_log_level_defaults_to_info_for_unknown_level(monkeypatch):
    monkeypatch.setattr(module, "LOG_LEVEL", "NOT_A_LEVEL")
    assert module._get_log_level() == logging.INFO


def test_setup_logger_without_console_adds_only_file_handler(monkeypatch):
    monkeypatch.setattr(module, "RotatingFileHandler", DummyRotatingHandler)
    monkeypatch.setattr(module.os, "makedirs", lambda *_args, **_kwargs: None)

    logger = module.setup_logger("test.no_console", include_console=False)

    assert logger.name == "test.no_console"
    assert logger.propagate is False
    assert len(logger.handlers) == 1
    assert isinstance(logger.handlers[0], DummyRotatingHandler)


def test_setup_logger_with_console_level_override(monkeypatch):
    monkeypatch.setattr(module, "RotatingFileHandler", DummyRotatingHandler)
    monkeypatch.setattr(module.os, "makedirs", lambda *_args, **_kwargs: None)

    logger = module.setup_logger("test.console", include_console=True, console_level="error")

    assert len(logger.handlers) == 2
    console_handlers = [h for h in logger.handlers if isinstance(h, logging.StreamHandler)]
    assert len(console_handlers) == 1
    assert console_handlers[0].level == logging.ERROR


def test_get_logger_returns_cached_instance(monkeypatch):
    monkeypatch.setattr(module, "RotatingFileHandler", DummyRotatingHandler)
    monkeypatch.setattr(module.os, "makedirs", lambda *_args, **_kwargs: None)

    first = module.setup_logger("test.cached", include_console=False)
    second = module.get_logger("test.cached", include_console=True)

    assert first is second


def test_set_global_log_level_updates_file_handlers(monkeypatch):
    monkeypatch.setattr(module, "RotatingFileHandler", DummyRotatingHandler)
    monkeypatch.setattr(module.os, "makedirs", lambda *_args, **_kwargs: None)

    logger = module.setup_logger("test.level_update", include_console=True)
    module.set_global_log_level("error")

    file_handlers = [h for h in logger.handlers if isinstance(h, DummyRotatingHandler)]
    assert len(file_handlers) == 1
    assert file_handlers[0].level == logging.ERROR
    assert module.get_current_log_level() == "ERROR"
