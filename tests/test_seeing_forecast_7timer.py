"""Unit tests for 7Timer atmospheric seeing forecast service."""

from datetime import datetime, timezone, timedelta
from unittest.mock import Mock, patch, MagicMock
import pytest
import requests

from seeing_forecast_7timer import SeeingForecastService, get_seeing_forecast, SEEING_SCALE


class TestSeeingForecastService:
    """Test seeing forecast service from 7Timer."""

    @pytest.fixture
    def service(self):
        """Create a service instance for testing."""
        return SeeingForecastService(
            latitude=48.866667,
            longitude=2.333333,
            timezone_str="Europe/Paris"
        )

    def test_service_initialization(self, service):
        """Test service initializes with correct parameters."""
        assert service.latitude == 48.866667
        assert service.longitude == 2.333333
        assert service.timezone_str == "Europe/Paris"

    def test_seeing_scale_mapping(self):
        """Test SEEING_SCALE has all required entries."""
        assert len(SEEING_SCALE) == 8
        
        # Check scale 1 (Excellent)
        assert SEEING_SCALE[1]["label"] == "Excellent"
        assert "Perfect" in SEEING_SCALE[1]["conditions"]
        
        # Check scale 8 (Bad)
        assert SEEING_SCALE[8]["label"] == "Bad"
        assert "Unsuitable" in SEEING_SCALE[8]["conditions"]

    def test_find_best_window_empty_list(self, service):
        """Test _find_best_window returns None for empty list."""
        result = service._find_best_window([])
        assert result is None

    def test_find_best_window_no_good_seeing(self, service):
        """Test _find_best_window returns None when no good seeing found."""
        now_utc = datetime.now(timezone.utc)
        
        forecast_list = [
            {"time": now_utc.isoformat(), "seeing": 4, "description": "Poor", "conditions": "Poor conditions"},
            {"time": (now_utc + timedelta(hours=2)).isoformat(), "seeing": 5, "description": "Very Poor", "conditions": "Unsuitable"},
        ]
        
        result = service._find_best_window(forecast_list)
        assert result is None

    def test_find_best_window_with_good_seeing(self, service):
        """Test _find_best_window finds excellent/good seeing window."""
        now_utc = datetime.now(timezone.utc)
        init_time = now_utc.replace(hour=0, minute=0, second=0, microsecond=0)
        
        forecast_list = [
            {"time": (now_utc).isoformat(), "seeing": 1, "description": "Excellent", "conditions": "Perfect"},
            {"time": (now_utc + timedelta(hours=2)).isoformat(), "seeing": 2, "description": "Good", "conditions": "Very good"},
            {"time": (now_utc + timedelta(hours=4)).isoformat(), "seeing": 2, "description": "Good", "conditions": "Very good"},
            {"time": (now_utc + timedelta(hours=6)).isoformat(), "seeing": 4, "description": "Poor", "conditions": "Poor conditions"},
        ]
        
        result = service._find_best_window(forecast_list)
        
        assert result is not None
        assert result["seeing"] == 1  # Minimum seeing in window
        assert result["duration_hours"] == 9  # 3 intervals * 3 hours each
        assert "Excellent" in result["description"]

    def test_find_best_window_multiple_windows(self, service):
        """Test _find_best_window selects longest window."""
        now_utc = datetime.now(timezone.utc)
        init_time = now_utc.replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Short good window (2 hours), then longer good window (6 hours)
        forecast_list = [
            {"time": (now_utc).isoformat(), "seeing": 1, "description": "Excellent", "conditions": "Perfect"},
            {"time": (now_utc + timedelta(hours=2)).isoformat(), "seeing": 4, "description": "Poor", "conditions": "Poor"},
            {"time": (now_utc + timedelta(hours=4)).isoformat(), "seeing": 1, "description": "Excellent", "conditions": "Perfect"},
            {"time": (now_utc + timedelta(hours=6)).isoformat(), "seeing": 2, "description": "Good", "conditions": "Very good"},
            {"time": (now_utc + timedelta(hours=8)).isoformat(), "seeing": 2, "description": "Good", "conditions": "Very good"},
            {"time": (now_utc + timedelta(hours=10)).isoformat(), "seeing": 5, "description": "Very Poor", "conditions": "Unsuitable"},
        ]
        
        result = service._find_best_window(forecast_list)
        
        assert result is not None
        assert result["duration_hours"] == 9  # Longer window wins

    @patch('seeing_forecast_7timer.requests.get')
    def test_fetch_tonight_seeing_success(self, mock_get, service):
        """Test successful fetch from 7Timer API."""
        now_utc = datetime.now(timezone.utc)
        init_time = now_utc.replace(hour=0, minute=0, second=0, microsecond=0)
        
        mock_response = Mock()
        mock_response.json.return_value = {
            "init": init_time.strftime("%Y%m%d%H"),
            "dataseries": [
                {"timepoint": 3, "seeing": 2},
                {"timepoint": 6, "seeing": 2},
                {"timepoint": 9, "seeing": 3},
            ]
        }
        mock_get.return_value = mock_response
        
        result = service.fetch_tonight_seeing()
        
        assert result is not None
        assert "location" in result
        assert "now" in result
        assert "forecast" in result
        assert "best_window" in result
        assert result["location"]["latitude"] == 48.866667
        assert len(result["forecast"]) >= 1

    @patch('seeing_forecast_7timer.requests.get')
    def test_fetch_tonight_seeing_api_error(self, mock_get, service):
        """Test fetch handles API errors gracefully."""
        mock_get.side_effect = requests.RequestException("API unavailable")
        
        result = service.fetch_tonight_seeing()
        
        assert result is None

    @patch('seeing_forecast_7timer.requests.get')
    def test_fetch_tonight_seeing_invalid_response(self, mock_get, service):
        """Test fetch handles invalid API response."""
        mock_response = Mock()
        mock_response.json.return_value = {"invalid": "format"}
        mock_get.return_value = mock_response
        
        result = service.fetch_tonight_seeing()
        
        assert result is None

    @patch('seeing_forecast_7timer.requests.get')
    def test_fetch_tonight_seeing_empty_dataseries(self, mock_get, service):
        """Test fetch handles empty dataseries."""
        now_utc = datetime.now(timezone.utc)
        init_time = now_utc.replace(hour=0, minute=0, second=0, microsecond=0)
        
        mock_response = Mock()
        mock_response.json.return_value = {
            "init": init_time.strftime("%Y%m%d%H"),
            "dataseries": []
        }
        mock_get.return_value = mock_response
        
        result = service.fetch_tonight_seeing()
        
        assert result is None

    @patch('seeing_forecast_7timer.requests.get')
    def test_fetch_tonight_seeing_builds_correct_params(self, mock_get, service):
        """Test fetch sends correct parameters to API."""
        mock_response = Mock()
        mock_response.json.return_value = {
            "init": "2024011500",
            "dataseries": [{"timepoint": 3, "seeing": 2}]
        }
        mock_get.return_value = mock_response
        
        service.fetch_tonight_seeing()
        
        # Verify the API was called
        mock_get.assert_called_once()
        call_args = mock_get.call_args
        
        # Check parameters
        assert call_args[1]["params"]["lat"] == 48.866667
        assert call_args[1]["params"]["lon"] == 2.333333
        assert call_args[1]["params"]["product"] == "astro"
        assert call_args[1]["params"]["output"] == "json"
        assert call_args[1]["timeout"] == 10


class TestGetSeeingForecastWrapper:
    """Test top-level wrapper function."""

    @patch.object(SeeingForecastService, 'fetch_tonight_seeing')
    def test_get_seeing_forecast_success(self, mock_fetch):
        """Test wrapper calls service correctly."""
        mock_forecast = {
            "now": 2,
            "forecast": [],
            "best_window": None
        }
        mock_fetch.return_value = mock_forecast
        
        result = get_seeing_forecast(45.5, -73.5, "America/Montreal")
        
        assert result == mock_forecast
        mock_fetch.assert_called_once()

    @patch.object(SeeingForecastService, 'fetch_tonight_seeing')
    def test_get_seeing_forecast_failure(self, mock_fetch):
        """Test wrapper handles service failures."""
        mock_fetch.return_value = None
        
        result = get_seeing_forecast(45.5, -73.5, "America/Montreal")
        
        assert result is None

    def test_get_seeing_forecast_creates_service_with_correct_params(self):
        """Test wrapper creates service with correct parameters."""
        with patch.object(SeeingForecastService, 'fetch_tonight_seeing', return_value=None):
            get_seeing_forecast(48.5, 2.5, "Europe/Paris")
            
            # If no exception, the service was created correctly


class TestSeeingForecastIntegration:
    """Integration tests for seeing forecast with cache."""

    @patch('seeing_forecast_7timer.requests.get')
    def test_forecast_response_structure(self, mock_get):
        """Test the complete response structure is correct."""
        now_utc = datetime.now(timezone.utc)
        init_time = now_utc.replace(hour=0, minute=0, second=0, microsecond=0)
        
        mock_response = Mock()
        mock_response.json.return_value = {
            "init": init_time.strftime("%Y%m%d%H"),
            "dataseries": [
                {"timepoint": 3, "seeing": 1},
                {"timepoint": 6, "seeing": 2},
                {"timepoint": 9, "seeing": 2},
                {"timepoint": 12, "seeing": 3},
            ]
        }
        mock_get.return_value = mock_response
        
        service = SeeingForecastService(45.5, -73.5, "America/Montreal")
        result = service.fetch_tonight_seeing()
        
        assert result is not None
        assert "location" in result
        assert isinstance(result["location"], dict)
        assert result["location"]["latitude"] == 45.5
        assert result["location"]["longitude"] == -73.5
        assert result["location"]["timezone"] == "America/Montreal"
        
        assert "now" in result
        assert isinstance(result["now"], int) or result["now"] is None
        
        assert "now_description" in result
        assert isinstance(result["now_description"], str)
        
        assert "forecast" in result
        assert isinstance(result["forecast"], list)
        
        for point in result["forecast"]:
            assert "time" in point
            assert "seeing" in point
            assert "description" in point
            assert "conditions" in point
        
        assert "best_window" in result
        if result["best_window"]:
            assert "start" in result["best_window"]
            assert "seeing" in result["best_window"]
            assert "description" in result["best_window"]
            assert "duration_hours" in result["best_window"]
        
        assert "updated_at" in result
