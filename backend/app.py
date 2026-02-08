"""
MyAstroBoard - Flask Backend API
Provides astronomy planning and configuration management
"""
from flask import Flask, request, jsonify, render_template, send_file, send_from_directory, session, redirect, url_for
from flask_cors import CORS
import os
import re
import json
import sys
from datetime import datetime, timedelta
import requests
from astropy.time import Time
from astropy.coordinates import EarthLocation, AltAz, get_sun
from astropy.coordinates import get_body
import astropy.units as u

import sys
import yaml
import time
from zoneinfo import ZoneInfo

# Windows-compatible file locking
if sys.platform == "win32":
    import msvcrt
else:
    import fcntl

# Add backend to path for imports
sys.path.insert(0, os.path.dirname(__file__))
from weather_openmeteo import get_hourly_forecast
from txtconf_loader import get_available_catalogues
from uptonight_scheduler import UptonightScheduler
from uptonight_parser import get_catalogue_reports 
from txtconf_loader import get_repo_version
from repo_config import load_config, save_config
from constants import DATA_DIR, CONFIG_FILE, OUTPUT_DIR, CONFIG_DIR, CACHE_TTL
from logging_config import get_logger
from utils import IndentDumper

#Cache for heavy computations
import cache_store

# Authentication
from auth import (
    user_manager, login_required, admin_required, get_current_user,
    ROLE_ADMIN, ROLE_READ_ONLY
)

# Astrodex
import astrodex

# Initialize logger for this module
logger = get_logger(__name__)

app = Flask(__name__, 
            template_folder='../templates',
            static_folder='../static')

# Configure session
# Use SECRET_KEY from environment, or generate random one (will invalidate sessions on restart)
secret_key = os.environ.get('SECRET_KEY')
if not secret_key:
    secret_key = os.urandom(24)
    logger.warning("No SECRET_KEY environment variable set. Using random key - sessions will be invalidated on restart.")
app.secret_key = secret_key
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

CORS(app, supports_credentials=True)

# Coordinate conversion regex pattern (module-level constant)
# Matches DMS format: 48d38m36.16s or 48°38'36.16"
# Pattern: optional sign, degrees, minutes, seconds
DMS_PATTERN = re.compile(r"([+-]?\d+)[d°]\s*(\d+)[m']\s*([\d.]+)[s\"]?")


# ============================================================
# API Utils
# ============================================================

@app.route('/')
def index():
    """Render main dashboard or redirect to login"""
    if 'username' not in session:
        return redirect(url_for('login_page'))
    
    # Initialize cache scheduler on first request
    try:
        get_or_create_cache_scheduler()
    except Exception as e:
        logger.error(f"Failed to initialize cache scheduler: {e}")
    
    # Get version for cache busting
    version = get_repo_version()
    
    return render_template('index.html', version=version)


@app.route('/login')
def login_page():
    """Render login page"""
    # Get version for cache busting
    version = get_repo_version()
    
    return render_template('login.html', version=version)


# ============================================================
# Authentication API
# ============================================================

@app.route('/api/auth/login', methods=['POST'])
def login():
    """Login endpoint"""
    try:
        data = request.json
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            return jsonify({'error': 'Username and password required'}), 400
        
        user = user_manager.authenticate(username, password)
        if user:
            session['user_id'] = user.user_id
            session['username'] = user.username
            session['role'] = user.role
            
            # Check if using default password
            using_default_password = user.is_using_default_password()
            
            logger.info(f"User {username} logged in successfully")
            return jsonify({
                'status': 'success',
                'user_id': user.user_id,
                'username': user.username,
                'role': user.role,
                'using_default_password': using_default_password
            })
        else:
            return jsonify({'error': 'Invalid credentials'}), 401
    except Exception as e:
        logger.error(f"Login error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/auth/logout', methods=['POST'])
@login_required
def logout():
    """Logout endpoint"""
    username = session.get('username')
    session.clear()
    logger.info(f"User {username} logged out")
    return jsonify({'status': 'success'})


@app.route('/api/auth/status', methods=['GET'])
def auth_status():
    """Get authentication status"""
    if 'username' in session:
        user = get_current_user()
        if user:
            return jsonify({
                'authenticated': True,
                'user_id': user.user_id,
                'username': user.username,
                'role': user.role,
                'using_default_password': user.is_using_default_password()
            })
    return jsonify({'authenticated': False})


# ============================================================
# User Management API (Admin only)
# ============================================================

@app.route('/api/users', methods=['GET'])
@admin_required
def list_users():
    """List all users (admin only)"""
    users = user_manager.list_users()
    return jsonify(users)


@app.route('/api/users', methods=['POST'])
@admin_required
def create_user():
    """Create a new user (admin only)"""
    try:
        data = request.json
        username = data.get('username')
        password = data.get('password')
        role = data.get('role')
        
        if not username or not password or not role:
            return jsonify({'error': 'Username, password, and role required'}), 400
        
        user = user_manager.create_user(username, password, role)
        return jsonify({
            'status': 'success',
            'user': {
                'username': user.username,
                'role': user.role,
                'created_at': user.created_at
            }
        })
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Error creating user: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/users/<user_id>', methods=['PUT'])
@admin_required
def update_user(user_id):
    """Update a user (admin only)"""
    try:
        data = request.json
        username = data.get('username')
        password = data.get('password')
        role = data.get('role')
        
        if not username and not password and not role:
            return jsonify({'error': 'Username, password or role required'}), 400
        
        logger.info(f"Updating user {user_id}, available users: {list(user_manager.users.keys())}")
        user = user_manager.update_user(user_id, username, password, role)
        return jsonify({
            'status': 'success',
            'user': {
                'user_id': user.user_id,
                'username': user.username,
                'role': user.role
            }
        })
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Error updating user: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/users/<user_id>', methods=['DELETE'])
@admin_required
def delete_user(user_id):
    """Delete a user (admin only)"""
    try:
        current_user_id = session.get('user_id')
        user_manager.delete_user(user_id, current_user_id)
        return jsonify({'status': 'success'})
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Error deleting user: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/config', methods=['GET'])
@login_required
def get_config_api():
    """Get current configuration"""
    config = load_config()
    return jsonify(config)


@app.route('/api/config', methods=['POST'])
@admin_required
def update_config_api():
    """
    Update configuration.
    Automatically detects and handles location changes (latitude, longitude, elevation, timezone).
    Triggers cache reset when location parameters are modified.
    """
    config = request.json
    
    # Validate at least one catalogue is selected
    selected_catalogues = config.get('selected_catalogues', [])
    if not selected_catalogues:
        return jsonify({
            "status": "error", 
            "message": "At least one catalogue must be selected"
        }), 400
    
    # Load old config to detect changes
    old_config = load_config()
    old_location = old_config.get('location', {})
    new_location = config.get('location', {})
    
    # Check if location parameters have changed
    location_changed = (
        old_location.get('latitude') != new_location.get('latitude') or
        old_location.get('longitude') != new_location.get('longitude') or
        old_location.get('elevation') != new_location.get('elevation') or
        old_location.get('timezone') != new_location.get('timezone')
    )
    
    # Compare selected catalogues to previous catalogues (on folder uptonight_outputs)
    # to remove uptonight_configs & uptonight_outputs of not used catalogues
    old_catalogues = set(old_config.get('selected_catalogues', [])) 
    new_catalogues = set(selected_catalogues)
    removed_catalogues = old_catalogues - new_catalogues
    for catalogue in removed_catalogues:
        # Remove config files from UPTONIGHT_CONFIG_DIR config_{catalogue}.yaml
        config_file = os.path.join(CONFIG_DIR, f'config_{catalogue}.yaml')
        if os.path.exists(config_file):
            try:
                os.remove(config_file)
            except Exception as e:
                logger.error(f"Error removing config file {config_file}: {e}")
        # Remove output directory
        output_dir = os.path.join(OUTPUT_DIR, catalogue)
        if os.path.exists(output_dir):
            try:
                for root, dirs, files in os.walk(output_dir, topdown=False):
                    for name in files:
                        os.remove(os.path.join(root, name))
                    for name in dirs:
                        os.rmdir(os.path.join(root, name))
                os.rmdir(output_dir)
            except Exception as e:
                logger.error(f"Error removing output directory {output_dir}: {e}")

    # Ensure features exist with defaults
    if 'features' not in config:
        config['features'] = {
            "horizon": True,
            "objects": True,
            "bodies": True,
            "comets": True,
            "alttime": True
        }
    
    # Save the new config
    save_config(config)
    
    # If location changed, reset astronomical caches immediately
    if location_changed:
        logger.warning("Location parameters changed! Resetting astronomical caches immediately.")
        cache_store.reset_all_caches()
        cache_store.update_location_config(new_location)
    
    return jsonify({
        "status": "success", 
        "config": config,
        "cache_reset": location_changed,
        "message": "Configuration updated" + (" and cache reset" if location_changed else "")
    })


@app.route('/api/config/view', methods=['GET'])
@admin_required
def view_configs_api():
    """Return all YAML configurations in CONFIG_DIR in a structured format"""
    try:
        configs = []

        # Yaml configs in folder
        for filename in os.listdir(CONFIG_DIR):
            if filename.endswith(('.yml', '.yaml')):
                path = os.path.join(CONFIG_DIR, filename)
                with open(path, 'r', encoding='utf-8') as f:
                    yaml_content = f.read()
                    json_content = yaml.safe_load(yaml_content)

                    configs.append({
                        "name": filename,
                        "yaml": yaml_content,
                        "json": json_content
                    })

        return jsonify({
            "status": "success",
            "configs": configs
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/config/export', methods=['GET'])
@admin_required
def export_config_api():
    """Download the raw CONFIG_FILE JSON"""
    try:
        if not os.path.isfile(CONFIG_FILE):
            return jsonify({"error": "Config file not found"}), 404

        return send_file(
            CONFIG_FILE,
            mimetype="application/json",
            as_attachment=True,
            download_name="config.json"
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/logs', methods=['GET'])
@admin_required
def get_logs_api():
    """Get application logs"""
    try:
        log_file = os.path.join(DATA_DIR, 'myastroboard.log')
        
        # Read log file if it exists
        if os.path.exists(log_file):
            with open(log_file, 'r', encoding='utf-8') as f:
                logs = f.readlines()
            
            # Get parameters
            limit = int(request.args.get('limit', 500))  # Increased default limit
            level = request.args.get('level', 'all').upper()
            offset = int(request.args.get('offset', 0))
            
            # Filter by level if specified
            if level != 'ALL':
                filtered_logs = []
                for log_line in logs:
                    if level in log_line:
                        filtered_logs.append(log_line.strip())
                logs = filtered_logs
            else:
                logs = [log.strip() for log in logs]
            
            # Apply pagination
            total_logs = len(logs)
            start_idx = max(0, total_logs - limit - offset)
            end_idx = total_logs - offset
            paginated_logs = logs[start_idx:end_idx] if end_idx > start_idx else []
            
            return jsonify({
                "status": "success",
                "logs": paginated_logs,
                "total": total_logs,
                "showing": len(paginated_logs),
                "offset": offset
            })
        else:
            return jsonify({
                "status": "success",
                "logs": [],
                "total": 0,
                "showing": 0,
                "offset": 0,
                "message": "No log file found yet"
            })
    except Exception as e:
        logger.error(f"Error reading logs: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/logs/clear", methods=["POST"])
@admin_required
def clear_logs_api():
    """Clear application log file"""
    try:
        log_file = os.path.join(DATA_DIR, "myastroboard.log")

        # If the file exists, clear it
        if os.path.exists(log_file):
            open(log_file, "w").close()

        return jsonify({
            "status": "success",
            "message": "Logs cleared"
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/convert-coordinates', methods=['POST'])
@login_required
def convert_coordinates_api():
    """Convert DMS coordinates to decimal"""
    try:
        data = request.json
        dms_str = data.get('dms', '')
        
        # Use module-level DMS_PATTERN constant
        match = DMS_PATTERN.match(dms_str.strip())
        
        if match:
            degrees = int(match.group(1))
            minutes = int(match.group(2))
            seconds = float(match.group(3))
            
            # Convert to decimal
            decimal = abs(degrees) + minutes/60 + seconds/3600
            if degrees < 0:
                decimal = -decimal
            
            # Validate reasonable ranges (lat: -90 to 90, lon: -180 to 180)
            # Note: We don't know if this is lat or lon, so we use wider range
            if decimal < -180 or decimal > 180:
                return jsonify({
                    "status": "error",
                    "message": "Coordinate value out of valid range (-180 to 180)"
                }), 400
            
            return jsonify({
                "status": "success",
                "decimal": round(decimal, 6),
                "dms": dms_str
            })
        else:
            return jsonify({
                "status": "error",
                "message": "Invalid DMS format. Use format like: 48d38m36.16s"
            }), 400
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/timezones', methods=['GET'])
@login_required
def get_timezones_api():
    """Get list of common IANA timezones"""
    common_timezones = [
        "UTC",
        "America/New_York",
        "America/Chicago",
        "America/Denver",
        "America/Los_Angeles",
        "America/Anchorage",
        "Pacific/Honolulu",
        "Europe/London",
        "Europe/Paris",
        "Europe/Berlin",
        "Europe/Madrid",
        "Europe/Rome",
        "Europe/Amsterdam",
        "Europe/Brussels",
        "Europe/Vienna",
        "Europe/Zurich",
        "Europe/Stockholm",
        "Europe/Warsaw",
        "Europe/Prague",
        "Europe/Athens",
        "Europe/Istanbul",
        "Asia/Tokyo",
        "Asia/Shanghai",
        "Asia/Hong_Kong",
        "Asia/Singapore",
        "Asia/Seoul",
        "Asia/Dubai",
        "Asia/Kolkata",
        "Australia/Sydney",
        "Australia/Melbourne",
        "Australia/Perth",
        "Pacific/Auckland",
        "America/Sao_Paulo",
        "America/Mexico_City",
        "America/Toronto",
        "America/Vancouver",
        "Africa/Johannesburg",
        "Africa/Cairo"
    ]
    return jsonify(common_timezones)


@app.route('/api/health', methods=['GET'])
def health_api():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "timestamp": datetime.now().isoformat()})


@app.route('/health', methods=['GET'])
def health_simple_api():
    """Simple health check endpoint for Docker healthcheck"""
    return jsonify({"status": "healthy", "timestamp": datetime.now().isoformat()})

@app.route('/api/cache', methods=['GET'])
@login_required
def cache_health_api():
    """
    Cache status endpoint - purely informational.
    Returns whether caches are currently valid based on TTL.
    All cache management is server-side only.
    """
    status = cache_store.get_cache_init_status()
    return jsonify({
        "cache_status": status["all_ready"],
        "details": status
    })




@app.route('/api/version', methods=['GET'])
@login_required
def get_version_api():
    """Get application version"""
    version = get_repo_version()
    version = version.strip()
    return jsonify({"version": version})


# ============================================================
# API UpTonight
# ============================================================

@app.route('/api/catalogues', methods=['GET'])
@login_required
def get_catalogues_api():
    """Get available target catalogues from uptonight repository"""
    try:
        catalogues = get_available_catalogues()
        # Sort alphabetically
        catalogues.sort()
        return jsonify(catalogues)
    except Exception as e:
        logger.error(f"Error getting catalogues: {e}")
        return jsonify(["Messier"])  # Fallback to default


@app.route('/api/scheduler/status', methods=['GET'])
@login_required
def scheduler_status_api():
    """Get scheduler status"""
    sched = get_scheduler_for_api()
    if sched == "remote_scheduler":
        # Scheduler is running in another worker - get real status from shared file
        return jsonify(get_remote_scheduler_status())
    elif sched:
        return jsonify(sched.get_status())
    return jsonify({
        "running": False, 
        "last_run": None, 
        "next_run": None,
        "is_executing": False,
        "progress": {
            "current_catalogue": None,
            "current_index": 0,
            "total_catalogues": 0,
            "execution_duration_seconds": None
        }
    })


@app.route('/api/scheduler/trigger', methods=['POST'])
@admin_required
def trigger_scheduler_api():
    """Manually trigger uptonight execution"""
    sched = get_scheduler_for_api()
    if sched == "remote_scheduler":
        # Scheduler is running in another worker, we can't trigger it directly
        # But we can create a trigger file that the scheduler will detect
        import os
        trigger_file = os.path.join(DATA_DIR, 'scheduler_trigger')
        try:
            with open(trigger_file, 'w') as f:
                f.write('trigger_now')
            return jsonify({"status": "triggered", "message": "Trigger signal sent to scheduler worker"})
        except Exception as e:
            logger.error(f"Failed to create trigger file: {e}")
            return jsonify({"error": "Failed to trigger scheduler"}), 500
    elif sched:
        return jsonify(sched.trigger_now())
    return jsonify({"error": "Scheduler not running"}), 500


@app.route('/api/uptonight/outputs', methods=['GET'])
@login_required
def get_uptonight_outputs_api():
    """Get list of uptonight output directories"""
    try:
        if not os.path.exists(OUTPUT_DIR):
            return jsonify([])
        
        outputs = []
        for target_dir in os.listdir(OUTPUT_DIR):
            target_path = os.path.join(OUTPUT_DIR, target_dir)
            if os.path.isdir(target_path):
                files = []
                for filename in os.listdir(target_path):
                    file_path = os.path.join(target_path, filename)
                    if os.path.isfile(file_path):
                        files.append({
                            'name': filename,
                            'size': os.path.getsize(file_path),
                            'modified': datetime.fromtimestamp(os.path.getmtime(file_path)).isoformat()
                        })
                
                outputs.append({
                    'target': target_dir,
                    'files': files
                })
        
        return jsonify(outputs)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/uptonight/outputs/<target>/<filename>', methods=['GET'])
@login_required
def get_uptonight_file_api(target, filename):
    """Download a specific uptonight output file"""
    try:
        target_dir = os.path.join(OUTPUT_DIR, target)
        return send_from_directory(target_dir, filename)
    except Exception as e:
        return jsonify({"error": str(e)}), 404


@app.route('/api/uptonight/reports/<catalogue>', methods=['GET'])
@login_required
def get_catalogue_reports_api(catalogue):
    """Get parsed reports for a specific target"""
    try:
        user = get_current_user()
        user_id = user.user_id if user else None
        if not user_id:
            return jsonify({'error': 'User not authenticated'}), 401
            
        catalogue_dir = os.path.join(OUTPUT_DIR, catalogue)
        reports = get_catalogue_reports(catalogue_dir)
        
        # Transform data into format expected by frontend
        result = {}
        
        # Add plot_image flag if plot exists
        plot_data = reports.get('plot', {})
        result['plot_image'] = plot_data.get('available', False)
        
        # Add report array (always set, even if empty)
        objects_data = reports.get('objects', {})
        result['report'] = objects_data.get('objects', [])
        
        # Enhance objects with astrodex status
        for item in result['report']:
            item_name = item.get('id', '')
            if item_name:
                item['in_astrodex'] = astrodex.is_item_in_astrodex(user_id, item_name)
            else:
                item['in_astrodex'] = False
        
        # Add other report types (bodies, comets) if they exist
        bodies_data = reports.get('bodies', {})
        if bodies_data.get('bodies'):
            result['bodies'] = bodies_data['bodies']
            # Enhance bodies with astrodex status
            for item in result['bodies']:
                item_name = item.get('target name', '')
                if item_name:
                    item['in_astrodex'] = astrodex.is_item_in_astrodex(user_id, item_name)
                else:
                    item['in_astrodex'] = False
        
        comets_data = reports.get('comets', {})
        if comets_data.get('comets'):
            result['comets'] = comets_data['comets']
            # Enhance comets with astrodex status
            for item in result['comets']:
                item_name = item.get('target name', '')
                if item_name:
                    item['in_astrodex'] = astrodex.is_item_in_astrodex(user_id, item_name)
                else:
                    item['in_astrodex'] = False
        
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/uptonight/logs/<catalogue>', methods=['GET'])
@login_required
def get_catalogue_log(catalogue):
    """Get log file for a specific catalogue"""
    try:
        catalogue_dir = os.path.join(OUTPUT_DIR, catalogue)
        log_file = os.path.join(catalogue_dir, 'uptonight.log')
        
        if not os.path.exists(log_file):
            return jsonify({"error": "Log file not found"}), 404
        
        # Check if file is not empty
        if os.path.getsize(log_file) == 0:
            return jsonify({"error": "Log file is empty"}), 404
        
        # Read the log file
        with open(log_file, 'r', encoding='utf-8') as f:
            log_content = f.read()
        
        return jsonify({
            "catalogue": catalogue,
            "log_content": log_content,
            "file_size": os.path.getsize(log_file)
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/uptonight/logs/<catalogue>/exists', methods=['GET'])
@login_required
def check_catalogue_log_exists(catalogue):
    """Check if log file exists for a specific catalogue"""
    try:
        catalogue_dir = os.path.join(OUTPUT_DIR, catalogue)
        log_file = os.path.join(catalogue_dir, 'uptonight.log')
        
        exists = os.path.exists(log_file) and os.path.getsize(log_file) > 0
        
        return jsonify({
            "catalogue": catalogue,
            "log_exists": exists
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ============================================================
# API Weather
# ============================================================

@app.route('/api/weather/forecast', methods=['GET'])
@login_required
def get_hourly_forecast_api():
    """Get hourly weather forecast"""
    try:
        forecast = get_hourly_forecast()
        if forecast is None:
            return jsonify({"error": "Failed to fetch hourly forecast"}), 500

        df = forecast["hourly"].copy()

        # Convert datetime to ISO string
        df["date"] = df["date"].dt.strftime("%Y-%m-%dT%H:%M:%S%z")

        # Convert any bytes to string
        for col in df.columns:
            if df[col].dtype == "object":
                df[col] = df[col].apply(lambda x: x.decode() if isinstance(x, bytes) else x)

        # Convert to list of dicts
        hourly_json = df.to_dict(orient="records")

        # Convert location info (just in case)
        location = {k: (v.decode() if isinstance(v, bytes) else v) for k, v in forecast["location"].items()}

        return jsonify({
            "location": location,
            "hourly": hourly_json
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/weather/astro-analysis', methods=['GET'])
@login_required
def get_astro_weather_analysis_api():
    """Get comprehensive astrophotography weather analysis"""
    try:
        from weather_astro import get_astro_weather_analysis
        
        # Get optional hours parameter (default 24)
        hours = request.args.get('hours', 24, type=int)
        hours = min(max(hours, 1), 72)  # Limit between 1-72 hours
        
        analysis = get_astro_weather_analysis(hours)
        if analysis is None:
            return jsonify({"error": "Failed to fetch astrophotography weather analysis"}), 500
        
        return jsonify(analysis)
        
    except Exception as e:
        app.logger.exception("Failed to get astro weather analysis")
        return jsonify({"error": str(e)}), 500

@app.route('/api/weather/astro-current', methods=['GET'])
@login_required
def get_current_astro_conditions_api():
    """Get current astrophotography conditions summary"""
    try:
        from weather_astro import get_current_astro_conditions
        
        conditions = get_current_astro_conditions()
        if conditions is None:
            return jsonify({"error": "Failed to fetch current astrophotography conditions"}), 500
        
        return jsonify(conditions)
        
    except Exception as e:
        app.logger.exception("Failed to get current astro conditions")
        return jsonify({"error": str(e)}), 500

@app.route('/api/weather/alerts', methods=['GET'])
@login_required
def get_weather_alerts_api():
    """Get weather alerts for astrophotography"""
    try:
        from weather_astro import get_astro_weather_analysis
        
        analysis = get_astro_weather_analysis(6)  # Next 6 hours for alerts
        if analysis is None:
            return jsonify({"error": "Failed to fetch weather alerts"}), 500
        
        return jsonify({
            "alerts": analysis.get("weather_alerts", []),
            "generated_at": analysis.get("generated_at"),
            "location": analysis.get("location")
        })
        
    except Exception as e:
        app.logger.exception("Failed to get weather alerts")
        return jsonify({"error": str(e)}), 500
    
# ============================================================
# API Moon
# ============================================================

@app.route("/api/moon/report", methods=["GET"])
@login_required
def get_moon_report_api():
    """Return astrophotography-grade Moon report, from cache only"""
    try:
        if cache_store._moon_report_cache["data"]:
            return jsonify(cache_store._moon_report_cache["data"])

        # Cache non disponible
        return jsonify({
            "status": "pending",
            "message": "Moon report cache is not ready yet. Please try again shortly."
        }), 202

    except Exception as e:
        app.logger.exception("Failed to read Moon report cache")
        return jsonify({"error": str(e)}), 500


@app.route("/api/moon/dark-window", methods=["GET"])
@login_required
def get_next_dark_window_api():
    """Return next astronomical moonless dark window, from cache only"""
    try:
        if cache_store._dark_window_report_cache["data"]:
            return jsonify(cache_store._dark_window_report_cache["data"])

        # Cache non disponible
        return jsonify({
            "status": "pending",
            "message": "Dark window cache is not ready yet. Please try again shortly."
        }), 202

    except Exception as e:
        app.logger.exception("Failed to read Dark Window cache")
        return jsonify({"error": str(e)}), 500


@app.route("/api/moon/next-7-nights", methods=["GET"])
@login_required
def get_next_7_nights_api():
    """Return Moon Planner next 7 nights report, from cache only"""
    try:
        if cache_store._moon_planner_report_cache["data"]:
            return jsonify(cache_store._moon_planner_report_cache["data"])

        # Cache non disponible
        return jsonify({
            "status": "pending",
            "message": "Moon Planner cache is not ready yet. Please try again shortly."
        }), 202

    except Exception as e:
        app.logger.exception("Failed to read Moon Planner cache")
        return jsonify({"error": str(e)}), 500



@app.route("/api/sun/today", methods=["GET"])
@login_required
def get_sun_today_api():
    """Return Sun today report, from cache only"""
    try:
        if cache_store._sun_report_cache["data"]:
            return jsonify(cache_store._sun_report_cache["data"])

        # Cache non disponible
        return jsonify({
            "status": "pending",
            "message": "Sun report cache is not ready yet. Please try again shortly."
        }), 202

    except Exception as e:
        app.logger.exception("Failed to read Sun report cache")
        return jsonify({"error": str(e)}), 500


@app.route("/api/tonight/best-window", methods=["GET"])
@login_required
def best_window_api():
    """
    Return best observation window for tonight, from cache only
    Modes: strict, practical, illumination
    """
    try:
        mode = request.args.get("mode", "strict")

        if mode not in ["strict", "practical", "illumination"]:
            return jsonify({"error": "Invalid mode"}), 400

        cache_entry = cache_store._best_window_cache[mode]

        if cache_entry["data"]:
            return jsonify(cache_entry["data"])

        # Cache non disponible
        return jsonify({
            "status": "pending",
            "message": f"Best window cache for mode '{mode}' is not ready yet. Please try again shortly."
        }), 202

    except Exception as e:
        app.logger.exception("Failed to read Best Window cache")
        return jsonify({"error": str(e)}), 500


# ============================================================
# Astrodex API
# ============================================================

@app.route('/api/astrodex', methods=['GET'])
@login_required
def get_astrodex():
    """Get user's astrodex collection"""
    try:
        user = get_current_user()
        user_id = user.user_id if user else None
        if not user_id:
            return jsonify({'error': 'User not authenticated'}), 401
            
        astrodex_data = astrodex.load_user_astrodex(user_id, user.username)
        stats = astrodex.get_astrodex_stats(user_id)
        
        return jsonify({
            'items': astrodex_data.get('items', []),
            'stats': stats,
            'created_at': astrodex_data.get('created_at'),
            'updated_at': astrodex_data.get('updated_at')
        })
    except Exception as e:
        logger.error(f"Error getting astrodex: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@app.route('/api/astrodex/items', methods=['POST'])
@login_required
def add_astrodex_item():
    """Add item to user's astrodex"""
    try:
        user = get_current_user()
        user_id = user.user_id if user else None
        if not user_id:
            return jsonify({'error': 'User not authenticated'}), 401
            
        item_data = request.json
        
        if not item_data.get('name'):
            return jsonify({'error': 'Item name is required'}), 400
        
        # Check if item already exists
        if astrodex.is_item_in_astrodex(user_id, item_data['name']):
            return jsonify({'error': 'Item already exists in Astrodex'}), 400
        
        new_item = astrodex.create_astrodex_item(user_id, item_data, user.username)
        
        if new_item:
            return jsonify({
                'status': 'success',
                'item': new_item
            })
        else:
            return jsonify({'error': 'Failed to create item'}), 500
    except Exception as e:
        logger.error(f"Error adding astrodex item: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@app.route('/api/astrodex/items/<item_id>', methods=['GET'])
@login_required
def get_astrodex_item_api(item_id):
    """Get a specific astrodex item"""
    try:
        user = get_current_user()
        user_id = user.user_id if user else None
        if not user_id:
            return jsonify({'error': 'User not authenticated'}), 401
            
        item = astrodex.get_astrodex_item(user_id, item_id)
        
        if item:
            return jsonify(item)
        else:
            return jsonify({'error': 'Item not found'}), 404
    except Exception as e:
        logger.error(f"Error getting astrodex item: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@app.route('/api/astrodex/items/<item_id>', methods=['PUT'])
@login_required
def update_astrodex_item_api(item_id):
    """Update an astrodex item"""
    try:
        user = get_current_user()
        user_id = user.user_id if user else None
        if not user_id:
            return jsonify({'error': 'User not authenticated'}), 401
            
        updates = request.json
        
        updated_item = astrodex.update_astrodex_item(user_id, item_id, updates)
        
        if updated_item:
            return jsonify({
                'status': 'success',
                'item': updated_item
            })
        else:
            return jsonify({'error': 'Item not found'}), 404
    except Exception as e:
        logger.error(f"Error updating astrodex item: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@app.route('/api/astrodex/items/<item_id>', methods=['DELETE'])
@login_required
def delete_astrodex_item_api(item_id):
    """Delete an astrodex item"""
    try:
        user = get_current_user()
        user_id = user.user_id if user else None
        if not user_id:
            return jsonify({'error': 'User not authenticated'}), 401
        
        if astrodex.delete_astrodex_item(user_id, item_id):
            return jsonify({'status': 'success'})
        else:
            return jsonify({'error': 'Item not found'}), 404
    except Exception as e:
        logger.error(f"Error deleting astrodex item: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@app.route('/api/astrodex/items/<item_id>/pictures', methods=['POST'])
@login_required
def add_picture_to_astrodex_item(item_id):
    """Add a picture to an astrodex item"""
    try:
        user = get_current_user()
        user_id = user.user_id if user else None
        if not user_id:
            return jsonify({'error': 'User not authenticated'}), 401
            
        picture_data = request.json
        
        new_picture = astrodex.add_picture_to_item(user_id, item_id, picture_data)
        
        if new_picture:
            return jsonify({
                'status': 'success',
                'picture': new_picture
            })
        else:
            return jsonify({'error': 'Item not found or failed to add picture'}), 404
    except Exception as e:
        logger.error(f"Error adding picture: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@app.route('/api/astrodex/items/<item_id>/pictures/<picture_id>', methods=['PUT'])
@login_required
def update_picture_api(item_id, picture_id):
    """Update a picture in an astrodex item"""
    try:
        user = get_current_user()
        user_id = user.user_id if user else None
        if not user_id:
            return jsonify({'error': 'User not authenticated'}), 401
            
        updates = request.json
        
        updated_picture = astrodex.update_picture(user_id, item_id, picture_id, updates)
        
        if updated_picture:
            return jsonify({
                'status': 'success',
                'picture': updated_picture
            })
        else:
            return jsonify({'error': 'Picture not found'}), 404
    except Exception as e:
        logger.error(f"Error updating picture: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@app.route('/api/astrodex/items/<item_id>/pictures/<picture_id>', methods=['DELETE'])
@login_required
def delete_picture_api(item_id, picture_id):
    """Delete a picture from an astrodex item"""
    try:
        user = get_current_user()
        user_id = user.user_id if user else None
        if not user_id:
            return jsonify({'error': 'User not authenticated'}), 401
        
        if astrodex.delete_picture(user_id, item_id, picture_id):
            return jsonify({'status': 'success'})
        else:
            return jsonify({'error': 'Picture not found'}), 404
    except Exception as e:
        logger.error(f"Error deleting picture: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@app.route('/api/astrodex/items/<item_id>/pictures/<picture_id>/main', methods=['POST'])
@login_required
def set_main_picture_api(item_id, picture_id):
    """Set a picture as the main picture for an item"""
    try:
        user = get_current_user()
        user_id = user.user_id if user else None
        if not user_id:
            return jsonify({'error': 'User not authenticated'}), 401
        
        if astrodex.set_main_picture(user_id, item_id, picture_id):
            return jsonify({'status': 'success'})
        else:
            return jsonify({'error': 'Picture not found'}), 404
    except Exception as e:
        logger.error(f"Error setting main picture: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@app.route('/api/astrodex/upload', methods=['POST'])
@login_required
def upload_astrodex_image():
    """Upload an image for astrodex"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Validate file type
        allowed_extensions = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
        filename = file.filename.lower()
        if not any(filename.endswith(ext) for ext in allowed_extensions):
            return jsonify({'error': 'Invalid file type. Allowed: png, jpg, jpeg, gif, webp'}), 400
        
        # Generate unique filename
        user = get_current_user()
        user_id = user.user_id if user else None
        if not user_id:
            return jsonify({'error': 'User not authenticated'}), 401
            
        import uuid
        file_ext = filename.rsplit('.', 1)[1]
        unique_filename = f"{user_id}_{uuid.uuid4()}.{file_ext}"
        
        # Save file
        astrodex.ensure_astrodex_directories()
        file_path = os.path.join(astrodex.ASTRODEX_IMAGES_DIR, unique_filename)
        file.save(file_path)
        
        return jsonify({
            'status': 'success',
            'filename': unique_filename
        })
    except Exception as e:
        logger.error(f"Error uploading image: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@app.route('/api/astrodex/images/<filename>', methods=['GET'])
@login_required
def get_astrodex_image(filename):
    """Serve an astrodex image"""
    try:
        return send_from_directory(astrodex.ASTRODEX_IMAGES_DIR, filename)
    except Exception as e:
        logger.error(f"Error serving image: {e}")
        return jsonify({'error': 'Image not found'}), 404


@app.route('/api/astrodex/check/<item_name>', methods=['GET'])
@login_required
def check_item_in_astrodex(item_name):
    """Check if an item is in user's astrodex"""
    try:
        user = get_current_user()
        user_id = user.user_id if user else None
        if not user_id:
            return jsonify({'error': 'User not authenticated'}), 401
        is_in_astrodex = astrodex.is_item_in_astrodex(user_id, item_name)
        
        return jsonify({
            'in_astrodex': is_in_astrodex
        })
    except Exception as e:
        logger.error(f"Error checking astrodex: {e}")
        return jsonify({'error': 'Internal server error'}), 500

def get_or_create_scheduler():
    """Get the scheduler instance, creating it if necessary"""
    if 'scheduler' not in app.config:
        # Only start scheduler in one worker process using file locking
        lock_file_path = os.path.join(DATA_DIR, 'scheduler.lock')
        
        try:
            lock_file = open(lock_file_path, 'w')
            
            if sys.platform == "win32":
                # Windows file locking
                try:
                    msvcrt.locking(lock_file.fileno(), msvcrt.LK_NBLCK, 1)
                except OSError:
                    # Another worker already has the lock, don't start scheduler
                    if not app.config.get('scheduler_lock_logged'):
                        logger.info("Scheduler already running in another worker process, skipping creation")
                        app.config['scheduler_lock_logged'] = True
                    app.config['is_scheduler_worker'] = False
                    lock_file.close()
                    return None
            else:
                # Unix file locking
                fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            
            logger.info("Creating scheduler instance (acquired lock)...")
            from uptonight_scheduler import UptonightScheduler
            scheduler = UptonightScheduler(
                config_loader=load_config,
                app=app
            )
            scheduler.start()
            app.config['scheduler'] = scheduler
            app.config['scheduler_lock_file'] = lock_file
            app.config['is_scheduler_worker'] = True
            logger.info("Scheduler created and started successfully.")
            
        except (IOError, OSError) as e:
            # Another worker already has the lock, don't start scheduler
            # Only log this message once per worker
            if not app.config.get('scheduler_lock_logged'):
                logger.info("Scheduler already running in another worker process, skipping creation")
                app.config['scheduler_lock_logged'] = True
            app.config['is_scheduler_worker'] = False
            return None
        except Exception as e:
            logger.error(f"Failed to create scheduler: {e}")
            app.config['is_scheduler_worker'] = False
            return None
            
    return app.config.get('scheduler')

def get_scheduler_for_api():
    """Get scheduler for API endpoints - tries to find running scheduler across workers"""
    # First try to get local scheduler
    scheduler = get_or_create_scheduler()
    if scheduler:
        return scheduler
    
    # If we don't have a local scheduler, check if another worker has it
    # by testing if the lock file exists and is locked
    import os
    lock_file_path = os.path.join(DATA_DIR, 'scheduler.lock')
    
    if os.path.exists(lock_file_path):
        try:
            test_file = open(lock_file_path, 'r')
            
            if sys.platform == "win32":
                # Windows file locking test
                try:
                    msvcrt.locking(test_file.fileno(), msvcrt.LK_NBLCK, 1)
                    # If we can acquire the lock, the scheduler is not running
                    test_file.close()
                    return None
                except OSError:
                    # Lock is held by another process, scheduler is running
                    test_file.close()
                    return "remote_scheduler"  # Placeholder to indicate scheduler exists
            else:
                # Unix file locking test
                fcntl.flock(test_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                # If we can acquire the lock, the scheduler is not running
                test_file.close()
                return None
                
        except (IOError, OSError):
            # Lock is held by another process, scheduler is running
            if 'test_file' in locals():
                test_file.close()
            return "remote_scheduler"  # Placeholder to indicate scheduler exists
    
    return None

def get_remote_scheduler_status():
    """Get scheduler status from shared file for remote workers"""
    status_file = os.path.join(DATA_DIR, 'scheduler_status.json')
    try:
        if os.path.exists(status_file):
            with open(status_file, 'r') as f:
                status = json.load(f)
                status['worker'] = 'remote'  # Mark as remote
                return status
    except Exception as e:
        logger.error(f"Failed to read remote scheduler status: {e}")
    
    # Default fallback
    return {
        "running": True, 
        "last_run": None, 
        "next_run": None, 
        "is_executing": False,
        "worker": "remote",
        "progress": {
            "current_catalogue": None,
            "current_index": 0,
            "total_catalogues": 0,
            "execution_duration_seconds": None
        }
    }

def get_or_create_cache_scheduler():
    """Get the cache scheduler instance, creating it if necessary"""
    if 'cache_scheduler' not in app.config:
        logger.info("Creating cache scheduler instance...")
        try:
            from cache_scheduler import CacheScheduler
            cache_scheduler = CacheScheduler()
            # Store the instance regardless of whether it started
            # (it may already be running in another process)
            app.config['cache_scheduler'] = cache_scheduler
            if cache_scheduler.start():
                logger.info("Cache scheduler created and started successfully.")
            else:
                logger.info("Cache scheduler not started - already running in another process.")
        except Exception as e:
            logger.error(f"Failed to create cache scheduler: {e}")
            return None
    return app.config.get('cache_scheduler')

# Don't initialize cache scheduler automatically on import
# It will be initialized on first request or explicitly when needed

# ============================================================

if __name__ == '__main__':
    # Running directly with Flask development server
    in_debug_mode = os.environ.get('FLASK_DEBUG') == '1'
    
    try:
        # Run Flask app
        app.run(host='0.0.0.0', port=5000, debug=in_debug_mode, use_reloader=in_debug_mode)
    finally:
        # Ensure scheduler stops gracefully on shutdown
        scheduler = app.config.get('scheduler')
        if scheduler:
            scheduler.stop()
            logger.info("Scheduler stopped.")
            
            # Clean up lock file if we have it
            lock_file = app.config.get('scheduler_lock_file')
            if lock_file:
                try:
                    lock_file.close()
                    os.unlink(os.path.join(DATA_DIR, 'scheduler.lock'))
                    logger.info("Scheduler lock file cleaned up.")
                except Exception as e:
                    logger.warning(f"Failed to clean up lock file: {e}")
                    
        cache_scheduler = app.config.get('cache_scheduler') 
        if cache_scheduler:
            cache_scheduler.stop()
            logger.info("Cache scheduler stopped.")

