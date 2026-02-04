"""
Moon Planner for Astrophotography

Provides next 7 nights dark-time forecast with 3 darkness modes:
- strict (Sun altitude < -18° AND Moon altitude < 0°) -> No moon on sky
- practical (Sun < -18° AND Moon altitude < 5°) -> Moon, but negligible
- illumination (Sun < -18° AND Moon illumination < 15%) -> Visible moon, but faint


Example output for a night (on API call):
{
  "date": "2026-01-30",
  "dark_hours": { # Total duration in hours during which the night is considered usable according to the mode.
    "strict": 5.3,
    "practical": 6.1,
    "illumination": 7.8
  },
  "moon": {
    "max_altitude": 12.4, # Maximum altitude of the Moon during the night (degrees)
    "illumination_percent": 6.2 # Maximum illumination percentage of the Moon during the night (%)
  },
  "astrophoto_score": 100,
  "units": {
    "dark_hours": "hours",
    "altitude": "degrees",
    "illumination": "percent"
  }
}

"""

import datetime
from zoneinfo import ZoneInfo

import astropy.units as u
from astropy.time import Time
from astropy.coordinates import EarthLocation, AltAz, get_sun, get_body

from astroplan.moon import moon_illumination


class MoonPlanner:

    def __init__(self, latitude: float, longitude: float, timezone: str):

        self.latitude = latitude
        self.longitude = longitude
        self.timezone = ZoneInfo(timezone)

        self.location = EarthLocation(
            lat=latitude * u.deg,
            lon=longitude * u.deg
        )

    # ============================================================
    # Public API
    # ============================================================

    def next_7_nights(self):

        today = datetime.datetime.now(self.timezone).date()
        results = []

        for i in range(7):
            date = today + datetime.timedelta(days=i)

            strict = self._dark_hours(date, mode="strict")
            practical = self._dark_hours(date, mode="practical")
            illum = self._dark_hours(date, mode="illumination")

            results.append({
                "date": str(date),
                "dark_hours": {
                    "strict": round(strict["hours"], 2),
                    "practical": round(practical["hours"], 2),
                    "illumination": round(illum["hours"], 2),
                },
                "moon": {
                    "max_altitude": round(strict["moon_max_alt"], 1),
                    "illumination_percent": round(strict["illumination"], 1)
                },
                "astrophoto_score": self._score(strict["hours"])
            })

        return results

    # ============================================================
    # Core computation
    # ============================================================

    def _dark_hours(self, date, mode="strict"):

        # Night window: 18:00 → 06:00 local time
        start = datetime.datetime.combine(
            date,
            datetime.time(18, 0),
            tzinfo=self.timezone
        )

        end = datetime.datetime.combine(
            date + datetime.timedelta(days=1),
            datetime.time(6, 0),
            tzinfo=self.timezone
        )

        step_minutes = 10
        step = datetime.timedelta(minutes=step_minutes)

        dark_minutes = 0
        moon_max_alt = -999

        # Compute illumination once per night
        illum_percent = self._moon_illumination(start)

        dt = start
        while dt <= end:

            # Convert local → UTC
            utc_dt = dt.astimezone(datetime.timezone.utc)

            # Astropy Time object
            t = Time(utc_dt)

            # AltAz frame
            frame = AltAz(obstime=t, location=self.location)

            # Sun altitude
            sun_alt = get_sun(t).transform_to(frame).alt.deg

            # Moon altitude
            moon_alt = get_body("moon", t).transform_to(frame).alt.deg
            moon_max_alt = max(moon_max_alt, moon_alt)

            # Always require astronomical night
            if sun_alt < -18:

                ok = False

                if mode == "strict":
                    ok = moon_alt < 0

                elif mode == "practical":
                    ok = moon_alt < 5

                elif mode == "illumination":
                    ok = illum_percent < 15

                if ok:
                    dark_minutes += step_minutes

            dt += step

        return {
            "hours": dark_minutes / 60,
            "moon_max_alt": moon_max_alt,
            "illumination": illum_percent
        }

    # ============================================================
    # Moon illumination (official astroplan)
    # ============================================================

    def _moon_illumination(self, dt_local):

        utc_dt = dt_local.astimezone(datetime.timezone.utc)
        t = Time(utc_dt)

        illum = moon_illumination(t) * 100
        return float(illum)

    # ============================================================
    # Simple astrophotography score
    # ============================================================

    def _score(self, strict_hours):

        if strict_hours >= 6:
            return 100
        elif strict_hours >= 4:
            return 80
        elif strict_hours >= 2:
            return 60
        elif strict_hours > 0:
            return 40
        return 10