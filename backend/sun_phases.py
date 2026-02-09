"""
Sun Service for Astrophotography

Provides:
- Sunrise / Sunset
- Civil / Nautical / Astronomical twilight times
- Duration of true astronomical night


Example output (on API call):
{
  "sun": {
    "sunrise": "2026-01-29 08:12",
    "sunset": "2026-01-29 17:45",

    "civil_dusk": "2026-01-29 18:20",
    "civil_dawn": "2026-01-29 07:37",

    "nautical_dusk": "2026-01-29 18:55",
    "nautical_dawn": "2026-01-29 07:02",

    "astronomical_dusk": "2026-01-29 19:35",
    "astronomical_dawn": "2026-01-29 06:22",

    "true_night_hours": 10.78
  }
}

"""

import datetime
from dataclasses import dataclass
from zoneinfo import ZoneInfo
from typing import Any, Optional, cast

from astropy.time import Time as AstroTime
from astropy.coordinates import EarthLocation, AltAz, get_sun
import astropy.units as u


# -----------------------------
# Data structure
# -----------------------------

@dataclass
class SunAstroInfo:
    sunrise: str
    sunset: str

    civil_dusk: str
    civil_dawn: str

    nautical_dusk: str
    nautical_dawn: str

    astronomical_dusk: str
    astronomical_dawn: str

    true_night_hours: float


# -----------------------------
# Service
# -----------------------------

class SunService:

    def __init__(self, latitude, longitude, timezone):
        self.latitude = latitude
        self.longitude = longitude
        self.timezone = ZoneInfo(timezone)

        self.location = EarthLocation(
            lat=latitude * u.deg,
            lon=longitude * u.deg
        )

    # -----------------------------
    # Public API
    # -----------------------------

    def get_today_report(self):

        today = datetime.date.today()
        return self._compute_day(today)
    
    def get_tomorrow_report(self):
        tomorrow = datetime.date.today() + datetime.timedelta(days=1)
        return self._compute_day(tomorrow)

    # -----------------------------
    # Core calculation
    # -----------------------------

    def _compute_day(self, date):

        # Search between noon and next noon
        start = datetime.datetime.combine(date, datetime.time(12, 0), self.timezone)
        end = start + datetime.timedelta(days=1)

        sunset = self._search_altitude_crossing(start, end, 0, direction="down")
        sunrise = self._search_altitude_crossing(start, end, 0, direction="up")

        civil_dusk = self._search_altitude_crossing(start, end, -6, "down")
        civil_dawn = self._search_altitude_crossing(start, end, -6, "up")

        nautical_dusk = self._search_altitude_crossing(start, end, -12, "down")
        nautical_dawn = self._search_altitude_crossing(start, end, -12, "up")

        astro_dusk = self._search_altitude_crossing(start, end, -18, "down")
        astro_dawn = self._search_altitude_crossing(start, end, -18, "up")

        # Duration of true astronomical night
        night_hours = 0
        if astro_dusk and astro_dawn:
            delta = astro_dawn - astro_dusk
            night_hours = delta.total_seconds() / 3600

        return SunAstroInfo(
            sunrise=self._fmt(sunrise),
            sunset=self._fmt(sunset),

            civil_dusk=self._fmt(civil_dusk),
            civil_dawn=self._fmt(civil_dawn),

            nautical_dusk=self._fmt(nautical_dusk),
            nautical_dawn=self._fmt(nautical_dawn),

            astronomical_dusk=self._fmt(astro_dusk),
            astronomical_dawn=self._fmt(astro_dawn),

            true_night_hours=round(night_hours, 2)
        )

    # -----------------------------
    # Search altitude crossing
    # -----------------------------

    def _search_altitude_crossing(self, start, end, target_alt, direction):

        step = datetime.timedelta(minutes=5)

        prev_alt = None
        prev_time = None

        dt = start
        while dt <= end:

            alt = self._sun_altitude(dt)

            if prev_alt is not None:

                if direction == "down":
                    if prev_alt > target_alt and alt <= target_alt:
                        return dt

                if direction == "up":
                    if prev_alt < target_alt and alt >= target_alt:
                        return dt

            prev_alt = alt
            prev_time = dt
            dt += step

        return None

    # -----------------------------
    # Sun altitude
    # -----------------------------

    def _sun_altitude(self, dt_local):

        utc = dt_local.astimezone(datetime.timezone.utc)
        t = AstroTime(utc)

        frame = AltAz(obstime=t, location=self.location)

        sun_alt = self._coord_altitude_deg(get_sun(t), frame)
        return sun_alt

    def _coord_altitude_deg(self, coord: Any, frame: AltAz) -> Optional[float]:
        if coord is None:
            return None

        transformed = coord.transform_to(frame)
        alt = getattr(transformed, "alt", None)
        if alt is None:
            return None

        value = alt.to_value(u.deg) if hasattr(alt, "to_value") else None
        if value is None:
            return None

        return float(cast(Any, value))

    # -----------------------------
    # Formatting
    # -----------------------------

    def _fmt(self, dt):

        if dt is None:
            return "Not found"

        return dt.strftime("%Y-%m-%d %H:%M")
