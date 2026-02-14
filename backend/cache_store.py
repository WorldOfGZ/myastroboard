"""
Server-side cache management with TTL-based expiration and config change detection.
All cache management is handled server-side only.
"""
import time
import json
import os
import sys
from contextlib import contextmanager
from constants import CACHE_TTL, WEATHER_CACHE_TTL, DATA_DIR

# Windows-compatible file locking
if sys.platform == "win32":
    import msvcrt
else:
    import fcntl

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
_solar_eclipse_cache = {"timestamp": 0, "data": None}
_lunar_eclipse_cache = {"timestamp": 0, "data": None}
_horizon_graph_cache = {"timestamp": 0, "data": None}

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

# Shared cache file (cross-worker)
_SHARED_CACHE_FILE = os.path.join(DATA_DIR, "astro_cache.json")
_SHARED_CACHE_LOCK = os.path.join(DATA_DIR, "astro_cache.lock")


def _ensure_data_dir():
    """Ensure DATA_DIR exists before file operations"""
    os.makedirs(DATA_DIR, exist_ok=True)


@contextmanager
def _cache_file_lock():
    """Cross-platform exclusive lock for shared cache file"""
    _ensure_data_dir()
    lock_file = open(_SHARED_CACHE_LOCK, "a+")
    try:
        if sys.platform == "win32":
            msvcrt.locking(lock_file.fileno(), msvcrt.LK_LOCK, 1)
        else:
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
        yield
    finally:
        try:
            if sys.platform == "win32":
                msvcrt.locking(lock_file.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)
        finally:
            lock_file.close()


def _read_shared_cache():
    """Read shared cache file safely"""
    _ensure_data_dir()
    if not os.path.exists(_SHARED_CACHE_FILE):
        return {}
    try:
        with open(_SHARED_CACHE_FILE, "r", encoding="utf-8") as f:
            return json.load(f) or {}
    except Exception:
        # If file is corrupted, ignore and treat as empty
        return {}


def _write_shared_cache(shared_cache):
    """Write shared cache file safely"""
    _ensure_data_dir()
    with open(_SHARED_CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(shared_cache, f)


def update_shared_cache_entry(key, data, timestamp):
    """Update a single shared cache entry"""
    with _cache_file_lock():
        shared_cache = _read_shared_cache()
        shared_cache[key] = {"timestamp": timestamp, "data": data}
        _write_shared_cache(shared_cache)


def load_shared_cache_entry(key):
    """Load a single cache entry from shared cache"""
    with _cache_file_lock():
        shared_cache = _read_shared_cache()
        entry = shared_cache.get(key)
        if not isinstance(entry, dict):
            return None
        if "timestamp" not in entry or "data" not in entry:
            return None
        return entry


def sync_cache_from_shared(key, cache_entry):
    """Sync in-memory cache entry from shared cache file"""
    entry = load_shared_cache_entry(key)
    if not entry or entry.get("data") is None:
        return False
    cache_entry["data"] = entry.get("data")
    cache_entry["timestamp"] = entry.get("timestamp", 0)
    return True


def _write_all_astronomical_caches_to_shared():
    """Persist all astronomical caches to shared file"""
    with _cache_file_lock():
        shared_cache = _read_shared_cache()
        shared_cache.update({
            "moon_report": _moon_report_cache,
            "sun_report": _sun_report_cache,
            "moon_planner": _moon_planner_report_cache,
            "dark_window": _dark_window_report_cache,
            "best_window_strict": _best_window_cache["strict"],
            "best_window_practical": _best_window_cache["practical"],
            "best_window_illumination": _best_window_cache["illumination"],
            "solar_eclipse": _solar_eclipse_cache,
            "lunar_eclipse": _lunar_eclipse_cache,
            "horizon_graph": _horizon_graph_cache,
        })
        _write_shared_cache(shared_cache)


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
    
    # If current signature is None (invalid config), consider it as changed
    if current_signature is None:
        return True
    
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
    global _solar_eclipse_cache, _lunar_eclipse_cache, _horizon_graph_cache
    
    _moon_report_cache = {"timestamp": 0, "data": None}
    _sun_report_cache = {"timestamp": 0, "data": None}
    _best_window_cache = {
        "strict": {"timestamp": 0, "data": None},
        "practical": {"timestamp": 0, "data": None},
        "illumination": {"timestamp": 0, "data": None}
    }
    _moon_planner_report_cache = {"timestamp": 0, "data": None}
    _dark_window_report_cache = {"timestamp": 0, "data": None}
    _solar_eclipse_cache = {"timestamp": 0, "data": None}
    _lunar_eclipse_cache = {"timestamp": 0, "data": None}
    _horizon_graph_cache = {"timestamp": 0, "data": None}
    _write_all_astronomical_caches_to_shared()


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
    sync_cache_from_shared("moon_report", _moon_report_cache)
    sync_cache_from_shared("sun_report", _sun_report_cache)
    sync_cache_from_shared("moon_planner", _moon_planner_report_cache)
    sync_cache_from_shared("dark_window", _dark_window_report_cache)
    sync_cache_from_shared("best_window_strict", _best_window_cache["strict"])
    sync_cache_from_shared("best_window_practical", _best_window_cache["practical"])
    sync_cache_from_shared("best_window_illumination", _best_window_cache["illumination"])
    sync_cache_from_shared("solar_eclipse", _solar_eclipse_cache)
    sync_cache_from_shared("lunar_eclipse", _lunar_eclipse_cache)
    sync_cache_from_shared("horizon_graph", _horizon_graph_cache)
    all_valid = (
        is_cache_valid(_moon_report_cache, CACHE_TTL) and
        is_cache_valid(_sun_report_cache, CACHE_TTL) and
        is_cache_valid(_best_window_cache["strict"], CACHE_TTL) and
        is_cache_valid(_moon_planner_report_cache, CACHE_TTL) and
        is_cache_valid(_dark_window_report_cache, CACHE_TTL) and
        is_cache_valid(_solar_eclipse_cache, CACHE_TTL) and
        is_cache_valid(_lunar_eclipse_cache, CACHE_TTL) and
        is_cache_valid(_horizon_graph_cache, CACHE_TTL)
    )
    return all_valid


def get_cache_init_status():
    """Get detailed cache initialization status"""
    sync_cache_from_shared("moon_report", _moon_report_cache)
    sync_cache_from_shared("sun_report", _sun_report_cache)
    sync_cache_from_shared("moon_planner", _moon_planner_report_cache)
    sync_cache_from_shared("dark_window", _dark_window_report_cache)
    sync_cache_from_shared("best_window_strict", _best_window_cache["strict"])
    sync_cache_from_shared("best_window_practical", _best_window_cache["practical"])
    sync_cache_from_shared("best_window_illumination", _best_window_cache["illumination"])
    sync_cache_from_shared("solar_eclipse", _solar_eclipse_cache)
    sync_cache_from_shared("lunar_eclipse", _lunar_eclipse_cache)
    sync_cache_from_shared("horizon_graph", _horizon_graph_cache)
    return {
        "moon_report": is_cache_valid(_moon_report_cache, CACHE_TTL),
        "sun_report": is_cache_valid(_sun_report_cache, CACHE_TTL),
        "best_window_strict": is_cache_valid(_best_window_cache["strict"], CACHE_TTL),
        "best_window_practical": is_cache_valid(_best_window_cache["practical"], CACHE_TTL),
        "best_window_illumination": is_cache_valid(_best_window_cache["illumination"], CACHE_TTL),
        "moon_planner": is_cache_valid(_moon_planner_report_cache, CACHE_TTL),
        "dark_window": is_cache_valid(_dark_window_report_cache, CACHE_TTL),
        "solar_eclipse": is_cache_valid(_solar_eclipse_cache, CACHE_TTL),
        "lunar_eclipse": is_cache_valid(_lunar_eclipse_cache, CACHE_TTL),
        "horizon_graph": is_cache_valid(_horizon_graph_cache, CACHE_TTL),
        "weather_forecast": is_cache_valid(_weather_cache, WEATHER_CACHE_TTL),
        "all_ready": is_astronomical_cache_ready(),
        "in_progress": _cache_initialization_in_progress
    }


def set_cache_initialization_in_progress(value):
    """Set the cache initialization progress flag"""
    global _cache_initialization_in_progress
    _cache_initialization_in_progress = value