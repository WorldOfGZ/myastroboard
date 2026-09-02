"""Target visibility calendar - best months to image a fixed deep-sky target.

Answers "when is this object best this year?" for the user's active location by sampling
two nights per month across a 12-month horizon and, for each, computing how many dark /
observable / moonless hours the target spends above the configured altitude floor and
custom horizon profile.

Deep-sky (fixed-coordinate) targets only: planets and comets move measurably over a year,
so a fixed-RA calendar would be meaningless for them - those return ``supported: False``.

Design notes
------------
* The night grid (Sun + Moon altitudes, Moon illumination) reuses
  :func:`astroweather.moon_planner.night_body_altitude_grid` so this module, the Moon
  planner and the SkyTonight pipeline all build it the same way.
* The target's own altitude/azimuth is computed analytically from the hour angle
  (``H = LST - RA``) rather than with a per-target frame transform - arcminute accuracy at
  O(1) trig per sample, far beyond what a monthly heatmap needs.
* The altitude/airmass/horizon gates match the live SkyTonight calculator so the calendar
  never disagrees with what SkyTonight reports for tonight.
* Results are cached in a small bounded in-process LRU keyed
  ``(identifier, location_id, year)`` - deliberately NOT a scheduler cache job, since the
  key space (any target x any location) is unbounded and the underlying ephemeris changes
  only once a year.
"""

from __future__ import annotations

import math
from collections import OrderedDict
from datetime import date, timezone
from typing import Any, Dict, List, Optional, Tuple
from zoneinfo import ZoneInfo

import numpy as np
import astropy.units as u

from astroweather.moon_planner import night_body_altitude_grid
from observation import object_info
from skytonight import skytonight_targets
from skytonight.skytonight_calculator import _horizon_floor_array
from skytonight.skytonight_targets import normalize_object_name
from utils import distant_epoch_precision_warnings_muted
from utils.logging_config import get_logger
from utils.repo_config import load_config

logger = get_logger(__name__)

_ASTRO_NIGHT_SUN_ALT = -18.0
_SAMPLE_DAYS: Tuple[int, ...] = (1, 15)
_MONTHS: Tuple[int, ...] = tuple(range(1, 13))
_STEP_MINUTES = 10
_MAX_CACHE_ENTRIES = 256
# How far the year selector may reach. Kept modest: further out is a less useful
# planning horizon, and beyond ~1 year the IERS Earth-orientation table only
# extrapolates (handled by distant_epoch_precision_warnings_muted below).
YEAR_OFFSET_MIN = -1
YEAR_OFFSET_MAX = 2

# Categories / SIMBAD object-type tokens that move over a year - unsupported.
_UNSUPPORTED_CATEGORIES = {'bodies', 'comets'}
_UNSUPPORTED_OTYPE_TOKENS = ('planet', 'comet', 'asteroid', 'moon', 'minor')

_calendar_cache: "OrderedDict[Tuple[str, Optional[str], int], Dict[str, Any]]" = OrderedDict()


def clear_cache() -> None:
    """Drop every cached calendar (used by tests and after a dataset rebuild)."""
    _calendar_cache.clear()


def _resolve_target(identifier: str) -> Dict[str, Any]:
    """Resolve *identifier* to equatorial coordinates (degrees) plus display metadata.

    The result always carries ``supported`` (bool). When supported it also has
    ``target_id``, ``name``, ``object_type``, ``ra_deg`` and ``dec_deg``. When not, it
    carries ``reason`` (``'moving_target'`` or ``'not_found'``).
    """
    wanted = normalize_object_name(identifier)
    if not wanted:
        return {'supported': False, 'reason': 'not_found', 'name': identifier}

    dataset = skytonight_targets.load_targets_dataset()
    targets = dataset.get('targets', []) if isinstance(dataset, dict) else []
    match = None
    for target in targets:
        if target.target_id == identifier:
            match = target
            break
        candidates = list(target.catalogue_names.values()) + list(target.aliases)
        if target.preferred_name:
            candidates.append(target.preferred_name)
        if any(name and normalize_object_name(name) == wanted for name in candidates):
            match = target
            break

    if match is not None:
        name = match.preferred_name or identifier
        if match.category in _UNSUPPORTED_CATEGORIES:
            return {
                'supported': False,
                'reason': 'moving_target',
                'name': name,
                'target_id': match.target_id,
                'object_type': match.object_type,
            }
        if match.coordinates is None:
            return {'supported': False, 'reason': 'not_found', 'name': name, 'target_id': match.target_id}
        return {
            'supported': True,
            'target_id': match.target_id,
            'name': name,
            'object_type': match.object_type,
            'ra_deg': match.coordinates.ra_hours * 15.0,
            'dec_deg': match.coordinates.dec_degrees,
        }

    # Fallback: SIMBAD - covers Astrodex items outside the SkyTonight dataset.
    resolved = object_info._resolve_via_simbad(identifier)
    if not resolved or resolved.get('ra') is None or resolved.get('dec') is None:
        return {'supported': False, 'reason': 'not_found', 'name': identifier}
    object_type = str(resolved.get('type') or '')
    if any(token in object_type.lower() for token in _UNSUPPORTED_OTYPE_TOKENS):
        return {'supported': False, 'reason': 'moving_target', 'name': resolved.get('name') or identifier}
    return {
        'supported': True,
        'target_id': str(resolved.get('id') or identifier),
        'name': str(resolved.get('name') or identifier),
        'object_type': object_type,
        'ra_deg': float(resolved['ra']),
        'dec_deg': float(resolved['dec']),
    }


def _target_altaz(
    ra_deg: float,
    dec_deg: float,
    lat_deg: float,
    lst_hours: np.ndarray,
) -> Tuple[np.ndarray, np.ndarray]:
    """Analytic (alt, az) in degrees for a fixed target over a precomputed LST array.

    ``az`` is measured from north, increasing clockwise (0 = N, 90 = E), matching the
    convention the horizon profile is stored in.
    """
    ra_hours = ra_deg / 15.0
    ha_hours = ((lst_hours - ra_hours + 12.0) % 24.0) - 12.0
    ha_rad = np.radians(ha_hours * 15.0)

    lat_rad = math.radians(lat_deg)
    dec_rad = math.radians(dec_deg)

    sin_alt = math.sin(dec_rad) * math.sin(lat_rad) + math.cos(dec_rad) * math.cos(lat_rad) * np.cos(ha_rad)
    sin_alt = np.clip(sin_alt, -1.0, 1.0)
    alt = np.degrees(np.arcsin(sin_alt))

    cos_alt = np.cos(np.radians(alt))
    denom = cos_alt * math.cos(lat_rad)
    with np.errstate(divide='ignore', invalid='ignore'):
        cos_az = np.where(
            np.abs(denom) < 1e-9,
            1.0,
            (math.sin(dec_rad) - sin_alt * math.sin(lat_rad)) / denom,
        )
    cos_az = np.clip(cos_az, -1.0, 1.0)
    az = np.degrees(np.arccos(cos_az))
    az = np.where(np.sin(ha_rad) > 0.0, 360.0 - az, az)
    return alt, az


def _sample_night(
    ra_deg: float,
    dec_deg: float,
    lat_deg: float,
    lon_deg: float,
    timezone_name: str,
    night_date: date,
    alt_min: float,
    alt_max: float,
    horizon_profile: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Compute one sample night's dark / observable / moonless hours for the target."""
    grid = night_body_altitude_grid(lat_deg, lon_deg, timezone_name, night_date, step_minutes=_STEP_MINUTES)
    times = grid['time']
    sun_alt = np.asarray(grid['sun_alt_deg'])
    moon_alt = np.asarray(grid['moon_alt_deg'])

    lst_hours = np.asarray(times.sidereal_time('apparent', longitude=lon_deg * u.deg).hour)
    target_alt, target_az = _target_altaz(ra_deg, dec_deg, lat_deg, lst_hours)

    floor = np.maximum(alt_min, _horizon_floor_array(target_az.astype(np.float64), horizon_profile or []))
    above = (target_alt >= floor) & (target_alt <= alt_max)
    dark = sun_alt < _ASTRO_NIGHT_SUN_ALT
    moonless = moon_alt < 0.0

    step_hours = _STEP_MINUTES / 60.0
    dark_hours = float(np.sum(dark) * step_hours)
    observable_hours = float(np.sum(dark & above) * step_hours)
    moonless_observable_hours = float(np.sum(dark & above & moonless) * step_hours)

    # Peak altitude over the whole night window (independent of Moon / twilight) so the figure is
    # still meaningful in a bright month when the target gets no dark time at all.
    max_altitude = float(np.max(target_alt)) if target_alt.size else None

    tz = ZoneInfo(timezone_name)
    times_local = [dt.astimezone(tz) for dt in times.to_datetime(timezone=timezone.utc)]
    ha_hours = ((lst_hours - ra_deg / 15.0 + 12.0) % 24.0) - 12.0
    transit_local_time: Optional[str] = None
    crossings = np.where((ha_hours[:-1] < 0.0) & (ha_hours[1:] >= 0.0))[0]
    for index in crossings:
        transit_local_time = times_local[int(index) + 1].strftime('%H:%M')
        if dark[int(index)] or dark[int(index) + 1]:
            break

    return {
        'date': night_date.isoformat(),
        'dark_hours': round(dark_hours, 2),
        'observable_hours': round(observable_hours, 2),
        'moonless_observable_hours': round(moonless_observable_hours, 2),
        'max_altitude': round(max_altitude, 1) if max_altitude is not None else None,
        'transit_local_time': transit_local_time,
        'moon_illumination_pct': round(float(grid['moon_illumination_pct']), 1),
    }


def _aggregate_months(samples: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Fold the 24 sample nights into 12 month aggregates with a normalized score."""
    by_month: Dict[int, List[Dict[str, Any]]] = {}
    for sample in samples:
        month = date.fromisoformat(sample['date']).month
        by_month.setdefault(month, []).append(sample)

    months: List[Dict[str, Any]] = []
    for month in _MONTHS:
        month_samples = by_month.get(month, [])
        if not month_samples:
            continue

        def _mean(key: str) -> float:
            return round(sum(float(item[key]) for item in month_samples) / len(month_samples), 2)

        max_alts = [item['max_altitude'] for item in month_samples if item['max_altitude'] is not None]
        months.append(
            {
                'month': month,
                'dark_hours': _mean('dark_hours'),
                'observable_hours': _mean('observable_hours'),
                'moonless_observable_hours': _mean('moonless_observable_hours'),
                'max_altitude': round(max(max_alts), 1) if max_alts else None,
                'moon_illumination_pct': _mean('moon_illumination_pct'),
            }
        )

    score_key = 'moonless_observable_hours'
    peak = max((month['moonless_observable_hours'] for month in months), default=0.0)
    if peak <= 0.0:
        score_key = 'observable_hours'
        peak = max((month['observable_hours'] for month in months), default=0.0)

    for month in months:
        score = (float(month[score_key]) / peak) if peak > 0.0 else 0.0
        score = max(0.0, min(1.0, score))
        month['score'] = round(score, 3)
        month['bucket'] = min(5, int(score * 6))
    return months


def _compute_visibility_calendar(identifier: str, location: Dict[str, Any], year: int) -> Dict[str, Any]:
    target = _resolve_target(identifier)
    base = {
        'target': {
            'id': str(target.get('target_id') or identifier),
            'name': str(target.get('name') or identifier),
            'type': str(target.get('object_type') or ''),
        },
        'location': {'id': location.get('id'), 'name': str(location.get('name') or '')},
        'year': int(year),
    }

    if not target.get('supported'):
        return {
            **base,
            'supported': False,
            'reason': str(target.get('reason') or 'not_found'),
            'months': [],
            'samples': [],
            'constraints': {},
        }

    config = load_config()
    skytonight_cfg = config.get('skytonight', {}) if isinstance(config, dict) else {}
    constraints = skytonight_cfg.get('constraints', {}) if isinstance(skytonight_cfg, dict) else {}

    alt_min = float(constraints.get('altitude_constraint_min', 30) or 0.0)
    alt_max = float(constraints.get('altitude_constraint_max', 80) or 90.0)
    airmass = float(constraints.get('airmass_constraint', 2.0) or 0.0)
    if airmass >= 1.0:
        alt_min = max(alt_min, math.degrees(math.asin(min(1.0, 1.0 / airmass))))

    horizon_profile = location.get('horizon_profile') or []
    lat_deg = float(location.get('latitude') or 0.0)
    lon_deg = float(location.get('longitude') or 0.0)
    timezone_name = str(location.get('timezone') or 'UTC')

    samples: List[Dict[str, Any]] = []
    # A future year runs past the ~1-year horizon of the IERS Earth-orientation table.
    # For a monthly heatmap the extrapolation error is far below arcminute, so mute the
    # degraded-accuracy error/warnings the same way the eclipse services do - otherwise
    # every sample past that horizon raises and the year comes back half-empty.
    with distant_epoch_precision_warnings_muted():
        for month in _MONTHS:
            for day in _SAMPLE_DAYS:
                try:
                    night_date = date(int(year), month, day)
                except ValueError:  # pragma: no cover - both sample days are always valid
                    continue
                try:
                    samples.append(
                        _sample_night(
                            target['ra_deg'],
                            target['dec_deg'],
                            lat_deg,
                            lon_deg,
                            timezone_name,
                            night_date,
                            alt_min,
                            alt_max,
                            horizon_profile,
                        )
                    )
                except Exception as exc:
                    logger.warning(f'Visibility calendar sample failed for {identifier} on {night_date}: {exc}')

    return {
        **base,
        'supported': True,
        'months': _aggregate_months(samples),
        'samples': samples,
        'constraints': {
            'altitude_min': round(alt_min, 1),
            'altitude_max': round(alt_max, 1),
            'has_horizon_profile': bool(horizon_profile),
        },
    }


def get_visibility_calendar(identifier: str, location: Dict[str, Any], year: int) -> Dict[str, Any]:
    """Return the 12-month visibility calendar for *identifier* at *location* for *year*.

    Cached in a bounded in-process LRU keyed ``(identifier, location_id, year)``.
    """
    cache_key = (identifier.strip().lower(), location.get('id'), int(year))
    cached = _calendar_cache.get(cache_key)
    if cached is not None:
        _calendar_cache.move_to_end(cache_key)
        return cached

    result = _compute_visibility_calendar(identifier, location, year)
    _calendar_cache[cache_key] = result
    _calendar_cache.move_to_end(cache_key)
    while len(_calendar_cache) > _MAX_CACHE_ENTRIES:
        _calendar_cache.popitem(last=False)
    return result
