"""
Cache functions for heavy computations.
All cache management is server-side with TTL-based expiration.
Automatically resets astronomical caches when location parameters change.
"""

from datetime import datetime
import time
from logging_config import get_logger

from repo_config import load_config
from moon_astrotonight import AstroTonightService
from moon_phases import MoonService
from moon_planner import MoonPlanner
from sun_phases import SunService
from sun_eclipse import SolarEclipseService
from moon_eclipse import LunarEclipseService
from horizon_graph import HorizonGraphService
from weather_openmeteo import get_hourly_forecast
import cache_store

# Initialize logger for this module
logger = get_logger(__name__)


def check_and_handle_config_changes():
    """
    Check if location configuration has changed.
    If it has, reset all astronomical caches.
    This ensures cache is invalidated when the observer location changes.
    """
    config = load_config()
    location_config = config.get("location")
    
    if not location_config:
        return False
    
    # Check if this is the first time (no persisted location)
    is_first_time = cache_store._last_known_location_config["latitude"] is None
    
    if is_first_time:
        # First initialization - just store the config without warning
        logger.info("Initializing location config tracking")
        cache_store.update_location_config(location_config)
        return False
    
    # Check if location actually changed
    if cache_store.has_location_changed(location_config):
        logger.warning(f"Location configuration changed! Resetting all astronomical caches.")
        cache_store.reset_all_caches()
        cache_store.update_location_config(location_config)
        return True
    
    return False

def update_moon_report_cache():
    """
    Updates the Moon report cache
    """
    try:
        logger.info("Updating Moon report cache...")
        config = load_config()
        
        if not config.get("location"):
            raise ValueError("Location configuration is missing")
        
        location = config["location"]
        logger.debug(f"Using location: lat={location.get('latitude')}, lon={location.get('longitude')}, tz={location.get('timezone')}")

        moon = MoonService(
            latitude=location["latitude"],
            longitude=location["longitude"],
            timezone=location["timezone"]
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
        cache_store.update_shared_cache_entry(
            "moon_report",
            cache_store._moon_report_cache["data"],
            cache_store._moon_report_cache["timestamp"]
        )

        logger.info(f"Moon report cache updated at {datetime.now().isoformat()}")

    except Exception as e:
        logger.error(f"Failed to update Moon report cache: {e}")


def update_dark_window_cache():
    """
    Updates the next moonless dark window cache
    """
    try:
        logger.debug("Updating Dark window cache...")
        config = load_config()
        
        if not config.get("location"):
            raise ValueError("Location configuration is missing")
        
        location = config["location"]
        logger.debug(f"Using location: lat={location.get('latitude')}, lon={location.get('longitude')}, tz={location.get('timezone')}")

        moon = MoonService(
            latitude=location["latitude"],
            longitude=location["longitude"],
            timezone=location["timezone"]
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
        cache_store.update_shared_cache_entry(
            "dark_window",
            cache_store._dark_window_report_cache["data"],
            cache_store._dark_window_report_cache["timestamp"]
        )

        logger.info(f"Dark window cache updated at {datetime.now().isoformat()}")

    except Exception as e:
        logger.error(f"Failed to update dark window cache: {e}")


def update_moon_planner_cache():
    """
    Updates the Moon Planner cache (next 7 nights report)
    """
    try:
        logger.debug("Updating Moon Planner cache...")
        config = load_config()
        
        if not config.get("location"):
            raise ValueError("Location configuration is missing")
        
        location = config["location"]
        logger.debug(f"Using location: lat={location.get('latitude')}, lon={location.get('longitude')}, tz={location.get('timezone')}")

        planner = MoonPlanner(
            latitude=location["latitude"],
            longitude=location["longitude"],
            timezone=location["timezone"]
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
        cache_store.update_shared_cache_entry(
            "moon_planner",
            cache_store._moon_planner_report_cache["data"],
            cache_store._moon_planner_report_cache["timestamp"]
        )

        logger.info(f"Moon Planner cache updated at {datetime.now().isoformat()}")

    except Exception as e:
        logger.error(f"Failed to update Moon Planner cache: {e}")


def update_sun_report_cache():
    """
    Updates the Sun report cache (today report)
    """
    try:
        logger.debug("Updating Sun report cache...")
        config = load_config()
        
        if not config.get("location"):
            raise ValueError("Location configuration is missing")
        
        location = config["location"]
        logger.debug(f"Using location: lat={location.get('latitude')}, lon={location.get('longitude')}, tz={location.get('timezone')}")

        sun = SunService(
            latitude=location["latitude"],
            longitude=location["longitude"],
            timezone=location["timezone"]
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
        cache_store.update_shared_cache_entry(
            "sun_report",
            cache_store._sun_report_cache["data"],
            cache_store._sun_report_cache["timestamp"]
        )

        logger.info(f"Sun report cache updated at {datetime.now().isoformat()}")

    except Exception as e:
        logger.error(f"Failed to update Sun report cache: {e}")


def update_best_window_cache():
    """
    Met à jour le cache des meilleures fenêtres d'observation pour ce soir
    (modes : strict, practical, illumination)
    """
    try:
        logger.debug("Updating Best window cache...")
        config = load_config()
        
        if not config.get("location"):
            raise ValueError("Location configuration is missing")
        
        location = config["location"]
        logger.debug(f"Using location: lat={location.get('latitude')}, lon={location.get('longitude')}, tz={location.get('timezone')}")

        service = AstroTonightService(
            latitude=location["latitude"],
            longitude=location["longitude"],
            timezone=location["timezone"]
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
            cache_store.update_shared_cache_entry(
                f"best_window_{mode}",
                cache_store._best_window_cache[mode]["data"],
                cache_store._best_window_cache[mode]["timestamp"]
            )

        logger.info(f"Best window cache updated at {datetime.now().isoformat()}")

    except Exception as e:
        logger.error(f"Failed to update best window cache: {e}")


def update_weather_cache():
    """
    Updates the weather forecast cache
    Pre-fetches weather data from Open-Meteo API and caches it
    """
    try:
        logger.debug("Updating Weather forecast cache...")
        
        # Call the weather API - this will be cached at HTTP level by requests_cache
        # and also stored in our application cache for consistency
        forecast = get_hourly_forecast()
        
        if forecast is None:
            logger.error("Failed to fetch weather forecast - API returned None")
            return
        
        # Store in application cache
        cache_store._weather_cache["data"] = forecast
        cache_store._weather_cache["timestamp"] = time.time()
        
        logger.info(f"Weather forecast cache updated at {datetime.now().isoformat()}")
        
    except Exception as e:
        logger.error(f"Failed to update Weather forecast cache: {e}")


def update_solar_eclipse_cache():
    """
    Updates the Solar Eclipse cache
    """
    try:
        logger.debug("Updating Solar Eclipse cache...")
        config = load_config()
        
        if not config.get("location"):
            raise ValueError("Location configuration is missing")
        
        location = config["location"]
        logger.debug(f"Using location: lat={location.get('latitude')}, lon={location.get('longitude')}, tz={location.get('timezone')}")

        eclipse_service = SolarEclipseService(
            latitude=location["latitude"],
            longitude=location["longitude"],
            timezone=location["timezone"]
        )

        eclipse = eclipse_service.get_next_eclipse()

        if eclipse is None:
            response = {
                "location": config["location"],
                "solar_eclipse": None,
                "message": "No solar eclipse found in the next 18 months"
            }
        else:
            # Convert dataclass to dict
            eclipse_dict = eclipse.__dict__.copy()
            # Convert altitude_vs_time EclipsePoint objects to dicts
            if "altitude_vs_time" in eclipse_dict:
                eclipse_dict["altitude_vs_time"] = [
                    point.__dict__ for point in eclipse_dict["altitude_vs_time"]
                ]
            
            response = {
                "location": config["location"],
                "solar_eclipse": eclipse_dict,
                "units": {
                    "times": "ISO format local timezone",
                    "altitude": "degrees",
                    "azimuth": "degrees",
                    "duration": "minutes",
                    "astrophotography_score": "0-10"
                }
            }

        # Update global cache
        cache_store._solar_eclipse_cache["data"] = response
        cache_store._solar_eclipse_cache["timestamp"] = time.time()
        cache_store.update_shared_cache_entry(
            "solar_eclipse",
            cache_store._solar_eclipse_cache["data"],
            cache_store._solar_eclipse_cache["timestamp"]
        )

        logger.info(f"Solar eclipse cache updated at {datetime.now().isoformat()}")

    except Exception as e:
        logger.error(f"Failed to update Solar Eclipse cache: {e}", exc_info=True)


def update_lunar_eclipse_cache():
    """
    Updates the Lunar Eclipse cache
    """
    try:
        logger.debug("Updating Lunar Eclipse cache...")
        config = load_config()
        
        if not config.get("location"):
            raise ValueError("Location configuration is missing")
        
        location = config["location"]
        logger.debug(f"Using location: lat={location.get('latitude')}, lon={location.get('longitude')}, tz={location.get('timezone')}")

        eclipse_service = LunarEclipseService(
            latitude=location["latitude"],
            longitude=location["longitude"],
            timezone=location["timezone"]
        )

        eclipse = eclipse_service.get_next_eclipse()

        if eclipse is None:
            response = {
                "location": config["location"],
                "lunar_eclipse": None,
                "message": "No lunar eclipse found in the next 18 months"
            }
        else:
            # Convert dataclass to dict
            eclipse_dict = eclipse.__dict__.copy()
            # Convert altitude_vs_time EclipsePoint objects to dicts
            if "altitude_vs_time" in eclipse_dict:
                eclipse_dict["altitude_vs_time"] = [
                    point.__dict__ for point in eclipse_dict["altitude_vs_time"]
                ]
            
            response = {
                "location": config["location"],
                "lunar_eclipse": eclipse_dict,
                "units": {
                    "times": "ISO format local timezone",
                    "altitude": "degrees",
                    "azimuth": "degrees",
                    "duration": "minutes",
                    "astrophotography_score": "0-10"
                }
            }

        # Update global cache
        cache_store._lunar_eclipse_cache["data"] = response
        cache_store._lunar_eclipse_cache["timestamp"] = time.time()
        cache_store.update_shared_cache_entry(
            "lunar_eclipse",
            cache_store._lunar_eclipse_cache["data"],
            cache_store._lunar_eclipse_cache["timestamp"]
        )

        logger.info(f"Lunar eclipse cache updated at {datetime.now().isoformat()}")

    except Exception as e:
        logger.error(f"Failed to update Lunar Eclipse cache: {e}", exc_info=True)

def update_horizon_graph_cache():
    """
    Updates the Horizon Graph cache (sun and moon positions throughout the day)
    """
    try:
        logger.info("Updating Horizon Graph cache...")
        config = load_config()
        
        if not config.get("location"):
            raise ValueError("Location configuration is missing")
        
        location = config["location"]
        logger.debug(f"Using location: lat={location.get('latitude')}, lon={location.get('longitude')}, tz={location.get('timezone')}")

        horizon_service = HorizonGraphService(
            latitude=location["latitude"],
            longitude=location["longitude"],
            timezone=location["timezone"]
        )

        horizon_data = horizon_service.get_horizon_data()

        if horizon_data is None:
            response = {
                "location": config["location"],
                "horizon_data": None,
                "message": "Failed to calculate horizon data"
            }
        else:
            # Convert dataclass to dict
            horizon_dict = horizon_data.__dict__.copy()
            # Convert HorizonPoint objects to dicts
            if "sun_data" in horizon_dict:
                horizon_dict["sun_data"] = [
                    point.__dict__ for point in horizon_dict["sun_data"]
                ]
            if "moon_data" in horizon_dict:
                horizon_dict["moon_data"] = [
                    point.__dict__ for point in horizon_dict["moon_data"]
                ]
            
            response = {
                "location": config["location"],
                "horizon_data": horizon_dict,
                "units": {
                    "altitude": "degrees",
                    "azimuth": "degrees",
                    "time": "HH:MM local timezone"
                }
            }

        # Update global cache
        cache_store._horizon_graph_cache["data"] = response
        cache_store._horizon_graph_cache["timestamp"] = time.time()
        cache_store.update_shared_cache_entry(
            "horizon_graph",
            cache_store._horizon_graph_cache["data"],
            cache_store._horizon_graph_cache["timestamp"]
        )

        logger.info(f"Horizon Graph cache updated at {datetime.now().isoformat()}")

    except Exception as e:
        logger.error(f"Failed to update Horizon Graph cache: {e}", exc_info=True)
        

def fully_initialize_caches():
    """
    Updates all cache entries with fresh calculations.
    Automatically resets caches if location configuration has changed.
    This is called:
    - On container/server startup
    - On schedule (every CACHE_TTL interval)
    - When location configuration changes
    """
    logger.debug("Starting cache refresh cycle...")
    cache_store.set_cache_initialization_in_progress(True)
    start_time = datetime.now()
    
    try:
        # Check if location has changed and reset caches if needed
        check_and_handle_config_changes()
        
        # All cache update functions
        cache_functions = [
            ("Moon report", update_moon_report_cache),
            ("Dark window", update_dark_window_cache),
            ("Moon planner", update_moon_planner_cache),
            ("Sun report", update_sun_report_cache),
            ("Solar eclipse", update_solar_eclipse_cache),
            ("Lunar eclipse", update_lunar_eclipse_cache),
            ("Horizon graph", update_horizon_graph_cache),
            ("Best window", update_best_window_cache),
            ("Weather forecast", update_weather_cache)
        ]
        
        success_count = 0
        for cache_name, cache_function in cache_functions:
            try:
                cache_function()
                success_count += 1
            except Exception as e:
                logger.error(f"Failed to update {cache_name} cache: {e}", exc_info=True)
        
        duration = (datetime.now() - start_time).total_seconds()
        logger.info(f"Cache refresh cycle completed: {success_count}/{len(cache_functions)} caches updated successfully in {duration:.2f} seconds")
        
    finally:
        cache_store.set_cache_initialization_in_progress(False)
