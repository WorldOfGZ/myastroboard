"""
Events Aggregator Service for MyAstroBoard

Aggregates upcoming astronomical events (eclipses, auroras, etc.) and provides
unified event information for dashboard alerts and sharing.

Collects events from:
- Solar eclipses
- Lunar eclipses  
- Aurora predictions
- Moon phases
- Custom events

Example output:
{
    "upcoming_events": [
        {
            "id": "solar_eclipse_20260812",
            "event_type": "Solar Eclipse",
            "emoji": "☀️",
            "title": "Partial Solar Eclipse",
            "description": "Partial eclipse visible from your location",
            "start_time": "2026-08-12T13:05:00",
            "peak_time": "2026-08-12T14:32:15",
            "end_time": "2026-08-12T15:59:00",
            "days_until_event": 170,
            "visibility": true,
            "importance": "high",
            "score": 6.5,
            "raw_data": {...}
        },
        ...
    ],
    "next_event": {...},
    "events_next_7_days": [...]
}
"""

import datetime
from dataclasses import dataclass, asdict
from typing import Optional, List, Dict, Any
from zoneinfo import ZoneInfo
from enum import Enum
from logging_config import get_logger

logger = get_logger(__name__)


class EventType(Enum):
    """Enum for event types"""
    SOLAR_ECLIPSE = "Solar Eclipse"
    LUNAR_ECLIPSE = "Lunar Eclipse"
    AURORA = "Aurora"
    ISS_PASS = "ISS Pass"
    MOON_PHASE = "Moon Phase"
    PLANETARY_CONJUNCTION = "Planetary Conjunction"
    PLANETARY_OPPOSITION = "Planetary Opposition"
    PLANETARY_ELONGATION = "Planetary Elongation"
    PLANETARY_RETROGRADE = "Planetary Retrograde"
    EQUINOX = "Equinox"
    SOLSTICE = "Solstice"
    ZODIACAL_LIGHT = "Zodiacal Light Window"
    MILKY_WAY = "Milky Way Core Visibility"
    METEOR_SHOWER = "Meteor Shower"
    COMET_APPEARANCE = "Comet Appearance"
    ASTEROID_OCCULTATION = "Asteroid Occultation"
    CUSTOM = "Custom Event"


class EventImportance(Enum):
    """Event importance levels for alerting"""
    CRITICAL = "critical"  # Must-see events
    HIGH = "high"          # Highly recommended
    MEDIUM = "medium"      # Worth considering
    LOW = "low"            # Nice to know


@dataclass
class AstronomicalEvent:
    """Standardized astronomical event data"""
    id: str                                    # Unique identifier
    event_type: str                           # Type of event
    emoji: str                                # Display emoji
    title: str                                # Short title
    description: str                          # Description
    start_time: Optional[str]                 # Start time (ISO format)
    peak_time: Optional[str]                  # Peak/best time (ISO format)
    end_time: Optional[str]                   # End time (ISO format)
    days_until_event: int                     # Days until event happens
    visibility: bool                          # Is event visible from location?
    importance: str                           # Importance level
    score: Optional[float]                    # Importance score (0-10)
    raw_data: Dict[str, Any]                  # Original data for detailed view


class EventsAggregator:
    """
    Aggregates upcoming astronomical events from various sources.
    Provides unified interface for event queries.
    """

    def __init__(self, latitude: float, longitude: float, timezone: str):
        """
        Initialize events aggregator
        
        Args:
            latitude: Observer latitude
            longitude: Observer longitude
            timezone: IANA timezone string
        """
        self.latitude = latitude
        self.longitude = longitude
        self.timezone = ZoneInfo(timezone)
        self.local_now = self._get_local_now()

    def aggregate_all_events(
        self,
        solar_eclipse_data: Optional[Dict[str, Any]] = None,
        lunar_eclipse_data: Optional[Dict[str, Any]] = None,
        aurora_data: Optional[Dict[str, Any]] = None,
        iss_passes_data: Optional[Dict[str, Any]] = None,
        moon_phases_data: Optional[Dict[str, Any]] = None,
        planetary_events_data: Optional[Dict[str, Any]] = None,
        special_phenomena_data: Optional[Dict[str, Any]] = None,
        solar_system_events_data: Optional[Dict[str, Any]] = None,
        sidereal_time_data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Aggregate all available events into a unified format.
        
        Args:
            solar_eclipse_data: Data from sun_eclipse endpoint
            lunar_eclipse_data: Data from moon_eclipse endpoint
            aurora_data: Data from aurora endpoint
            iss_passes_data: Data from ISS passes endpoint
            moon_phases_data: Data from moon phases endpoint
            planetary_events_data: Data from planetary events endpoint
            special_phenomena_data: Data from special phenomena endpoint
            solar_system_events_data: Data from solar system events endpoint
            sidereal_time_data: Data from sidereal time endpoint
            
        Returns:
            Unified events data with next event and filtered views
        """
        events = []

        # Add solar eclipse if available
        if solar_eclipse_data:
            try:
                solar_eclipse_events = self._extract_solar_eclipse_events(solar_eclipse_data)
                events.extend(solar_eclipse_events)
            except Exception as e:
                logger.warning(f"Error extracting solar eclipse events: {e}")

        # Add lunar eclipse if available
        if lunar_eclipse_data:
            try:
                lunar_eclipse_events = self._extract_lunar_eclipse_events(lunar_eclipse_data)
                events.extend(lunar_eclipse_events)
            except Exception as e:
                logger.warning(f"Error extracting lunar eclipse events: {e}")

        # Add aurora if available
        if aurora_data:
            try:
                aurora_events = self._extract_aurora_events(aurora_data)
                events.extend(aurora_events)
            except Exception as e:
                logger.warning(f"Error extracting aurora events: {e}")
        
        # Add moon phases if available
        if moon_phases_data:
            try:
                moon_events = self._extract_moon_phase_events(moon_phases_data)
                events.extend(moon_events)
            except Exception as e:
                logger.warning(f"Error extracting moon phase events: {e}")

        # Add ISS pass if available
        if iss_passes_data:
            try:
                iss_events = self._extract_iss_pass_events(iss_passes_data)
                events.extend(iss_events)
            except Exception as e:
                logger.warning(f"Error extracting ISS pass events: {e}")

        # Add planetary events if available
        if planetary_events_data:
            try:
                planetary_events = self._extract_planetary_events(planetary_events_data)
                events.extend(planetary_events)
            except Exception as e:
                logger.warning(f"Error extracting planetary events: {e}")

        # Add special phenomena if available
        if special_phenomena_data:
            try:
                phenomena_events = self._extract_special_phenomena_events(special_phenomena_data)
                events.extend(phenomena_events)
            except Exception as e:
                logger.warning(f"Error extracting special phenomena events: {e}")

        # Add solar system events if available
        if solar_system_events_data:
            try:
                solsys_events = self._extract_solar_system_events(solar_system_events_data)
                events.extend(solsys_events)
            except Exception as e:
                logger.warning(f"Error extracting solar system events: {e}")

        # Sort by days until event
        events.sort(key=lambda x: x.days_until_event)

        # Prepare results
        result = {
            "aggregation_time": self.local_now.isoformat(),
            "upcoming_events": [asdict(e) for e in events],
            "events_count": len(events),
            "next_event": asdict(events[0]) if events else None,
            "events_next_7_days": [
                asdict(e) for e in events 
                if e.days_until_event <= 7
            ],
            "events_next_30_days": [
                asdict(e) for e in events 
                if e.days_until_event <= 30
            ],
        }

        return result

    def _extract_solar_eclipse_events(self, eclipse_data: Dict[str, Any]) -> List[AstronomicalEvent]:
        """Extract solar eclipse event(s) from raw eclipse data"""
        events = []

        solar_eclipse = eclipse_data.get("solar_eclipse")
        if not solar_eclipse:
            return events

        # Only create event if eclipse is visible
        if not solar_eclipse.get("visible", False):
            return events

        peak_time_str = solar_eclipse.get("peak_time")
        peak_time = self._parse_iso_time(peak_time_str)
        days_until = (peak_time.date() - self.local_now.date()).days

        # Determine importance based on type and score
        eclipse_type = solar_eclipse.get("type", "Partial")
        score = solar_eclipse.get("astrophotography_score", 0)

        if eclipse_type == "Total":
            importance = EventImportance.CRITICAL.value
        elif eclipse_type == "Annular":
            importance = EventImportance.HIGH.value if score >= 6 else EventImportance.MEDIUM.value
        else:
            importance = EventImportance.MEDIUM.value if score >= 5 else EventImportance.LOW.value

        event = AstronomicalEvent(
            id=f"solar_eclipse_{peak_time_str.split('T')[0]}",
            event_type=EventType.SOLAR_ECLIPSE.value,
            emoji="☀️",
            title=f"{eclipse_type} Solar Eclipse",
            description=(
                f"{eclipse_type} eclipse with {solar_eclipse.get('obscuration_percent', 0):.1f}% "
                f"obscuration. Peak at {solar_eclipse.get('peak_altitude_deg', 0):.1f}° altitude."
            ),
            start_time=solar_eclipse.get("start_time"),
            peak_time=peak_time_str,
            end_time=solar_eclipse.get("end_time"),
            days_until_event=days_until,
            visibility=True,
            importance=importance,
            score=score,
            raw_data=eclipse_data,
        )
        events.append(event)
        return events

    def _extract_lunar_eclipse_events(self, eclipse_data: Dict[str, Any]) -> List[AstronomicalEvent]:
        """Extract lunar eclipse event(s) from raw eclipse data"""
        events = []

        lunar_eclipse = eclipse_data.get("lunar_eclipse")
        if not lunar_eclipse:
            return events

        visible = lunar_eclipse.get("visible", False)
        peak_time_str = lunar_eclipse.get("peak_time")
        
        if not peak_time_str:
            return events

        peak_time = self._parse_iso_time(peak_time_str)
        days_until = (peak_time.date() - self.local_now.date()).days

        eclipse_type = lunar_eclipse.get("type", "Penumbral")
        
        # Lunar eclipses are usually visible from wide areas
        if eclipse_type == "Total":
            importance = EventImportance.HIGH.value
        elif eclipse_type == "Partial":
            importance = EventImportance.MEDIUM.value
        else:
            importance = EventImportance.LOW.value

        event = AstronomicalEvent(
            id=f"lunar_eclipse_{peak_time_str.split('T')[0]}",
            event_type=EventType.LUNAR_ECLIPSE.value,
            emoji="🌙",
            title=f"{eclipse_type} Lunar Eclipse",
            description=(
                f"{eclipse_type} lunar eclipse with {lunar_eclipse.get('obscuration_percent', 0):.1f}% "
                f"coverage at peak."
            ),
            start_time=lunar_eclipse.get("start_time"),
            peak_time=peak_time_str,
            end_time=lunar_eclipse.get("end_time"),
            days_until_event=days_until,
            visibility=visible,
            importance=importance,
            score=lunar_eclipse.get("astrophotography_score"),
            raw_data=eclipse_data,
        )
        events.append(event)
        return events

    def _extract_aurora_events(self, aurora_data: Dict[str, Any]) -> List[AstronomicalEvent]:
        """Return only the first strong aurora visibility event.
           The aurora event is different because it is a forecast with multiple time slots (8 x 3h), 
           so we will extract the most relevant one based on visibility likelihood and timing.
        """

        if not aurora_data:
            return []

        forecast = aurora_data.get("forecast", [])
        if not forecast:
            return []

        for entry in forecast:
            visibility_percent = entry.get("visibility_likelihood")
            if visibility_percent is None:
                visibility_percent = entry.get("probability", 0)

            # Only consider events with at least 70% visibility likelihood as worth reporting
            if visibility_percent < 70:
                continue

            timestamp = entry.get("timestamp")
            if not timestamp:
                continue

            try:
                event_date = datetime.datetime.fromisoformat(timestamp).astimezone(self.timezone)
            except Exception:
                continue

            days_until = (event_date.date() - self.local_now.date()).days
            kp_index = entry.get("kp_index", 0)

            if visibility_percent >= 70:
                importance = EventImportance.HIGH.value
            elif visibility_percent >= 40:
                importance = EventImportance.MEDIUM.value
            else:
                importance = EventImportance.LOW.value

            event = AstronomicalEvent(
                id=f"aurora_{timestamp}",
                event_type=EventType.AURORA.value,
                emoji="🌌",
                title="Aurora Borealis",
                description=(
                    f"Aurora visibility: {visibility_percent:.0f}% likelihood. "
                    f"Kp index: {kp_index:.1f}"
                ),
                start_time=None,
                peak_time=event_date.isoformat(),
                end_time=None,
                days_until_event=days_until,
                visibility=True,
                importance=importance,
                score=visibility_percent,
                raw_data=entry,
            )

            return [event]  # Immediately return the first strong event

        return []  # No strong events found

    def _extract_moon_phase_events(self, moon_data: Dict[str, Any]) -> List[AstronomicalEvent]:
        """Extract moon phase events from 'phases' or 'next_7_nights' format"""
        events = []

        # 1. Standard 'phases' format
        phases = moon_data.get("phases", [])
        if phases:
            for phase in phases[:2]:  # Next 2 phases
                phase_type = phase.get("phase")
                phase_date_str = phase.get("date")
                if not phase_date_str:
                    continue
                phase_date = datetime.datetime.fromisoformat(phase_date_str).replace(tzinfo=self.timezone)
                days_until = (phase_date.date() - self.local_now.date()).days
                phase_info = {
                    "New Moon": {"emoji": "🌑", "importance": EventImportance.MEDIUM.value},
                    "First Quarter": {"emoji": "🌓", "importance": EventImportance.LOW.value},
                    "Full Moon": {"emoji": "🌕", "importance": EventImportance.MEDIUM.value},
                    "Last Quarter": {"emoji": "🌗", "importance": EventImportance.LOW.value},
                }
                phase_details = phase_info.get(phase_type, {"emoji": "🌙", "importance": EventImportance.LOW.value})
                event = AstronomicalEvent(
                    id=f"moon_phase_{phase_date_str}_{phase_type.lower().replace(' ', '_')}",
                    event_type=EventType.MOON_PHASE.value,
                    emoji=phase_details["emoji"],
                    title=phase_type,
                    description=f"{phase_type} occurs. Good time for {self._get_moon_phase_activity(phase_type)}.",
                    start_time=None,
                    peak_time=phase_date_str,
                    end_time=None,
                    days_until_event=days_until,
                    visibility=True,
                    importance=phase_details["importance"],
                    score=None,
                    raw_data=moon_data,
                )
                events.append(event)
            return events

        # 2. Adapted for 'next_7_nights' format
        nights = moon_data.get("next_7_nights", [])
        for night in nights:
            date_str = night.get("date")
            moon_info = night.get("moon", {})
            illumination = moon_info.get("illumination_percent")
            if date_str is None or illumination is None:
                continue
            # Heuristic: Full Moon >98%, New Moon <2%, else ignore
            if illumination >= 98:
                phase_type = "Full Moon"
                emoji = "🌕"
                importance = EventImportance.MEDIUM.value
            elif illumination <= 2:
                phase_type = "New Moon"
                emoji = "🌑"
                importance = EventImportance.MEDIUM.value
            else:
                continue  # Ignore other phases for now
            phase_date = datetime.datetime.fromisoformat(date_str).replace(tzinfo=self.timezone)
            days_until = (phase_date.date() - self.local_now.date()).days
            event = AstronomicalEvent(
                id=f"moon_phase_{date_str}_{phase_type.lower().replace(' ', '_')}",
                event_type=EventType.MOON_PHASE.value,
                emoji=emoji,
                title=phase_type,
                description=f"{phase_type} occurs. Good time for {self._get_moon_phase_activity(phase_type)}.",
                start_time=None,
                peak_time=date_str,
                end_time=None,
                days_until_event=days_until,
                visibility=True,
                importance=importance,
                score=None,
                raw_data=moon_data,
            )
            events.append(event)
        return events

    def _extract_iss_pass_events(self, iss_data: Dict[str, Any]) -> List[AstronomicalEvent]:
        """Extract ISS visible pass events occurring in the next 7 days."""
        raw_passes = iss_data.get("passes")
        if not isinstance(raw_passes, list):
            next_pass = iss_data.get("next_visible_passage")
            raw_passes = [next_pass] if next_pass else []

        events: List[AstronomicalEvent] = []

        for iss_pass in raw_passes:
            if not isinstance(iss_pass, dict):
                continue

            peak_time_str = iss_pass.get("peak_time")
            if not peak_time_str:
                continue

            peak_time = self._parse_iso_time(peak_time_str)
            days_until = (peak_time.date() - self.local_now.date()).days

            if days_until < 0 or days_until > 7:
                continue

            score = float(iss_pass.get("visibility_score", 0) or 0)
            visibility_day_night = iss_pass.get("visibility_day_night", "Unknown")

            if score >= 75:
                importance = EventImportance.HIGH.value
            elif score >= 55:
                importance = EventImportance.MEDIUM.value
            else:
                importance = EventImportance.LOW.value

            event = AstronomicalEvent(
                id=f"iss_pass_{peak_time_str.replace(':', '').replace('-', '')}",
                event_type=EventType.ISS_PASS.value,
                emoji="🛰️",
                title="ISS Visible Passage",
                description=(
                    f"ISS pass score {score:.0f}/100 ({visibility_day_night}). "
                    f"Peak altitude {float(iss_pass.get('peak_altitude_deg', 0)):.1f}°."
                ),
                start_time=iss_pass.get("start_time"),
                peak_time=peak_time_str,
                end_time=iss_pass.get("end_time"),
                days_until_event=days_until,
                visibility=bool(iss_pass.get("is_visible", False)),
                importance=importance,
                score=score,
                raw_data=iss_pass,
            )
            events.append(event)

        events.sort(key=lambda event: self._parse_iso_time(event.peak_time) if event.peak_time else self.local_now)
        return events

    def _get_moon_phase_activity(self, phase_type: str) -> str:
        """Get recommended activity for moon phase"""
        activities = {
            "New Moon": "deep-sky observations",
            "First Quarter": "lunar observations",
            "Full Moon": "lunar photography",
            "Last Quarter": "lunar observations",
        }
        return activities.get(phase_type, "observing")

    def _parse_iso_time(self, iso_string: str) -> datetime.datetime:
        """Parse ISO format time string"""
        try:
            dt = datetime.datetime.fromisoformat(iso_string)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=self.timezone)
            return dt
        except Exception as e:
            logger.warning(f"Failed to parse ISO time '{iso_string}': {e}")
            return self.local_now

    def _get_local_now(self) -> datetime.datetime:
        """Get current time in configured timezone"""
        return datetime.datetime.now(self.timezone)

    def _extract_planetary_events(self, planetary_data: Dict[str, Any]) -> List[AstronomicalEvent]:
        """Extract planetary events from raw data"""
        events = []
        
        raw_events = planetary_data.get("events", [])
        if not isinstance(raw_events, list):
            return events
        
        for event_data in raw_events:
            try:
                peak_time_str = event_data.get("peak_time")
                if not peak_time_str:
                    continue
                
                peak_time = self._parse_iso_time(peak_time_str)
                days_until = (peak_time.date() - self.local_now.date()).days
                
                visibility = event_data.get("visibility", True)
                importance = event_data.get("importance", "medium")
                
                event_type = event_data.get("event_type", "Planetary Event")
                emoji = event_data.get("emoji", "⭐")
                title = event_data.get("title", "Planetary Event")
                description = event_data.get("description", "")
                
                event = AstronomicalEvent(
                    id=f"planetary_{peak_time_str.replace(':', '').replace('-', '')}_{event_type.lower().replace(' ', '_')}",
                    event_type=event_type,
                    emoji=emoji,
                    title=title,
                    description=description,
                    start_time=event_data.get("start_time"),
                    peak_time=peak_time_str,
                    end_time=event_data.get("end_time"),
                    days_until_event=days_until,
                    visibility=visibility,
                    importance=importance,
                    score=event_data.get("score"),
                    raw_data=event_data,
                )
                events.append(event)
            except Exception as e:
                logger.debug(f"Error extracting planetary event: {e}")
        
        return events

    def _extract_special_phenomena_events(self, phenomena_data: Dict[str, Any]) -> List[AstronomicalEvent]:
        """Extract special phenomena events from raw data"""
        events = []
        
        raw_events = phenomena_data.get("events", [])
        if not isinstance(raw_events, list):
            return events
        
        for event_data in raw_events:
            try:
                peak_time_str = event_data.get("peak_time")
                if not peak_time_str:
                    continue
                
                peak_time = self._parse_iso_time(peak_time_str)
                days_until = (peak_time.date() - self.local_now.date()).days
                
                visibility = event_data.get("visibility", True)
                importance = event_data.get("importance", "medium")
                
                event_type = event_data.get("event_type", "Special Phenomenon")
                emoji = event_data.get("emoji", "✨")
                title = event_data.get("title", "Special Phenomenon")
                description = event_data.get("description", "")
                
                event = AstronomicalEvent(
                    id=f"phenomena_{peak_time_str.replace(':', '').replace('-', '')}_{event_type.lower().replace(' ', '_')}",
                    event_type=event_type,
                    emoji=emoji,
                    title=title,
                    description=description,
                    start_time=event_data.get("start_time"),
                    peak_time=peak_time_str,
                    end_time=event_data.get("end_time"),
                    days_until_event=days_until,
                    visibility=visibility,
                    importance=importance,
                    score=event_data.get("score"),
                    raw_data=event_data,
                )
                events.append(event)
            except Exception as e:
                logger.debug(f"Error extracting special phenomena event: {e}")
        
        return events

    def _extract_solar_system_events(self, solsys_data: Dict[str, Any]) -> List[AstronomicalEvent]:
        """Extract solar system events (meteor showers, comets, occultations) from raw data"""
        events = []
        
        raw_events = solsys_data.get("events", [])
        if not isinstance(raw_events, list):
            return events
        
        for event_data in raw_events:
            try:
                peak_time_str = event_data.get("peak_time")
                if not peak_time_str:
                    continue
                
                peak_time = self._parse_iso_time(peak_time_str)
                days_until = (peak_time.date() - self.local_now.date()).days
                
                visibility = event_data.get("visibility", True)
                importance = event_data.get("importance", "medium")
                
                event_type = event_data.get("event_type", "Solar System Event")
                emoji = event_data.get("emoji", "☄️")
                title = event_data.get("title", "Solar System Event")
                description = event_data.get("description", "")
                
                event = AstronomicalEvent(
                    id=f"solsys_{peak_time_str.replace(':', '').replace('-', '')}_{event_type.lower().replace(' ', '_')}",
                    event_type=event_type,
                    emoji=emoji,
                    title=title,
                    description=description,
                    start_time=event_data.get("start_time"),
                    peak_time=peak_time_str,
                    end_time=event_data.get("end_time"),
                    days_until_event=days_until,
                    visibility=visibility,
                    importance=importance,
                    score=event_data.get("score"),
                    raw_data=event_data,
                )
                events.append(event)
            except Exception as e:
                logger.debug(f"Error extracting solar system event: {e}")
        
        return events
