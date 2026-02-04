# Copilot Instructions for MyAstroBoard

This document provides comprehensive guidance for GitHub Copilot (or other AI assistants) when working on the MyAstroBoard project.

## Project Overview

MyAstroBoard is a web-based astronomy observation planning system that integrates with the [mawinkler/uptonight](https://github.com/mawinkler/uptonight) Docker container to provide automated observation planning with a user-friendly dashboard.

### Core Concept
- Users configure their location and select target catalogues via web dashboard
- System automatically runs uptonight Docker container every 2 hours
- Each selected target gets its own uptonight execution (each executed in a queue between targets)
- Generated outputs (plots, reports) are stored and displayed in the dashboard

## Architecture

### Technology Stack
- **Backend**: Python 3.11 + Flask
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Astronomy**: Astropy for calculations
- **Visualization**: Matplotlib for plots
- **Containerization**: Docker + Docker Compose
- **Scheduler**: Custom Python threading-based scheduler
- **CI/CD**: GitHub Actions for image publishing

### Directory Structure
```
myastroboard/
├── backend/
│   ├── app.py                  # Main Flask application with modern API
│   ├── auth.py                 # Authentication and user management
│   ├── cache_scheduler.py      # Cyclic cache for scheduler data
│   ├── cache_store.py          # Variable cache storage
│   ├── cache_updater.py        # Functions to update cache
│   ├── config_defaults.py      # Default config for UpTonight
│   ├── constants.py            # Centralization of constants
│   ├── logging_config.py       # Centralization of logging
│   ├── moon_astrotonight.py    # Computes the best astrophotography imaging window tonight
│   ├── moon_phases.py          # Computes locally the moon phases
│   ├── moon_planner.py         # Computes locally the moon phase for a range of dates
│   ├── repo_config.py          # Manages repository configuration file
│   ├── sun_phases.py           # Computes locally the sun phases
│   ├── txtconf_loader.py       # Loads flat txtconf files
│   ├── uptonight_parser.py     # Parses uptonight JSON reports
│   ├── uptonight_scheduler.py  # Manages periodic uptonight execution
│   ├── utils.py                # Utils functions
│   └── weather_openmeteo.py    # Parses weather data from Open-Meteo API
├── docs/                       # Comprehensive documentation
├── data/                       # User configuration (Docker volume, persists)
│   ├── config.json             # Main configuration file
│   ├── users.json              # User accounts and credentials (hashed passwords)
│   └── myastroboard.log        # Application logs
├── static/
│   ├── css/
│   │   ├── main.css (import orchestrator)
│   │   ├── variables.css (CSS custom properties)
│   │   ├── base.css (reset, typography, base styles)
│   │   ├── layout.css (header, footer, cards, containers)
│   │   ├── components.css (tabs, buttons, forms, modals, etc.)
│   │   ├── weather.css (weather-specific components)
│   │   ├── astro.css (astrophotography-specific styles)
│   │   ├── login.css (login page styles)
│   │   └── responsive.css (media queries & responsive design)
│   ├── js/
│   │   ├── apiHelper.js
│   │   ├── app.js
│   │   ├── auth.js (authentication and user management)
│   │   ├── domUtils.js
│   │   ├── moon.js
│   │   ├── scheduler.js
│   │   ├── sun.js
│   │   ├── utils.js
│   │   ├── weather.js
│   │   ├── weather_alerts.js
│   │   └── weather_astro.js
│   └── favicon.svg
├── templates/
│   ├── index.html              # Modern tabbed dashboard
│   └── login.html              # User login page
├── uptonight_configs/          # Generated configs (Docker volume)
├── uptonight_outputs/          # Generated outputs (Docker volume)
├── catalogues.conf             # Catalogue configuration from UpTonight
├── docker-compose-dev.yml      # Development deployment (local image)
├── docker-compose.debug.yml    # Additional docker-compose for debugging (launch with docker-compose-dev.yml)
├── docker-compose.yml          # Production deployment (published image)
├── Dockerfile                  # Production container image
├── entrypoint.sh               # Production container entrypoint script
├── README.md                   # Project overview and instructions
├── requirements.txt            # Python dependencies
├── UPTONIGHT_VERSION           # Specified uptonight Docker image version
└── VERSION                     # Semantic version number
```

## Code Style & Conventions

### General Guidelines
- **LANGUAGE REQUIREMENT**: All code, comments, documentation, and user-facing text MUST be in English
- This includes: variable names, function names, class names, comments, docstrings, error messages, UI text, and documentation
- Exception: Only external library names or technical terms that are internationally recognized

### Python
- Follow PEP 8 style guidelines
- Use type hints where beneficial for clarity
- Docstrings for all public functions/classes
- Maximum line length: 120 characters
- Use f-strings for string formatting
- Prefer explicit over implicit

### Unified Logging System
- **MANDATORY**: Use centralized logging configuration from `logging_config.py`
- **NEVER** use `print()` statements for logging in backend code
- **NEVER** import `logging` directly - always use the centralized system

#### Logging Usage Pattern
```python
from logging_config import get_logger

# Initialize logger for this module (typically at module level)
logger = get_logger(__name__)

# Use appropriate log levels
logger.debug("Detailed information for debugging")
logger.info("General information about program execution")
logger.warning("Warning about something unexpected but not critical")
logger.error("Error occurred but program can continue")
logger.critical("Critical error - program may not be able to continue")

# For exceptions, use:
try:
    # some code
except Exception as e:
    logger.error(f"Descriptive error message: {e}")
    # or
    logger.exception("Descriptive error message")  # Automatically includes stack trace
```

#### Log Levels and Configuration
- **Default File Level**: INFO (set via LOG_LEVEL environment variable)
- **Default Console Level**: WARNING (set via CONSOLE_LOG_LEVEL environment variable)
- **Available Levels**: DEBUG, INFO, WARNING, ERROR, CRITICAL
- **Log File**: `/app/data/myastroboard.log` (with rotation)
- **Environment Control**:
  ```bash
  LOG_LEVEL=DEBUG          # Controls file output level
  CONSOLE_LOG_LEVEL=INFO   # Controls console output level
  ```

#### Logging Features
- **Automatic Rotation**: 10MB files, keeps 5 backups
- **Enhanced Format**: Includes module name, function name, and line number
- **UTF-8 Encoding**: Proper handling of special characters
- **Duplicate Prevention**: Logger registry prevents multiple handlers
- **Performance**: Different levels for console vs file output

#### Logging Guidelines
- Use **DEBUG** for detailed tracing and variable dumps
- Use **INFO** for normal program flow and important events
- Use **WARNING** for unexpected conditions that don't stop execution
- Use **ERROR** for exceptions and error conditions
- Use **CRITICAL** for severe errors that may stop the program
- Include relevant context in log messages (user input, file paths, etc.)
- Use f-strings for efficient string formatting in log messages

### JavaScript
- Use modern ES6+ syntax
- Async/await for asynchronous operations
- Clear, descriptive variable names
- Comment complex logic

### File Organization
- One class per file when possible
- Keep related functionality together
- Separate concerns (data loading, business logic, presentation)

## Key Design Patterns

### 1. Configuration Management
- **Pattern**: JSON file-based configuration with environment variable overrides
- **Location**: `data/config.json`
- **Structure**: Hierarchical with new sections:
  - `location`: Name, latitude (supports DMS format), longitude, elevation, timezone
  - `features`: Boolean flags for horizon, objects, bodies, comets, alttime (all default true)
  - `constraints`: Altitude, airmass, size, moon separation, observability thresholds
  - `bucket_list`: Targets to always include
  - `done_list`: Targets to never show
  - `custom_targets`: User-defined targets in YAML format
  - `horizon`: Custom horizon profile with anchor points
  - `output_datestamp`: Boolean for timestamped outputs
- **Persistence**: Stored in Docker volume, survives container rebuilds
- **Validation**: At least one catalogue must be selected (Messier by default)
- **Why**: Simple, human-readable, easy to backup/restore, flexible

### 1.1. User Management
- **Pattern**: JSON file-based user storage with hashed passwords
- **Location**: `data/users.json`
- **Structure**: Dictionary of users with:
  - `username`: Unique username
  - `password_hash`: Bcrypt hashed password (never stored in plaintext)
  - `role`: Either `admin` or `read-only`
  - `created_at`: ISO timestamp of user creation
  - `last_login`: ISO timestamp of last successful login
- **Default User**: `admin:admin` created automatically on first run
- **Persistence**: Stored in Docker volume (`./data:/app/data`), survives container restarts/rebuilds
- **Security**: Passwords are hashed using Werkzeug's `generate_password_hash` (bcrypt)
- **Session Management**: Flask session-based authentication with secure cookies
- **Why**: Persistent user accounts, secure password storage, survives Docker restarts

### 2. Uptonight Docker Version Management
- **Pattern**: Version file configuration for release management
- **File**: `UPTONIGHT_VERSION` in repository root (contains version tag, e.g., "2.5")
- **Usage**: Read at runtime by scheduler to construct image name `mawinkler/uptonight:{version}`
- **Why**: Centralized version control for releases, no user configuration needed

### 3. Coordinate Format Conversion
- **Pattern**: DMS (Degrees Minutes Seconds) to Decimal conversion
- **Format**: Accepts formats like "48d38m36.16s" or "48°38'36.16\""
- **API**: `/api/convert-coordinates` endpoint with validation
- **Frontend**: Real-time conversion with error display
- **Why**: User-friendly input for astronomers familiar with DMS notation

### 2. Target Catalogue Loading
- **Pattern**: Remote-first with local caching
- **Flow**: GitHub API → Download YAML → Parse → Cache locally → Serve
- **Sorting**: Catalogues are alphabetically sorted in UI
- **Default**: Messier catalogue selected by default
- **Validation**: Prevents saving without at least one catalogue selected
- **Why**: Always up-to-date catalogues, works offline after first load, better UX

### 3. Scheduler
- **Pattern**: Threading-based scheduler in-process
- **Mechanism**: Daemon thread with configurable interval
- **Image Version**: Read from UPTONIGHT_VERSION file for release management
- **Why**: Simple, no external dependencies, survives across requests, version controlled

### 4. Docker-in-Docker
- **Pattern**: Mount host Docker socket into container
- **Access**: `/var/run/docker.sock` volume mount
- **Security**: Requires privileged mode
- **Why**: Allows spawning sibling containers for uptonight execution

### 5. API Design
- **Pattern**: RESTful JSON API with role-based access control
- **Endpoints**: 
  - **Authentication (Unprotected)**:
    - `/api/auth/login` - User login (POST)
    - `/api/auth/logout` - User logout (POST, requires login)
    - `/api/auth/status` - Check authentication status (GET)
  - **User Management (Admin only)**:
    - `/api/users` - List/Create users (GET/POST, admin only)
    - `/api/users/<username>` - Update/Delete user (PUT/DELETE, admin only)
  - **Health & Version (Unprotected)**:
    - `/api/health` - Health check (GET, unprotected)
    - `/health` - Simple health check (GET, unprotected)
  - **Configuration (Read: login required, Write: admin only)**:
    - `/api/config` - GET (login required), POST (admin only)
    - `/api/config/view` - View YAML configs (GET, login required)
    - `/api/config/export` - Export config (GET, admin only)
  - **Data Endpoints (Login required)**:
    - `/api/catalogues` - List available catalogues (GET, login required)
    - `/api/timezones` - List IANA timezones (GET, login required)
    - `/api/convert-coordinates` - DMS to decimal conversion (POST, login required)
    - `/api/cache` - Cache status (GET, login required)
    - `/api/version` - Application version (GET, login required)
  - **Scheduler (Read: login required, Write: admin only)**:
    - `/api/scheduler/status` - Get scheduler status (GET, login required)
    - `/api/scheduler/trigger` - Manually trigger (POST, admin only)
  - **UpTonight Results (Login required)**:
    - `/api/uptonight/outputs` - List outputs (GET, login required)
    - `/api/uptonight/outputs/<target>/<filename>` - Get file (GET, login required)
    - `/api/uptonight/reports/<catalogue>` - Get reports (GET, login required)
  - **Weather & Astronomy (Login required)**:
    - `/api/weather/forecast` - Weather forecast (GET, login required)
    - `/api/weather/astro-analysis` - Astro weather (GET, login required)
    - `/api/weather/astro-current` - Current conditions (GET, login required)
    - `/api/weather/alerts` - Weather alerts (GET, login required)
    - `/api/moon/report` - Moon report (GET, login required)
    - `/api/moon/dark-window` - Dark window (GET, login required)
    - `/api/moon/next-7-nights` - Moon phases (GET, login required)
    - `/api/sun/today` - Sun phases (GET, login required)
    - `/api/tonight/best-window` - Best observation window (GET, login required)
  - **Logs (Read: login required, Write: admin only)**:
    - `/api/logs` - Get logs (GET, login required)
    - `/api/logs/clear` - Clear logs (POST, admin only)
- **Error Handling**: Return appropriate HTTP status codes with JSON error objects
  - 401 Unauthorized - Not authenticated
  - 403 Forbidden - Insufficient permissions (not admin)
  - 400 Bad Request - Invalid input
  - 500 Internal Server Error - Server errors
- **Authentication Flow**:
  - Session-based authentication using Flask sessions
  - Credentials stored in `/app/data/users.json` with hashed passwords
  - Default admin user created on first run (username: admin, password: admin)
  - Password change warning shown when using default password
- **Why**: Clear separation, security through authentication, role-based access control

### 6. Modern UI/UX
- **Pattern**: Tab-based interface with sections
- **Tabs**: 
  - Dashboard (overview)
  - Configuration (basic + advanced settings)
  - Results (dynamic tabs per catalogue + weather)
- **Features**:
  - DMS coordinate converter with real-time validation
  - Timezone dropdown selector
  - Sortable/filterable result tables
  - Image popups for plots
  - Log viewer with filtering
  - Responsive design
- **Styling**: Modern gradient design, smooth animations, accessibility-compliant
- **Why**: Professional appearance, better UX, easier navigation

## Important Implementation Details

### Uptonight Version Management
The uptonight Docker image version is managed via the `UPTONIGHT_VERSION` file in the repository root:
- **File Location**: `UPTONIGHT_VERSION` (repository root)
- **Content**: Version tag only (e.g., `2.5`)
- **Usage**: Read at runtime to construct `mawinkler/uptonight:{version}`
- **Purpose**: Centralized version control for repository releases

To update for a new release:
```bash
echo "2.6" > UPTONIGHT_VERSION
```

### Environment Configuration
Key environment variables (set in docker-compose.yml or .env):
- **SCHEDULE_INTERVAL**: Uptonight execution interval in seconds (default: 7200)
- **DATA_DIR**: Configuration storage (default: `/app/data`)
- **UPTONIGHT_OUTPUT_DIR**: Results storage (default: `/app/uptonight_outputs`)
- **LOG_LEVEL**: File logging level - DEBUG, INFO, WARNING, ERROR, CRITICAL (default: INFO)
- **CONSOLE_LOG_LEVEL**: Console logging level - DEBUG, INFO, WARNING, ERROR, CRITICAL (default: WARNING)

#### Logging Environment Setup Example
```yaml
# docker-compose.yml
environment:
  - LOG_LEVEL=INFO          # Standard logging to file
  - CONSOLE_LOG_LEVEL=WARNING # Minimal console noise
  - SCHEDULE_INTERVAL=7200  # 2 hours
  
# For debugging
environment:
  - LOG_LEVEL=DEBUG         # Detailed logging to file  
  - CONSOLE_LOG_LEVEL=INFO  # More console output
```

See `.env.example` for full list and documentation.

### Scheduler Behavior
```python
# Runs immediately on startup
# Then every SCHEDULE_INTERVAL seconds (default: 7200 = 2 hours)
# For each target:
#   1. Generate uptonight config YAML
#   2. Run uptonight Docker container
#   3. Wait until completion
#   4. Proceed to next target
```

### Coordinate Format Conversion
- **Input** (from uptonight catalogues): `"5 34 30"` and `"+22 1 0"`
- **Internal** (Astropy): `"05h34m30s"` and `"+22d01m00s"`
- **Output** (to uptonight): `"5 34 30"` and `"+22 1 0"`
- **Critical**: Use regex parsing, not simple string replace (to handle edge cases)

### Target Selection
- User selects catalogues (not individual targets)
- All targets from selected catalogues are processed
- Each target runs independently in uptonight
- Outputs stored in separate directories per target

### Uptonight Output Files

For each target, uptonight generates:
- **uptonight-report.json**: Main objects/targets report (celestial objects)
- **uptonight-comets-report.json**: Comets report (if comets feature enabled)
- **uptonight-bodies-report.json**: Solar system bodies (planets, moon)
- **uptonight-plot.png**: Altitude plot visualization
- **uptonight-moon.png**: Moon position/phase plot

All files are stored in: `uptonight_outputs/{target_name}/`

## Common Tasks

### Adding a New API Endpoint

1. Define route in `backend/app.py`:
```python
@app.route('/api/new-endpoint', methods=['GET'])
def new_endpoint():
    """Brief description"""
    try:
        # Implementation
        return jsonify({"status": "success", "data": result})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
```

2. Add corresponding JavaScript in `static/app.js`:
```javascript
async function callNewEndpoint() {
    const response = await fetch(`${API_BASE}/api/new-endpoint`);
    const data = await response.json();
    // Handle data
}
```

3. Update API documentation in `docs/api.md`

### Adding a New Configuration Parameter

1. Update default config in `backend/app.py` `load_config()`:
```python
"new_parameter": default_value
```

2. Add form field in `templates/index.html`:
```html
<div class="form-group">
    <label>New Parameter:</label>
    <input type="text" id="new-parameter">
</div>
```

3. Update save/load in `static/app.js`:
```javascript
// In saveConfiguration()
new_parameter: document.getElementById('new-parameter').value

// In loadConfiguration()
document.getElementById('new-parameter').value = config.new_parameter
```

4. Update config generation in `uptonight_scheduler.py` if needed for uptonight

### Adding a New Target Catalogue

Catalogues are loaded automatically from the uptonight repository. To add a custom catalogue:

1. Create YAML file in `targets/` directory
2. Follow uptonight format:
```yaml
- name: Object Name
  ra: 5 34 30
  dec: +22 1 0
  type: Galaxy
  constellation: Taurus
  size: 10.5
  mag: 8.4
```
3. It will appear automatically in the catalogues list

### Updating the Version

1. Edit `VERSION` file: `1.0.0` → `1.1.0`
2. Commit and push to main branch
3. GitHub Actions will automatically build and publish new image
4. Users update with: `docker compose pull && docker compose up -d`

## Testing Guidelines

### Manual Testing Checklist
- [ ] Configuration save/load works
- [ ] Target catalogues load from GitHub
- [ ] Weather API integration functions
- [ ] Scheduler starts and triggers
- [ ] Uptonight containers execute successfully
- [ ] Outputs are generated and accessible
- [ ] Version endpoint returns correct version
- [ ] Health endpoint responds

### Testing with Docker
```bash
# Build
docker compose build

# Start
docker compose up -d

# View logs
docker logs -f myastroboard

# Test API
curl http://localhost:5000/health
curl http://localhost:5000/api/version
curl http://localhost:5000/api/catalogues

# Stop
docker compose down
```

### Testing Scheduler (Without Waiting 2 Hours)
Set environment variable for shorter interval:
```bash
docker compose down
SCHEDULE_INTERVAL=300 docker compose up -d  # 5 minutes
```

## Security Considerations

### Docker Socket Access
- **Risk**: Container has full Docker access
- **Mitigation**: Document requirement, warn users
- **Alternative**: None practical for Docker-in-Docker pattern

### Input Validation
- Always validate user input before:
  - Saving to config
  - Passing to subprocess
  - Using in file paths

### Dependency Security
- Keep dependencies updated
- Run security scans via GitHub Actions
- Pin versions in requirements.txt

## Performance Considerations

### Scheduler Efficiency
- One thread, sequential execution
- Acceptable for personal use (< 100 targets)
- For large deployments, consider async or queue-based approach

### Memory Usage
- Matplotlib plots held in memory briefly
- Clear figures after generating images
- Astropy calculations are efficient

## Debugging Tips

### Common Issues

**Scheduler not starting**
- Check logs: `docker logs myastroboard`
- Verify scheduler initialization in app.py
- Check for exceptions during startup

**Targets not loading**
- Test GitHub API access: `curl https://api.github.com/repos/mawinkler/uptonight/contents/targets`
- Check network connectivity from container
- Verify YAML parsing

**Uptonight containers failing**
- Check Docker socket mount: `ls -l /var/run/docker.sock`
- Verify privileged mode in docker-compose.yml
- Test manual uptonight execution

**Coordinate conversion errors**
- Check regex patterns in uptonight_scheduler.py
- Validate input format matches expected
- Add logging for coordinate parsing

### Enable Debug Logging
Set environment variables to increase logging verbosity:
```bash
# In docker-compose.yml or .env file
LOG_LEVEL=DEBUG              # Enable debug logging to file
CONSOLE_LOG_LEVEL=DEBUG      # Enable debug logging to console

# Or temporarily via Docker
docker compose down
LOG_LEVEL=DEBUG CONSOLE_LOG_LEVEL=INFO docker compose up -d
```

#### Dynamic Log Level Control
```python
from logging_config import set_global_log_level, get_current_log_level

# Check current level
current_level = get_current_log_level()

# Change level at runtime (affects all loggers)
set_global_log_level('DEBUG')
```

### Useful Log Locations
- **Application Log**: `data/myastroboard.log` (mounted volume in `/app/data/`)
- **Docker Logs**: `docker logs myastroboard` (shows console output)
- **Container Logs**: `docker-compose logs -f myastroboard`
- **Log Rotation**: Check `myastroboard.log.1`, `myastroboard.log.2`, etc. for older logs
- **Scheduler Events**: Look for module `uptonight_scheduler` in logs
- **Cache Updates**: Look for module `cache_updater` and `cache_scheduler` in logs
- **Weather API**: Look for module `weather_openmeteo` in logs

## Resources & References

### Astronomy
- [Astropy Documentation](https://docs.astropy.org/)
- [Coordinate Systems](https://docs.astropy.org/en/stable/coordinates/)
- [Time Handling](https://docs.astropy.org/en/stable/time/)

### Uptonight
- [Uptonight Repository](https://github.com/mawinkler/uptonight)
- [Uptonight Docker Hub](https://hub.docker.com/r/mawinkler/uptonight)
- [Config Format](https://github.com/mawinkler/uptonight/blob/main/config.yaml.sample)

### Docker
- [Docker-in-Docker](https://jpetazzo.github.io/2015/09/03/do-not-use-docker-in-docker-for-ci/)
- [Docker Socket Mounting](https://docs.docker.com/engine/reference/commandline/dockerd/#daemon-socket-option)

### Web Development
- [Flask Documentation](https://flask.palletsprojects.com/)
- [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)

## Contact & Support

- **GitHub Issues**: https://github.com/WorldOfGZ/myastroboard/issues
- **Uptonight Discussions**: https://github.com/mawinkler/uptonight/discussions
- **Documentation**: https://github.com/WorldOfGZ/myastroboard/tree/main/docs

## License

AGPL-3.0 License - See LICENSE file for details

---

**Last Updated**: 2026-01-24
**Version**: 1.0.0
**Maintainer**: WorldOfGZ
