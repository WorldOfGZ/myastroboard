"""
Advanced cross-catalogue alias generator for astronomical targets.
Provides a detailed execution summary at the end.
"""

from __future__ import annotations

import json
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, cast

import yaml
from astropy import units as u
from astropy.coordinates import SkyCoord, Angle

# --- Configuration ---
ROOT_DIR = Path(__file__).resolve().parent.parent
TARGETS_DIR = ROOT_DIR / 'targets'
ALIASES_OUTPUT = ROOT_DIR / 'backend' / 'catalogue_aliases.json'

MATCH_THRESHOLD_ARCSEC = 120.0
BIN_SIZE_DEG = 0.5

# --- Utility Functions ---

def normalize_name(value: str) -> str:
    """Standardize names: 'Messier 31' -> 'm31', 'NGC 0224' -> 'ngc224'."""
    if not value: return ''
    name = str(value).lower().strip()
    name = re.sub(r'^messier\s*', 'm', name)
    # Remove leading zeros (NGC 0001 -> ngc1)
    name = re.sub(r'([a-z]+)0+([1-9])', r'\1\2', name)
    return ''.join(ch for ch in name if ch.isalnum())

def extract_ids_from_text(text: str) -> List[str]:
    """Extract IDs (NGC, M, IC, LBN, LDN, Abell, Sh2, vdB, Arp, Barnard)."""
    if not text: return []
    patterns = r'(ngc|ic|m|messier|lbn|ldn|abell|sh2|vdb|arp|b|barnard|simeis)\s*(\d+)'
    matches = re.findall(patterns, text.lower())
    results = []
    for prefix, num in matches:
        p = 'm' if prefix == 'messier' else ('b' if prefix == 'barnard' else prefix)
        results.append(normalize_name(f"{p}{num}"))
    return list(set(results))

def is_type_compatible(type_left: str, type_right: str) -> bool:
    """Fuzzy matching for celestial object types."""
    if not type_left or not type_right: return True
    t1, t2 = type_left.lower(), type_right.lower()
    if t1 == t2: return True
    categories = {
        'galaxy': ['galaxy', 'spiral', 'elliptical', 'lenticular', 'duo', 'pair'],
        'cluster': ['cluster', 'open', 'globular', 'cl+n'],
        'nebula': ['nebula', 'hii', 'reflection', 'emission', 'planetary', 'dark', 'remnant'],
        'star': ['star', 'double', 'triple', 'asterism', '*']
    }
    for cat_list in categories.values():
        if any(kw in t1 for kw in cat_list) and any(kw in t2 for kw in cat_list):
            return True
    return False

def parse_skycoord(ra: str, dec: str) -> Optional[SkyCoord]:
    if not ra or not dec: return None
    try:
        return SkyCoord(" ".join(str(ra).split()), " ".join(str(dec).split()), 
                        unit=(u.hourangle, u.deg), frame='icrs')
    except: return None

def to_scalar_float(val: Any) -> float:
    return float(val.item()) if hasattr(val, 'item') else float(val)

# --- Matching Logic ---

class UnionFind:
    def __init__(self, size: int):
        self.parent = list(range(size))
    def find(self, node: int) -> int:
        while self.parent[node] != node:
            self.parent[node] = self.parent[self.parent[node]]
            node = self.parent[node]
        return node
    def union(self, left: int, right: int):
        root_l, root_r = self.find(left), self.find(right)
        if root_l != root_r: self.parent[root_r] = root_l

def build_aliases_table(objects: List[Dict]) -> Dict:
    uf = UnionFind(len(objects))
    bin_index: Dict[Tuple[int, int], List[int]] = {}

    for idx, obj in enumerate(objects):
        ra_deg = to_scalar_float(obj['coord'].ra.to_value(u.deg))
        dec_deg = to_scalar_float(obj['coord'].dec.to_value(u.deg))
        cell = (int(ra_deg / BIN_SIZE_DEG), int((dec_deg + 90.0) / BIN_SIZE_DEG))
        
        for ra_off in (-1, 0, 1):
            for dec_off in (-1, 0, 1):
                neighbor = (cell[0] + ra_off, cell[1] + dec_off)
                for c_idx in bin_index.get(neighbor, []):
                    cand = objects[c_idx]
                    if cand['catalogue'] == obj['catalogue']: continue
                    
                    match = False
                    if obj['norm_name'] == cand['norm_name'] or \
                       obj['norm_name'] in cand['desc_ids'] or \
                       cand['norm_name'] in obj['desc_ids']:
                        match = True
                    elif is_type_compatible(obj['type'], cand['type']):
                        if obj['coord'].separation(cand['coord']).arcsecond <= MATCH_THRESHOLD_ARCSEC:
                            match = True
                    if match: uf.union(idx, c_idx)
        bin_index.setdefault(cell, []).append(idx)

    groups: Dict[int, List[int]] = {}
    for i in range(len(objects)):
        groups.setdefault(uf.find(i), []).append(i)

    lookup: Dict[str, Dict] = {}
    for g_no, indices in enumerate(groups.values(), start=1):
        aliases = {}
        for i in indices:
            o = objects[i]
            if o['catalogue'] not in aliases or len(o['name']) > len(aliases[o['catalogue']]):
                aliases[o['catalogue']] = o['name']
        
        entry = {'group_id': f"OBJ{g_no:06d}", 'aliases': aliases}
        for cat, name in aliases.items():
            lookup[f"{cat.lower()}::{normalize_name(name)}"] = entry

    return {
        'metadata': {
            'generated_at': datetime.now(timezone.utc).isoformat(),
            'total_input_objects': len(objects),
            'unique_physical_objects': len(groups),
        },
        'lookup': lookup,
        'raw_groups': list(groups.values()) # Used for summary only
    }

# --- Main & Summary ---

def print_summary(start_time: float, objects: List[Dict], result: Dict):
    duration = time.time() - start_time
    meta = result['metadata']
    groups = result['raw_groups']
    
    # Calculate stats
    catalog_counts = {}
    for obj in objects:
        catalog_counts[obj['catalogue']] = catalog_counts.get(obj['catalogue'], 0) + 1
    
    multi_catalog_groups = [g for g in groups if len(g) > 1]
    max_aliases = max(groups, key=len) if groups else []
    
    print("\n" + "="*50)
    print(" EXECUTION SUMMARY ".center(50, "="))
    print("="*50)
    print(f"Status: SUCCESS")
    print(f"Duration: {duration:.2f} seconds")
    print(f"Output: {ALIASES_OUTPUT}")
    print("-" * 50)
    print(f"Total Objects Loaded:    {meta['total_input_objects']}")
    print(f"Unique Physical Objects: {meta['unique_physical_objects']}")
    print(f"Cross-Catalog Matches:   {len(multi_catalog_groups)}")
    print("-" * 50)
    print("OBJECTS PER CATALOGUE:")
    for cat, count in sorted(catalog_counts.items()):
        print(f"  - {cat:<15}: {count:>5}")
    print("-" * 50)
    if max_aliases:
        example_idx = max_aliases[0]
        example_name = objects[example_idx]['name']
        print(f"MOST ALIASED OBJECT: {example_name}")
        print(f"Found in {len(max_aliases)} entries across catalogues.")
    print("="*50 + "\n")

def main():
    start_time = time.time()
    if not TARGETS_DIR.exists(): return
    files = sorted(TARGETS_DIR.glob('*.yaml'))
    
    all_data = []
    for f in files:
        with f.open('r', encoding='utf-8') as s:
            content = yaml.safe_load(s) or []
            for item in content:
                coord = parse_skycoord(item.get('ra'), item.get('dec'))
                if not coord: continue
                all_data.append({
                    'catalogue': f.stem, 'name': str(item.get('name', '')),
                    'norm_name': normalize_name(str(item.get('name', ''))),
                    'desc_ids': extract_ids_from_text(str(item.get('description', ''))),
                    'type': str(item.get('type', '')), 'coord': coord
                })

    result = build_aliases_table(all_data)
    
    # Save to file
    ALIASES_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with ALIASES_OUTPUT.open('w', encoding='utf-8') as out:
        # We don't save 'raw_groups' to the JSON to keep it clean
        json_output = {k: v for k, v in result.items() if k != 'raw_groups'}
        json.dump(json_output, out, indent=2, ensure_ascii=False)

    print_summary(start_time, all_data, result)

if __name__ == '__main__':
    main()