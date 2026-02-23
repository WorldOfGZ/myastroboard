"""Generate catalogue configuration and cross-catalogue aliases table.

This script:
1. Updates catalogues.conf from files present in /targets (without .yaml extension)
2. Generates backend/catalogue_aliases.json for cross-catalogue duplicate detection
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, cast

import yaml
from astropy import units as u
from astropy.coordinates import SkyCoord, Angle


ROOT_DIR = Path(__file__).resolve().parent.parent
TARGETS_DIR = ROOT_DIR / 'targets'
CATALOGUES_CONF = ROOT_DIR / 'catalogues.conf'
ALIASES_OUTPUT = ROOT_DIR / 'backend' / 'catalogue_aliases.json'

# Coordinate matching threshold for considering two entries as the same object
MATCH_THRESHOLD_ARCSEC = 90.0
# Coordinate bucketing size to reduce matching cost
BIN_SIZE_DEG = 0.1


def normalize_name(value: str) -> str:
    """Normalize an object name for lookup keys."""
    if not value:
        return ''
    cleaned = ''.join(ch for ch in value.lower().strip() if ch.isalnum())
    return cleaned


def make_lookup_key(catalogue: str, name: str) -> str:
    """Create key used in runtime lookup map."""
    return f"{catalogue.lower()}::{normalize_name(name)}"


def parse_skycoord(ra: str, dec: str) -> Optional[SkyCoord]:
    """Parse RA/Dec strings into SkyCoord."""
    if not ra or not dec:
        return None

    try:
        return SkyCoord(str(ra).strip(), str(dec).strip(), unit=(u.hourangle, u.deg), frame='icrs')
    except Exception:
        return None


def update_catalogues_conf(catalogues: List[str]) -> None:
    """Update catalogues.conf while preserving comments and surrounding text."""
    catalogues_sorted = sorted(dict.fromkeys(catalogues), key=lambda item: item.lower())

    if not CATALOGUES_CONF.exists():
        lines = []
    else:
        lines = CATALOGUES_CONF.read_text(encoding='utf-8').splitlines()

    data_line_indexes = [
        index for index, raw_line in enumerate(lines)
        if raw_line.strip() and not raw_line.strip().startswith('#')
    ]

    if data_line_indexes:
        first = data_line_indexes[0]
        last = data_line_indexes[-1]
        new_lines = lines[:first] + catalogues_sorted + lines[last + 1:]
    else:
        new_lines = lines + ([''] if lines else []) + catalogues_sorted

    CATALOGUES_CONF.write_text('\n'.join(new_lines) + '\n', encoding='utf-8')


def load_targets_objects(catalogue: str, file_path: Path) -> List[Dict]:
    """Load YAML objects and keep only entries with usable coordinates."""
    with file_path.open('r', encoding='utf-8') as stream:
        content = yaml.safe_load(stream) or []

    objects: List[Dict] = []
    if not isinstance(content, list):
        return objects

    for item in content:
        if not isinstance(item, dict):
            continue

        name = str(item.get('name', '')).strip()
        ra = item.get('ra')
        dec = item.get('dec')

        if not name or ra is None or dec is None:
            continue

        skycoord = parse_skycoord(str(ra), str(dec))
        if skycoord is None:
            continue

        obj_type = str(item.get('type', '')).strip().lower()

        ra_angle = cast(Angle, skycoord.ra)
        dec_angle = cast(Angle, skycoord.dec)
        ra_deg = to_scalar_float(ra_angle.to_value(u.deg))
        dec_deg = to_scalar_float(dec_angle.to_value(u.deg))

        objects.append({
            'catalogue': catalogue,
            'name': name,
            'type': obj_type,
            'coord': skycoord,
            'ra_deg': ra_deg,
            'dec_deg': dec_deg,
        })

    return objects


class UnionFind:
    """Simple union-find for grouping matching entries."""

    def __init__(self, size: int) -> None:
        self.parent = list(range(size))

    def find(self, node: int) -> int:
        while self.parent[node] != node:
            self.parent[node] = self.parent[self.parent[node]]
            node = self.parent[node]
        return node

    def union(self, left: int, right: int) -> None:
        root_left = self.find(left)
        root_right = self.find(right)
        if root_left != root_right:
            self.parent[root_right] = root_left


def coord_bin(ra_deg: float, dec_deg: float) -> Tuple[int, int]:
    """Get coarse coordinate bin."""
    return (int(ra_deg / BIN_SIZE_DEG), int((dec_deg + 90.0) / BIN_SIZE_DEG))


def to_scalar_float(value: Any) -> float:
    """Convert numpy-like values to a plain float."""
    if hasattr(value, 'item'):
        return float(value.item())
    return float(value)


def is_type_compatible(type_left: str, type_right: str) -> bool:
    """Return True when object types are compatible enough for matching."""
    if not type_left or not type_right:
        return True
    return type_left == type_right


def build_aliases_table(objects: List[Dict], catalogues: List[str]) -> Dict:
    """Build lookup table with grouped aliases."""
    uf = UnionFind(len(objects))

    bin_index: Dict[Tuple[int, int], List[int]] = {}

    for idx, obj in enumerate(objects):
        cell = coord_bin(obj['ra_deg'], obj['dec_deg'])
        candidate_indexes: List[int] = []

        for ra_offset in (-1, 0, 1):
            for dec_offset in (-1, 0, 1):
                candidate_indexes.extend(bin_index.get((cell[0] + ra_offset, cell[1] + dec_offset), []))

        for candidate_idx in candidate_indexes:
            candidate = objects[candidate_idx]

            if candidate['catalogue'] == obj['catalogue']:
                continue
            if not is_type_compatible(candidate['type'], obj['type']):
                continue

            separation = obj['coord'].separation(candidate['coord']).arcsecond
            if separation <= MATCH_THRESHOLD_ARCSEC:
                uf.union(idx, candidate_idx)

        bin_index.setdefault(cell, []).append(idx)

    grouped: Dict[int, List[int]] = {}
    for idx in range(len(objects)):
        root = uf.find(idx)
        grouped.setdefault(root, []).append(idx)

    lookup: Dict[str, Dict] = {}

    for group_number, indexes in enumerate(grouped.values(), start=1):
        aliases: Dict[str, str] = {}

        for index in indexes:
            obj = objects[index]
            existing = aliases.get(obj['catalogue'])
            if existing:
                if len(obj['name']) < len(existing):
                    aliases[obj['catalogue']] = obj['name']
            else:
                aliases[obj['catalogue']] = obj['name']

        group_id = f"OBJ{group_number:06d}"
        entry = {
            'group_id': group_id,
            'aliases': aliases,
        }

        for catalogue_name, object_name in aliases.items():
            key = make_lookup_key(catalogue_name, object_name)
            lookup[key] = entry

    return {
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'catalogues': sorted(catalogues),
        'match_threshold_arcsec': MATCH_THRESHOLD_ARCSEC,
        'lookup': lookup,
    }


def main() -> None:
    """Run full analysis and generation process."""
    catalogue_files = sorted(TARGETS_DIR.glob('*.yaml'))
    catalogues = [path.stem for path in catalogue_files]

    update_catalogues_conf(catalogues)

    all_objects: List[Dict] = []
    for catalogue_file in catalogue_files:
        all_objects.extend(load_targets_objects(catalogue_file.stem, catalogue_file))

    aliases_table = build_aliases_table(all_objects, catalogues)

    ALIASES_OUTPUT.write_text(
        json.dumps(aliases_table, indent=2, ensure_ascii=False),
        encoding='utf-8',
    )

    print(f"Updated catalogues.conf with {len(catalogues)} catalogues")
    print(f"Parsed {len(all_objects)} objects from targets")
    print(f"Generated aliases table: {ALIASES_OUTPUT}")


if __name__ == '__main__':
    main()
