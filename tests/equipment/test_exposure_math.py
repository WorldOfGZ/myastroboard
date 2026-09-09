"""Tests for equipment/exposure_math.py (v1.4 integration-time estimate)."""

import math

import pytest

from equipment import exposure_math as em


def test_bortle_sqm_lookup_and_default():
    assert em.sqm_for_bortle(1) == 22.0
    assert em.sqm_for_bortle(5) == 20.3
    assert em.sqm_for_bortle(None) == em.BORTLE_SQM[5]
    assert em.sqm_for_bortle('not-a-number') == em.BORTLE_SQM[5]
    assert em.sqm_for_bortle(42) == em.BORTLE_SQM[5]  # out of range -> default


def test_surface_brightness_unit_conversion():
    # 1 arcmin^2 = 3600 arcsec^2 -> +2.5*log10(3600) mag fainter per arcsec^2.
    assert em.surface_brightness_per_arcsec2(13.0) == pytest.approx(13.0 + 2.5 * math.log10(3600.0))
    assert em.surface_brightness_per_arcsec2(None) is None


def test_sky_background_matches_documented_calibration():
    # docs/EXPOSURE_CALC.md: ASI294MC Pro f/7, 150 mm, pixel 4.63 um, QE 0.75, Bortle 5 (SQM 20.3)
    # -> formula result ~1.0 e-/px/s.
    plate_scale = em.plate_scale_arcsec_per_px(4.63, 150.0 * 7.0)
    b_sky = em.photon_rate_e_per_px_s(20.3, 150.0, plate_scale, 0.75)
    assert b_sky == pytest.approx(1.0, abs=0.3)


def test_estimate_returns_none_on_missing_inputs():
    assert em.estimate_min_integration_hours(None, 1050, 7.0, 4.63) is None
    assert em.estimate_min_integration_hours(13.0, None, 7.0, 4.63) is None
    assert em.estimate_min_integration_hours(13.0, 1050, None, 4.63) is None
    assert em.estimate_min_integration_hours(13.0, 1050, 7.0, None) is None


def test_plate_scale_returns_none_when_a_dimension_is_zero():
    assert em.plate_scale_arcsec_per_px(0.0, 1050.0) is None
    assert em.plate_scale_arcsec_per_px(4.63, 0.0) is None


def test_estimate_returns_none_for_non_physical_aperture():
    # A negative focal ratio makes focal_length / focal_ratio non-physical (<= 0).
    assert em.estimate_min_integration_hours(13.0, 900.0, -7.0, 4.0) is None


def test_estimate_returns_none_when_target_signal_underflows_to_zero():
    # An absurdly faint surface brightness drives 10**(-SB/2.5) to 0.0, so the
    # per-pixel target rate underflows and the guard trips before the 1/S^2 step.
    assert em.estimate_min_integration_hours(900.0, 900.0, 7.0, 4.0, bortle=5) is None


def test_estimate_is_finite_and_positive_for_typical_target():
    hours = em.estimate_min_integration_hours(13.0, 1050, 7.0, 4.63, bortle=5, quantum_efficiency=0.75)
    assert hours is not None and 0.0 < hours < 100.0


def test_fainter_target_needs_more_integration():
    bright = em.estimate_min_integration_hours(12.0, 900, 6.0, 4.0, bortle=4)
    faint = em.estimate_min_integration_hours(15.0, 900, 6.0, 4.0, bortle=4)
    assert bright is not None and faint is not None
    assert faint > bright


def test_faster_optics_and_darker_sky_reduce_integration():
    fast = em.estimate_min_integration_hours(14.0, 500, 4.0, 4.0, bortle=5)
    slow = em.estimate_min_integration_hours(14.0, 900, 7.2, 4.0, bortle=5)
    assert fast is not None and slow is not None and fast < slow

    dark = em.estimate_min_integration_hours(14.0, 900, 7.0, 4.0, bortle=3)
    bright_sky = em.estimate_min_integration_hours(14.0, 900, 7.0, 4.0, bortle=7)
    assert dark is not None and bright_sky is not None and dark < bright_sky


def test_measured_sqm_overrides_bortle():
    with_bortle = em.estimate_min_integration_hours(14.0, 900, 7.0, 4.0, bortle=7)
    with_sqm = em.estimate_min_integration_hours(14.0, 900, 7.0, 4.0, bortle=7, sqm=21.5)
    assert with_sqm is not None and with_bortle is not None
    assert with_sqm < with_bortle  # a darker measured sky needs less time
