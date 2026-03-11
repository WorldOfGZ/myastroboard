"""Unit tests for backend i18n utilities (i18n_utils.py)."""

import pytest
from unittest.mock import mock_open, patch

import i18n_utils as module
from i18n_utils import I18nManager, _is_safe_path, create_translated_alert, get_translated_message


@pytest.fixture(autouse=True)
def _clear_translation_cache():
    module._translation_cache.clear()
    yield
    module._translation_cache.clear()


def test_is_safe_path_true_for_nested_path(tmp_path):
    base = tmp_path / "base"
    base.mkdir()
    candidate = base / "folder" / "en.json"
    candidate.parent.mkdir()
    candidate.write_text("{}", encoding="utf-8")
    assert _is_safe_path(str(base), str(candidate)) is True


def test_load_translation_file_unsupported_language_falls_back_to_default():
    payload = '{"common": {"hello": "Hello"}}'
    with patch("i18n_utils.os.path.exists", return_value=True), patch(
        "builtins.open", mock_open(read_data=payload)
    ):
        data = module._load_translation_file("xx")

    assert data == {"common": {"hello": "Hello"}}


def test_load_translation_file_not_found_returns_empty():
    with patch("i18n_utils.os.path.exists", return_value=False):
        assert module._load_translation_file("en") == {}


def test_i18n_manager_fallback_and_params():
    def fake_loader(language):
        if language == "fr":
            return {"weather_alerts": {}}
        return {"weather_alerts": {"critical_dew_risk": "Dew risk at {time}"}}

    with patch("i18n_utils._load_translation_file", side_effect=fake_loader):
        manager = I18nManager("fr")
        result = manager.t("weather_alerts.critical_dew_risk", time="22:15")

    assert result == "Dew risk at 22:15"


def test_i18n_manager_missing_key_returns_key():
    with patch("i18n_utils._load_translation_file", return_value={}):
        manager = I18nManager("en")
    assert manager.t("missing.namespace") == "missing.namespace"


def test_i18n_manager_set_language_unsupported_keeps_current():
    with patch("i18n_utils._load_translation_file", return_value={}):
        manager = I18nManager("en")
        manager.set_language("xx")
    assert manager.get_language() == "en"


def test_get_namespace_and_supported_languages():
    with patch("i18n_utils._load_translation_file", return_value={"weather_alerts": {"x": "y"}}):
        manager = I18nManager("en")
    assert manager.get_namespace("weather_alerts") == {"x": "y"}
    assert "en" in manager.get_supported_languages()


def test_get_translated_message_calls_manager():
    with patch("i18n_utils.I18nManager") as manager_cls:
        manager_instance = manager_cls.return_value
        manager_instance.t.return_value = "Translated"
        result = get_translated_message("weather_alerts.section_title", "en")

    assert result == "Translated"
    manager_instance.t.assert_called_once_with("weather_alerts.section_title")


def test_create_translated_alert_uses_formatted_time_and_fallback_key():
    with patch("i18n_utils.I18nManager") as manager_cls:
        manager_instance = manager_cls.return_value
        manager_instance.t.return_value = "Alert text"

        alert = create_translated_alert(
            alert_type="DEW_WARNING",
            severity="HIGH",
            time="2026-03-11T21:45:00",
            language="en",
        )

    manager_instance.t.assert_called_once_with("weather_alerts.critical_dew_risk", time="21:45")
    assert alert["message"] == "Alert text"


def test_create_translated_alert_invalid_time_keeps_original_string():
    with patch("i18n_utils.I18nManager") as manager_cls:
        manager_instance = manager_cls.return_value
        manager_instance.t.return_value = "Section"

        create_translated_alert(
            alert_type="UNKNOWN",
            severity="LOW",
            time="not-a-time",
            language="en",
        )

    manager_instance.t.assert_called_once_with("weather_alerts.section_title", time="not-a-time")
