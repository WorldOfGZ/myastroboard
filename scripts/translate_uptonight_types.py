"""Check that Uptonight target types have matching translation keys in en.json."""

from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path
from typing import Any, Dict, Iterable, Mapping, Set

import yaml

ROOT_DIR = Path(__file__).resolve().parent.parent
TARGETS_DIR = ROOT_DIR / "targets"
I18N_EN_FILE = ROOT_DIR / "static" / "i18n" / "en.json"
UPTONIGHT_NAMESPACE = "uptonight"
TYPE_KEY_PREFIX = "type_"


def str_to_translate_key(value: str) -> str:
    """Mirror static/js/i18n.js:strToTranslateKey behavior."""
    normalized = unicodedata.normalize("NFD", value.strip())
    without_accents = "".join(char for char in normalized if unicodedata.category(char) != "Mn")
    lowered = without_accents.lower()
    underscored = re.sub(r"[^a-z0-9]+", "_", lowered)
    return re.sub(r"^_+|_+$", "", underscored)


def iter_target_files(targets_dir: Path) -> Iterable[Path]:
    """Yield YAML target files in deterministic order."""
    return sorted(targets_dir.glob("*.yaml"))


def load_json_file(path: Path) -> Dict[str, Any]:
    """Load JSON and validate a dictionary root."""
    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, dict):
        raise ValueError(f"Top-level JSON object must be a dictionary in {path.name}")
    return data


def extract_type_values(data: Any) -> Set[str]:
    """Recursively collect string values of every 'type' property."""
    found: Set[str] = set()

    if isinstance(data, dict):
        for key, value in data.items():
            if key == "type" and isinstance(value, str) and value.strip():
                found.add(value.strip())
            found.update(extract_type_values(value))
    elif isinstance(data, list):
        for item in data:
            found.update(extract_type_values(item))

    return found


def load_uptonight_type_keys(en_file: Path) -> Set[str]:
    """Return existing uptonight.type_* keys from en.json."""
    en_payload = load_json_file(en_file)
    namespace = en_payload.get(UPTONIGHT_NAMESPACE)
    if not isinstance(namespace, Mapping):
        raise ValueError(f"Missing or invalid '{UPTONIGHT_NAMESPACE}' namespace in {en_file.name}")

    return {
        key
        for key, value in namespace.items()
        if isinstance(key, str) and key.startswith(TYPE_KEY_PREFIX) and isinstance(value, str)
    }


def main() -> None:
    if not TARGETS_DIR.exists():
        print(f"Error: targets folder not found: {TARGETS_DIR}")
        return

    if not I18N_EN_FILE.exists():
        print(f"Error: reference file not found: {I18N_EN_FILE}")
        return

    try:
        existing_type_keys = load_uptonight_type_keys(I18N_EN_FILE)
    except (OSError, json.JSONDecodeError, ValueError) as error:
        print(f"Error while loading {I18N_EN_FILE.name}: {error}")
        return

    distinct_types: Set[str] = set()
    scanned_files = 0

    for yaml_file in iter_target_files(TARGETS_DIR):
        try:
            with yaml_file.open("r", encoding="utf-8") as handle:
                payload = yaml.safe_load(handle)
        except (OSError, yaml.YAMLError) as error:
            print(f"Warning: skip {yaml_file.name} ({error})")
            continue

        scanned_files += 1
        distinct_types.update(extract_type_values(payload))

    if scanned_files == 0:
        print("No valid YAML files found in targets.")
        return

    if not distinct_types:
        print("No 'type' properties found in target YAML files.")
        return

    keys_to_labels: Dict[str, Set[str]] = {}
    for label in distinct_types:
        suffix = str_to_translate_key(label)
        if not suffix:
            print(f"Warning: unable to convert type label to key: {label!r}")
            continue
        key = f"{TYPE_KEY_PREFIX}{suffix}"
        keys_to_labels.setdefault(key, set()).add(label)

    missing_keys = sorted(key for key in keys_to_labels if key not in existing_type_keys)

    print("=" * 72)
    print("UPTONIGHT TYPE TRANSLATION CHECK")
    print("=" * 72)
    print(f"Scanned files: {scanned_files}")
    print(f"Distinct 'type' labels: {len(distinct_types)}")
    print(f"Existing '{UPTONIGHT_NAMESPACE}.{TYPE_KEY_PREFIX}*' keys in en.json: {len(existing_type_keys)}")
    print(f"Missing keys: {len(missing_keys)}")

    if not missing_keys:
        print("\nAll generated type keys already exist in en.json.")
        return

    print("\nAdd the following entries under 'uptonight' in static/i18n/en.json:")
    for key in missing_keys:
        label = sorted(keys_to_labels[key], key=str.casefold)[0]
        print(f'  "{key}": "{label}"')

    collision_keys = sorted(
        key
        for key, labels in keys_to_labels.items()
        if len({label.casefold() for label in labels}) > 1
    )
    if collision_keys:
        print("\nPotential key collisions (multiple labels map to the same key):")
        for key in collision_keys:
            labels = ", ".join(sorted(keys_to_labels[key], key=str.casefold))
            print(f"- {key}: {labels}")


if __name__ == "__main__":
    main()
