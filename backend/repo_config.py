"""
Manage configuration loading and saving
"""
from copy import deepcopy

from constants import CONFIG_FILE
from config_defaults import DEFAULT_CONFIG
from utils import load_json_file, save_json_file


def _merge_defaults(config, defaults):
    """Recursively merge missing default keys into a config payload."""
    if not isinstance(defaults, dict):
        return deepcopy(defaults)

    merged = deepcopy(defaults)
    if not isinstance(config, dict):
        return merged

    for key, value in config.items():
        default_value = merged.get(key)
        if isinstance(value, dict) and isinstance(default_value, dict):
            merged[key] = _merge_defaults(value, default_value)
        else:
            merged[key] = value

    return merged


def load_config():
    """Load configuration from file"""
    config = load_json_file(CONFIG_FILE, deepcopy(DEFAULT_CONFIG))
    return _merge_defaults(config, DEFAULT_CONFIG)


def save_config(config):
    """Save configuration to file"""
    return save_json_file(CONFIG_FILE, config)