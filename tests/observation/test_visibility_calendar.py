"""Tests for the target visibility calendar (observation/visibility_calendar.py)."""

import sys
import types

import pytest

if 'psutil' not in sys.modules:
    sys.modules['psutil'] = types.ModuleType('psutil')

from observation import visibility_calendar  # type: ignore[import-not-found]
from skytonight.skytonight_models import SkyTonightTarget, SkyTonightCoordinates  # type: ignore[import-not-found]


_YEAR = 2026
_PARIS = {
    'id': 'loc-paris',
    'name': 'Paris',
    'latitude': 48.8566,
    'longitude': 2.3522,
    'elevation': 35,
    'timezone': 'Europe/Paris',
    'horizon_profile': [],
}


def _target(target_id, ra_hours, dec_degrees, category='deep_sky', object_type='Nebula', name=None):
    return SkyTonightTarget(
        target_id=target_id,
        category=category,
        object_type=object_type,
        preferred_name=name or target_id,
        catalogue_names={'OpenNGC': name or target_id},
        coordinates=SkyTonightCoordinates(ra_hours=ra_hours, dec_degrees=dec_degrees),
    )


@pytest.fixture(autouse=True)
def _default_constraints(monkeypatch):
    """Pin the constraint config so tests do not depend on the on-disk config."""
    monkeypatch.setattr(
        visibility_calendar,
        'load_config',
        lambda: {
            'skytonight': {
                'constraints': {
                    'altitude_constraint_min': 30,
                    'altitude_constraint_max': 90,
                    'airmass_constraint': 0,
                }
            }
        },
    )
    visibility_calendar.clear_cache()
    yield
    visibility_calendar.clear_cache()


def _patch_dataset(monkeypatch, targets):
    monkeypatch.setattr(
        visibility_calendar.skytonight_targets,
        'load_targets_dataset',
        lambda *a, **k: {'loaded': True, 'targets': list(targets), 'metadata': {}},
    )


def test_response_shape_for_supported_target(monkeypatch):
    _patch_dataset(monkeypatch, [_target('dso-m31', 0.712, 41.27, name='NGC 224')])
    result = visibility_calendar.get_visibility_calendar('NGC 224', _PARIS, _YEAR)

    assert result['supported'] is True
    assert result['year'] == _YEAR
    assert result['location'] == {'id': 'loc-paris', 'name': 'Paris'}
    assert len(result['months']) == 12
    assert len(result['samples']) == 24
    for month in result['months']:
        assert 1 <= month['month'] <= 12
        assert 0.0 <= month['score'] <= 1.0
        assert 0 <= month['bucket'] <= 5
        assert month['dark_hours'] >= month['observable_hours'] >= month['moonless_observable_hours']
    assert set(result['constraints']) == {'altitude_min', 'altitude_max', 'has_horizon_profile'}


def test_circumpolar_target_is_observable_whenever_it_is_dark(monkeypatch):
    # Dec +85 from lat +48.86: minimum altitude ~= 85 - (90 - 48.86) = ~43.7 deg, always up and
    # always inside the [30, 90] window - so it is observable for essentially every dark minute.
    _patch_dataset(monkeypatch, [_target('dso-polar', 12.0, 85.0, name='NGC 0000')])
    result = visibility_calendar.get_visibility_calendar('NGC 0000', _PARIS, _YEAR)

    assert result['supported'] is True
    assert all(sample['max_altitude'] is not None and sample['max_altitude'] > 40.0 for sample in result['samples'])
    for month in result['months']:
        assert abs(month['observable_hours'] - month['dark_hours']) < 0.4
    assert any(month['observable_hours'] > 3.0 for month in result['months'])


def test_never_rises_target_has_no_observable_hours(monkeypatch):
    # Dec -80 from a northern site never clears the horizon.
    _patch_dataset(monkeypatch, [_target('dso-south', 6.0, -80.0, name='NGC 9999')])
    result = visibility_calendar.get_visibility_calendar('NGC 9999', _PARIS, _YEAR)

    assert result['supported'] is True
    assert all(month['observable_hours'] == 0.0 for month in result['months'])
    assert all(month['score'] == 0.0 and month['bucket'] == 0 for month in result['months'])


def test_horizon_profile_reduces_observable_hours(monkeypatch):
    _patch_dataset(monkeypatch, [_target('dso-m31', 0.712, 41.27, name='NGC 224')])
    open_sky = visibility_calendar.get_visibility_calendar('NGC 224', _PARIS, _YEAR)

    visibility_calendar.clear_cache()
    walled = dict(_PARIS, id='loc-walled', horizon_profile=[{'az': 0, 'alt': 89}, {'az': 359, 'alt': 89}])
    blocked = visibility_calendar.get_visibility_calendar('NGC 224', walled, _YEAR)

    open_total = sum(month['observable_hours'] for month in open_sky['months'])
    blocked_total = sum(month['observable_hours'] for month in blocked['months'])
    assert open_total > 0.0
    assert blocked_total == 0.0


def test_solar_system_body_is_unsupported(monkeypatch):
    _patch_dataset(monkeypatch, [_target('body-jupiter', 5.0, 20.0, category='bodies', object_type='Planet', name='Jupiter')])
    result = visibility_calendar.get_visibility_calendar('Jupiter', _PARIS, _YEAR)

    assert result['supported'] is False
    assert result['reason'] == 'moving_target'
    assert result['months'] == [] and result['samples'] == []


def test_comet_is_unsupported(monkeypatch):
    _patch_dataset(
        monkeypatch,
        [_target('comet-13p', 5.0, 20.0, category='comets', object_type='Comet', name='13P/Olbers')],
    )
    result = visibility_calendar.get_visibility_calendar('13P/Olbers', _PARIS, _YEAR)
    assert result['supported'] is False
    assert result['reason'] == 'moving_target'


def test_unknown_target_falls_back_to_simbad_then_not_found(monkeypatch):
    _patch_dataset(monkeypatch, [])
    monkeypatch.setattr(visibility_calendar.object_info, '_resolve_via_simbad', lambda *_a, **_k: None)
    result = visibility_calendar.get_visibility_calendar('not-a-real-object', _PARIS, _YEAR)
    assert result['supported'] is False
    assert result['reason'] == 'not_found'


def test_future_year_computes_all_months_despite_stale_iers(monkeypatch):
    """A year past the ~1-year IERS horizon must still return all 12 months - the
    calendar mutes the degraded-accuracy error the way the eclipse services do."""
    from astropy.utils import iers

    monkeypatch.setattr(iers.conf, 'iers_degraded_accuracy', 'error')
    _patch_dataset(monkeypatch, [_target('dso-m31', 0.712, 41.27, name='NGC 224')])
    result = visibility_calendar.get_visibility_calendar('NGC 224', _PARIS, _YEAR + 2)
    assert result['supported'] is True
    assert len(result['months']) == 12
    assert len(result['samples']) == 24


def test_simbad_fallback_resolves_astrodex_only_target(monkeypatch):
    _patch_dataset(monkeypatch, [])
    monkeypatch.setattr(
        visibility_calendar.object_info,
        '_resolve_via_simbad',
        lambda *_a, **_k: {'id': 'LBN 552', 'name': 'LBN 552', 'type': 'Nebula', 'ra': 10.68, 'dec': 41.27},
    )
    result = visibility_calendar.get_visibility_calendar('LBN 552', _PARIS, _YEAR)
    assert result['supported'] is True
    assert len(result['months']) == 12


def test_result_is_cached_and_lru_evicts(monkeypatch):
    _patch_dataset(monkeypatch, [_target('dso-m31', 0.712, 41.27, name='NGC 224')])

    first = visibility_calendar.get_visibility_calendar('NGC 224', _PARIS, _YEAR)
    second = visibility_calendar.get_visibility_calendar('NGC 224', _PARIS, _YEAR)
    assert first is second  # served from the LRU, not recomputed

    monkeypatch.setattr(visibility_calendar, '_MAX_CACHE_ENTRIES', 2)
    visibility_calendar.get_visibility_calendar('NGC 224', _PARIS, _YEAR + 1)
    visibility_calendar.get_visibility_calendar('NGC 224', _PARIS, _YEAR + 2)
    assert ('ngc 224', 'loc-paris', _YEAR) not in visibility_calendar._calendar_cache
