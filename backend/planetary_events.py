"""
Planetary Events Service for MyAstroBoard

Calculates and provides information about planetary events:
- Planetary Conjunctions - when two planets appear very close in the sky
- Planetary Oppositions - best visibility of outer planets (180° from Sun)
- Planetary Elongations - maximum angular distance from the Sun
- Retrograde Motion - apparent backward motion of planets

Uses Astropy and Skyfield for accurate astronomical calculations.
All calculations account for observer location and timezone.
"""

from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from zoneinfo import ZoneInfo
from logging_config import get_logger

from astropy.coordinates import (
    EarthLocation,
    AltAz,
    get_body,
)
from astropy.time import Time
from astropy import units as u
import numpy as np

logger = get_logger(__name__)

# Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune
PLANETS = {
    'Mercury': {'min_elong': 18, 'has_opposition': False},
    'Venus': {'min_elong': 46, 'has_opposition': False},
    'Mars': {'min_elong': 0, 'has_opposition': True},
    'Jupiter': {'min_elong': 0, 'has_opposition': True},
    'Saturn': {'min_elong': 0, 'has_opposition': True},
    'Uranus': {'min_elong': 0, 'has_opposition': True},
    'Neptune': {'min_elong': 0, 'has_opposition': True},
}

PLANET_SYMBOLS = {
    'Mercury': '☿️',
    'Venus': '♀',
    'Mars': '♂',
    'Jupiter': '♃️',
    'Saturn': '♄️',
    'Uranus': '♅️',
    'Neptune': '♆️',
}


class PlanetaryEventsService:
    """
    Calculates planetary events for a given location.
    Provides conjunction, opposition, elongation, and retrograde motion data.
    """

    def __init__(self, latitude: float, longitude: float, elevation: float = 0, timezone: str = "UTC"):
        """
        Initialize planetary events service.
        
        Args:
            latitude: Observer latitude in degrees
            longitude: Observer longitude in degrees
            elevation: Observer elevation in meters (default 0)
            timezone: IANA timezone string (default UTC)
        """
        self.latitude = latitude
        self.longitude = longitude
        self.elevation = elevation
        self.timezone = ZoneInfo(timezone)
        self.location = EarthLocation(
            lat=latitude * u.deg,
            lon=longitude * u.deg,
            height=elevation * u.m
        )

    def get_planetary_events(self, days_ahead: int = 365) -> List[Dict[str, Any]]:
        """
        Get all planetary events for the next N days.
        
        Args:
            days_ahead: Number of days to calculate ahead (default 365)
            
        Returns:
            List of planetary events, sorted by date
        """
        events = []
        now_utc = datetime.now(tz=ZoneInfo("UTC"))
        start_date = Time(now_utc)
        end_date = Time(now_utc + timedelta(days=days_ahead))

        try:
            # Get conjunctions
            conjunctions = self._find_conjunctions(start_date, end_date)
            events.extend(conjunctions)

            # Get oppositions (only for outer planets)
            oppositions = self._find_oppositions(start_date, end_date)
            events.extend(oppositions)

            # Get elongations (only for inner planets: Mercury and Venus)
            elongations = self._find_elongations(start_date, end_date)
            events.extend(elongations)

            # Get retrograde periods
            retrograde = self._find_retrograde_periods(start_date, end_date)
            events.extend(retrograde)

        except Exception as e:
            logger.error(f"Error calculating planetary events: {e}")
            return []

        # Sort by time
        events.sort(key=lambda x: x.get('peak_time', x.get('start_time')))
        
        return events

    def _find_conjunctions(self, start_date: Time, end_date: Time) -> List[Dict[str, Any]]:
        """
        Find conjunctions (when planets appear close to each other in the sky).
        Conjunction occurs when elongation angle is < 5 degrees.
        """
        events = []
        planet_list = list(PLANETS.keys())
        
        # Check each pair of planets
        for i, planet1 in enumerate(planet_list):
            for planet2 in planet_list[i + 1:]:
                try:
                    # Skip certain pairs that aren't particularly interesting
                    if planet1 == 'Mercury' and planet2 == 'Venus':
                        pass  # These conjunctions are usually not visible
                    
                    conjunction_time = self._find_conjunction_time(
                        planet1, planet2, start_date, end_date
                    )
                    
                    if conjunction_time:
                        events.extend(conjunction_time)
                        
                except Exception as e:
                    logger.debug(f"Error finding conjunction {planet1}-{planet2}: {e}")

        return events

    def _find_conjunction_time(
        self, planet1: str, planet2: str, start_date: Time, end_date: Time
    ) -> Optional[List[Dict[str, Any]]]:
        """
        Find conjunction time between two planets.
        Returns when their angular separation is at minimum.
        """
        events = []
        
        # Step through time checking angular separation
        current_time = start_date
        step_days = 1.0 * u.day
        min_separation = None
        min_time = None
        in_conjunction = False
        conjunction_data = {}
        
        while current_time < end_date:
            try:
                sep = self._angular_separation(planet1, planet2, current_time)
                
                # Track minimum separation
                if min_separation is None or sep < min_separation:
                    min_separation = sep
                    min_time = current_time
                
                # Conjunction zone: separation < 5 degrees
                if sep < 5.0:
                    if not in_conjunction:
                        in_conjunction = True
                        conjunction_data = {
                            'planet1': planet1,
                            'planet2': planet2,
                            'start_separation': sep,
                            'start_time': current_time,
                        }
                    conjunction_data['end_time'] = current_time
                    conjunction_data['current_separation'] = sep
                else:
                    if in_conjunction:
                        # Conjunction zone ended
                        if min_time and min_separation is not None:
                            event = {
                                'event_type': 'Planetary Conjunction',
                                'title': f'{planet1} - {planet2} Conjunction',
                                'description': f'{planet1} and {planet2} appear very close in the sky',
                                'star_emoji': PLANET_SYMBOLS.get(planet1, '○'),
                                'secondary_emoji': PLANET_SYMBOLS.get(planet2, '○'),
                                'peak_time': self._to_local_iso(min_time),
                                'start_time': self._to_local_iso(conjunction_data['start_time']),
                                'end_time': self._to_local_iso(conjunction_data['end_time']),
                                'min_separation_degrees': min_separation,
                                'visibility': self._is_event_visible(planet1, planet2, min_time),
                                'importance': self._rate_importance(planet1, planet2, min_separation),
                                'raw_data': {
                                    'planet1': planet1,
                                    'planet2': planet2,
                                    'separation_degrees': min_separation,
                                }
                            }
                            events.append(event)
                        
                        in_conjunction = False
                        min_separation = None
                        min_time = None
                        conjunction_data = {}
            
            except Exception as e:
                logger.debug(f"Error in conjunction calculations: {e}")
            
            current_time = current_time + step_days
        
        return events

    def _find_oppositions(self, start_date: Time, end_date: Time) -> List[Dict[str, Any]]:
        """
        Find oppositions (when outer planets are 180° from the Sun).
        Opposition = best visibility for observation.
        Only outer planets: Mars, Jupiter, Saturn, Uranus, Neptune.
        """
        events = []
        outer_planets = ['Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune']
        
        for planet in outer_planets:
            try:
                oppositions = self._find_opposition_time(planet, start_date, end_date)
                events.extend(oppositions)
            except Exception as e:
                logger.debug(f"Error finding opposition for {planet}: {e}")
        
        return events

    def _find_opposition_time(
        self, planet: str, start_date: Time, end_date: Time
    ) -> List[Dict[str, Any]]:
        """
        Find opposition time for an outer planet.
        Opposition occurs when elongation ≈ 180°.
        """
        events = []
        sun = get_body('sun', start_date, self.location)
        
        # Step through time checking elongation
        current_time = start_date
        step_days = 2.0 * u.day
        min_angle_from_180 = None
        opposition_time = None
        in_opposition = False
        opposition_data = {}
        
        while current_time < end_date:
            try:
                elongation = self._get_elongation(planet, current_time)
                angle_from_180 = abs(elongation - 180.0)
                
                # Track closest approach to 180°
                if min_angle_from_180 is None or angle_from_180 < min_angle_from_180:
                    min_angle_from_180 = angle_from_180
                    opposition_time = current_time
                
                # Opposition zone: elongation between 170-190 degrees
                if 170 <= elongation <= 190:
                    if not in_opposition:
                        in_opposition = True
                        opposition_data['start_time'] = current_time
                    opposition_data['end_time'] = current_time
                else:
                    if in_opposition and opposition_time and min_angle_from_180 is not None:
                        # Opposition zone ended - record event
                        start_time = opposition_data.get('start_time', opposition_time)
                        end_time = opposition_data.get('end_time', opposition_time)
                        
                        if start_time is None or end_time is None:
                            current_time += step_days
                            opposition_data = {}
                            in_opposition = False
                            continue
                            
                        event = {
                            'event_type': 'Planetary Opposition',
                            'title': f'{planet} at Opposition',
                            'description': f'{planet} is at opposition (best visibility). Optimal for observation.',
                            'emoji': PLANET_SYMBOLS.get(planet, '○'),
                            'peak_time': self._to_local_iso(opposition_time),
                            'start_time': self._to_local_iso(start_time),
                            'end_time': self._to_local_iso(end_time),
                            'elongation_degrees': 180.0,
                            'visibility': True,  # Opposition is always visible
                            'importance': 'high',  # Opposition is excellent for observation
                            'raw_data': {
                                'planet': planet,
                                'elongation': 180.0,
                                'best_viewing_time': self._to_local_iso(opposition_time),
                            }
                        }
                        events.append(event)
                        
                        in_opposition = False
                        min_angle_from_180 = None
                        opposition_time = None
                        opposition_data = {}
            
            except Exception as e:
                logger.debug(f"Error in opposition calculations: {e}")
            
            current_time = current_time + step_days
        
        return events

    def _find_elongations(self, start_date: Time, end_date: Time) -> List[Dict[str, Any]]:
        """
        Find elongations (maximum angular distance from Sun).
        Only for Mercury and Venus (inferior planets).
        """
        events = []
        inner_planets = ['Mercury', 'Venus']
        
        for planet in inner_planets:
            try:
                elongations = self._find_elongation_time(planet, start_date, end_date)
                events.extend(elongations)
            except Exception as e:
                logger.debug(f"Error finding elongation for {planet}: {e}")
        
        return events

    def _find_elongation_time(
        self, planet: str, start_date: Time, end_date: Time
    ) -> List[Dict[str, Any]]:
        """
        Find maximum elongation times for Mercury or Venus.
        Maximum elongation = best viewing opportunity for inferior planets.
        """
        events = []
        min_elong = PLANETS[planet]['min_elong']
        
        current_time = start_date
        step_days = 1.0 * u.day
        max_elongation = None
        max_elong_time = None
        was_increasing = None
        
        while current_time < end_date:
            try:
                elongation = self._get_elongation(planet, current_time)
                is_visible = elongation >= min_elong
                is_increasing = elongation < 170  # Rough heuristic
                
                if is_visible:
                    if max_elongation is None or elongation > max_elongation:
                        max_elongation = elongation
                        max_elong_time = current_time
                    
                    # Peak occurs when elongation stops increasing
                    if was_increasing and not is_increasing:
                        if max_elong_time and max_elongation is not None:
                            event = {
                                'event_type': 'Planetary Elongation',
                                'title': f'{planet} at Maximum Elongation',
                                'description': f'{planet} reaches maximum elongation ({max_elongation:.1f}°). Best viewing time.',
                                'emoji': PLANET_SYMBOLS.get(planet, '○'),
                                'peak_time': self._to_local_iso(max_elong_time),
                                'elongation_degrees': max_elongation,
                                'visibility': True,
                                'importance': 'medium',
                                'raw_data': {
                                    'planet': planet,
                                    'elongation': max_elongation,
                                    'occurs_at': self._to_local_iso(max_elong_time),
                                }
                            }
                            events.append(event)
                        
                        max_elongation = None
                        max_elong_time = None
                    
                    was_increasing = is_increasing
            
            except Exception as e:
                logger.debug(f"Error in elongation calculations: {e}")
            
            current_time = current_time + step_days
        
        return events

    def _find_retrograde_periods(
        self, start_date: Time, end_date: Time
    ) -> List[Dict[str, Any]]:
        """
        Find retrograde motion periods for each planet.
        Retrograde = apparent backward motion due to Earth's orbit.
        """
        events = []
        planets_with_retrograde = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune']
        
        for planet in planets_with_retrograde:
            try:
                retrograde = self._find_retrograde_period(planet, start_date, end_date)
                events.extend(retrograde)
            except Exception as e:
                logger.debug(f"Error finding retrograde for {planet}: {e}")
        
        return events

    def _find_retrograde_period(
        self, planet: str, start_date: Time, end_date: Time
    ) -> List[Dict[str, Any]]:
        """
        Find retrograde motion periods for a specific planet.
        Retrograde occurs when planet's apparent RA/Dec velocities reverse.
        """
        events = []
        
        current_time = start_date
        step_days = 1.0 * u.day
        in_retrograde = False
        retrograde_start = None
        prev_ra = None
        
        while current_time < end_date:
            try:
                planet_obj = get_body(planet, current_time, self.location)
                if planet_obj is None:
                    current_time += step_days
                    continue
                
                # Handle both scalar and array returns from Astropy
                ra_val = planet_obj.ra.degree  # type: ignore
                if isinstance(ra_val, np.ndarray):
                    current_ra = float(np.real(ra_val.flat[0]))
                elif isinstance(ra_val, complex):
                    current_ra = float(np.real(ra_val))
                else:
                    current_ra = float(np.real(ra_val))  # type: ignore
                
                if prev_ra is not None:
                    # Check if RA is decreasing (retrograde motion)
                    ra_change = float(current_ra - prev_ra)
                    # Handle wrap-around at 0°
                    if ra_change > 180:
                        ra_change -= 360
                    elif ra_change < -180:
                        ra_change += 360
                    
                    is_retrograde = ra_change < -0.05  # Retrograde if decreasing
                    
                    if is_retrograde and not in_retrograde:
                        # Start of retrograde
                        in_retrograde = True
                        retrograde_start = current_time
                    
                    elif not is_retrograde and in_retrograde:
                        # End of retrograde
                        if retrograde_start:
                            duration_days = (current_time - retrograde_start).jd
                            event = {
                                'event_type': 'Planetary Retrograde',
                                'title': f'{planet} Retrograde Motion',
                                'description': f'{planet} appears to move backward for ~{duration_days:.0f} days.',
                                'emoji': PLANET_SYMBOLS.get(planet, '○'),
                                'start_time': self._to_local_iso(retrograde_start),
                                'end_time': self._to_local_iso(current_time),
                                'duration_days': duration_days,
                                'visibility': self._is_planet_visible(planet, retrograde_start),
                                'importance': 'medium',
                                'raw_data': {
                                    'planet': planet,
                                    'duration_days': duration_days,
                                }
                            }
                            events.append(event)
                        
                        in_retrograde = False
                        retrograde_start = None
                
                prev_ra = current_ra
            
            except Exception as e:
                logger.debug(f"Error in retrograde calculations: {e}")
            
            current_time = current_time + step_days
        
        return events

    def _angular_separation(self, planet1: str, planet2: str, time: Time) -> float:
        """Calculate angular separation between two planets in degrees."""
        try:
            p1 = get_body(planet1, time, self.location)
            p2 = get_body(planet2, time, self.location)
            
            sep = p1.separation(p2)
            # Handle both scalar and array returns from Astropy
            sep_val = sep.degree
            if isinstance(sep_val, np.ndarray):
                return float(np.real(sep_val.flat[0]))
            elif isinstance(sep_val, complex):
                return float(np.real(sep_val))
            else:
                return float(np.real(sep_val))  # type: ignore
        except Exception as e:
            logger.debug(f"Error calculating separation {planet1}-{planet2}: {e}")
            return float('inf')

    def _get_elongation(self, planet: str, time: Time) -> float:
        """Get angular distance from Sun to planet (elongation) in degrees."""
        try:
            planet_obj = get_body(planet, time, self.location)
            sun_obj = get_body('sun', time, self.location)
            
            elongation = planet_obj.separation(sun_obj)
            # Handle both scalar and array returns from Astropy
            elong_val = elongation.degree
            if isinstance(elong_val, np.ndarray):
                return float(np.real(elong_val.flat[0]))
            elif isinstance(elong_val, complex):
                return float(np.real(elong_val))
            else:
                return float(np.real(elong_val))  # type: ignore
        except Exception as e:
            logger.debug(f"Error calculating elongation for {planet}: {e}")
            return 0.0

    def _is_event_visible(self, planet1: str, planet2: str, time: Time) -> bool:
        """Check if a conjunction is visible from the location."""
        try:
            p1 = get_body(planet1, time, self.location)
            p2 = get_body(planet2, time, self.location)
            
            if p1 is None or p2 is None:
                return False
            
            altaz_p1 = p1.transform_to(AltAz(obstime=time, location=self.location))
            altaz_p2 = p2.transform_to(AltAz(obstime=time, location=self.location))
            
            if altaz_p1 is None or altaz_p2 is None:
                return False
            
            # Both planets must be above horizon for conjunction to be visible
            alt1_val = altaz_p1.alt.degree  # type: ignore
            alt2_val = altaz_p2.alt.degree  # type: ignore
            
            if isinstance(alt1_val, np.ndarray):
                alt1 = float(np.real(alt1_val.flat[0]))
            elif isinstance(alt1_val, complex):
                alt1 = float(np.real(alt1_val))
            else:
                alt1 = float(np.real(alt1_val))  # type: ignore
                
            if isinstance(alt2_val, np.ndarray):
                alt2 = float(np.real(alt2_val.flat[0]))
            elif isinstance(alt2_val, complex):
                alt2 = float(np.real(alt2_val))
            else:
                alt2 = float(np.real(alt2_val))  # type: ignore
                
            return alt1 > 5 and alt2 > 5
        except Exception:
            return False

    def _is_planet_visible(self, planet: str, time: Time) -> bool:
        """Check if a planet is visible from the location."""
        try:
            planet_obj = get_body(planet, time, self.location)
            if planet_obj is None:
                return False
                
            altaz = planet_obj.transform_to(AltAz(obstime=time, location=self.location))
            if altaz is None:
                return False
            
            # Planet is visible if above horizon and not too close to Sun
            sun_obj = get_body('sun', time, self.location)
            if sun_obj is None:
                return False
            
            # Handle both scalar and array returns
            elong_val = planet_obj.separation(sun_obj).degree
            if isinstance(elong_val, np.ndarray):
                elongation = float(np.real(elong_val.flat[0]))
            elif isinstance(elong_val, complex):
                elongation = float(np.real(elong_val))
            else:
                elongation = float(np.real(elong_val))  # type: ignore
                
            alt_val = altaz.alt.degree  # type: ignore
            if isinstance(alt_val, np.ndarray):
                altitude = float(np.real(alt_val.flat[0]))
            elif isinstance(alt_val, complex):
                altitude = float(np.real(alt_val))
            else:
                altitude = float(np.real(alt_val))  # type: ignore
            
            return altitude > 5 and elongation > 10
        except Exception:
            return False

    def _to_local_iso(self, time: Time) -> str:
        """Convert Astropy Time to configured local timezone ISO string with offset."""
        dt = time.to_datetime(timezone=self.timezone)
        return dt.isoformat() if isinstance(dt, datetime) else str(dt)

    def _rate_importance(self, planet1: str, planet2: str, separation: float) -> str:
        """Rate the importance of a conjunction based on brightness and separation."""
        # Major planets: Jupiter and Saturn
        major_planets = {'Jupiter', 'Saturn'}
        is_major = (planet1 in major_planets) or (planet2 in major_planets)
        
        # Closer conjunctions are more impressive
        if separation < 0.5:
            return 'high' if is_major else 'medium'
        elif separation < 2:
            return 'medium'
        else:
            return 'low'
