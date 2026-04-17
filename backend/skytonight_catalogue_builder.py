"""SkyTonight target dataset builder for deep-sky catalogues."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import re
from typing import Any, Dict, Iterable, List, Optional, Tuple

from logging_config import get_logger
from skytonight_bodies import build_body_targets
from skytonight_comets import build_comet_targets
from skytonight_models import SkyTonightCoordinates, SkyTonightTarget
from skytonight_targets import normalize_catalogue_name, normalize_object_name, save_targets_dataset, choose_preferred_catalogue_name


logger = get_logger(__name__)


DEFAULT_CALDWELL_MAP: Dict[str, str] = {}
IDENTIFIER_PATTERN = re.compile(r'\b(M\s*\d+|NGC\s*\d+|IC\s*\d+)\b', re.IGNORECASE)


@dataclass(frozen=True)
class PyOngcRow:
    """Intermediate representation used by the dataset builder."""

    name: str
    object_type: str
    constellation: str
    ra_hours: Optional[float]
    dec_degrees: Optional[float]
    magnitude: Optional[float]
    size_arcmin: Optional[float]
    messier: Optional[str]
    ngc_names: List[str]
    ic_names: List[str]
    common_names: List[str]
    other_identifiers: List[str]


def _safe_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None
    return numeric


def _coerce_identifier_list(values: Any) -> List[str]:
    if not values:
        return []
    if isinstance(values, str):
        return [values] if values.strip() else []

    coerced: List[str] = []
    for value in values:
        text = str(value or '').strip()
        if text:
            coerced.append(text)
    return coerced


def _normalize_identifier(identifier: str) -> str:
    text = str(identifier or '').strip()
    if not text:
        return ''
    upper = text.upper().replace('  ', ' ')
    if upper.startswith('M') and upper[1:].isdigit():
        return f'M {int(upper[1:])}'
    if upper.startswith('NGC'):
        suffix = upper[3:].strip()
        return f'NGC {suffix}' if suffix else 'NGC'
    if upper.startswith('IC'):
        suffix = upper[2:].strip()
        return f'IC {suffix}' if suffix else 'IC'
    if upper.startswith('C') and upper[1:].strip().isdigit():
        return f'C {int(upper[1:].strip())}'
    return text




def _collect_catalogue_names(row: PyOngcRow, caldwell_map: Optional[Dict[str, str]] = None) -> Dict[str, str]:
    names: Dict[str, str] = {}

    if row.messier:
        names['Messier'] = _normalize_identifier(row.messier)

    if row.ngc_names:
        names['OpenNGC'] = _normalize_identifier(row.ngc_names[0])

    if row.ic_names:
        if 'OpenNGC' not in names:
            names['OpenNGC'] = _normalize_identifier(row.ic_names[0])
        names['OpenIC'] = _normalize_identifier(row.ic_names[0])

    # PyOngc returns identifiers[1]/[2] as cross-references only — they are None
    # for the primary NGC/IC object itself.  Derive OpenNGC / OpenIC from the
    # canonical row name when the cross-reference columns were empty.
    norm_primary = _normalize_identifier(row.name)
    if norm_primary.startswith('NGC ') and 'OpenNGC' not in names:
        names['OpenNGC'] = norm_primary
    elif norm_primary.startswith('IC ') and 'OpenIC' not in names:
        names['OpenIC'] = norm_primary
        if 'OpenNGC' not in names:
            names['OpenNGC'] = norm_primary

    # Popular / common name (first entry from PyOngc common-names list)
    if row.common_names:
        first_common = str(row.common_names[0]).strip()
        if first_common:
            names['CommonName'] = first_common

    # First: extract Caldwell identifier directly from PyOngc other_identifiers
    # (PyOngc returns entries like "C 1", "C 42" in the other_identifiers field)
    for identifier in row.other_identifiers:
        if re.match(r'^C \d+$', identifier):
            names['Caldwell'] = identifier
            break

    # Fallback: use caldwell_map lookup (for custom maps or testing)
    if 'Caldwell' not in names:
        caldwell_catalogue = caldwell_map or DEFAULT_CALDWELL_MAP
        for alias_name in list(names.values()) + [row.name]:
            caldwell_name = caldwell_catalogue.get(normalize_object_name(alias_name), '')
            if caldwell_name:
                names['Caldwell'] = _normalize_identifier(caldwell_name)
                break

    return names


def _build_aliases(row: PyOngcRow, catalogue_names: Dict[str, str]) -> List[str]:
    aliases = {
        str(row.name or '').strip(),
        *catalogue_names.values(),
        *_coerce_identifier_list(row.common_names),
        *_coerce_identifier_list(row.other_identifiers),
        *_coerce_identifier_list(row.ngc_names),
        *_coerce_identifier_list(row.ic_names),
    }
    aliases.discard('')
    return sorted(aliases)


def _canonical_key(catalogue_names: Dict[str, str], fallback_name: str) -> Tuple[str, str]:
    if 'OpenNGC' in catalogue_names:
        return ('OpenNGC', normalize_object_name(catalogue_names['OpenNGC']))
    if 'Messier' in catalogue_names:
        return ('Messier', normalize_object_name(catalogue_names['Messier']))
    if 'OpenIC' in catalogue_names:
        return ('OpenIC', normalize_object_name(catalogue_names['OpenIC']))
    if 'Caldwell' in catalogue_names:
        return ('Caldwell', normalize_object_name(catalogue_names['Caldwell']))
    return ('Alias', normalize_object_name(fallback_name))


def _target_id_from_key(canonical_catalogue: str, canonical_name: str) -> str:
    return f"dso-{normalize_catalogue_name(canonical_catalogue).lower()}-{canonical_name}"


def _merge_target(existing: SkyTonightTarget, incoming: SkyTonightTarget) -> SkyTonightTarget:
    catalogue_names = dict(existing.catalogue_names)
    # Merge incoming catalogue entries without overwriting keys already present
    # (keeps the first-seen CommonName, Messier, etc. rather than the last).
    for k, v in incoming.catalogue_names.items():
        if k not in catalogue_names or not catalogue_names[k]:
            catalogue_names[k] = v

    aliases = sorted({*existing.aliases, *incoming.aliases})
    source_catalogues = sorted({*existing.source_catalogues, *incoming.source_catalogues})

    magnitude = existing.magnitude if existing.magnitude is not None else incoming.magnitude
    size_arcmin = existing.size_arcmin if existing.size_arcmin is not None else incoming.size_arcmin
    coordinates = existing.coordinates or incoming.coordinates
    constellation = existing.constellation or incoming.constellation
    preferred_name = existing.preferred_name or incoming.preferred_name
    object_type = existing.object_type or incoming.object_type

    metadata = dict(existing.metadata)
    metadata.update(incoming.metadata)

    return SkyTonightTarget(
        target_id=existing.target_id,
        category=existing.category,
        object_type=object_type,
        preferred_name=preferred_name,
        catalogue_names=catalogue_names,
        aliases=aliases,
        constellation=constellation,
        magnitude=magnitude,
        size_arcmin=size_arcmin,
        coordinates=coordinates,
        source_catalogues=source_catalogues,
        translation_key=existing.translation_key or incoming.translation_key,
        metadata=metadata,
    )


def build_targets_from_rows(rows: Iterable[PyOngcRow], caldwell_map: Optional[Dict[str, str]] = None) -> List[SkyTonightTarget]:
    """Normalize PyOngc rows into deduplicated SkyTonight targets."""
    targets_by_key: Dict[Tuple[str, str], SkyTonightTarget] = {}

    for row in rows:
        if row.ra_hours is None or row.dec_degrees is None:
            continue
        if str(row.object_type or '').strip().lower().startswith('duplicated'):
            continue

        catalogue_names = _collect_catalogue_names(row, caldwell_map=caldwell_map)
        aliases = _build_aliases(row, catalogue_names)
        canonical_catalogue, canonical_name = _canonical_key(catalogue_names, row.name)
        if not canonical_name:
            continue

        preferred_name = choose_preferred_catalogue_name(catalogue_names) or row.name
        source_catalogues = sorted({canonical_catalogue, *catalogue_names.keys()})
        target = SkyTonightTarget(
            target_id=_target_id_from_key(canonical_catalogue, canonical_name),
            category='deep_sky',
            object_type=str(row.object_type or '').strip() or 'Unknown',
            preferred_name=preferred_name,
            catalogue_names=catalogue_names,
            aliases=aliases,
            constellation=str(row.constellation or '').strip(),
            magnitude=row.magnitude,
            size_arcmin=row.size_arcmin,
            coordinates=SkyTonightCoordinates(ra_hours=float(row.ra_hours), dec_degrees=float(row.dec_degrees)),
            source_catalogues=source_catalogues,
            translation_key=f"skytonight.type_{normalize_object_name(row.object_type) or 'unknown'}",
            metadata={'source': 'pyongc'},
        )

        key = (canonical_catalogue, canonical_name)
        if key in targets_by_key:
            targets_by_key[key] = _merge_target(targets_by_key[key], target)
        else:
            targets_by_key[key] = target

    return sorted(targets_by_key.values(), key=lambda item: item.preferred_name.lower())


def _load_pyongc_rows() -> List[PyOngcRow]:
    """Load deep-sky objects from PyOngc when available."""
    try:
        from pyongc import ongc  # type: ignore[import-not-found]
    except ImportError as error:
        raise RuntimeError('PyOngc is required to build the SkyTonight deep-sky dataset') from error

    rows: List[PyOngcRow] = []
    for dso in ongc.listObjects():
        coords = getattr(dso, 'coords', None)
        if coords is None:
            continue

        try:
            ra_hours = float(coords[0][0] + (coords[0][1] / 60.0) + (coords[0][2] / 3600.0))
            dec_sign = -1.0 if float(coords[1][0]) < 0 else 1.0
            dec_abs = abs(float(coords[1][0])) + (float(coords[1][1]) / 60.0) + (float(coords[1][2]) / 3600.0)
            dec_degrees = dec_sign * dec_abs
        except (TypeError, ValueError, IndexError):
            continue

        dimensions = getattr(dso, 'dimensions', (None, None, None))
        magnitudes = getattr(dso, 'magnitudes', (None, None, None, None, None))
        identifiers = getattr(dso, 'identifiers', (None, None, None, None, None))

        rows.append(PyOngcRow(
            name=str(getattr(dso, 'name', '') or '').strip(),
            object_type=str(getattr(dso, 'type', '') or '').strip(),
            constellation=str(getattr(dso, 'constellation', '') or '').strip(),
            ra_hours=ra_hours,
            dec_degrees=dec_degrees,
            magnitude=_safe_float(magnitudes[1] if len(magnitudes) > 1 else None) or _safe_float(magnitudes[0] if len(magnitudes) > 0 else None),
            size_arcmin=_safe_float(dimensions[0] if len(dimensions) > 0 else None),
            messier=_normalize_identifier(str(identifiers[0])) if len(identifiers) > 0 and identifiers[0] is not None else None,
            ngc_names=[_normalize_identifier(value) for value in _coerce_identifier_list(identifiers[1] if len(identifiers) > 1 else [])],
            ic_names=[_normalize_identifier(value) for value in _coerce_identifier_list(identifiers[2] if len(identifiers) > 2 else [])],
            common_names=_coerce_identifier_list(identifiers[3] if len(identifiers) > 3 else []),
            other_identifiers=[_normalize_identifier(value) for value in _coerce_identifier_list(identifiers[4] if len(identifiers) > 4 else [])],
        ))

    logger.info(f'Loaded {len(rows)} PyOngc deep-sky rows for SkyTonight')
    return rows


def _load_deep_sky_rows() -> Tuple[List[PyOngcRow], str]:
    return _load_pyongc_rows(), 'PyOngc'


def build_deep_sky_targets(caldwell_map: Optional[Dict[str, str]] = None) -> List[SkyTonightTarget]:
    """Build normalized SkyTonight deep-sky targets from PyOngc."""
    rows, _source = _load_deep_sky_rows()
    return build_targets_from_rows(rows, caldwell_map=caldwell_map)


def build_and_save_default_dataset(
    caldwell_map: Optional[Dict[str, str]] = None,
    comet_source_mode: str = 'mpc+jpl',
) -> Dict[str, Any]:
    """Build the first SkyTonight dataset and persist it to the configured dataset file."""
    rows, source_name = _load_deep_sky_rows()
    deep_sky_targets = build_targets_from_rows(rows, caldwell_map=caldwell_map)
    body_targets = build_body_targets()
    comet_targets = build_comet_targets(source_mode=comet_source_mode)
    all_targets = [*deep_sky_targets, *body_targets, *comet_targets]

    comet_sources = sorted({str(target.metadata.get('source') or '') for target in comet_targets if isinstance(target.metadata, dict) and target.metadata.get('source')})
    body_sources = sorted({str(target.metadata.get('source') or '') for target in body_targets if isinstance(target.metadata, dict) and target.metadata.get('source')})
    source_values = [source_name, *body_sources, *comet_sources]
    deduplicated_sources = [value for index, value in enumerate(source_values) if value and value not in source_values[:index]]

    metadata = {
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'sources': deduplicated_sources,
        'counts': {
            'deep_sky': len(deep_sky_targets),
            'bodies': len(body_targets),
            'comets': len(comet_targets),
        },
    }

    if not save_targets_dataset(all_targets, metadata=metadata):
        raise RuntimeError('Failed to persist SkyTonight dataset')

    # Do not return the full targets list: the caller only needs metadata and the
    # data is already persisted to disk.  Keeping a reference here would double
    # RAM usage until the caller returns (the scheduler also loads the dataset).
    return {
        'metadata': metadata,
    }