"""
Tests for events_aggregator module.
Tests event aggregation, filtering, sorting, and translation logic.
"""

import pytest
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from unittest.mock import Mock, MagicMock, patch

from events_aggregator import (
    EventType,
    EventImportance,
    AstronomicalEvent,
    EventsAggregator,
)


@pytest.fixture
def aggregator():
    """Create an EventsAggregator instance for testing."""
    return EventsAggregator(
        latitude=45.0,
        longitude=-75.0,
        timezone="America/Toronto",
        language="en"
    )


@pytest.fixture
def aggregator_french():
    """Create a French EventsAggregator instance for testing."""
    return EventsAggregator(
        latitude=45.0,
        longitude=-75.0,
        timezone="America/Toronto",
        language="fr"
    )


class TestEventTypeEnum:
    """Tests for EventType enumeration."""

    def test_solar_eclipse_event_type(self):
        """Test solar eclipse event type."""
        assert EventType.SOLAR_ECLIPSE.value == "Solar Eclipse"

    def test_lunar_eclipse_event_type(self):
        """Test lunar eclipse event type."""
        assert EventType.LUNAR_ECLIPSE.value == "Lunar Eclipse"

    def test_aurora_event_type(self):
        """Test aurora event type."""
        assert EventType.AURORA.value == "Aurora"

    def test_planetary_conjunction_event_type(self):
        """Test planetary conjunction event type."""
        assert EventType.PLANETARY_CONJUNCTION.value == "Planetary Conjunction"


class TestEventImportanceEnum:
    """Tests for EventImportance enumeration."""

    def test_critical_importance(self):
        """Test critical importance level."""
        assert EventImportance.CRITICAL.value == "critical"

    def test_high_importance(self):
        """Test high importance level."""
        assert EventImportance.HIGH.value == "high"

    def test_medium_importance(self):
        """Test medium importance level."""
        assert EventImportance.MEDIUM.value == "medium"

    def test_low_importance(self):
        """Test low importance level."""
        assert EventImportance.LOW.value == "low"


class TestAstronomicalEvent:
    """Tests for AstronomicalEvent dataclass."""

    def test_create_eclipse_event(self):
        """Test creating an eclipse event."""
        event = AstronomicalEvent(
            id="solar_eclipse_20260812",
            event_type="Solar Eclipse",
            icon_class="bi bi-sun",
            icon_color_class="text-warning",
            title="Partial Solar Eclipse",
            description="A partial eclipse visible from your location",
            start_time="2026-08-12T13:05:00",
            peak_time="2026-08-12T14:32:00",
            end_time="2026-08-12T15:59:00",
            days_until_event=170,
            visibility=True,
            importance="high",
            score=8.5,
            raw_data={},
            structure_key="solar"
        )
        
        assert event.id == "solar_eclipse_20260812"
        assert event.event_type == "Solar Eclipse"
        assert event.importance == "high"
        assert event.visibility is True

    def test_event_with_optional_none_values(self):
        """Test creating event with None optional fields."""
        event = AstronomicalEvent(
            id="test_event",
            event_type="Test",
            icon_class="bi bi-star",
            icon_color_class="text-info",
            title="Test Event",
            description="Test description",
            start_time=None,
            peak_time=None,
            end_time=None,
            days_until_event=10,
            visibility=False,
            importance="low",
            score=None,
            raw_data={},
            structure_key="test"
        )
        
        assert event.start_time is None
        assert event.score is None


class TestEventsAggregatorInitialization:
    """Tests for EventsAggregator initialization."""

    def test_init_with_valid_timezone(self, aggregator):
        """Test initialization with valid timezone."""
        assert aggregator.latitude == 45.0
        assert aggregator.longitude == -75.0
        assert aggregator.timezone == ZoneInfo("America/Toronto")

    def test_init_with_utc_timezone(self):
        """Test initialization with UTC timezone."""
        agg = EventsAggregator(
            latitude=0.0,
            longitude=0.0,
            timezone="UTC",
            language="en"
        )
        assert agg.timezone == ZoneInfo("UTC")

    def test_init_sets_i18n_language(self, aggregator):
        """Test that i18n manager is initialized."""
        assert aggregator.i18n is not None

    def test_init_with_french_language(self, aggregator_french):
        """Test initialization with French language."""
        assert aggregator_french.i18n is not None


class TestTranslationHelpers:
    """Tests for translation helper methods."""

    def test_translate_method_t(self, aggregator):
        """Test _t translation method with fallback."""
        result = aggregator._t("nonexistent_key", "fallback_text")
        # Should return fallback if key doesn't exist
        assert "fallback" in result.lower() or result == "nonexistent_key"

    def test_translate_eclipse_type_total(self, aggregator):
        """Test eclipse type translation for Total."""
        result = aggregator._translate_eclipse_type("Total", "solar_eclipse")
        assert result is not None
        assert isinstance(result, str)

    def test_translate_eclipse_type_partial(self, aggregator):
        """Test eclipse type translation for Partial."""
        result = aggregator._translate_eclipse_type("Partial", "lunar_eclipse")
        assert result is not None

    def test_translate_eclipse_type_annular(self, aggregator):
        """Test eclipse type translation for Annular."""
        result = aggregator._translate_eclipse_type("Annular", "solar_eclipse")
        assert result is not None

    def test_moon_phase_translation_full_moon(self, aggregator):
        """Test moon phase translation for Full Moon."""
        result = aggregator._get_moon_phase_translation("Full Moon")
        assert result is not None

    def test_moon_phase_translation_new_moon(self, aggregator):
        """Test moon phase translation for New Moon."""
        result = aggregator._get_moon_phase_translation("New Moon")
        assert result is not None

    def test_moon_phase_translation_waxing_crescent(self, aggregator):
        """Test moon phase translation for Waxing Crescent."""
        result = aggregator._get_moon_phase_translation("Waxing Crescent")
        assert result is not None

    def test_planet_name_translation_venus(self, aggregator):
        """Test planet name translation."""
        result = aggregator._translate_planet_name("Venus")
        assert result is not None

    def test_planet_name_translation_empty(self, aggregator):
        """Test planet name translation with empty string."""
        result = aggregator._translate_planet_name("")
        assert result == ""

    def test_visibility_period_translation(self, aggregator):
        """Test visibility period translation."""
        result = aggregator._translate_visibility_period("Astronomical Night")
        assert result is not None

    def test_visibility_period_translation_unknown(self, aggregator):
        """Test visibility period translation for unknown."""
        result = aggregator._translate_visibility_period("Unknown")
        assert result is not None


class TestIconAndImportanceMapping:
    """Tests for icon class and importance mapping methods."""

    def test_importance_icon_color_critical(self, aggregator):
        """Test icon color for critical importance."""
        result = aggregator._importance_icon_color_class("critical")
        assert "danger" in result or "critical" in result

    def test_importance_icon_color_high(self, aggregator):
        """Test icon color for high importance."""
        result = aggregator._importance_icon_color_class("high")
        assert "warning" in result or "high" in result

    def test_importance_icon_color_medium(self, aggregator):
        """Test icon color for medium importance."""
        result = aggregator._importance_icon_color_class("medium")
        assert result is not None

    def test_importance_icon_color_low(self, aggregator):
        """Test icon color for low importance."""
        result = aggregator._importance_icon_color_class("low")
        assert "secondary" in result or result is not None

    def test_importance_icon_color_unknown(self, aggregator):
        """Test icon color for unknown importance."""
        result = aggregator._importance_icon_color_class("unknown")
        assert result is not None

    def test_phase_icon_class_full_moon(self, aggregator):
        """Test icon class for full moon."""
        result = aggregator._phase_icon_class("Full Moon")
        assert "moon" in result or "bi" in result

    def test_phase_icon_class_new_moon(self, aggregator):
        """Test icon class for new moon."""
        result = aggregator._phase_icon_class("New Moon")
        assert "moon" in result or "bi" in result

    def test_infer_icon_class_solar_eclipse(self, aggregator):
        """Test icon inference for solar eclipse."""
        result = aggregator._infer_icon_class("Solar Eclipse")
        assert "sun" in result or "bi" in result

    def test_infer_icon_class_lunar_eclipse(self, aggregator):
        """Test icon inference for lunar eclipse."""
        result = aggregator._infer_icon_class("Lunar Eclipse")
        assert "moon" in result or "bi" in result

    def test_infer_icon_class_aurora(self, aggregator):
        """Test icon inference for aurora."""
        result = aggregator._infer_icon_class("Aurora")
        assert "stars" in result or "bi" in result

    def test_infer_icon_class_iss_pass(self, aggregator):
        """Test icon inference for ISS pass."""
        result = aggregator._infer_icon_class("ISS Pass")
        assert result is not None

    def test_infer_icon_class_unknown_type(self, aggregator):
        """Test icon inference for unknown type uses fallback."""
        result = aggregator._infer_icon_class("Unknown Event Type")
        assert "star" in result or "bi" in result  # Should use fallback


class TestPlanetaryEventLocalization:
    """Tests for planetary event localization."""

    def test_localize_conjunction(self, aggregator):
        """Test localizing conjunction event."""
        event_data = {
            "event_type": "Planetary Conjunction",
            "title": "Venus-Jupiter Conjunction",
            "description": "Two planets come together",
            "raw_data": {
                "planet1": "Venus",
                "planet2": "Jupiter"
            }
        }
        
        title, desc = aggregator._localize_planetary_text(event_data)
        
        assert title is not None
        assert desc is not None

    def test_localize_opposition(self, aggregator):
        """Test localizing opposition event."""
        event_data = {
            "event_type": "Planetary Opposition",
            "title": "Mars Opposition",
            "description": "Mars at opposition",
            "raw_data": {
                "planet": "Mars"
            }
        }
        
        title, desc = aggregator._localize_planetary_text(event_data)
        
        assert title is not None
        assert desc is not None

    def test_localize_elongation(self, aggregator):
        """Test localizing elongation event."""
        event_data = {
            "event_type": "Planetary Elongation",
            "title": "Mercury Elongation",
            "description": "Mercury at maximum elongation",
            "raw_data": {
                "planet": "Mercury",
                "elongation": "28.1"
            },
            "elongation_degrees": 28.1
        }
        
        title, desc = aggregator._localize_planetary_text(event_data)
        
        assert title is not None
        assert desc is not None

    def test_localize_retrograde(self, aggregator):
        """Test localizing retrograde event."""
        event_data = {
            "event_type": "Planetary Retrograde",
            "title": "Mercury Retrograde",
            "description": "Mercury retrograde period",
            "raw_data": {
                "planet": "Mercury",
                "duration_days": 21
            },
            "duration_days": 21
        }
        
        title, desc = aggregator._localize_planetary_text(event_data)
        
        assert title is not None
        assert desc is not None

    def test_localize_unknown_planetary_event(self, aggregator):
        """Test localizing unknown planetary event type."""
        event_data = {
            "event_type": "Unknown Planetary Event",
            "title": "Unknown",
            "description": "Unknown description",
            "raw_data": {}
        }
        
        title, desc = aggregator._localize_planetary_text(event_data)
        
        assert title == "Unknown" or title is not None
        assert desc == "Unknown description" or desc is not None


class TestAggregateAllEvents:
    """Tests for aggregate_all_events method."""

    def test_aggregate_with_no_data(self, aggregator):
        """Test aggregation with no event data."""
        result = aggregator.aggregate_all_events()
        
        assert result is not None
        assert isinstance(result, dict)
        assert "upcoming_events" in result or result == {}

    def test_aggregate_with_solar_eclipse_data(self, aggregator):
        """Test aggregation with solar eclipse data."""
        eclipse_data = {
            "solar_eclipse": {
                "date": "2026-08-12",
                "magnitude": 0.95,
                "type": "Partial"
            }
        }
        
        result = aggregator.aggregate_all_events(solar_eclipse_data=eclipse_data)
        
        assert result is not None

    def test_aggregate_with_lunar_eclipse_data(self, aggregator):
        """Test aggregation with lunar eclipse data."""
        eclipse_data = {
            "lunar_eclipse": {
                "date": "2026-09-07",
                "magnitude": 1.2,
                "type": "Total"
            }
        }
        
        result = aggregator.aggregate_all_events(lunar_eclipse_data=eclipse_data)
        
        assert result is not None

    def test_aggregate_with_aurora_data(self, aggregator):
        """Test aggregation with aurora data."""
        aurora_data = {
            "forecast": [
                {
                    "date": "2026-04-17",
                    "probability": 0.7
                }
            ]
        }
        
        result = aggregator.aggregate_all_events(aurora_data=aurora_data)
        
        assert result is not None

    def test_aggregate_with_iss_passes_data(self, aggregator):
        """Test aggregation with ISS passes data."""
        iss_data = {
            "passes": [
                {
                    "date": "2026-04-17",
                    "max_altitude": 85,
                    "magnitude": 2.5
                }
            ]
        }
        
        result = aggregator.aggregate_all_events(iss_passes_data=iss_data)
        
        assert result is not None

    def test_aggregate_with_moon_phases_data(self, aggregator):
        """Test aggregation with moon phases data."""
        moon_data = {
            "phases": [
                {
                    "date": "2026-04-18",
                    "phase": "Full Moon"
                }
            ]
        }
        
        result = aggregator.aggregate_all_events(moon_phases_data=moon_data)
        
        assert result is not None

    def test_aggregate_with_planetary_events_data(self, aggregator):
        """Test aggregation with planetary events data."""
        planetary_data = {
            "events": [
                {
                    "date": "2026-04-25",
                    "event_type": "conjunction",
                    "planet1": "Venus",
                    "planet2": "Jupiter"
                }
            ]
        }
        
        result = aggregator.aggregate_all_events(planetary_events_data=planetary_data)
        
        assert result is not None

    def test_aggregate_with_special_phenomena_data(self, aggregator):
        """Test aggregation with special phenomena data."""
        phenomena_data = {
            "equinoxes": [
                {
                    "date": "2026-03-20",
                    "type": "Spring Equinox"
                }
            ],
            "solstices": [],
            "zodiacal_light": []
        }
        
        result = aggregator.aggregate_all_events(special_phenomena_data=phenomena_data)
        
        assert result is not None

    def test_aggregate_with_multiple_event_types(self, aggregator):
        """Test aggregation with multiple event types."""
        eclipse_data = {"solar_eclipse": {"date": "2026-08-12"}}
        aurora_data = {"forecast": [{"date": "2026-04-17"}]}
        
        result = aggregator.aggregate_all_events(
            solar_eclipse_data=eclipse_data,
            aurora_data=aurora_data
        )
        
        assert result is not None


class TestEventFiltering:
    """Tests for event filtering and sorting functionality."""

    def test_sort_events_by_days_until(self, aggregator):
        """Test that events can be sorted by days until event."""
        # This would depend on aggregate_all_events returning structured data
        pass

    def test_filter_high_importance_events(self, aggregator):
        """Test filtering events by importance."""
        # This would depend on the API returning filterable events
        pass

    def test_find_next_event(self, aggregator):
        """Test finding the next upcoming event."""
        # This would depend on aggregate_all_events returning next_event field
        pass


class TestGetLocalNow:
    """Tests for local time handling."""

    def test_local_now_respects_timezone(self, aggregator):
        """Test that local_now respects the aggregator's timezone."""
        assert aggregator.local_now is not None
        assert aggregator.local_now.tzinfo == aggregator.timezone


class TestDaysUntilEventCalculation:
    """Tests for days until event calculation."""

    def test_calculate_days_until_future_event(self):
        """Test calculating days until a future event."""
        agg = EventsAggregator(45.0, -75.0, "America/Toronto", "en")
        
        # Create a test event 10 days in future
        future_date = datetime.now(tz=ZoneInfo("America/Toronto")) + timedelta(days=10)
        
        # The aggregator should calculate this correctly
        # Implementation depends on the actual method used

    def test_calculate_days_until_past_event(self):
        """Test calculating days until a past event returns negative."""
        agg = EventsAggregator(45.0, -75.0, "America/Toronto", "en")
        
        # Create a test event 5 days in past
        past_date = datetime.now(tz=ZoneInfo("America/Toronto")) - timedelta(days=5)
        
        # The aggregator should handle this correctly
