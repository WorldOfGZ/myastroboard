"""
AstroTonightService

Computes the best astrophotography imaging window tonight.

Conditions:
- Sun altitude < -18° (astronomical night)
- Moon constraint depending on mode

Modes:
- strict      : Moon below horizon
- practical   : Moon altitude < 5°
- illumination: Moon illumination < 15%

Example output (on API call):
{
  "best_window": {
    "start": "2026-01-30 22:15",
    "end": "2026-01-31 04:40",
    "duration_hours": 6.42,
    "moon_condition": "strict",
    "score": 100
  }
}

"""

import datetime
from zoneinfo import ZoneInfo
from dataclasses import dataclass
from typing import Any, Optional, cast

import astropy.units as u
from astropy.time import Time
from astropy.coordinates import EarthLocation, AltAz, get_sun, get_body

from astroplan.moon import moon_illumination


# ============================================================
# Data structure
# ============================================================

@dataclass
class BestWindow:
    start: str
    end: str
    duration_hours: float
    moon_condition: str
    score: int


# ============================================================
# Main service
# ============================================================

class AstroTonightService:

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

    def best_window_tonight(self, mode="strict") -> BestWindow:
        """
        Returns the best continuous imaging window tonight.
        """
        windows = self.best_windows_all_modes()
        return windows[mode]

    def best_windows_all_modes(self) -> dict:
        """
        Compute best windows for all three modes in a single pass through the night.
        Altitudes are calculated once per time-step instead of once per mode,
        reducing Astropy frame transforms by ~66%.
        Returns a dict keyed by mode: {'strict': BestWindow, 'practical': BestWindow, 'illumination': BestWindow}
        """
        now = datetime.datetime.now(self.timezone)
        today = now.date()

        # Night interval: 18:00 → 06:00 local
        start = datetime.datetime.combine(
            today,
            datetime.time(18, 0),
            tzinfo=self.timezone
        )
        end = datetime.datetime.combine(
            today + datetime.timedelta(days=1),
            datetime.time(6, 0),
            tzinfo=self.timezone
        )

        # Illumination computed once per night (used by 'illumination' mode)
        illumination = self._moon_illumination(start)

        step_minutes = 5
        step = datetime.timedelta(minutes=step_minutes)

        modes = ["strict", "practical", "illumination"]

        # Per-mode tracking state
        best_start    = {m: None for m in modes}
        best_duration = {m: datetime.timedelta(0) for m in modes}
        current_start = {m: None for m in modes}

        dt = start

        # Mode condition lambdas — evaluated once per step with shared altitudes
        def is_ok(mode, sun_alt, moon_alt):
            if sun_alt >= -18:
                return False
            if mode == "strict":
                return moon_alt < 0
            if mode == "practical":
                return moon_alt < 5
            # illumination
            return illumination < 15

        while dt <= end:
            sun_alt, moon_alt = self._altitudes(dt)

            if sun_alt is None or moon_alt is None:
                dt += step
                continue

            for m in modes:
                ok = is_ok(m, sun_alt, moon_alt)
                if ok:
                    if current_start[m] is None:
                        current_start[m] = dt
                else:
                    if current_start[m] is not None:
                        duration = dt - current_start[m]
                        if duration > best_duration[m]:
                            best_duration[m] = duration
                            best_start[m] = current_start[m]
                        current_start[m] = None

            dt += step

        # Close any still-open windows at end of scan
        for m in modes:
            if current_start[m] is not None:
                duration = end - current_start[m]
                if duration > best_duration[m]:
                    best_duration[m] = duration
                    best_start[m] = current_start[m]

        # Build result dict
        result = {}
        for m in modes:
            if best_start[m] is None:
                result[m] = BestWindow(
                    start="Not found",
                    end="Not found",
                    duration_hours=0,
                    moon_condition="unfavorable",
                    score=0,
                )
            else:
                b_end = best_start[m] + best_duration[m]
                hours = best_duration[m].total_seconds() / 3600
                result[m] = BestWindow(
                    start=best_start[m].strftime("%Y-%m-%d %H:%M"),
                    end=b_end.strftime("%Y-%m-%d %H:%M"),
                    duration_hours=round(hours, 2),
                    moon_condition=m,
                    score=self._score(hours),
                )

        return result

    # ============================================================
    # Compute altitudes (Sun + Moon)
    # ============================================================

    def _altitudes(self, dt_local) -> tuple[Optional[float], Optional[float]]:

        # Local → UTC
        utc_dt = dt_local.astimezone(datetime.timezone.utc)

        # Astropy Time
        t = Time(utc_dt)

        # AltAz frame
        frame = AltAz(obstime=t, location=self.location)

        # Sun altitude
        sun_coord = get_sun(t)
        moon_coord = get_body("moon", t)

        sun_alt = self._coord_altitude_deg(sun_coord, frame)
        moon_alt = self._coord_altitude_deg(moon_coord, frame)

        return sun_alt, moon_alt

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

    # ============================================================
    # Moon illumination %
    # ============================================================

    def _moon_illumination(self, dt_local):

        utc_dt = dt_local.astimezone(datetime.timezone.utc)
        t = Time(utc_dt)

        illum = moon_illumination(t) * 100
        return float(illum)

    # ============================================================
    # Score function
    # ============================================================

    def _score(self, hours):

        if hours >= 6:
            return 100
        elif hours >= 4:
            return 85
        elif hours >= 2:
            return 65
        elif hours > 0:
            return 40
        return 10