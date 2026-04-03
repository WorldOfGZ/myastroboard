"""
Shared constants and configuration for MyAstroBoard backend
Centralizes commonly used values to avoid duplication and ensure consistency
"""
import os

# Directory paths
DEFAULT_DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'data'))
DATA_DIR = os.environ.get('DATA_DIR', DEFAULT_DATA_DIR)
DATA_DIR_CACHE = os.path.join(DATA_DIR, 'cache')
SKYTONIGHT_DIR = os.environ.get('SKYTONIGHT_DIR', os.path.join(DATA_DIR, 'skytonight'))
SKYTONIGHT_CATALOGUES_DIR = os.path.join(SKYTONIGHT_DIR, 'catalogues')
SKYTONIGHT_DATASET_FILE = os.path.join(SKYTONIGHT_CATALOGUES_DIR, 'targets.json')
SKYTONIGHT_RESULTS_FILE = os.path.join(SKYTONIGHT_DIR, 'calculation_results.json')
SKYTONIGHT_SKYMAP_FILE = os.path.join(SKYTONIGHT_DIR, 'skymap_data.json')

# File paths
CONFIG_FILE = os.path.join(DATA_DIR, 'config.json')
LOG_FILE = os.path.join(DATA_DIR, 'myastroboard.log')
CONDITIONS_FILE = os.path.join(DATA_DIR_CACHE, 'conditions.json')
CONFIG_DIR = os.path.join(SKYTONIGHT_DIR, 'configs')
OUTPUT_DIR = os.path.join(SKYTONIGHT_DIR, 'outputs')
SKYTONIGHT_OUTPUT_DIR = os.path.join(SKYTONIGHT_DIR, 'outputs')
SKYTONIGHT_LOGS_DIR = os.path.join(SKYTONIGHT_DIR, 'logs')
SKYTONIGHT_RUNTIME_DIR = os.path.join(SKYTONIGHT_DIR, 'runtime')
SKYTONIGHT_SCHEDULER_STATUS_FILE = os.path.join(SKYTONIGHT_RUNTIME_DIR, 'scheduler_status.json')
SKYTONIGHT_SCHEDULER_TRIGGER_FILE = os.path.join(SKYTONIGHT_RUNTIME_DIR, 'scheduler_trigger')
SKYTONIGHT_SCHEDULER_LOCK_FILE = os.path.join(SKYTONIGHT_RUNTIME_DIR, 'scheduler.lock')

# Environment configuration
SCHEDULE_INTERVAL = int(os.environ.get('SCHEDULE_INTERVAL', '21601'))  # 6 hours in seconds (1 sec more to see it in logs immediately on startup so not set)

# API/Service URLs
URL_OPENMETEO = "https://api.open-meteo.com/v1/forecast"

# Cache configuration
CACHE_TTL = 1800  # seconds

# Weather API configuration
WEATHER_CACHE_TTL = 3600  # seconds (1 hour)

# Version update check configuration
VERSION_UPDATE_CACHE_TTL = 14400  # seconds (4 hours)
OPENMETEO_RETRY_COUNT = 5
OPENMETEO_BACKOFF_FACTOR = 0.2

# Astronomical constants (angles in degrees)
ASTRONOMICAL_NIGHT_ALTITUDE = -18  # Sun altitude for astronomical night
NAUTICAL_TWILIGHT_ALTITUDE = -12   # Sun altitude for nautical twilight
CIVIL_TWILIGHT_ALTITUDE = -6       # Sun altitude for civil twilight
MOON_ILLUMINATION_THRESHOLD = 15   # Percentage - moon considered "low" below this
MOON_ALTITUDE_PRACTICAL = 5        # Degrees - minimum moon altitude for visibility
WIND_TRACKING_THRESHOLD = 15.0     # km/h - wind speed that affects mount tracking

# Logging configuration
LOG_MAX_BYTES = 10 * 1024 * 1024  # 10MB
LOG_BACKUP_COUNT = 5
LOG_LEVEL = os.environ.get('LOG_LEVEL', 'WARNING').upper()  # Global log level for file output
CONSOLE_LOG_LEVEL = os.environ.get('CONSOLE_LOG_LEVEL', 'WARNING').upper()  # Console log level

# SkyTonight dataset configuration
SKYTONIGHT_PREFERRED_NAME_ORDER = ['CommonName', 'Messier', 'OpenNGC', 'OpenIC', 'Caldwell']