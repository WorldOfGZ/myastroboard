"""Tests for SkyTonight bodies ingestion."""

from skytonight_bodies import build_body_targets


def test_build_body_targets_contains_major_bodies():
    targets = build_body_targets()

    names = {target.preferred_name for target in targets}
    assert 'Moon' in names
    assert 'Mars' in names
    assert 'Jupiter' in names
    assert all(target.category == 'bodies' for target in targets)


def test_build_body_targets_metadata_source_is_builtin():
    targets = build_body_targets()
    assert targets
    assert all(target.metadata.get('source') == 'builtin-solar-system' for target in targets)
