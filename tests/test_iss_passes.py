"""Unit tests for ISS pass service and ISS event aggregation."""

from datetime import timedelta

from iss_passes import ISSPassService, get_iss_passes_report
from events_aggregator import EventsAggregator


class TestISSPassServiceScoring:
    """Test score and day/night classification helpers."""

    def test_day_night_classification(self):
        service = ISSPassService(45.5, -73.5, 30, "America/Montreal")

        assert service._classify_day_night(-20) == "Astronomical Night"
        assert service._classify_day_night(-15) == "Nautical Twilight"
        assert service._classify_day_night(-8) == "Civil Twilight"
        assert service._classify_day_night(-1) == "Twilight"
        assert service._classify_day_night(10) == "Daylight"

    def test_visibility_score_range(self):
        service = ISSPassService(45.5, -73.5, 30, "America/Montreal")

        low_score = service._compute_visibility_score(
            peak_altitude_deg=12,
            duration_minutes=2,
            sun_altitude_deg=8,
        )
        high_score = service._compute_visibility_score(
            peak_altitude_deg=80,
            duration_minutes=10,
            sun_altitude_deg=-20,
        )

        assert 0 <= low_score <= 100
        assert 0 <= high_score <= 100
        assert high_score > low_score

    def test_azimuth_to_cardinal(self):
        service = ISSPassService(45.5, -73.5, 30, "America/Montreal")

        assert service._azimuth_to_cardinal(0) == "N"
        assert service._azimuth_to_cardinal(90) == "E"
        assert service._azimuth_to_cardinal(180) == "S"
        assert service._azimuth_to_cardinal(270) == "W"
        assert service._azimuth_to_cardinal(225) == "SW"


class TestISSPassServiceWrapper:
    """Test top-level ISS wrapper behavior."""

    def test_get_iss_passes_report_handles_exceptions(self, monkeypatch):
        def _raise_error(*args, **kwargs):
            raise RuntimeError("boom")

        monkeypatch.setattr(ISSPassService, "get_report", _raise_error)

        result = get_iss_passes_report(
            latitude=45.5,
            longitude=-73.5,
            elevation_m=30,
            timezone_str="America/Montreal",
            days=20,
        )

        assert result is None


class TestISSCalendarAggregation:
    """Test ISS event integration in event aggregation payload."""

    def test_aggregate_all_events_includes_iss_event(self):
        aggregator = EventsAggregator(45.5, -73.5, "America/Montreal")

        base_day = aggregator.local_now.replace(hour=20, minute=0, second=0, microsecond=0)
        pass_1_peak = (base_day + timedelta(days=1, minutes=4))
        pass_2_peak = (base_day + timedelta(days=3, minutes=6))
        pass_3_peak_outside = (base_day + timedelta(days=9, minutes=8))

        iss_payload = {
            "passes": [
                {
                    "start_time": (base_day + timedelta(days=1)).isoformat(),
                    "peak_time": pass_1_peak.isoformat(),
                    "end_time": (base_day + timedelta(days=1, minutes=8)).isoformat(),
                    "peak_altitude_deg": 64.0,
                    "duration_minutes": 8.0,
                    "visibility_score": 82.5,
                    "visibility_day_night": "Astronomical Night",
                    "is_visible": True,
                },
                {
                    "start_time": (base_day + timedelta(days=3)).isoformat(),
                    "peak_time": pass_2_peak.isoformat(),
                    "end_time": (base_day + timedelta(days=3, minutes=10)).isoformat(),
                    "peak_altitude_deg": 52.0,
                    "duration_minutes": 10.0,
                    "visibility_score": 61.0,
                    "visibility_day_night": "Astronomical Night",
                    "is_visible": True,
                },
                {
                    "start_time": (base_day + timedelta(days=9)).isoformat(),
                    "peak_time": pass_3_peak_outside.isoformat(),
                    "end_time": (base_day + timedelta(days=9, minutes=9)).isoformat(),
                    "peak_altitude_deg": 40.0,
                    "duration_minutes": 9.0,
                    "visibility_score": 55.0,
                    "visibility_day_night": "Astronomical Night",
                    "is_visible": True,
                },
            ]
        }

        result = aggregator.aggregate_all_events(iss_passes_data=iss_payload)

        assert result["events_count"] == 2
        assert result["upcoming_events"][0]["event_type"] == "ISS Pass"
        assert result["upcoming_events"][0]["title"] == "ISS Visible Passage"
        assert result["upcoming_events"][0]["structure_key"] == "iss"

    def test_aggregate_all_events_localizes_titles_with_language(self):
        aggregator = EventsAggregator(45.5, -73.5, "America/Montreal", language="fr")

        peak_time = (aggregator.local_now + timedelta(days=2)).replace(hour=12, minute=0, second=0, microsecond=0)
        solar_payload = {
            "solar_eclipse": {
                "visible": True,
                "type": "Partial",
                "peak_time": peak_time.isoformat(),
                "start_time": (peak_time - timedelta(minutes=30)).isoformat(),
                "end_time": (peak_time + timedelta(minutes=30)).isoformat(),
                "obscuration_percent": 38.0,
                "peak_altitude_deg": 22.0,
                "astrophotography_score": 6.2,
            }
        }

        result = aggregator.aggregate_all_events(solar_eclipse_data=solar_payload)

        assert result["events_count"] == 1
        event = result["upcoming_events"][0]
        assert event["event_type"] == "Solar Eclipse"
        assert "Éclipse Solaire" in event["title"]
        assert event["structure_key"] == "sun"
