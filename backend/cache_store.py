"""
Server-side cache management with TTL-based expiration and config change detection.
All cache management is handled server-side only.
"""
import time
import json
import os
from constants import CACHE_TTL, WEATHER_CACHE_TTL, DATA_DIR

# Cache entries with timestamp for TTL tracking
_moon_report_cache = {"timestamp": 0, "data": None}
_sun_report_cache = {"timestamp": 0, "data": None}
_best_window_cache = {
    "strict": {"timestamp": 0, "data": None},
    "practical": {"timestamp": 0, "data": None},
    "illumination": {"timestamp": 0, "data": None}
}
_moon_planner_report_cache = {"timestamp": 0, "data": None}
_dark_window_report_cache = {"timestamp": 0, "data": None}

# Weather cache (separate TTL)
_weather_cache = {"timestamp": 0, "data": None}

# Track the last known location config to detect changes
# This is loaded from disk to survive restarts
_LOCATION_CACHE_FILE = os.path.join(DATA_DIR, 'location_cache.json')
_last_known_location_config = {
    "latitude": None,
    "longitude": None,
    "elevation": None,
    "timezone": None
}

# Flag to indicate if caches are currently being initialized
_cache_initialization_in_progress = False


def _load_location_cache():
    """Load persisted location config from disk"""
    global _last_known_location_config
    try:
        if os.path.exists(_LOCATION_CACHE_FILE):
            with open(_LOCATION_CACHE_FILE, 'r') as f:
                _last_known_location_config = json.load(f)
    except Exception:
        # If loading fails, keep the default None values
        pass


def _save_location_cache():
    """Persist location config to disk"""
    try:
        with open(_LOCATION_CACHE_FILE, 'w') as f:
            json.dump(_last_known_location_config, f)
    except Exception:
        # Not critical if save fails, just means next restart might trigger false positive
        pass


# Load persisted location on module import
_load_location_cache()


def get_current_location_signature(location_config):
    """Create a signature of location parameters for change detection"""
    if not location_config:
        return None
    return {
        "latitude": location_config.get("latitude"),
        "longitude": location_config.get("longitude"),
        "elevation": location_config.get("elevation"),
        "timezone": location_config.get("timezone")
    }


def has_location_changed(new_location_config):
    """Check if location parameters have changed"""
    current_signature = get_current_location_signature(new_location_config)
    
    # If last config was not set, location has "changed" (first time)
    if _last_known_location_config["latitude"] is None:
        return True
    
    # Compare current signature with last known
    return (
        _last_known_location_config["latitude"] != current_signature["latitude"] or
        _last_known_location_config["longitude"] != current_signature["longitude"] or
        _last_known_location_config["elevation"] != current_signature["elevation"] or
        _last_known_location_config["timezone"] != current_signature["timezone"]
    )


def update_location_config(new_location_config):
    """Update the tracked location config and persist to disk"""
    global _last_known_location_config
    signature = get_current_location_signature(new_location_config)
    if signature:
        _last_known_location_config = signature.copy()
        _save_location_cache()


def reset_all_caches():
    """Reset all astronomical caches (called when location changes)"""
    global _moon_report_cache, _sun_report_cache, _best_window_cache
    global _moon_planner_report_cache, _dark_window_report_cache
    
    _moon_report_cache = {"timestamp": 0, "data": None}
    _sun_report_cache = {"timestamp": 0, "data": None}
    _best_window_cache = {
        "strict": {"timestamp": 0, "data": None},
        "practical": {"timestamp": 0, "data": None},
        "illumination": {"timestamp": 0, "data": None}
    }
    _moon_planner_report_cache = {"timestamp": 0, "data": None}
    _dark_window_report_cache = {"timestamp": 0, "data": None}


def reset_weather_cache():
    """Reset weather cache (can be called independently)"""
    global _weather_cache
    _weather_cache = {"timestamp": 0, "data": None}


def is_cache_valid(cache_entry, ttl_seconds):
    """Check if a cache entry is still valid based on TTL"""
    if not cache_entry or cache_entry["data"] is None:
        return False
    
    current_time = time.time()
    elapsed = current_time - cache_entry["timestamp"]
    
    return elapsed < ttl_seconds


def is_astronomical_cache_ready():
    """Check if all astronomical caches are valid and ready"""
    all_valid = (
        is_cache_valid(_moon_report_cache, CACHE_TTL) and
        is_cache_valid(_sun_report_cache, CACHE_TTL) and
        is_cache_valid(_best_window_cache["strict"], CACHE_TTL) and
        is_cache_valid(_moon_planner_report_cache, CACHE_TTL) and
        is_cache_valid(_dark_window_report_cache, CACHE_TTL)
    )
    return all_valid


def get_cache_init_status():
    """Get detailed cache initialization status"""
    return {
        "moon_report": is_cache_valid(_moon_report_cache, CACHE_TTL),
        "sun_report": is_cache_valid(_sun_report_cache, CACHE_TTL),
        "best_window_strict": is_cache_valid(_best_window_cache["strict"], CACHE_TTL),
        "best_window_practical": is_cache_valid(_best_window_cache["practical"], CACHE_TTL),
        "best_window_illumination": is_cache_valid(_best_window_cache["illumination"], CACHE_TTL),
        "moon_planner": is_cache_valid(_moon_planner_report_cache, CACHE_TTL),
        "dark_window": is_cache_valid(_dark_window_report_cache, CACHE_TTL),
        "weather_forecast": is_cache_valid(_weather_cache, WEATHER_CACHE_TTL),
        "all_ready": is_astronomical_cache_ready(),
        "in_progress": _cache_initialization_in_progress
    }


def set_cache_initialization_in_progress(value):
    """Set the cache initialization progress flag"""
    global _cache_initialization_in_progress
    _cache_initialization_in_progress = value