"""Tests for SkyTonight comet ingestion."""

from skytonight_comets import build_comet_targets, enrich_with_jpl_fallback


def test_build_comet_targets_uses_curated_fallback_when_network_unavailable(monkeypatch):
    monkeypatch.setattr('skytonight_comets.fetch_mpc_comets', lambda timeout_seconds=12: [])

    targets = build_comet_targets('mpc+jpl')

    assert targets
    assert all(target.category == 'comets' for target in targets)
    assert any(target.metadata.get('source') == 'curated-fallback' for target in targets)


def test_enrich_with_jpl_fallback_fills_missing_fields(monkeypatch):
    row = {
        'name': '13P/Olbers',
        'designation': '',
        'absolute_magnitude': None,
    }

    monkeypatch.setattr(
        'skytonight_comets._fetch_jpl_comet_snapshot',
        lambda name, timeout_seconds=8: {
            'name': '13P/Olbers',
            'designation': '13P',
            'absolute_magnitude': 9.1,
            'orbit_class': 'Periodic Comet',
        },
    )

    enriched = enrich_with_jpl_fallback([row])

    assert len(enriched) == 1
    assert enriched[0]['designation'] == '13P'
    assert enriched[0]['absolute_magnitude'] == 9.1
