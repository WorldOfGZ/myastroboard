"""
Cache functions for heavy computations.
"""

from datetime import datetime
import time
from logging_config import get_logger

from repo_config import load_config
from moon_astrotonight import AstroTonightService
from moon_phases import MoonService
from moon_planner import MoonPlanner
from sun_phases import SunService
import cache_store

# Initialize logger for this module
logger = get_logger(__name__)

def update_moon_report_cache():
    """
    Updates the Moon report cache
    """
    try:
        config = load_config()

        moon = MoonService(
            latitude=config["location"]["latitude"],
            longitude=config["location"]["longitude"],
            timezone=config["location"]["timezone"]
        )

        report = moon.get_report()

        report_json = {}
        for k, v in report.__dict__.items():
            if isinstance(v, bytes):
                report_json[k] = v.decode("utf-8")
            else:
                report_json[k] = v

        response = {
            "location": config["location"],
            "moon": report_json
        }

        # Update global cache
        cache_store._moon_report_cache["data"] = response
        cache_store._moon_report_cache["timestamp"] = time.time()

        logger.info(f"Moon report cache updated at {datetime.now().isoformat()}")

    except Exception as e:
        logger.error(f"Failed to update Moon report cache: {e}")


def update_dark_window_cache():
    """
    Updates the next moonless dark window cache
    """
    try:
        config = load_config()

        moon = MoonService(
            latitude=config["location"]["latitude"],
            longitude=config["location"]["longitude"],
            timezone=config["location"]["timezone"]
        )

        report = moon.get_report()

        response = {
            "next_dark_night": {
                "start": report.next_dark_night_start,
                "end": report.next_dark_night_end
            }
        }

        # Mettre à jour le cache global
        cache_store._dark_window_report_cache["data"] = response
        cache_store._dark_window_report_cache["timestamp"] = time.time()

        logger.info(f"Dark window cache updated at {datetime.now().isoformat()}")

    except Exception as e:
        logger.error(f"Failed to update dark window cache: {e}")


def update_moon_planner_cache():
    """
    Updates the Moon Planner cache (next 7 nights report)
    """
    try:
        config = load_config()

        planner = MoonPlanner(
            latitude=config["location"]["latitude"],
            longitude=config["location"]["longitude"],
            timezone=config["location"]["timezone"]
        )

        nights = planner.next_7_nights()

        response = {
            "location": config["location"],
            "next_7_nights": nights,
            "units": {
                "dark_hours": "hours",
                "altitude": "degrees",
                "illumination": "percent"
            }
        }

        # Update global cache
        cache_store._moon_planner_report_cache["data"] = response
        cache_store._moon_planner_report_cache["timestamp"] = time.time()

        logger.info(f"Moon Planner cache updated at {datetime.now().isoformat()}")

    except Exception as e:
        logger.error(f"Failed to update Moon Planner cache: {e}")


def update_sun_report_cache():
    """
    Updates the Sun report cache (today report)
    """
    try:
        config = load_config()

        sun = SunService(
            latitude=config["location"]["latitude"],
            longitude=config["location"]["longitude"],
            timezone=config["location"]["timezone"]
        )

        report = sun.get_today_report()

        response = {
            "location": config["location"],
            "sun": report.__dict__,
            "units": {
                "times": "local timezone",
                "true_night_hours": "hours"
            }
        }

        # Update global cache
        cache_store._sun_report_cache["data"] = response
        cache_store._sun_report_cache["timestamp"] = time.time()

        logger.info(f"Sun report cache updated at {datetime.now().isoformat()}")

    except Exception as e:
        logger.error(f"Failed to update Sun report cache: {e}")


def update_best_window_cache():
    """
    Met à jour le cache des meilleures fenêtres d'observation pour ce soir
    (modes : strict, practical, illumination)
    """
    try:
        config = load_config()

        service = AstroTonightService(
            latitude=config["location"]["latitude"],
            longitude=config["location"]["longitude"],
            timezone=config["location"]["timezone"]
        )

        for mode in ["strict", "practical", "illumination"]:
            window = service.best_window_tonight(mode=mode)

            cache_store._best_window_cache[mode]["data"] = {
                "location": config["location"],
                "mode": mode,
                "best_window": window.__dict__,
                "units": {
                    "times": "local timezone",
                    "duration": "hours",
                    "score": "0-100"
                }
            }
            cache_store._best_window_cache[mode]["timestamp"] = time.time()

        logger.info(f"Best window cache updated at {datetime.now().isoformat()}")

    except Exception as e:
        logger.error(f"Failed to update best window cache: {e}")
        
def fully_initialize_caches():
    """Updates all caches and activates the flag"""
    update_moon_report_cache()
    update_dark_window_cache()
    update_moon_planner_cache()
    update_sun_report_cache()
    update_best_window_cache()

    # Update the flag in the module
    cache_store._cache_fully_initialized = True
    logger.info("All caches fully initialized")