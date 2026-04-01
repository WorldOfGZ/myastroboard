"""
ISS pass prediction service.

Computes upcoming International Space Station passages for the configured observer
location using current TLE data and returns local-time windows with a visibility
score and day/night visibility classification.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List, Tuple
from zoneinfo import ZoneInfo
import os
import time

import requests
import astropy.units as u
from astropy.time import Time as AstroTime
from astropy.coordinates import EarthLocation, AltAz, get_sun
from skyfield.api import Loader, EarthSatellite, wgs84

from constants import CACHE_TTL, DATA_DIR_CACHE
from logging_config import get_logger
from utils import load_json_file, save_json_file


logger = get_logger(__name__)

SKYFIELD_CACHE_DIR = os.path.join(DATA_DIR_CACHE, 'skyfield')
os.makedirs(SKYFIELD_CACHE_DIR, exist_ok=True)
SKYFIELD_LOADER = Loader(SKYFIELD_CACHE_DIR)
logger.info(f"Skyfield cache directory: {SKYFIELD_CACHE_DIR}")

CELESTRAK_ISS_TLE_URLS = [
    "https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE",
    "https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle",
    "https://celestrak.org/NORAD/elements/stations.txt",
    "https://www.celestrak.com/NORAD/elements/stations.txt",
]
REQUEST_TIMEOUT_SECONDS = 10
DEFAULT_FORECAST_DAYS = 20
MAX_FORECAST_DAYS = 30
MIN_EVENT_ALTITUDE_DEG = 10.0
MAX_VISIBLE_SKY_SUN_ALTITUDE_DEG = -4.0
VISIBILITY_SAMPLE_SECONDS = 5
ISS_TLE_CACHE_FILE = os.path.join(DATA_DIR_CACHE, 'iss_tle_cache.json')
ISS_TLE_MAX_AGE_SECONDS = 6 * 60 * 60
ISS_TLE_FAILURE_COOLDOWN_SECONDS = 3 * 60 * 60


def _utc_timestamp() -> int:
    return int(time.time())


def _read_tle_cache() -> Dict[str, Any]:
    payload = load_json_file(ISS_TLE_CACHE_FILE, default={})
    return payload if isinstance(payload, dict) else {}


def _write_tle_cache(payload: Dict[str, Any]) -> None:
    save_json_file(ISS_TLE_CACHE_FILE, payload)


def _get_cached_tle(max_age_seconds: Optional[int] = None) -> Optional[Tuple[str, str, int]]:
    cache = _read_tle_cache()
    line1 = str(cache.get('line1') or '').strip()
    line2 = str(cache.get('line2') or '').strip()
    fetched_at = int(cache.get('fetched_at') or 0)
    if not line1 or not line2 or fetched_at <= 0:
        return None

    age = _utc_timestamp() - fetched_at
    if max_age_seconds is not None and age > max_age_seconds:
        return None

    return line1, line2, fetched_at


def _set_cached_tle(line1: str, line2: str) -> None:
    payload = _read_tle_cache()
    payload['line1'] = line1
    payload['line2'] = line2
    payload['fetched_at'] = _utc_timestamp()
    payload['last_error_at'] = None
    _write_tle_cache(payload)


def _set_tle_error_timestamp() -> None:
    payload = _read_tle_cache()
    payload['last_error_at'] = _utc_timestamp()
    _write_tle_cache(payload)


def _in_tle_failure_cooldown() -> bool:
    payload = _read_tle_cache()
    last_error_at = int(payload.get('last_error_at') or 0)
    if last_error_at <= 0:
        return False
    return (_utc_timestamp() - last_error_at) < ISS_TLE_FAILURE_COOLDOWN_SECONDS


class ISSPassService:
    """Service that computes ISS visible passes for an observer location."""

    def __init__(self, latitude: float, longitude: float, elevation_m: float, timezone_str: str):
        self.latitude = latitude
        self.longitude = longitude
        self.elevation_m = elevation_m
        self.timezone = ZoneInfo(timezone_str)
        self.location = EarthLocation(
            lat=latitude * u.deg,
            lon=longitude * u.deg,
            height=elevation_m * u.m
        )

    def get_report(self, days: int = DEFAULT_FORECAST_DAYS) -> Dict[str, Any]:
        """Generate ISS pass report for the requested window."""
        forecast_days = max(1, min(int(days), MAX_FORECAST_DAYS))

        line1, line2 = self._fetch_iss_tle()

        ts = SKYFIELD_LOADER.timescale()
        satellite = EarthSatellite(line1, line2, "ISS (ZARYA)", ts)
        observer = wgs84.latlon(self.latitude, self.longitude, elevation_m=self.elevation_m)
        eph = self._load_ephemeris()

        now_utc = datetime.now(timezone.utc)
        end_utc = now_utc + timedelta(days=forecast_days)

        event_times, event_types = satellite.find_events(
            observer,
            ts.from_datetime(now_utc),
            ts.from_datetime(end_utc),
            altitude_degrees=MIN_EVENT_ALTITUDE_DEG,
        )

        all_passes = self._build_passes(event_times, event_types, satellite, observer, ts, eph)
        passes = [entry for entry in all_passes if entry.get("is_visible")]
        next_visible = passes[0] if passes else None

        return {
            "timestamp": datetime.now(self.timezone).isoformat(),
            "location": {
                "latitude": self.latitude,
                "longitude": self.longitude,
                "elevation": self.elevation_m,
                "timezone": str(self.timezone),
            },
            "window_days": forecast_days,
            "next_visible_passage": next_visible,
            "passes": passes,
            "total_passes": len(passes),
            "cache_ttl": CACHE_TTL,
            "units": {
                "times": "ISO format local timezone",
                "duration_minutes": "minutes",
                "peak_altitude": "degrees",
                "azimuth": "degrees",
                "visibility_score": "0-100",
            },
        }

    def _load_ephemeris(self):
        """Load JPL ephemeris for solar illumination checks."""
        try:
            return SKYFIELD_LOADER('de421.bsp')
        except Exception as exc:
            logger.warning(f"Could not load ephemeris file de421.bsp: {exc}")
            return None

    def _fetch_iss_tle(self) -> Tuple[str, str]:
        """Fetch latest ISS TLE, trying multiple CelesTrak endpoints as fallback."""
        # Fast path: prefer recent cached TLE to avoid unnecessary upstream requests.
        cached_recent = _get_cached_tle(max_age_seconds=ISS_TLE_MAX_AGE_SECONDS)
        if cached_recent is not None:
            line1, line2, _ = cached_recent
            return line1, line2

        # Circuit breaker: if a recent failure happened, avoid hammering providers.
        if _in_tle_failure_cooldown():
            cached_any = _get_cached_tle(max_age_seconds=None)
            if cached_any is not None:
                line1, line2, fetched_at = cached_any
                age_hours = (_utc_timestamp() - fetched_at) / 3600.0
                logger.warning(f"ISS TLE fetch is in cooldown; reusing stale cached TLE ({age_hours:.1f}h old)")
                return line1, line2
            raise RuntimeError('ISS TLE fetch is in cooldown and no cached TLE is available')

        last_error: Optional[Exception] = None

        for tle_url in CELESTRAK_ISS_TLE_URLS:
            try:
                response = requests.get(tle_url, timeout=REQUEST_TIMEOUT_SECONDS)
                response.raise_for_status()
                line1, line2 = self._parse_iss_tle_from_response(response.text)
                _set_cached_tle(line1, line2)
                return line1, line2
            except Exception as exc:
                last_error = exc
                logger.debug(f"ISS TLE fetch failed for {tle_url}: {exc}")

        _set_tle_error_timestamp()
        cached_any = _get_cached_tle(max_age_seconds=None)
        if cached_any is not None:
            line1, line2, fetched_at = cached_any
            age_hours = (_utc_timestamp() - fetched_at) / 3600.0
            logger.warning(f"All ISS TLE sources failed; using stale cached TLE ({age_hours:.1f}h old)")
            return line1, line2

        logger.warning("All ISS TLE sources failed and no cached TLE is available")
        raise RuntimeError(f"Failed to fetch ISS TLE from all sources: {last_error}")

    def _parse_iss_tle_from_response(self, response_text: str) -> Tuple[str, str]:
        """Extract ISS TLE pair from plain-text response payload."""
        lines = [line.strip() for line in response_text.splitlines() if line.strip()]
        first_tle_pair: Optional[Tuple[str, str]] = None

        for index in range(len(lines) - 1):
            line = lines[index]
            next_line = lines[index + 1]
            if line.startswith("1 ") and next_line.startswith("2 "):
                pair = (line, next_line)
                if first_tle_pair is None:
                    first_tle_pair = pair

                previous_name = lines[index - 1].upper() if index > 0 else ""
                if "ISS" in previous_name or "ZARYA" in previous_name:
                    return pair

        if first_tle_pair is not None:
            return first_tle_pair

        raise ValueError("Could not parse ISS TLE from response payload")

    def _build_passes(self, event_times, event_types, satellite: EarthSatellite, observer, ts, eph) -> List[Dict[str, Any]]:
        """Build normalized pass objects from Skyfield rise/culminate/set events."""
        passes: List[Dict[str, Any]] = []
        current: Dict[str, Any] = {}

        for event_time, event_type in zip(event_times, event_types):
            dt_utc = event_time.utc_datetime().replace(tzinfo=timezone.utc)

            if event_type == 0:
                current = {"start": dt_utc}
                continue

            if event_type == 1:
                if not current:
                    continue
                current["peak"] = dt_utc
                current["peak_altitude_deg"] = self._satellite_altitude_deg(satellite, observer, event_time)
                continue

            if event_type == 2:
                if not current or "peak" not in current:
                    current = {}
                    continue

                current["end"] = dt_utc
                pass_entry = self._extract_visible_segment(
                    start_utc=current["start"],
                    end_utc=current["end"],
                    satellite=satellite,
                    observer=observer,
                    ts=ts,
                    eph=eph,
                )

                if pass_entry:
                    passes.append(pass_entry)

                current = {}

        return passes

    def _extract_visible_segment(
        self,
        start_utc: datetime,
        end_utc: datetime,
        satellite: EarthSatellite,
        observer,
        ts,
        eph,
    ) -> Optional[Dict[str, Any]]:
        """Extract the visible segment of a geometric pass using time sampling."""
        if end_utc <= start_utc:
            return None

        samples = []
        sample_time = start_utc
        while sample_time <= end_utc:
            samples.append(self._sample_observation(sample_time, satellite, observer, ts, eph))
            sample_time += timedelta(seconds=VISIBILITY_SAMPLE_SECONDS)

        if not samples or samples[-1]["time_utc"] != end_utc:
            samples.append(self._sample_observation(end_utc, satellite, observer, ts, eph))

        visible_indices = [idx for idx, sample in enumerate(samples) if sample["is_visible"]]
        if not visible_indices:
            return None

        segments = self._group_consecutive_indices(visible_indices)
        best_segment = max(
            segments,
            key=lambda segment: max(samples[idx]["altitude_deg"] for idx in segment),
        )

        segment_samples = [samples[idx] for idx in best_segment]
        start_sample = segment_samples[0]
        end_sample = segment_samples[-1]
        peak_sample = max(segment_samples, key=lambda sample: sample["altitude_deg"])

        start_time = start_sample["time_utc"]
        peak_time = peak_sample["time_utc"]
        end_time = end_sample["time_utc"]
        duration_minutes = max(0.0, (end_time - start_time).total_seconds() / 60.0)
        peak_altitude = float(peak_sample["altitude_deg"])
        sun_altitude_deg = float(peak_sample["sun_altitude_deg"])
        day_night_visibility = self._classify_day_night(sun_altitude_deg)
        visibility_score = self._compute_visibility_score(
            peak_altitude_deg=peak_altitude,
            duration_minutes=duration_minutes,
            sun_altitude_deg=sun_altitude_deg,
        )

        return {
            "start_time": start_time.astimezone(self.timezone).isoformat(),
            "peak_time": peak_time.astimezone(self.timezone).isoformat(),
            "end_time": end_time.astimezone(self.timezone).isoformat(),
            "start_altitude_deg": round(float(start_sample["altitude_deg"]), 1),
            "peak_altitude_deg": round(peak_altitude, 1),
            "end_altitude_deg": round(float(end_sample["altitude_deg"]), 1),
            "start_azimuth_deg": round(float(start_sample["azimuth_deg"]), 1),
            "peak_azimuth_deg": round(float(peak_sample["azimuth_deg"]), 1),
            "end_azimuth_deg": round(float(end_sample["azimuth_deg"]), 1),
            "start_azimuth_cardinal": self._azimuth_to_cardinal(float(start_sample["azimuth_deg"])),
            "peak_azimuth_cardinal": self._azimuth_to_cardinal(float(peak_sample["azimuth_deg"])),
            "end_azimuth_cardinal": self._azimuth_to_cardinal(float(end_sample["azimuth_deg"])),
            "duration_minutes": round(duration_minutes, 1),
            "visibility_score": round(visibility_score, 1),
            "visibility_day_night": day_night_visibility,
            "sun_altitude_deg": round(sun_altitude_deg, 1),
            "pass_type": "visible",
            "is_visible": True,
        }

    def _sample_observation(self, when_utc: datetime, satellite: EarthSatellite, observer, ts, eph) -> Dict[str, Any]:
        """Sample observer-relative ISS geometry and visibility at one instant."""
        event_time = ts.from_datetime(when_utc)
        topocentric = (satellite - observer).at(event_time)
        altitude, azimuth, _ = topocentric.altaz()
        altitude_deg = float(altitude.degrees)
        azimuth_deg = float(azimuth.degrees)

        if eph is not None:
            sun_altitude_deg = self._sun_altitude_deg_skyfield(observer, eph, event_time)
            is_sunlit = bool(topocentric.is_sunlit(eph))
        else:
            sun_altitude_deg = self._sun_altitude_deg(when_utc)
            is_sunlit = True

        is_visible = (
            altitude_deg >= MIN_EVENT_ALTITUDE_DEG
            and sun_altitude_deg <= MAX_VISIBLE_SKY_SUN_ALTITUDE_DEG
            and is_sunlit
        )

        return {
            "time_utc": when_utc,
            "altitude_deg": altitude_deg,
            "azimuth_deg": azimuth_deg,
            "sun_altitude_deg": sun_altitude_deg,
            "is_visible": is_visible,
        }

    def _sun_altitude_deg_skyfield(self, observer, eph, event_time) -> float:
        """Compute Sun altitude with Skyfield at observer location."""
        earth = eph["earth"]
        sun = eph["sun"]
        astrometric = (earth + observer).at(event_time).observe(sun)
        altitude, _, _ = astrometric.apparent().altaz()
        return float(altitude.degrees)

    def _group_consecutive_indices(self, indices: List[int]) -> List[List[int]]:
        """Group sorted indices into consecutive runs."""
        if not indices:
            return []

        groups: List[List[int]] = []
        current_group: List[int] = [indices[0]]

        for index in indices[1:]:
            if index == current_group[-1] + 1:
                current_group.append(index)
            else:
                groups.append(current_group)
                current_group = [index]

        groups.append(current_group)
        return groups

    def _azimuth_to_cardinal(self, azimuth_deg: float) -> str:
        """Convert azimuth in degrees to 16-point compass direction."""
        labels = [
            "N", "NNE", "NE", "ENE",
            "E", "ESE", "SE", "SSE",
            "S", "SSW", "SW", "WSW",
            "W", "WNW", "NW", "NNW",
        ]
        normalized = azimuth_deg % 360.0
        index = int((normalized + 11.25) // 22.5) % 16
        return labels[index]

    def _satellite_altitude_deg(self, satellite: EarthSatellite, observer, event_time) -> float:
        """Get ISS altitude (degrees) for a given event time."""
        topocentric = (satellite - observer).at(event_time)
        altitude, _, _ = topocentric.altaz()
        return float(altitude.degrees)

    def _sun_altitude_deg(self, when_utc: datetime) -> float:
        """Compute Sun altitude in degrees for observer at a UTC datetime."""
        astro_time = AstroTime(when_utc)
        frame = AltAz(obstime=astro_time, location=self.location)
        sun_alt = get_sun(astro_time).transform_to(frame).alt
        return float(sun_alt.to_value(u.deg))

    def _classify_day_night(self, sun_altitude_deg: float) -> str:
        """Classify visibility context based on Sun altitude."""
        if sun_altitude_deg <= -18:
            return "Astronomical Night"
        if sun_altitude_deg <= -12:
            return "Nautical Twilight"
        if sun_altitude_deg <= -6:
            return "Civil Twilight"
        if sun_altitude_deg <= 0:
            return "Twilight"
        return "Daylight"

    def _compute_visibility_score(self, peak_altitude_deg: float, duration_minutes: float, sun_altitude_deg: float) -> float:
        """Compute a user-facing visibility score in range 0-100."""
        altitude_component = min(max((peak_altitude_deg - MIN_EVENT_ALTITUDE_DEG) / 70.0, 0.0), 1.0)
        duration_component = min(max(duration_minutes / 10.0, 0.0), 1.0)

        if sun_altitude_deg <= -18:
            lighting_component = 1.0
        elif sun_altitude_deg <= -12:
            lighting_component = 0.8
        elif sun_altitude_deg <= -6:
            lighting_component = 0.55
        elif sun_altitude_deg <= 0:
            lighting_component = 0.35
        else:
            lighting_component = 0.1

        score = (0.65 * altitude_component) + (0.25 * lighting_component) + (0.10 * duration_component)
        return max(0.0, min(100.0, score * 100.0))


def get_iss_passes_report(
    latitude: float,
    longitude: float,
    elevation_m: float,
    timezone_str: str,
    days: int = DEFAULT_FORECAST_DAYS,
) -> Optional[Dict[str, Any]]:
    """Convenience wrapper to generate ISS pass report."""
    try:
        service = ISSPassService(
            latitude=latitude,
            longitude=longitude,
            elevation_m=elevation_m,
            timezone_str=timezone_str,
        )
        return service.get_report(days=days)
    except Exception as e:
        logger.warning(f"Failed to generate ISS passes report: {e}")
        return None
