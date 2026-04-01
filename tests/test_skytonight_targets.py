"""Tests for SkyTonight target normalization and compatibility helpers."""

from skytonight_models import SkyTonightCoordinates, SkyTonightTarget
import skytonight_targets


def _sample_targets():
    return [
        SkyTonightTarget(
            target_id='DSO-0001',
            category='deep_sky',
            object_type='Galaxy',
            preferred_name='NGC 224',
            catalogue_names={
                'Messier': 'M 31',
                'OpenNGC': 'NGC 224',
                'Caldwell': 'C 23',
            },
            aliases=['Andromeda Galaxy', 'Andromeda'],
            constellation='Andromeda',
            magnitude=3.44,
            size_arcmin=189.0,
            coordinates=SkyTonightCoordinates(ra_hours=0.712, dec_degrees=41.269),
            source_catalogues=['Messier', 'OpenNGC', 'Caldwell'],
            translation_key='skytonight.type_galaxy',
        )
    ]


def test_choose_preferred_catalogue_name_uses_priority_order():
    name = skytonight_targets.choose_preferred_catalogue_name({
        'Messier': 'M 31',
        'OpenNGC': 'NGC 224',
        'Caldwell': 'C 23',
    })
    assert name == 'NGC 224'


def test_build_lookup_from_targets_registers_catalogues_and_aliases():
    lookup = skytonight_targets.build_lookup_from_targets(_sample_targets())
    assert lookup['messier::m31']['group_id'] == 'DSO-0001'
    assert lookup['openngc::ngc224']['preferred_name'] == 'NGC 224'
    assert lookup['alias::andromedagalaxy']['aliases']['OpenNGC'] == 'NGC 224'


def test_save_and_load_targets_dataset_round_trip(tmp_path):
    dataset_file = tmp_path / 'targets.json'
    targets = _sample_targets()

    saved = skytonight_targets.save_targets_dataset(
        targets,
        metadata={'version': 'test'},
        dataset_file=str(dataset_file),
    )

    assert saved is True

    dataset = skytonight_targets.load_targets_dataset(force_reload=True, dataset_file=str(dataset_file))
    assert dataset['metadata']['version'] == 'test'
    assert len(dataset['targets']) == 1
    assert dataset['lookup']['openngc::ngc224']['group_id'] == 'DSO-0001'


def test_get_lookup_entry_falls_back_to_alias_match(tmp_path):
    dataset_file = tmp_path / 'targets.json'
    skytonight_targets.save_targets_dataset(_sample_targets(), dataset_file=str(dataset_file))

    entry = skytonight_targets.get_lookup_entry('Messier', 'Andromeda Galaxy', force_reload=True, dataset_file=str(dataset_file))
    assert entry['group_id'] == 'DSO-0001'


def test_merge_item_with_target_entry_adds_alias_payload(monkeypatch):
    monkeypatch.setattr(
        skytonight_targets,
        'get_lookup_entry',
        lambda catalogue, object_name, force_reload=False: {
            'group_id': 'DSO-0001',
            'aliases': {'Messier': 'M 31', 'OpenNGC': 'NGC 224'},
        },
    )

    item = {'catalogue': 'Messier', 'name': 'M 31'}
    merged = skytonight_targets.merge_item_with_target_entry(item)

    assert merged['catalogue_group_id'] == 'DSO-0001'
    assert merged['catalogue_aliases']['OpenNGC'] == 'NGC 224'