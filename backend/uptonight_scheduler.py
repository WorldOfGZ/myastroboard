"""
Uptonight Scheduler - Manages periodic execution of uptonight Docker container
Runs uptonight for each selected target with 10-minute delays between runs
"""
import os
import subprocess
import threading
import time
import yaml
import json
from datetime import datetime, timedelta
from txtconf_loader import get_uptonight_image_name, get_uptonight_version
from weather_openmeteo import get_uptonight_conditions
from constants import DATA_DIR, OUTPUT_DIR, CONFIG_DIR, SCHEDULE_INTERVAL
from logging_config import get_logger
from utils import IndentDumper

# Configure logging and ensure data directory exists
os.makedirs(DATA_DIR, exist_ok=True)
UPTONIGHT_IMAGE = get_uptonight_image_name()
UPTONIGHT_VERSION = get_uptonight_version()

# Create logger with centralized configuration
logger = get_logger(__name__)

# Host paths for Docker-in-Docker volume mounts
HOST_OUTPUT_DIR = os.environ.get('HOST_OUTPUT_DIR', OUTPUT_DIR)
HOST_CONFIG_DIR = os.environ.get('HOST_CONFIG_DIR', CONFIG_DIR)
if HOST_OUTPUT_DIR == OUTPUT_DIR and os.path.exists('/.dockerenv'):
    logger.warning("HOST_OUTPUT_DIR not set in Docker environment - Docker-in-Docker may not work correctly")
if HOST_CONFIG_DIR == CONFIG_DIR and os.path.exists('/.dockerenv'):
    logger.warning("HOST_CONFIG_DIR not set in Docker environment - Docker-in-Docker may not work correctly")


class UptonightScheduler:
    def __init__(self, config_loader, app=None):
        """
        Initialize scheduler
        :param config_loader: Function to load current configuration
        :param app: Flask app instance for application context
        """
        self.config_loader = config_loader
        self.app = app
        self.running = False
        self.thread = None
        self.last_run = None

        # Progress tracking
        self.current_catalogue = None
        self.current_index = 0
        self.total_catalogues = 0
        self.is_executing = False
        self.execution_start_time = None

        # Lock to prevent simultaneous executions
        self._execution_lock = threading.Lock()
        self._scheduler_started = False

        # Ensure directories exist
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        os.makedirs(CONFIG_DIR, exist_ok=True)

    def start(self):
        """Start the scheduler"""
        if self._scheduler_started:
            logger.warning("Scheduler already started")
            return

        self._scheduler_started = True
        self.running = True
        self.thread = threading.Thread(target=self._run_loop, daemon=True)
        self.thread.start()
        logger.info(f"Scheduler started - will run every {SCHEDULE_INTERVAL} seconds")

    def stop(self):
        """Stop the scheduler"""
        self.running = False
        if self.thread:
            self.thread.join(timeout=5)
        logger.info("Scheduler stopped")

    def _run_loop(self):
        """Main scheduler loop"""
        while self.running:
            time.sleep(60)  # Check every minute
            
            # Check for manual trigger file
            trigger_file = os.path.join(DATA_DIR, 'scheduler_trigger')
            manual_trigger = False
            if os.path.exists(trigger_file):
                try:
                    os.remove(trigger_file)
                    manual_trigger = True
                    logger.info("Manual trigger detected, executing uptonight")
                except Exception as e:
                    logger.error(f"Failed to remove trigger file: {e}")
            
            # Execute if manually triggered or scheduled
            if manual_trigger or self.last_run is None or (datetime.now() - self.last_run).total_seconds() >= SCHEDULE_INTERVAL:
                self._execute_uptonight_for_all_catalogues()

    def _execute_uptonight_for_all_catalogues(self):
        """Execute uptonight for each selected catalogue with delays"""
        if self._execution_lock.locked():
            logger.warning("Execution already in progress, skipping new run")
            return

        with self._execution_lock:
            try:
                logger.info("Starting uptonight execution cycle")
                self.last_run = datetime.now()
                self.is_executing = True

                config = self.config_loader()
                selected_catalogues = config.get('selected_catalogues', [])

                if not selected_catalogues:
                    logger.warning("No catalogues selected, skipping uptonight execution")
                    self.is_executing = False
                    return
                
                self._cleanup_old_uptonight_images(UPTONIGHT_VERSION)

                logger.info(f"Executing uptonight for {len(selected_catalogues)} catalogues")

                weather_conditions = self._get_weather_for_config(config)
                logger.info(f"Retrieved weather conditions: "
                            f"T={weather_conditions['temperature']}°C, "
                            f"P={weather_conditions['pressure']} bar, "
                            f"RH={weather_conditions['relative_humidity']*100}%")

                for idx, catalogue in enumerate(selected_catalogues):
                    try:
                        self.current_catalogue = catalogue
                        self.current_index = idx + 1
                        self.total_catalogues = len(selected_catalogues)
                        self.execution_start_time = datetime.now()

                        logger.info(f"Processing catalogue {idx+1}/{len(selected_catalogues)}: {catalogue}")
                        self._execute_uptonight_for_catalogue(config, catalogue, weather_conditions)
                    except Exception as e:
                        logger.error(f"Error executing catalogue {catalogue}: {e}")

                # Reset progress
                self.current_catalogue = None
                self.current_index = 0
                self.total_catalogues = 0
                self.is_executing = False
                self.execution_start_time = None

                logger.info("Uptonight execution cycle completed")

            except Exception as e:
                logger.error(f"Error in uptonight execution cycle: {e}")
                self.is_executing = False

    def _execute_uptonight_for_catalogue(self, config, catalogue, weather_conditions):
        """Execute uptonight Docker container for a single catalogue"""
        safe_name = catalogue.replace(' ', '_').replace('/', '_')
        config_path = os.path.join(CONFIG_DIR, f"config_{safe_name}.yaml")
        output_dir = os.path.join(OUTPUT_DIR, safe_name)
        os.makedirs(output_dir, exist_ok=True)

        # Remove old files
        for root, dirs, files in os.walk(output_dir, topdown=False):
            for name in files:
                try:
                    os.remove(os.path.join(root, name))
                except Exception as e:
                    logger.warning(f"Could not remove file {name}: {e}")
            for name in dirs:
                try:
                    os.rmdir(os.path.join(root, name))
                except Exception as e:
                    logger.warning(f"Could not remove directory {name}: {e}")

        log_file = os.path.join(output_dir, 'uptonight.log')
        uptonight_config = self._generate_uptonight_config_for_catalogue(config, catalogue, weather_conditions)

        with open(config_path, 'w') as f:
            yaml.dump(uptonight_config, f, Dumper=IndentDumper, default_flow_style=False, sort_keys=False)

        logger.debug(f"Generated config for catalogue {catalogue}")

        # Pull image
        try:
            subprocess.run(['docker', 'pull', UPTONIGHT_IMAGE], check=True, capture_output=True, timeout=300)
        except Exception as e:
            logger.warning(f"Could not pull uptonight image: {e}")

        # Run container
        try:
            config_rel_path = os.path.relpath(config_path, CONFIG_DIR)
            output_rel_path = os.path.relpath(output_dir, OUTPUT_DIR)
            host_config_path = os.path.join(HOST_CONFIG_DIR, config_rel_path).replace('\\', '/')
            host_output_path = os.path.join(HOST_OUTPUT_DIR, output_rel_path).replace('\\', '/')

            docker_cmd = [
                'docker', 'run', '--rm',
                '-v', f'{host_config_path}:/app/config.yaml:ro',
                '-v', f'{host_output_path}:/app/out',
                UPTONIGHT_IMAGE
            ]

            logger.debug(f"Running uptonight for catalogue {catalogue}...")

            result = subprocess.run(docker_cmd, capture_output=True, text=True, timeout=600)

            # Write log
            with open(log_file, 'w') as log_f:
                log_f.write(f"=== STDOUT ===\n{result.stdout or ''}\n")
                log_f.write(f"=== STDERR ===\n{result.stderr or ''}\n")
                log_f.write(f"\n=== Exit code: {result.returncode} ===\n")

            if result.returncode == 0:
                logger.debug(f"Successfully executed uptonight for catalogue {catalogue}")
            else:
                logger.error(f"Uptonight failed for catalogue {catalogue}")

        except subprocess.TimeoutExpired:
            logger.error(f"Uptonight execution timed out for catalogue {catalogue}")
        except Exception as e:
            logger.error(f"Error running uptonight Docker for catalogue {catalogue}: {e}")

    def _get_weather_for_config(self, config):
        """Get current weather conditions for uptonight config"""
        default_conditions = {"pressure": 1013.0, "temperature": 15.0, "relative_humidity": 0.5}
        conditions = get_uptonight_conditions()
        if conditions:
            logger.debug("Using Open-Meteo uptonight conditions")
            return conditions
        logger.warning("Open-Meteo failed, fallback to default conditions")
        return default_conditions

    def _generate_uptonight_config_for_catalogue(self, config, catalogue, weather_conditions):
        """Generate uptonight configuration for a single catalogue"""
        location = config.get('location', {})
        lat = location.get('latitude', 0)
        lon = location.get('longitude', 0)

        if lat == 0 and lon == 0:
            raise ValueError("Location coordinates (latitude/longitude) must be configured before running uptonight")

        uptonight_config = {
            'target_list': f'targets/{catalogue}',
            'output_dir': 'out',
            'live_mode': False,
            'output_datestamp': False,
            'features': config.get('features', {k: True for k in ['horizon','objects','bodies','comets','alttime']}),
            'location': {
                'longitude': self._format_coordinate(lon, 'lon'),
                'latitude': self._format_coordinate(lat, 'lat'),
                'elevation': location.get('elevation', 0),
                'timezone': location.get('timezone', 'UTC')
            },
            'environment': {
                'pressure': weather_conditions['pressure'],
                'temperature': weather_conditions['temperature'],
                'relative_humidity': weather_conditions['relative_humidity']
            }
        }

        # Add optional fields based on specific conditions
        # Add constraints only if use_constraints is True
        if config.get('use_constraints', False):
            uptonight_config['constraints'] = config.get('constraints', {})
            
        # Add horizon only if it's defined and not empty
        if config.get('horizon') and len(config.get('horizon', [])) > 0:
            uptonight_config['horizon'] = config['horizon']
            
        # Add lists only if they contain items
        for list_key in ['bucket_list', 'done_list', 'custom_targets']:
            if config.get(list_key) and len(config[list_key]) > 0:
                uptonight_config[list_key] = config[list_key]

        return uptonight_config

    def _format_coordinate(self, value, coord_type):
        """Convert decimal degrees to uptonight DMS format"""
        if isinstance(value, str):
            return value
        abs_value = abs(value)
        degrees = int(abs_value)
        minutes_float = (abs_value - degrees) * 60
        minutes = int(minutes_float)
        seconds = (minutes_float - minutes) * 60
        return f"-{degrees}d{minutes}m{seconds:.2f}s" if value < 0 else f"{degrees}d{minutes}m{seconds:.2f}s"

    def _cleanup_old_uptonight_images(self, version_to_keep: str):
        """Remove all upTonight images except the active version"""

        logger.debug(f"Cleaning up old upTonight images, keeping version: {version_to_keep}")

        try:
            # Get list of all upTonight image tags
            result = subprocess.check_output(
                ["docker", "images", "upTonight", "--format", "{{.Tag}}"]
            )
            tags = result.decode().splitlines()

            for tag in tags:
                if tag != version_to_keep:
                    logger.warning(f"Removing old upTonight image: {tag}")
                    subprocess.run(["docker", "rmi", "-f", f"upTonight:{tag}"], check=False)
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to list or remove images: {e}")
        except Exception as e:
            logger.error(f"Unexpected error during cleanup: {e}")

    def get_status(self):
        """Get scheduler status with progress information"""
        execution_duration_seconds = None
        if self.is_executing and self.execution_start_time:
            execution_duration_seconds = int((datetime.now() - self.execution_start_time).total_seconds())
        status = {
            'running': self.running,
            'last_run': self.last_run.isoformat() if self.last_run else None,
            'next_run': (self.last_run + timedelta(seconds=SCHEDULE_INTERVAL)).isoformat() if self.last_run else None,
            'is_executing': self.is_executing,
            'progress': {
                'current_catalogue': self.current_catalogue,
                'current_index': self.current_index,
                'total_catalogues': self.total_catalogues,
                'execution_duration_seconds': execution_duration_seconds
            }
        }
        # Write status to shared file for remote workers
        try:
            status_file = os.path.join(DATA_DIR, 'scheduler_status.json')
            with open(status_file, 'w') as f:
                json.dump(status, f)
        except Exception as e:
            logger.error(f"Failed to write status to file: {e}")
        return status

    def trigger_now(self):
        """Manually trigger uptonight execution"""
        if self._execution_lock.locked():
            logger.warning("Manual trigger requested but execution already in progress")
            return {"status": "skipped", "reason": "execution already in progress"}
        logger.info("Manual trigger requested")
        threading.Thread(target=self._execute_uptonight_for_all_catalogues, daemon=True).start()
        return {"status": "triggered"}
