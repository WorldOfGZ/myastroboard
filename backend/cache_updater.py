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
from aurora_predictions import get_aurora_report
from iss_passes import get_iss_passes_report
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
        logger.debug(f"Using location: lat={int(location.get('latitude'))}, lon={int(location.get('longitude'))}, tz=***")

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
        logger.debug(f"Using location: lat={int(location.get('latitude'))}, lon={int(location.get('longitude'))}, tz=***")

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
        logger.debug(f"Using location: lat={int(location.get('latitude'))}, lon={int(location.get('longitude'))}, tz=***")

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
        logger.debug(f"Using location: lat={int(location.get('latitude'))}, lon={int(location.get('longitude'))}, tz=***")

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
        logger.debug(f"Using location: lat={int(location.get('latitude'))}, lon={int(location.get('longitude'))}, tz=***")

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
        
        forecast = get_hourly_forecast()
        
        if forecast is None:
            logger.error("Failed to fetch weather forecast - API returned None")
            return
        
        # Serialize to JSON-compatible format so the endpoint can serve directly from cache
        df = forecast["hourly"].copy()
        df["date"] = df["date"].dt.strftime("%Y-%m-%dT%H:%M:%S%z")
        for col in df.columns:
            if df[col].dtype == "object":
                df[col] = df[col].apply(lambda x: x.decode() if isinstance(x, bytes) else x)
        location = {k: (v.decode() if isinstance(v, bytes) else v) for k, v in forecast["location"].items()}
        
        cache_store._weather_cache["data"] = {"location": location, "hourly": df.to_dict(orient="records")}
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
        logger.debug(f"Using location: lat={int(location.get('latitude'))}, lon={int(location.get('longitude'))}, tz=***")

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
        logger.debug(f"Using location: lat={int(location.get('latitude'))}, lon={int(location.get('longitude'))}, tz=***")

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
        logger.debug(f"Using location: lat={int(location.get('latitude'))}, lon={int(location.get('longitude'))}, tz=***")

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


def update_aurora_cache():
    """
    Updates the Aurora Borealis predictions cache
    """
    try:
        logger.info("Updating Aurora Borealis predictions cache...")
        config = load_config()
        
        if not config.get("location"):
            raise ValueError("Location configuration is missing")
        
        location = config["location"]
        logger.debug(f"Using location: lat={int(location.get('latitude'))}, lon={int(location.get('longitude'))}, tz=***")

        # Get aurora report
        report = get_aurora_report(
            latitude=location["latitude"],
            longitude=location["longitude"],
            timezone_str=location["timezone"]
        )

        if report is None:
            raise ValueError("Failed to generate aurora report")

        # Update global cache
        cache_store._aurora_cache["data"] = report
        cache_store._aurora_cache["timestamp"] = time.time()
        cache_store.update_shared_cache_entry(
            "aurora",
            cache_store._aurora_cache["data"],
            cache_store._aurora_cache["timestamp"]
        )

        logger.info(f"Aurora cache updated at {datetime.now().isoformat()}")

    except Exception as e:
        logger.error(f"Failed to update Aurora cache: {e}", exc_info=True)


def update_iss_passes_cache(days: int = 20):
    """
    Updates the ISS passes cache.
    """
    try:
        logger.info("Updating ISS passes cache...")
        config = load_config()

        if not config.get("location"):
            raise ValueError("Location configuration is missing")

        location = config["location"]
        logger.debug(f"Using location: lat={int(location.get('latitude'))}, lon={int(location.get('longitude'))}, tz=***")

        report = get_iss_passes_report(
            latitude=location["latitude"],
            longitude=location["longitude"],
            elevation_m=location.get("elevation", 0),
            timezone_str=location["timezone"],
            days=days,
        )

        if report is None:
            logger.warning("ISS passes report unavailable (provider/network/cache miss); keeping previous cache state")
            return

        cache_store._iss_passes_cache["data"] = report
        cache_store._iss_passes_cache["timestamp"] = time.time()
        cache_store.update_shared_cache_entry(
            "iss_passes",
            cache_store._iss_passes_cache["data"],
            cache_store._iss_passes_cache["timestamp"],
        )

        logger.info(f"ISS passes cache updated at {datetime.now().isoformat()}")

    except Exception as e:
        logger.warning(f"Failed to update ISS passes cache: {e}")


def update_planetary_events_cache():
    """
    Updates the Planetary Events cache
    Calculates planetary conjunctions, oppositions, elongations, and retrograde motion
    """
    try:
        logger.debug("Updating Planetary Events cache...")
        config = load_config()
        
        if not config.get("location"):
            raise ValueError("Location configuration is missing")
        
        location = config["location"]
        logger.debug(f"Using location: lat={int(location.get('latitude'))}, lon={int(location.get('longitude'))}, tz=***")

        from planetary_events import PlanetaryEventsService
        
        events_service = PlanetaryEventsService(
            latitude=location["latitude"],
            longitude=location["longitude"],
            elevation=location.get("elevation", 0),
            timezone=location.get("timezone", "UTC")
        )

        events = events_service.get_planetary_events(days_ahead=365)

        response = {
            "location": config["location"],
            "events": events,
            "count": len(events),
            "units": {
                "times": "ISO 8601 with user timezone offset",
                "angles": "degrees",
                "elevation": "meters"
            }
        }

        # Update global cache
        cache_store._planetary_events_cache["data"] = response
        cache_store._planetary_events_cache["timestamp"] = time.time()
        cache_store.update_shared_cache_entry(
            "planetary_events",
            cache_store._planetary_events_cache["data"],
            cache_store._planetary_events_cache["timestamp"]
        )

        logger.info(f"Planetary events cache updated at {datetime.now().isoformat()}")

    except Exception as e:
        logger.error(f"Failed to update Planetary events cache: {e}", exc_info=True)


def update_special_phenomena_cache():
    """
    Updates the Special Phenomena cache
    Calculates equinoxes, solstices, zodiacal light windows, and Milky Way visibility
    """
    try:
        logger.debug("Updating Special Phenomena cache...")
        config = load_config()
        
        if not config.get("location"):
            raise ValueError("Location configuration is missing")
        
        location = config["location"]
        logger.debug(f"Using location: lat={int(location.get('latitude'))}, lon={int(location.get('longitude'))}, tz=***")

        from special_phenomena import SpecialPhenomenaService
        
        phenomena_service = SpecialPhenomenaService(
            latitude=location["latitude"],
            longitude=location["longitude"],
            elevation=location.get("elevation", 0),
            timezone=location.get("timezone", "UTC")
        )

        events = phenomena_service.get_special_phenomena(days_ahead=365)

        response = {
            "location": config["location"],
            "events": events,
            "count": len(events),
            "units": {
                "times": "ISO 8601 with user timezone offset",
                "angles": "degrees",
                "elevation": "meters"
            }
        }

        # Update global cache
        cache_store._special_phenomena_cache["data"] = response
        cache_store._special_phenomena_cache["timestamp"] = time.time()
        cache_store.update_shared_cache_entry(
            "special_phenomena",
            cache_store._special_phenomena_cache["data"],
            cache_store._special_phenomena_cache["timestamp"]
        )

        logger.info(f"Special phenomena cache updated at {datetime.now().isoformat()}")

    except Exception as e:
        logger.error(f"Failed to update Special phenomena cache: {e}", exc_info=True)


def update_solar_system_events_cache():
    """
    Updates the Solar System Events cache
    Calculates meteor shower peaks, comet appearances, and asteroid occultations
    """
    try:
        logger.debug("Updating Solar System Events cache...")
        config = load_config()
        
        if not config.get("location"):
            raise ValueError("Location configuration is missing")
        
        location = config["location"]
        logger.debug(f"Using location: lat={int(location.get('latitude'))}, lon={int(location.get('longitude'))}, tz=***")

        from solar_system_events import SolarSystemEventsService
        
        solsys_service = SolarSystemEventsService(
            latitude=location["latitude"],
            longitude=location["longitude"],
            elevation=location.get("elevation", 0),
            timezone=location.get("timezone", "UTC")
        )

        events = solsys_service.get_solar_system_events(days_ahead=365)

        response = {
            "location": config["location"],
            "events": events,
            "count": len(events),
            "units": {
                "times": "ISO 8601 with user timezone offset",
                "angles": "degrees",
                "elevation": "meters"
            }
        }

        # Update global cache
        cache_store._solar_system_events_cache["data"] = response
        cache_store._solar_system_events_cache["timestamp"] = time.time()
        cache_store.update_shared_cache_entry(
            "solar_system_events",
            cache_store._solar_system_events_cache["data"],
            cache_store._solar_system_events_cache["timestamp"]
        )

        logger.info(f"Solar system events cache updated at {datetime.now().isoformat()}")

    except Exception as e:
        logger.error(f"Failed to update Solar system events cache: {e}", exc_info=True)


def update_sidereal_time_cache():
    """
    Updates the Sidereal Time cache
    Provides sidereal time information for current observation planning
    """
    try:
        logger.debug("Updating Sidereal Time cache...")
        config = load_config()
        
        if not config.get("location"):
            raise ValueError("Location configuration is missing")
        
        location = config["location"]
        logger.debug(f"Using location: lat={int(location.get('latitude'))}, lon={int(location.get('longitude'))}, tz=***")

        from sidereal_time import SiderealTimeService
        
        sidereal_service = SiderealTimeService(
            latitude=location["latitude"],
            longitude=location["longitude"],
            elevation=location.get("elevation", 0),
            timezone=location.get("timezone", "UTC")
        )

        # Get current sidereal time
        current_info = sidereal_service.get_current_sidereal_info()
        
        # Get hourly sidereal times for current day
        from datetime import datetime
        today = datetime.today().date()
        hourly_info = sidereal_service.get_hourly_sidereal_times(today)

        response = {
            "location": config["location"],
            "current": current_info,
            "hourly_forecast": hourly_info,
            "units": {
                "sidereal_time": "hours (0-24, where 24h = 1 sidereal day = 23h56m4s solar time)",
                "coordinates": "degrees",
                "elevation": "meters"
            }
        }

        # Update global cache
        cache_store._sidereal_time_cache["data"] = response
        cache_store._sidereal_time_cache["timestamp"] = time.time()
        cache_store.update_shared_cache_entry(
            "sidereal_time",
            cache_store._sidereal_time_cache["data"],
            cache_store._sidereal_time_cache["timestamp"]
        )

        logger.info(f"Sidereal time cache updated at {datetime.now().isoformat()}")

    except Exception as e:
        logger.error(f"Failed to update Sidereal time cache: {e}", exc_info=True)
        

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
    start_time = datetime.now()
    
    try:
        # Check if location has changed and reset caches if needed
        check_and_handle_config_changes()
        
        # All cache update functions
        cache_functions = [
            ("moon_report", update_moon_report_cache),
            ("dark_window", update_dark_window_cache),
            ("moon_planner", update_moon_planner_cache),
            ("sun_report", update_sun_report_cache),
            ("solar_eclipse", update_solar_eclipse_cache),
            ("lunar_eclipse", update_lunar_eclipse_cache),
            ("horizon_graph", update_horizon_graph_cache),
            ("aurora", update_aurora_cache),
            ("iss_passes", update_iss_passes_cache),
            ("planetary_events", update_planetary_events_cache),
            ("special_phenomena", update_special_phenomena_cache),
            ("solar_system_events", update_solar_system_events_cache),
            ("sidereal_time", update_sidereal_time_cache),
            ("best_window", update_best_window_cache),
            ("weather_forecast", update_weather_cache)
        ]
        
        total_steps = len(cache_functions)
        success_count = 0
        
        for index, (cache_name, cache_function) in enumerate(cache_functions, start=1):
            try:
                # Update progress before starting each cache update
                cache_store.set_cache_initialization_in_progress(
                    True, 
                    current_step=index, 
                    total_steps=total_steps, 
                    step_name=cache_name
                )
                cache_function()
                success_count += 1
            except Exception as e:
                logger.error(f"Failed to update {cache_name} cache: {e}", exc_info=True)
        
        duration = (datetime.now() - start_time).total_seconds()
        logger.info(f"Cache refresh cycle completed: {success_count}/{len(cache_functions)} caches updated successfully in {duration:.2f} seconds")
        
    finally:
        cache_store.set_cache_initialization_in_progress(False)
