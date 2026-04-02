"""SkyTonight observability calculator.

Computes, for each target in the dataset, the visibility metrics and
AstroScore for the upcoming astronomical night and writes the results
to a JSON cache file.  The scheduler calls :func:`run_calculations`
once per cycle; the API reads from the cache file rather than
recomputing on every request.
"""

from __future__ import annotations

import math
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
from zoneinfo import ZoneInfo

import numpy as np
import astropy.units as u
from astropy.coordinates import AltAz, EarthLocation, SkyCoord, get_body
from astropy.time import Time

from astroplan.moon import moon_illumination

from constants import SKYTONIGHT_OUTPUT_DIR, SKYTONIGHT_RESULTS_FILE
from logging_config import get_logger
from repo_config import load_config
from skytonight_models import SkyTonightTarget
from skytonight_storage import ensure_skytonight_directories
from skytonight_targets import load_targets_dataset
from sun_phases import SunService
from utils import ensure_directory_exists, load_json_file, save_json_file


logger = get_logger(__name__)

# How many time-steps to generate over the night window for trajectory sampling
_TIME_RESOLUTION_MINUTES = 15

# Minimum number of time steps required to compute meaningful fractions
_MIN_STEPS = 2

# Log a progress line every N deep-sky targets
_DSO_LOG_INTERVAL = 500

# Regex pattern for valid alttime target IDs used in file names
_ALTTIME_ID_SAFE = re.compile(r'[^a-z0-9_-]')


def _alttime_json_path(target_id: str) -> str:
    """Return the full path for a target's altitude-time JSON file."""
    safe_id = _ALTTIME_ID_SAFE.sub('_', target_id.lower())
    return os.path.join(SKYTONIGHT_OUTPUT_DIR, f'{safe_id}_alttime.json')


def _save_alttime_json(
    target_id: str,
    name: str,
    times: Any,
    altitudes: np.ndarray,
    night_start: datetime,
    night_end: datetime,
    constraints: Dict[str, Any],
    timezone_name: str = 'UTC',
) -> bool:
    """Persist altitude-time series for one target to the outputs directory.

    The JSON is consumed by the frontend Chart.js graph rendered on demand
    when the user opens the altitude-vs-time popup for a specific target.
    Only targets that pass visibility constraints are saved; the presence of
    the file is used by the API to indicate that a graph is available.
    """
    try:
        ensure_directory_exists(SKYTONIGHT_OUTPUT_DIR)
        times_iso = [
            t.strftime('%Y-%m-%dT%H:%M:%S')  # type: ignore[attr-defined]
            for t in times.to_datetime(timezone=timezone.utc)
        ]
        payload: Dict[str, Any] = {
            'target_id': target_id,
            'name': name,
            'timezone': timezone_name,
            'night_start': night_start.isoformat(),
            'night_end': night_end.isoformat(),
            'times_utc': times_iso,
            'altitudes': [round(float(a), 2) for a in altitudes],
            'altitude_constraint_min': float(constraints.get('altitude_constraint_min', 30)),
            'altitude_constraint_max': float(constraints.get('altitude_constraint_max', 80)),
        }
        path = _alttime_json_path(target_id)
        return save_json_file(path, payload)
    except Exception as exc:
        logger.debug(f'Failed to save alttime JSON for {target_id}: {exc}')
        return False


def _clear_alttime_files() -> None:
    """Remove all altitude-time JSON files produced by the previous calculation run."""
    try:
        ensure_directory_exists(SKYTONIGHT_OUTPUT_DIR)
        for filename in os.listdir(SKYTONIGHT_OUTPUT_DIR):
            if filename.endswith('_alttime.json'):
                try:
                    os.remove(os.path.join(SKYTONIGHT_OUTPUT_DIR, filename))
                except Exception:
                    pass
    except Exception as exc:
        logger.debug(f'Failed to clear alttime files: {exc}')

# ---------------------------------------------------------------------------
# Module-level calculation progress — updated in-place during run_calculations
# so the scheduler can surface live phase info while calculation runs.
# ---------------------------------------------------------------------------
_calculation_progress: Dict[str, Any] = {}


def get_calculation_progress() -> Dict[str, Any]:
    """Return a snapshot of the current calculation phase information."""
    return dict(_calculation_progress)


def _set_progress(phase: str, processed: int = 0, total: int = 0) -> None:
    """Update the module-level progress dict in place (thread-safe via GIL)."""
    _calculation_progress['phase'] = phase
    _calculation_progress['phase_processed'] = processed
    _calculation_progress['phase_total'] = total
# ---------------------------------------------------------------------------

def _parse_localtime(text: str, tz: ZoneInfo) -> Optional[datetime]:
    text = str(text or '').strip()
    if not text or text == 'Not found':
        return None
    for fmt in ('%Y-%m-%d %H:%M', '%Y-%m-%dT%H:%M'):
        try:
            return datetime.strptime(text, fmt).replace(tzinfo=tz)
        except ValueError:
            pass
    return None


def _normalise(value: float, lo: float, hi: float) -> float:
    if hi <= lo:
        return 0.0
    return max(0.0, min(1.0, (value - lo) / (hi - lo)))


def _angular_separation_deg(ra1: float, dec1: float, ra2: float, dec2: float) -> float:
    """Return angular separation in degrees between two equatorial positions."""
    ra1_r = math.radians(ra1)
    dec1_r = math.radians(dec1)
    ra2_r = math.radians(ra2)
    dec2_r = math.radians(dec2)

    cos_val = (
        math.sin(dec1_r) * math.sin(dec2_r)
        + math.cos(dec1_r) * math.cos(dec2_r) * math.cos(ra1_r - ra2_r)
    )
    # Clamp to [-1, 1] to guard against floating-point drift
    cos_val = max(-1.0, min(1.0, cos_val))
    return math.degrees(math.acos(cos_val))


def _surface_brightness(magnitude: Optional[float], size_arcmin: Optional[float]) -> Optional[float]:
    """Approximate surface brightness from integrated magnitude and angular size."""
    if magnitude is None or size_arcmin is None or size_arcmin <= 0:
        return None
    try:
        surface_area = math.pi * ((size_arcmin / 2.0) ** 2)
        if surface_area <= 0:
            return None
        return magnitude + 2.5 * math.log10(surface_area)
    except (ValueError, ZeroDivisionError):
        return None


# ---------------------------------------------------------------------------
# Night window detection
# ---------------------------------------------------------------------------

def _get_night_window(
    lat: float,
    lon: float,
    timezone_name: str,
) -> Optional[Tuple[datetime, datetime]]:
    """Return (dusk, dawn) for tonight's astronomical night; None if no night."""
    tz = ZoneInfo(timezone_name)
    sun_service = SunService(latitude=lat, longitude=lon, timezone=timezone_name)
    report = sun_service.get_today_report()

    dusk = _parse_localtime(report.astronomical_dusk, tz)
    dawn = _parse_localtime(report.astronomical_dawn, tz)

    if dusk is None or dawn is None:
        return None
    if dawn <= dusk:
        # Dusk already past — try tomorrow
        report_tomorrow = sun_service.get_tomorrow_report()
        dusk = _parse_localtime(report_tomorrow.astronomical_dusk, tz)
        dawn = _parse_localtime(report_tomorrow.astronomical_dawn, tz)

    if dusk is None or dawn is None or dawn <= dusk:
        return None

    return dusk, dawn


# ---------------------------------------------------------------------------
# Per-target computation
# ---------------------------------------------------------------------------

def _sample_times(night_start: datetime, night_end: datetime) -> Time:
    """Return an Astropy Time array sampled at fixed intervals over the night."""
    total_minutes = (night_end - night_start).total_seconds() / 60.0
    n_steps = max(_MIN_STEPS, int(total_minutes // _TIME_RESOLUTION_MINUTES) + 1)
    step_minutes = total_minutes / (n_steps - 1)

    times_utc = [
        night_start + timedelta(minutes=i * step_minutes)
        for i in range(n_steps)
    ]
    # Astropy isot format requires bare UTC strings without timezone offset (e.g.
    # "2026-04-01T20:00:00.000"), so strip the "+00:00" suffix produced by isoformat().
    iso_strings = [
        t.astimezone(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000')
        for t in times_utc
    ]
    return Time(iso_strings, format='isot', scale='utc')


def _compute_altaz_series(
    ra_hours: float,
    dec_degrees: float,
    times: Any,
    location: EarthLocation,
) -> np.ndarray:
    """Return array of altitude values (degrees) for the target over 'times'."""
    coord = SkyCoord(ra=ra_hours * u.hourangle, dec=dec_degrees * u.deg, frame='icrs')
    frame = AltAz(obstime=times, location=location)
    altaz = coord.transform_to(frame)
    return altaz.alt.deg  # type: ignore[return-value]


def _compute_body_altaz_series(
    body_name: str,
    times: Any,
    location: EarthLocation,
) -> Tuple[np.ndarray, np.ndarray, float, float]:
    """Return (alt_deg, az_deg, ra_hours_mid, dec_degrees_mid) for a solar system body.

    Uses astropy's built-in ephemeris so positions are accurate for the current date.
    The RA/Dec mid-night values are returned for display in the More popup.
    """
    frame = AltAz(obstime=times, location=location)
    body_coord = get_body(body_name.lower(), times, location)
    altaz = body_coord.transform_to(frame)
    alt_deg: np.ndarray = altaz.alt.deg  # type: ignore[assignment]
    az_deg: np.ndarray = altaz.az.deg  # type: ignore[assignment]

    # RA/Dec at night midpoint for display
    mid_idx = len(times) // 2
    mid_coord = get_body(body_name.lower(), times[mid_idx], location)
    ra_hours_mid = float(mid_coord.ra.hour)  # type: ignore[attr-defined]
    dec_degrees_mid = float(mid_coord.dec.deg)  # type: ignore[attr-defined]

    return alt_deg, az_deg, ra_hours_mid, dec_degrees_mid


def _meridian_transit_time(
    ra_hours: float,
    night_start: datetime,
    night_end: datetime,
    lat: float,
    lon: float,
) -> Optional[str]:
    """
    Approximate meridian transit time (local sidereal time equals target RA).

    We use a simple linear search because precision at the minute level is
    sufficient for the display field.
    """
    try:
        tz = night_start.tzinfo
        location = EarthLocation(lat=lat * u.deg, lon=lon * u.deg)
        step = timedelta(minutes=_TIME_RESOLUTION_MINUTES)
        current = night_start

        prev_hour_angle: Optional[float] = None

        while current <= night_end:
            utc_moment = current.astimezone(timezone.utc)
            t = Time(utc_moment.strftime('%Y-%m-%dT%H:%M:%S.000'), format='isot', scale='utc')
            lst_hours = float(t.sidereal_time('apparent', longitude=location.lon).hour)  # type: ignore[attr-defined]
            ha = ((lst_hours - ra_hours + 12.0) % 24.0) - 12.0  # [-12, +12]

            if prev_hour_angle is not None and prev_hour_angle < 0.0 <= ha:
                return current.strftime('%H:%M')

            prev_hour_angle = float(ha)
            current += step

        return None
    except Exception as exc:
        logger.debug(f'Meridian transit estimation failed: {exc}')
        return None


def _antimeridian_transit_time(
    ra_hours: float,
    night_start: datetime,
    night_end: datetime,
    lat: float,
    lon: float,
) -> Optional[str]:
    """Approximate antimeridian transit (HA = ±12 h)."""
    try:
        location = EarthLocation(lat=lat * u.deg, lon=lon * u.deg)
        anti_ra = (ra_hours + 12.0) % 24.0
        step = timedelta(minutes=_TIME_RESOLUTION_MINUTES)
        current = night_start
        prev_hour_angle: Optional[float] = None

        while current <= night_end:
            utc_moment = current.astimezone(timezone.utc)
            t = Time(utc_moment.strftime('%Y-%m-%dT%H:%M:%S.000'), format='isot', scale='utc')
            lst_hours = float(t.sidereal_time('apparent', longitude=location.lon).hour)  # type: ignore[attr-defined]
            ha = ((lst_hours - anti_ra + 12.0) % 24.0) - 12.0

            if prev_hour_angle is not None and prev_hour_angle < 0.0 <= ha:
                return current.strftime('%H:%M')

            prev_hour_angle = float(ha)
            current += step

        return None
    except Exception as exc:
        logger.debug(f'Antimeridian transit estimation failed: {exc}')
        return None


class _MoonInfo:
    """Cached moon properties for one night session."""

    def __init__(self, times: Any, location: EarthLocation) -> None:
        self.phase: float = 0.0  # 0 = new, 1 = full
        self.ra_deg: Optional[float] = None
        self.dec_deg: Optional[float] = None
        self._compute(times, location)

    def _compute(self, times: Any, location: EarthLocation) -> None:
        try:
            mid_time = times[len(times) // 2]
            illum = moon_illumination(mid_time)
            self.phase = float(illum)

            moon_coord = get_body('moon', mid_time, location)
            self.ra_deg = float(moon_coord.ra.deg)  # type: ignore[attr-defined]
            self.dec_deg = float(moon_coord.dec.deg)  # type: ignore[attr-defined]
        except Exception as exc:
            logger.debug(f'Moon info computation failed: {exc}')


# ---------------------------------------------------------------------------
# AstroScore calculation
# ---------------------------------------------------------------------------

def compute_astro_score(
    *,
    max_altitude: float,
    observable_hours: float,
    meridian_altitude: float,
    moon_phase: float,
    angular_distance_moon: Optional[float],
    magnitude: Optional[float],
    size_arcmin: Optional[float],
    observable_hours_in_window: float,
    window_start_hour: int,
    is_messier: bool = False,
    is_planet: bool = False,
    is_opposition: bool = False,
) -> float:
    """
    Compute AstroScore on [0, 1] for astrophotography suitability.

    Score components
    ----------------
    score_visibility  (weight 0.40):
        Combines peak altitude, observable hours, and meridian altitude.

    score_sky  (weight 0.25):
        Moon phase + angular distance from moon.

    score_object  (weight 0.25):
        Surface brightness proxy using magnitude + apparent size.

    score_comfort  (weight 0.10):
        Penalises targets only observable in inconvenient late-night hours.

    Bonuses applied after normalisation:
        +0.20 for planet at opposition, capped at 1.0.
        +0.05 for Messier objects (high visual reward).
    """
    # --- score_visibility ---
    sv = (
        0.5 * _normalise(max_altitude, 20.0, 90.0)
        + 0.3 * _normalise(observable_hours, 0.0, 8.0)
        + 0.2 * _normalise(meridian_altitude, 20.0, 90.0)
    )

    # --- score_sky ---
    moon_distance_used = angular_distance_moon if angular_distance_moon is not None else 180.0
    moon_impact = moon_phase * (1.0 - moon_distance_used / 180.0)
    sky_score = max(0.0, 1.0 - moon_impact)

    # --- score_object ---
    sb = _surface_brightness(magnitude, size_arcmin)
    if sb is not None:
        obj_score = _normalise(sb, 12.0, 22.0)
        # Invert: lower surface-brightness number → brighter/easier → higher score
        obj_score = 1.0 - obj_score
    else:
        # No magnitude/size data — neutral contribution
        obj_score = 0.5

    # --- score_comfort ---
    # Reward targets that transit during prime evening hours (21:00–01:00)
    if 21 <= window_start_hour or window_start_hour <= 1:
        time_bonus = 1.0
    elif 1 < window_start_hour <= 3:
        time_bonus = 0.5
    else:
        time_bonus = 0.0

    comfort_score = (
        0.5 * _normalise(observable_hours_in_window, 0.0, 6.0)
        + 0.5 * time_bonus
    )

    # --- Weighted sum ---
    score = (
        0.40 * sv
        + 0.25 * sky_score
        + 0.25 * obj_score
        + 0.10 * comfort_score
    )

    # --- Bonuses ---
    if is_opposition and is_planet:
        score += 0.20
    if is_messier:
        score += 0.05

    return round(min(1.0, max(0.0, score)), 4)


# ---------------------------------------------------------------------------
# Per-target result builder
# ---------------------------------------------------------------------------

def _compute_target_result(
    target: SkyTonightTarget,
    times: Any,
    altaz_values: np.ndarray,
    location: EarthLocation,
    moon: _MoonInfo,
    constraints: Dict[str, Any],
    night_start: datetime,
    night_end: datetime,
    lat: float,
    lon: float,
) -> Optional[Dict[str, Any]]:
    """Return a computed result dict for one target, or None if not visible."""
    if target.coordinates is None:
        return None

    ra_hours = target.coordinates.ra_hours
    dec_degrees = target.coordinates.dec_degrees

    alt_min = float(constraints.get('altitude_constraint_min', 30))
    alt_max = float(constraints.get('altitude_constraint_max', 80))
    moon_sep_min = float(constraints.get('moon_separation_min', 45))
    size_min = float(constraints.get('size_constraint_min', 10))
    size_max = float(constraints.get('size_constraint_max', 300))
    frac_threshold = float(constraints.get('fraction_of_time_observable_threshold', 0.5))
    moon_use_illum = bool(constraints.get('moon_separation_use_illumination', True))
    north_to_east_ccw = bool(constraints.get('north_to_east_ccw', False))

    # Derive the effective altitude floor from the airmass constraint:
    # airmass = 1 / sin(altitude)  =>  altitude = arcsin(1 / airmass)
    # Use the stricter of the two limits.
    airmass_constr = float(constraints.get('airmass_constraint', 2.0))
    if airmass_constr >= 1.0:
        alt_from_airmass = math.degrees(math.asin(min(1.0, 1.0 / airmass_constr)))
        alt_min = max(alt_min, alt_from_airmass)

    # --- Size filter for DSOs ---
    if target.category == 'deep_sky' and target.size_arcmin is not None:
        if target.size_arcmin < size_min or target.size_arcmin > size_max:
            return None

    # --- Moon separation filter ---
    if moon.ra_deg is not None and moon.dec_deg is not None:
        ang_sep = _angular_separation_deg(
            ra_hours * 15.0,  # convert h to degrees
            dec_degrees,
            moon.ra_deg,
            moon.dec_deg,
        )
        # When moon_separation_use_illumination is enabled, the minimum
        # separation (in degrees) equals the moon illumination percentage:
        #   1% illumination = 1° minimum separation (overrides moon_sep_min).
        # At new moon (phase≈0) any target is accepted; at full moon (phase=1)
        # the threshold is 100°, providing a strong natural filter.
        effective_min_sep = moon_sep_min
        if moon_use_illum:
            effective_min_sep = moon.phase * 100.0
        if ang_sep < effective_min_sep:
            return None
        angular_distance_moon: Optional[float] = ang_sep
    else:
        angular_distance_moon = None

    # --- Altitude-based observable fraction ---
    total_steps = len(altaz_values)
    if total_steps < _MIN_STEPS:
        return None

    # Steps where target is within [alt_min, alt_max]
    in_window_mask = (altaz_values >= alt_min) & (altaz_values <= alt_max)
    observable_steps = int(np.sum(in_window_mask))
    observable_fraction = observable_steps / total_steps

    if observable_fraction < frac_threshold:
        return None

    max_altitude = float(np.max(altaz_values))
    if max_altitude < alt_min:
        return None

    # Altitude at peak (meridian altitude approximation)
    peak_idx = int(np.argmax(altaz_values))
    meridian_altitude = float(altaz_values[peak_idx])

    # At the peak time, also record AZ
    peak_az_deg: Optional[float] = None
    try:
        peak_time = times[peak_idx : peak_idx + 1]
        coord = SkyCoord(ra=ra_hours * u.hourangle, dec=dec_degrees * u.deg, frame='icrs')
        frame = AltAz(obstime=peak_time, location=location)
        peak_altaz = coord.transform_to(frame)
        az_cw = float(peak_altaz.az.deg[0])  # type: ignore[index]
        # north_to_east_ccw: azimuth increases CCW (N top, E left)
        # Standard astropy/altaz az increases CW (N top, E right)
        peak_az_deg = round((360.0 - az_cw) % 360.0 if north_to_east_ccw else az_cw, 1)
    except Exception:
        pass

    # Observable hours
    night_hours = (night_end - night_start).total_seconds() / 3600.0
    observable_hours = night_hours * observable_fraction

    # Determine the hour of the night when the target starts being observable
    # to compute the "comfort" scoring window.
    first_obs_idx = next((i for i, v in enumerate(in_window_mask) if v), None)
    if first_obs_idx is not None:
        first_obs_time = night_start + timedelta(
            minutes=first_obs_idx * _TIME_RESOLUTION_MINUTES
        )
        window_start_hour = first_obs_time.hour
    else:
        window_start_hour = night_start.hour

    # Messier check
    is_messier = 'Messier' in (target.catalogue_names or {})

    # Meridian / antimeridian times
    meridian_time = _meridian_transit_time(ra_hours, night_start, night_end, lat, lon)
    antimeridian_time = _antimeridian_transit_time(ra_hours, night_start, night_end, lat, lon)

    # RA/Dec in HMS/DMS
    ra_hms = _hours_to_hms(ra_hours)
    dec_dms = _degrees_to_dms(dec_degrees)

    astro_score = compute_astro_score(
        max_altitude=max_altitude,
        observable_hours=observable_hours,
        meridian_altitude=meridian_altitude,
        moon_phase=moon.phase,
        angular_distance_moon=angular_distance_moon,
        magnitude=target.magnitude,
        size_arcmin=target.size_arcmin,
        observable_hours_in_window=observable_hours,
        window_start_hour=window_start_hour,
        is_messier=is_messier,
        is_planet=(target.object_type or '').lower() == 'planet',
        is_opposition=False,
    )

    return {
        'target_id': target.target_id,
        'preferred_name': target.preferred_name,
        'catalogue_names': target.catalogue_names,
        'category': target.category,
        'object_type': target.object_type,
        'constellation': target.constellation,
        'magnitude': target.magnitude,
        'size_arcmin': target.size_arcmin,
        'coordinates': {
            'ra_hours': ra_hours,
            'dec_degrees': dec_degrees,
        },
        'observation': {
            'max_altitude': round(max_altitude, 1),
            'azimuth': peak_az_deg,
            'observable_fraction': round(observable_fraction, 3),
            'observable_hours': round(observable_hours, 2),
            'meridian_transit': meridian_time,
            'antimeridian_transit': antimeridian_time,
            'ra_hms': ra_hms,
            'dec_dms': dec_dms,
        },
        'astro_score': astro_score,
        'moon_angular_distance': round(angular_distance_moon, 1) if angular_distance_moon is not None else None,
        'source_catalogues': target.source_catalogues,
        'metadata': target.metadata,
    }


def _compute_body_result(
    target: SkyTonightTarget,
    times: Any,
    location: EarthLocation,
    moon: _MoonInfo,
    constraints: Dict[str, Any],
    night_start: datetime,
    night_end: datetime,
    lat: float,
    lon: float,
) -> Tuple[Optional[Dict[str, Any]], Optional[np.ndarray]]:
    """Compute visibility for a solar system body using live ephemeris positions.

    Returns a tuple of (result_dict, alt_deg_array).  Both elements are None
    when the body is not observable tonight.  The alt_deg array is used by the
    caller to persist the altitude-time graph JSON for the frontend chart.

    Bodies do not have static coordinates — their positions are calculated from
    astropy's built-in ephemeris at each time step.  Constraints are relaxed
    compared to DSOs: no moon-separation filter (planets can be near the moon)
    and a lower observable-fraction threshold.
    """
    body_name = target.preferred_name
    try:
        alt_deg, az_deg, ra_hours, dec_degrees = _compute_body_altaz_series(
            body_name, times, location
        )
    except Exception as exc:
        logger.debug(f'Body AltAz computation failed for {body_name}: {exc}')
        return None, None

    alt_min = float(constraints.get('altitude_constraint_min', 30))
    north_to_east_ccw = bool(constraints.get('north_to_east_ccw', False))
    frac_threshold = float(constraints.get('fraction_of_time_observable_threshold', 0.5))

    # Derive effective altitude floor from airmass constraint (stricter wins).
    airmass_constr = float(constraints.get('airmass_constraint', 2.0))
    if airmass_constr >= 1.0:
        alt_from_airmass = math.degrees(math.asin(min(1.0, 1.0 / airmass_constr)))
        alt_min = max(alt_min, alt_from_airmass)

    # Don't apply alt_max clamp for bodies — planets can reach high altitudes
    night_hours = (night_end - night_start).total_seconds() / 3600.0
    total_steps = len(alt_deg)
    if total_steps < _MIN_STEPS:
        return None, None

    in_window_mask = (alt_deg >= alt_min)
    observable_steps = int(np.sum(in_window_mask))
    observable_fraction = observable_steps / total_steps

    if observable_fraction < frac_threshold:
        return None, None

    max_altitude = float(np.max(alt_deg))
    if max_altitude < alt_min:
        return None, None

    peak_idx = int(np.argmax(alt_deg))
    meridian_altitude = float(alt_deg[peak_idx])
    az_cw = float(az_deg[peak_idx])
    peak_az_deg = round((360.0 - az_cw) % 360.0 if north_to_east_ccw else az_cw, 1)

    observable_hours = night_hours * observable_fraction

    first_obs_idx = next((i for i, v in enumerate(in_window_mask) if v), None)
    window_start_hour = (
        (night_start + timedelta(minutes=first_obs_idx * _TIME_RESOLUTION_MINUTES)).hour
        if first_obs_idx is not None
        else night_start.hour
    )

    # Moon angular separation (informational only for bodies, not a filter)
    angular_distance_moon: Optional[float] = None
    if moon.ra_deg is not None and moon.dec_deg is not None:
        ang_sep = _angular_separation_deg(
            ra_hours * 15.0, dec_degrees, moon.ra_deg, moon.dec_deg
        )
        angular_distance_moon = ang_sep

    meridian_time = _meridian_transit_time(ra_hours, night_start, night_end, lat, lon)
    antimeridian_time = _antimeridian_transit_time(ra_hours, night_start, night_end, lat, lon)
    ra_hms = _hours_to_hms(ra_hours)
    dec_dms = _degrees_to_dms(dec_degrees)

    astro_score = compute_astro_score(
        max_altitude=max_altitude,
        observable_hours=observable_hours,
        meridian_altitude=meridian_altitude,
        moon_phase=moon.phase,
        angular_distance_moon=angular_distance_moon,
        magnitude=target.magnitude,
        size_arcmin=None,
        observable_hours_in_window=observable_hours,
        window_start_hour=window_start_hour,
        is_messier=False,
        is_planet=(target.object_type or '').lower() == 'planet',
        is_opposition=False,
    )

    return {
        'target_id': target.target_id,
        'preferred_name': target.preferred_name,
        'catalogue_names': target.catalogue_names,
        'category': target.category,
        'object_type': target.object_type,
        'constellation': '',
        'magnitude': target.magnitude,
        'size_arcmin': None,
        'coordinates': {'ra_hours': round(ra_hours, 6), 'dec_degrees': round(dec_degrees, 6)},
        'observation': {
            'max_altitude': round(max_altitude, 1),
            'azimuth': peak_az_deg,
            'observable_fraction': round(observable_fraction, 3),
            'observable_hours': round(observable_hours, 2),
            'meridian_transit': meridian_time,
            'antimeridian_transit': antimeridian_time,
            'ra_hms': ra_hms,
            'dec_dms': dec_dms,
        },
        'astro_score': astro_score,
        'moon_angular_distance': round(angular_distance_moon, 1) if angular_distance_moon is not None else None,
        'source_catalogues': target.source_catalogues,
        'metadata': target.metadata,
    }, alt_deg


def _hours_to_hms(hours: float) -> str:
    total_seconds = hours * 3600.0
    h = int(total_seconds // 3600)
    remaining = total_seconds - h * 3600
    m = int(remaining // 60)
    s = remaining - m * 60
    return f'{h:02d}h {m:02d}m {s:05.2f}s'


def _degrees_to_dms(degrees: float) -> str:
    sign = '' if degrees >= 0 else '-'
    d = abs(degrees)
    d_int = int(d)
    remaining = (d - d_int) * 60
    m_int = int(remaining)
    s = (remaining - m_int) * 60
    return f'{sign}{d_int:02d}° {m_int:02d}\' {s:05.2f}"'


# ---------------------------------------------------------------------------
# Main calculation runner
# ---------------------------------------------------------------------------

def run_calculations(
    config: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Compute observability and AstroScore for all visible targets.

    Writes results to :data:`~constants.SKYTONIGHT_RESULTS_FILE`.

    Parameters
    ----------
    config:
        Merged application config dict.  If *None*, it is loaded internally.

    Returns
    -------
    dict
        Summary with metadata and per-category counts.
    """
    ensure_skytonight_directories()

    if config is None:
        config = load_config()

    location = config.get('location', {}) if isinstance(config, dict) else {}
    lat = float(location.get('latitude') or 0.0)
    lon = float(location.get('longitude') or 0.0)
    elevation = float(location.get('elevation') or 0.0)
    timezone_name = str(location.get('timezone') or 'UTC')
    location_name = str(location.get('name') or 'default-location')

    skytonight_cfg = config.get('skytonight', {}) if isinstance(config, dict) else {}
    constraints: Dict[str, Any] = skytonight_cfg.get('constraints', {})

    logger.info(f'SkyTonight calculations starting for location: {location_name}')
    _set_progress('night_window')

    # --- Determine astronomical night window ---
    night_window = _get_night_window(lat, lon, timezone_name)
    if night_window is None:
        logger.warning('No astronomical night found for tonight; SkyTonight calculations skipped.')
        payload: Dict[str, Any] = {
            'metadata': {
                'calculated_at': datetime.now(timezone.utc).isoformat(),
                'location_name': location_name,
                'latitude': lat,
                'longitude': lon,
                'elevation': elevation,
                'timezone': timezone_name,
                'night_start': None,
                'night_end': None,
                'night_hours': 0.0,
                'moon_phase': 0.0,
                'counts': {'deep_sky': 0, 'bodies': 0, 'comets': 0},
            },
            'deep_sky': [],
            'bodies': [],
            'comets': [],
        }
        save_json_file(SKYTONIGHT_RESULTS_FILE, payload)
        return {'counts': {'deep_sky': 0, 'bodies': 0, 'comets': 0}, 'night_found': False}

    night_start, night_end = night_window
    night_hours = (night_end - night_start).total_seconds() / 3600.0

    logger.info(
        f'Night window: {night_start.strftime("%Y-%m-%d %H:%M %Z")} → '
        f'{night_end.strftime("%Y-%m-%d %H:%M %Z")} ({night_hours:.1f}h)'
    )
    _set_progress('loading_dataset')
    # --- Load targets dataset ---
    dataset = load_targets_dataset()
    all_targets: List[SkyTonightTarget] = []
    for raw in dataset.get('targets', []):
        if isinstance(raw, SkyTonightTarget):
            all_targets.append(raw)
        elif isinstance(raw, dict):
            try:
                from skytonight_models import SkyTonightTarget as ST
                all_targets.append(ST.from_dict(raw))
            except Exception:
                pass

    if not all_targets:
        logger.warning('SkyTonight dataset is empty; no calculations to perform.')

    # Pre-count targets by category for progress reporting
    n_bodies = sum(1 for t in all_targets if t.category == 'bodies')
    n_deep_sky = sum(1 for t in all_targets if t.category == 'deep_sky')
    n_comets = sum(1 for t in all_targets if t.category == 'comets')
    logger.info(f'Targets to process: {n_deep_sky} DSOs, {n_bodies} bodies, {n_comets} comets')
    _set_progress('moon_init')

    # --- Shared resources ---
    location_obj = EarthLocation(lat=lat * u.deg, lon=lon * u.deg, height=elevation * u.m)
    times = _sample_times(night_start, night_end)
    moon = _MoonInfo(times, location_obj)

    logger.info(
        f'Moon phase: {moon.phase:.2f} '
        f'(RA={moon.ra_deg:.1f}°, Dec={moon.dec_deg:.1f}°)'
        if moon.ra_deg is not None else f'Moon phase: {moon.phase:.2f}'
    )

    # --- Compute per-target results ---
    deep_sky_results: List[Dict[str, Any]] = []
    bodies_results: List[Dict[str, Any]] = []
    comets_results: List[Dict[str, Any]] = []

    processed_deep_sky = 0
    processed_bodies = 0
    processed_comets = 0
    _set_progress('deep_sky', 0, n_deep_sky)

    # Clear altitude-time JSON files from the previous calculation run so stale
    # files are never served after a recalculation for a different night.
    _clear_alttime_files()

    for target in all_targets:
        if target.category == 'bodies':
            if processed_bodies == 0:
                _set_progress('bodies', 0, n_bodies)
            # Bodies (planets, Moon) have no static coordinates — use live ephemeris
            body_result, body_alt_deg = _compute_body_result(
                target=target,
                times=times,
                location=location_obj,
                moon=moon,
                constraints=constraints,
                night_start=night_start,
                night_end=night_end,
                lat=lat,
                lon=lon,
            )
            if body_result is not None:
                bodies_results.append(body_result)
                if body_alt_deg is not None:
                    _save_alttime_json(
                        target_id=target.target_id,
                        name=body_result.get('preferred_name', target.target_id),
                        times=times,
                        altitudes=body_alt_deg,
                        night_start=night_start,
                        night_end=night_end,
                        constraints=constraints,
                        timezone_name=timezone_name,
                    )
            processed_bodies += 1
            _set_progress('bodies', processed_bodies, n_bodies)
            continue

        if target.coordinates is None:
            continue

        try:
            altaz_values = _compute_altaz_series(
                ra_hours=target.coordinates.ra_hours,
                dec_degrees=target.coordinates.dec_degrees,
                times=times,
                location=location_obj,
            )
        except Exception as exc:
            logger.debug(f'AltAz computation failed for {target.target_id}: {exc}')
            continue

        result = _compute_target_result(
            target=target,
            times=times,
            altaz_values=altaz_values,
            location=location_obj,
            moon=moon,
            constraints=constraints,
            night_start=night_start,
            night_end=night_end,
            lat=lat,
            lon=lon,
        )
        if result is None:
            continue

        # Target is visible — persist altitude-time JSON for the frontend graph
        _save_alttime_json(
            target_id=target.target_id,
            name=result.get('preferred_name', target.target_id),
            times=times,
            altitudes=altaz_values,
            night_start=night_start,
            night_end=night_end,
            constraints=constraints,
            timezone_name=timezone_name,
        )

        if target.category == 'deep_sky':
            deep_sky_results.append(result)
            processed_deep_sky += 1
            if processed_deep_sky % _DSO_LOG_INTERVAL == 0:
                logger.info(f'SkyTonight progress: DSO {processed_deep_sky}/{n_deep_sky}')
            _set_progress('deep_sky', processed_deep_sky, n_deep_sky)
        elif target.category == 'comets':
            if processed_comets == 0:
                _set_progress('comets', 0, n_comets)
            comets_results.append(result)
            processed_comets += 1
            _set_progress('comets', processed_comets, n_comets)

    # Sort by AstroScore descending
    _set_progress('saving')
    deep_sky_results.sort(key=lambda r: r['astro_score'], reverse=True)
    bodies_results.sort(key=lambda r: r['astro_score'], reverse=True)
    comets_results.sort(key=lambda r: r['astro_score'], reverse=True)

    counts = {
        'deep_sky': len(deep_sky_results),
        'bodies': len(bodies_results),
        'comets': len(comets_results),
    }

    payload = {
        'metadata': {
            'calculated_at': datetime.now(timezone.utc).isoformat(),
            'location_name': location_name,
            'latitude': lat,
            'longitude': lon,
            'elevation': elevation,
            'timezone': timezone_name,
            'night_start': night_start.isoformat(),
            'night_end': night_end.isoformat(),
            'night_hours': round(night_hours, 2),
            'moon_phase': round(moon.phase, 4),
            'counts': counts,
            'constraints': constraints,
        },
        'deep_sky': deep_sky_results,
        'bodies': bodies_results,
        'comets': comets_results,
    }

    save_json_file(SKYTONIGHT_RESULTS_FILE, payload)
    _calculation_progress.clear()

    logger.info(
        f'SkyTonight calculations done: '
        f'{counts["deep_sky"]} DSOs, {counts["bodies"]} bodies, {counts["comets"]} comets.'
    )

    return {'counts': counts, 'night_found': True, 'night_start': night_start.isoformat(), 'night_end': night_end.isoformat()}


def load_calculation_results() -> Dict[str, Any]:
    """Load the latest SkyTonight calculation cache from disk."""
    return load_json_file(SKYTONIGHT_RESULTS_FILE, default={})
