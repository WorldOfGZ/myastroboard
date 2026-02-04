"""
Moon Service

Includes:
- Phase, illumination, distance
- Alt/Az live position
- Moonrise / Moonset
- Next full/new moon
- Next astronomical dark night:
    Sun altitude < -18°
    Moon below horizon


Example output for current Moon status (on API call):
{
  "location": {
    "name": "Location name",
    "latitude": 40.00,
    "longitude": 5.00,
    "timezone": "Europe/Paris"
  },
  "moon": {
    "phase_name": "Waning Crescent",
    "illumination_percent": 6.2,
    "distance_km": 398112,
    "altitude_deg": -12.4,
    "azimuth_deg": 310.2,
    "next_moonrise": "2026-01-29 04:55",
    "next_moonset": "2026-01-29 15:10",
    "next_full_moon": "2026-02-01 17:32",
    "next_new_moon": "2026-02-16 03:10",
    "next_dark_night_start": "2026-01-30 22:15",
    "next_dark_night_end": "2026-01-31 04:40"
  }
}

"""

import datetime
from dataclasses import dataclass
from zoneinfo import ZoneInfo
import math

from astronomy import (
    Time,
    MoonPhase,
    SearchMoonPhase,
    SearchRiseSet,
    Body,
    Observer,
    Equator,
    Horizon,
    Refraction,
    Direction
)

from astropy.time import Time as AstroTime
from astropy.coordinates import EarthLocation, AltAz, get_sun, get_body
import astropy.units as u


@dataclass
class MoonAstroPhotoInfo:
    phase_name: str
    illumination_percent: float
    distance_km: float

    altitude_deg: float
    azimuth_deg: float

    next_moonrise: str
    next_moonset: str

    next_full_moon: str
    next_new_moon: str

    next_dark_night_start: str
    next_dark_night_end: str


class MoonService:

    def __init__(self, latitude: float, longitude: float, timezone: str):
        self.latitude = latitude
        self.longitude = longitude
        self.timezone = ZoneInfo(timezone)

        self.observer = Observer(latitude, longitude, 0)

        self.location = EarthLocation(
            lat=latitude * u.deg,
            lon=longitude * u.deg
        )

    def get_report(self) -> MoonAstroPhotoInfo:
        # --- Now UTC & local ---
        now_local = datetime.datetime.now(self.timezone)
        now_utc = now_local.astimezone(datetime.timezone.utc)

        # astronomy.Time expects ISO8601 with 'T' and 'Z'
        time_str = now_utc.strftime("%Y-%m-%dT%H:%M:%SZ")
        t = Time(time_str)

        # Phase
        phase_angle = MoonPhase(t)
        # Illumination (0° new moon → 0%, 180° full → 100%)
        illumination = (1 - math.cos(math.radians(phase_angle))) / 2 * 100
        phase_name = self._phase_name(phase_angle)

        # Distance
        eq = Equator(Body.Moon, t, self.observer, True, True)
        distance_km = eq.dist * 149597870.7

        # Alt/Az current
        hor = Horizon(t, self.observer, eq.ra, eq.dec, Refraction.Normal)

        # Moonrise / Moonset
        moonrise = SearchRiseSet(Body.Moon, self.observer, Direction.Rise, t, 2)
        moonset = SearchRiseSet(Body.Moon, self.observer, Direction.Set, t, 2)

        # Next full/new moon
        next_full = SearchMoonPhase(180, t, 30)
        next_new = SearchMoonPhase(0, t, 30)

        # Next astronomical dark night
        dark_start, dark_end = self._next_astronomical_dark_window(now_local)

        return MoonAstroPhotoInfo(
            phase_name=phase_name,
            illumination_percent=round(illumination, 2),
            distance_km=round(distance_km, 0),

            altitude_deg=round(hor.altitude, 2),
            azimuth_deg=round(hor.azimuth, 2),

            next_moonrise=self._fmt(moonrise),
            next_moonset=self._fmt(moonset),

            next_full_moon=self._fmt(next_full),
            next_new_moon=self._fmt(next_new),

            next_dark_night_start=dark_start,
            next_dark_night_end=dark_end
        )

    def _phase_name(self, angle: float) -> str:
        
        # Determine if waxing or waning
        if angle < 180:
            waxing = True
        else:
            waxing = False

        if angle < 10:
            name = "New Moon"
        elif angle < 90:
            name = "Waxing Crescent" if waxing else "Waning Crescent"
        elif angle < 100:
            name = "First Quarter" if waxing else "Last Quarter"
        elif angle < 170:
            name = "Waxing Gibbous" if waxing else "Waning Gibbous"
        elif angle < 190:
            name = "Full Moon"
        elif angle < 260:
            name = "Waning Gibbous" if not waxing else "Waxing Gibbous"
        elif angle < 280:
            name = "Last Quarter" if not waxing else "First Quarter"
        else:
            name = "Waning Crescent" if not waxing else "Waxing Crescent"

        return name

    def _fmt(self, astro_time_obj) -> str:
        """
        Convert an astronomy.Time (or equivalent result) to local string.
        Uses Time.Utc() as defined in Astronomy Engine.
        """
        # Time.Utc() returns a datetime.datetime UTC object
        dt_utc = astro_time_obj.Utc()
        # convert to local timezone
        dt_local = dt_utc.astimezone(self.timezone)
        return dt_local.isoformat(timespec='minutes')  # ex: "2026-02-03T20:28:00+01:00"
    
    def _fmt_time(self, dt_local: datetime.datetime) -> str:
        # s'assure que dt_local a tzinfo
        if dt_local.tzinfo is None:
            dt_local = dt_local.replace(tzinfo=self.timezone)
        return dt_local.isoformat(timespec='minutes')  # ex: "2026-02-03T20:28:00+01:00"

    def _next_astronomical_dark_window(self, start_local: datetime.datetime):
        dt = start_local
        found_start = None

        for _ in range(60 * 24 * 10):  # search up to 10 days
            utc = dt.astimezone(datetime.timezone.utc)
            t_astropy = AstroTime(utc)

            frame = AltAz(obstime=t_astropy, location=self.location)
            sun_alt = get_sun(t_astropy).transform_to(frame).alt.deg
            moon_alt = get_body("moon", t_astropy).transform_to(frame).alt.deg

            if sun_alt < -18 and moon_alt < 0:
                if found_start is None:
                    found_start = dt
            else:
                if found_start is not None:
                    return (
                        self._fmt_time(found_start),
                        self._fmt_time(dt)
                    )
            dt += datetime.timedelta(minutes=5)

        return ("Not found", "Not found")
