"""
Shared constants and configuration for MyAstroBoard backend
Centralizes commonly used values to avoid duplication and ensure consistency
"""
import os

# Directory paths
DATA_DIR = os.environ.get('DATA_DIR', '/app/data')
OUTPUT_DIR = os.environ.get('OUTPUT_DIR', '/app/uptonight_outputs')
CONFIG_DIR = os.environ.get('CONFIG_DIR', '/app/uptonight_configs')

# File paths
CONFIG_FILE = os.path.join(DATA_DIR, 'config.json')
LOG_FILE = os.path.join(DATA_DIR, 'myastroboard.log')
CONDITIONS_FILE = os.path.join(DATA_DIR, 'conditions.json')

# Environment configuration
SCHEDULE_INTERVAL = int(os.environ.get('SCHEDULE_INTERVAL', '7201'))  # 2 hours in seconds

# API/Service URLs
URL_OPENMETEO = "https://api.open-meteo.com/v1/forecast"

# Cache configuration
CACHE_TTL = 1800  # seconds

# Weather API configuration
WEATHER_CACHE_TTL = 3600  # seconds (1 hour)
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

# Version and image configuration
UPTONIGHT_VERSION_FILE = '/app/UPTONIGHT_VERSION'
