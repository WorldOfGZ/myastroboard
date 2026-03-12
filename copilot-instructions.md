# Copilot Instructions for MyAstroBoard

This document provides comprehensive guidance for GitHub Copilot (or other AI assistants) when working on the MyAstroBoard project.

## Project Overview

MyAstroBoard is a web-based astronomy observation planning system that integrates with the [mawinkler/uptonight](https://github.com/mawinkler/uptonight) Docker container to provide automated observation planning with a user-friendly dashboard.

### Core Concept
- Users configure their location and select target catalogues via web dashboard
- System automatically runs uptonight Docker container every 6 hours
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
│   ├── __pycache__/                 # Python bytecode cache
│   ├── app.py                       # Main Flask API entry point
│   ├── astrodex.py                  # Astrodex business logic and storage
│   ├── aurora_predictions.py        # Aurora forecast logic
│   ├── auth.py                      # Authentication and user management
│   ├── cache_scheduler.py           # Periodic cache scheduler
│   ├── cache_store.py               # Shared cache persistence
│   ├── cache_updater.py             # Cache refresh orchestration
│   ├── catalogue_aliases.json       # Generated catalogue alias table
│   ├── catalogue_aliases.py         # Catalogue alias helpers
│   ├── config_defaults.py           # Default config values
│   ├── constants.py                 # Shared constants
│   ├── equipment_profiles.py        # Equipment profiles API helpers
│   ├── events_aggregator.py         # Unified upcoming events data
│   ├── horizon_graph.py             # Horizon graph generation
│   ├── i18n_utils.py                # Translation backend helpers
│   ├── iss_passes.py                # ISS passes integration
│   ├── logging_config.py            # Centralized logger setup
│   ├── metrics_collector.py         # Metrics collection service
│   ├── moon_astrotonight.py         # Best astrophotography window calculations
│   ├── moon_eclipse.py              # Lunar eclipse calculations
│   ├── moon_phases.py               # Moon phase calculations
│   ├── moon_planner.py              # Moon planner over date ranges
│   ├── planetary_events.py          # Planetary events cache service
│   ├── repo_config.py               # Config file load/save helpers
│   ├── sidereal_time.py             # Sidereal time service
│   ├── solar_system_events.py       # Solar system events cache service
│   ├── special_phenomena.py         # Special phenomena cache service
│   ├── sun_eclipse.py               # Solar eclipse calculations
│   ├── sun_phases.py                # Sun phase calculations
│   ├── txtconf_loader.py            # txtconf loader
│   ├── uptonight_parser.py          # UpTonight JSON parser
│   ├── uptonight_scheduler.py       # UpTonight scheduler
│   ├── version_checker.py           # GitHub release checks
│   ├── utils.py                     # Common backend utility functions
│   ├── weather_astro.py             # Astro weather analysis
│   ├── weather_openmeteo.py         # Open-Meteo adapter
│   └── weather_utils.py             # Weather utility helpers
├── data/                            # Runtime persisted data (volume-mounted)
│   ├── astrodex/                    # Astrodex JSON + images
│   ├── cache/                       # Runtime cache payloads
│   ├── config.json                  # Main app config
│   ├── equipments/                  # Equipment profile JSON files
│   ├── myastroboard.log             # Application log file
│   ├── projects/                    # User project data
│   └── users.json                   # User accounts + preferences
├── docs/                            # Project documentation
│   ├── img/                         # Documentation images
│   ├── 1.INSTALLATION.md            # Installation guide
│   ├── 2.QUICKSTART.md              # Quick start guide
│   ├── 3.UPDATE.md                  # Update guide
│   ├── 4.RELEASE.md                 # Release process guide
│   ├── 5.ORGANIZATION.md            # Repository organization guide
│   ├── 6.REVERSE_PROXY.md           # Reverse proxy and HTTPS guide
│   ├── 7.TRANSLATIONS.md            # Translation contribution guide
│   ├── API_ENDPOINTS.md             # API endpoint inventory
│   ├── CACHE_SYSTEM.md              # Cache architecture documentation
│   ├── README.md                    # Documentation index
│   └── VISUAL_TOUR.md               # Visual tour of the application
├── scripts/
│   ├── analyse_catalogues.py        # Catalogue analysis and maintenance helper
│   ├── translate_checker.py         # Translation consistency checker
│   ├── translate_i18n_values.py     # i18n value translation helper
│   └── translate_uptonight_types.py # UpTonight type translation helper
├── static/
│   ├── css/                         # Stylesheets
│   ├── i18n/                        # Frontend translation dictionaries
│   ├── ico/                         # Platform-specific app icons
│   ├── img/                         # UI images and illustrations
│   ├── js/                          # Frontend JavaScript modules
│   ├── favicon.ico                  # Browser favicon (ICO)
│   ├── favicon.svg                  # Browser favicon (SVG)
│   ├── manifest.webmanifest         # PWA manifest
│   ├── offline.html                 # Offline fallback page
│   └── sw.js                        # Service worker
├── targets/
│   ├── GaryImm.yaml                 # Gary Imm target catalogue
│   ├── Herschel400.yaml             # Herschel 400 target catalogue
│   ├── LBN.yaml                     # LBN target catalogue
│   ├── LDN.yaml                     # LDN target catalogue
│   ├── Messier.yaml                 # Messier target catalogue
│   ├── OpenIC.yaml                  # OpenIC target catalogue
│   ├── OpenNGC.yaml                 # OpenNGC target catalogue
│   ├── Pensack500.yaml              # Pensack 500 target catalogue
│   └── README.md                    # Target catalogue notes
├── templates/
│   ├── index.html                   # Main dashboard page
│   └── login.html                   # Login page
├── tests/
│   ├── __pycache__/                 # Python bytecode cache for tests
│   ├── __init__.py                  # Tests package marker
│   ├── conftest.py                  # Shared pytest fixtures
│   ├── README.md                    # Testing notes
│   ├── test_astrodex.py             # Astrodex unit tests
│   ├── test_astrodex_api.py         # Astrodex API tests
│   ├── test_astronomical.py         # Astronomical services tests
│   ├── test_auth.py                 # Authentication and users tests
│   ├── test_cache_scheduler.py      # Cache scheduler tests
│   ├── test_cache_store.py          # Cache storage tests
│   ├── test_catalogue_aliases.py    # Catalogue aliases tests
│   ├── test_config.py               # Configuration management tests
│   ├── test_constants.py            # Constants module tests
│   ├── test_equipment_profiles.py   # Equipment profiles tests
│   ├── test_horizon_graph.py        # Horizon graph tests
│   ├── test_i18n_utils.py           # i18n utility tests
│   ├── test_iss_passes.py           # ISS passes tests
│   ├── test_logging_config.py       # Logging configuration tests
│   ├── test_moon_eclipse.py         # Moon eclipse tests
│   ├── test_new_event_services.py   # New event services tests
│   ├── test_txtconf_loader.py       # txtconf loader tests
│   ├── test_uptonight_parser.py     # UpTonight parser tests
│   ├── test_utils.py                # Shared utility tests
│   ├── test_version_checker.py      # Version checker tests
│   └── test_weather_utils.py        # Weather utility tests
├── uptonight/
│   ├── configs/                     # Generated UpTonight configs
│   └── outputs/                     # Generated UpTonight outputs
├── CODEOWNERS                       # Repository ownership rules
├── CODE_OF_CONDUCT.md               # Community code of conduct
├── CONTRIBUTING.md                  # Contribution guidelines
├── copilot-instructions.md          # AI assistant working guidelines
├── docker-compose-dev.yml           # Development deployment
├── docker-compose.debug.yml         # Debug compose overlay
├── docker-compose.yml               # Production deployment
├── Dockerfile                       # Container build definition
├── entrypoint.sh                    # Container startup script
├── feature.md                       # Feature planning notes
├── LICENSE                          # Project license
├── pytest.ini                       # Pytest configuration
├── README.md                        # Main project documentation
├── requirements-dev.txt             # Development Python dependencies
├── requirements.txt                 # Runtime Python dependencies
├── ROADMAP.md                       # Product roadmap
├── SECURITY.md                      # Security policy
└── VERSION                          # Application version
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

#### Frontend XSS Security Rules (MANDATORY)
- **NEVER** use `innerHTML` in `static/js/**` (writes or reads for rendering).
- **NEVER** introduce new `DOMUtils.setTrustedHTML(...)` callsites.
- Build UI with explicit DOM APIs: `document.createElement`, `textContent`, `appendChild`, `setAttribute`.
- For text and API/user content, always use `textContent` (never HTML string interpolation).
- Before re-rendering containers, use `DOMUtils.clear(container)`.
- Preserve existing IDs/classes/data-attributes required by listeners and Bootstrap behavior.
- If a legacy HTML template must be kept temporarily, isolate it and prioritize migration to node-based rendering.

#### Existing Security Baseline (Do Not Regress)
- `innerHTML` has been removed from `static/js/**`.
- Major modules (`auth`, `app`, `astrodex`, `weather`, `weather_astro`, `equipment`, `moon`, `sun`, `iss`, `horizon_graph`, `aurora`, `solar_eclipse`, `lunar_eclipse`, `uptonightScheduler`) now follow node-based DOM updates.
- Any change reintroducing HTML sinks should be treated as a regression and rewritten.

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
  - `role`: One of `admin`, `user`, `read-only`
  - `created_at`: ISO timestamp of user creation
  - `last_login`: ISO timestamp of last successful login
  - `preferences`: Per-user UI customization settings
- **Default User**: `admin:admin` created automatically on first run
- **Persistence**: Stored in Docker volume (`./data:/app/data`), survives container restarts/rebuilds
- **Security**: Passwords are hashed using Werkzeug's `generate_password_hash` (bcrypt)
- **Session Management**: Flask session-based authentication with secure cookies
- **Why**: Persistent user accounts, secure password storage, survives Docker restarts

### 1.2. User Customization Preferences
- **Pattern**: Per-user preference object persisted in `data/users.json`
- **Scope**: Preferences are always user-scoped; never shared globally across users
- **Current Keys**:
  - `startup_main_tab`: default main tab at login
  - `startup_subtab`: default sub-tab at login
  - `time_format`: `auto` | `12h` | `24h`
  - `density`: `comfortable` | `compact`
  - `theme_mode`: `auto` | `light` | `dark` | `red`
- **Backend Rules**:
  - Validate allowed keys and values before saving
  - Merge with defaults for missing keys
  - Persist via atomic + validated users save path (tmp + validate + replace + backup/restore)
- **Frontend Rules**:
  - Load preferences after authentication, then apply immediately
  - Use preferences as startup navigation source
  - Keep `customize-subtab` strictly user-level (no admin/global settings here)
  - On language change, re-render dynamic preference labels/options
- **Why**: Personalized UX without compromising role boundaries or data integrity

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
- **Endpoint Coverage**:
  - Routes are defined in `backend/app.py` and grouped by domain: auth, users, config, logs/metrics, scheduler, uptonight, weather, astronomy, events, astrodex, and equipment.
  - The current endpoint inventory is maintained in `docs/API_ENDPOINTS.md` and should be updated whenever a route is added, removed, or renamed.
  - Key security constraints:
    - Most `/api/*` routes require login (`@login_required`).
    - Admin-only routes use `@admin_required` (users CRUD, config write/export, logs clear, metrics, scheduler trigger).
    - User update/delete route is `/api/users/<user_id>` (not `<username>`).
    - Self-service endpoints include `/api/auth/change-password` and `/api/auth/preferences`.
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
- **SCHEDULE_INTERVAL**: Uptonight execution interval in seconds (default: 21600)
- **DATA_DIR**: Configuration storage (default: `/app/data`)
- **UPTONIGHT_DIR**: Results storage (default: `/app/uptonight`)
- **LOG_LEVEL**: File logging level - DEBUG, INFO, WARNING, ERROR, CRITICAL (default: INFO)
- **CONSOLE_LOG_LEVEL**: Console logging level - DEBUG, INFO, WARNING, ERROR, CRITICAL (default: WARNING)

#### Logging Environment Setup Example
```yaml
# docker-compose.yml
environment:
  - LOG_LEVEL=INFO          # Standard logging to file
  - CONSOLE_LOG_LEVEL=WARNING # Minimal console noise
  - SCHEDULE_INTERVAL=21600  # 6 hours
  
# For debugging
environment:
  - LOG_LEVEL=DEBUG         # Detailed logging to file  
  - CONSOLE_LOG_LEVEL=INFO  # More console output
```

See `.env.example` for full list and documentation.

### Scheduler Behavior
```python
# Runs immediately on startup
# Then every SCHEDULE_INTERVAL seconds (default: 21600 = 6 hours)
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

All files are stored in: `uptonight/outputs/{target_name}/`

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
        logger.error(f"Error in new endpoint: {e}")
        return jsonify({'error': 'Internal server error'}), 500
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

### Testing Scheduler (Without Waiting 6 Hours)
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

## UI/UX Graphing Standard

All interactive charts in the UI should follow a consistent, clean presentation format. Use the `horizon-graph.js` implementation as reference for the standard layout.

### Chart Component Structure

Every chart must be wrapped in a Bootstrap card container with the following structure:

```html
<div class="col mb-3"> <!-- Adjust col size based on grid requirement -->
    <div class="card h-100">
        <!-- Header with title -->
        <div class="card-header">
            <h5 class="mb-0">🔥 Chart Title</h5>
        </div>
        
        <!-- Chart container -->
        <div class="card-body">
            <canvas id="unique-chart-id" style="height: 350px;"></canvas>
        </div>
        
        <!-- Footer with legend and metadata -->
        <div class="card-footer text-muted small">
            <div class="row">
                <div class="col-auto">
                    <span class="badge" style="background-color: #COLOR1;">Legend Item 1</span>
                </div>
                <div class="col-auto">
                    <span class="badge" style="background-color: #COLOR2;">Legend Item 2</span>
                </div>
                <div class="col-auto">
                    <span class="text-muted">Additional metadata or unit information</span>
                </div>
            </div>
        </div>
    </div>
</div>
```

### Grid Sizes
- **Full width**: `col-12` (for wide charts like horizon-graph)
- **Two columns**: `col-6` (for standard side-by-side charts)
- **Three columns**: `col-4` (for compact displays)
- **Responsive**: Use Bootstrap responsive classes:
  - `row-cols-1 row-cols-sm-2 row-cols-lg-3 row-cols-xl-4`

### Chart Configuration Best Practices

When implementing charts with Chart.js:

1. **Always use card wrapper**: Don't render canvas directly without card styling
2. **Font sizing**: Use responsive units for labels/titles
3. **Colors**: Use consistent color scheme (reference existing charts)
4. **Legend**: Display in card footer as badges with color indicators
5. **Responsiveness**: Use device-aware options like `isCompactChart()` function
6. **Height**: Set canvas height in card-body or inline style (e.g., `max-height: 350px`)
7. **Destruction**: Always destroy previous chart instance before creating new one
8. **Tooltip formatting**: Round to 1 decimal place for readability

### Example Implementation Pattern

```javascript
/**
 * Render chart with standard card layout
 */
function renderMyChart(data) {
    const container = document.getElementById('my-chart-display');
    if (!container) return;

  // Create card structure with explicit DOM APIs (no innerHTML)
  DOMUtils.clear(container);
  const col = document.createElement('div');
  col.className = 'col-12 mb-3';

  const card = document.createElement('div');
  card.className = 'card h-100';

  const header = document.createElement('div');
  header.className = 'card-header';
  const title = document.createElement('h5');
  title.className = 'mb-0';
  title.textContent = '📊 My Chart Title';
  header.appendChild(title);

  const body = document.createElement('div');
  body.className = 'card-body';
  const canvas = document.createElement('canvas');
  canvas.id = 'myChartCanvas';
  canvas.style.height = '350px';
  body.appendChild(canvas);

  const footer = document.createElement('div');
  footer.className = 'card-footer text-muted small';
  const footerRow = document.createElement('div');
  footerRow.className = 'row';

  const badge1Col = document.createElement('div');
  badge1Col.className = 'col-auto';
  const badge1 = document.createElement('span');
  badge1.className = 'badge';
  badge1.style.backgroundColor = '#3b82f6';
  badge1.textContent = 'Series 1';
  badge1Col.appendChild(badge1);

  const badge2Col = document.createElement('div');
  badge2Col.className = 'col-auto';
  const badge2 = document.createElement('span');
  badge2.className = 'badge';
  badge2.style.backgroundColor = '#8b5cf6';
  badge2.textContent = 'Series 2';
  badge2Col.appendChild(badge2);

  footerRow.appendChild(badge1Col);
  footerRow.appendChild(badge2Col);
  footer.appendChild(footerRow);

  card.appendChild(header);
  card.appendChild(body);
  card.appendChild(footer);
  col.appendChild(card);
  container.appendChild(col);
    
    // Create Chart.js instance
    const ctx = document.getElementById('myChartCanvas');
    if (window.myChartInstance) {
        window.myChartInstance.destroy();
    }
    
    window.myChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.times,
            datasets: [
                {
                    label: 'Series 1',
                    data: data.series1,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    // ... other options
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
            // ... other options
        }
    });
}
```

### Files Requiring This Standard
- `weather_astro.js`: astro-seeing-chart, astro-clouds-chart, astro-conditions-chart
- `weather.js`: cloudConditionsChart, seeingConditionsChart
- `solar_eclipse.js`: solar-eclipse-altitude-chart
- `lunar_eclipse.js`: lunar-eclipse-altitude-chart

## Internationalization (i18n) & Translations

### Overview
MyAstroBoard supports multiple languages through a structured i18n system. Currently supported languages: **English (en)**, **French (fr)**.

### Key Principles
- **All user-facing text must be translatable** - No hardcoded strings in UI
- **Keys use dot notation for organization** - `namespace.section.key` structure
- **Key naming respects file organization** - Keys grouped by component/file
- **Backend and Frontend coordination** - Consistent key naming across stack
- **Fallback to English** - Missing keys default to English
- **Browser language detection** - Automatically detects browser language preference
- **User preference persistence** - Stores language choice in localStorage
- **Translated API payloads required** - No hardcoded English messages in API responses when i18n keys exist
- **Parameterized keys must be resolved** - Always pass required placeholders (example: `{time}`) before returning payloads

### Directory Structure
```
static/i18n/
├── en.json          # English translations
├── fr.json          # French translations
└── [language].json  # Add new languages here

static/js/
└── i18n.js          # Global i18n manager (must load early)

backend/
└── i18n_utils.py    # Backend translation utilities
```

### Frontend Usage

#### 1. HTML Elements with data-i18n attribute
```html
<!-- Static content translation -->
<h2 data-i18n="astro_weather.section_title">🌡️ Current Conditions</h2>
<p data-i18n="common.loading">Loading...</p>

<!-- Initialize i18n translations after page load -->
<script>
    window.addEventListener('load', () => {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            el.textContent = i18n.t(key);
        });
    });
</script>
```

#### 2. JavaScript Direct Translation Calls
```javascript
// Get translated string
const message = i18n.t('common.loading');

// Get translated string with parameters (placeholders)
const alertMsg = i18n.t('weather_alerts.critical_dew_risk', { time: '14:30' });

// Check if translation exists
if (i18n.has('my.key')) {
    console.log(i18n.t('my.key'));
}
```

#### 3. Language Switching

**Automatic (User-facing)**:
```html
<!-- Language selector dropdown in footer -->
<select id="language-select-footer" class="form-select form-select-sm">
    <option value="en">English</option>
    <option value="fr">Français</option>
</select>
```

The `LanguageSelector` class (in `static/js/language-selector.js`) automatically handles user interactions with this dropdown, switching the language and updating all UI elements.

**Programmatic (Developer)**:
```javascript
// Switch language programmatically
await i18n.setLanguage('fr');  // Switch to French

// Get current language
const currentLang = i18n.getCurrentLanguage();

// Get supported languages
const langs = i18n.getSupportedLanguages();  // Returns ['en', 'fr']

// Listen for language changes (useful for components needing dynamic updates)
window.addEventListener('i18nLanguageChanged', (e) => {
    // Update UI elements here
    console.log(`Language changed to: ${e.detail.language}`);
});
```

**User Experience**:
- Footer contains language selector dropdown (next to theme selector)
- Users can click dropdown to switch between English and Français
- Language preference persists in browser localStorage
- All page content updates instantly to new language
- Browser language is auto-detected on first visit

#### 4. Dynamic Content Translation in JavaScript
```javascript
// Creating translated content dynamically
function renderAlert(alert) {
    const alertDiv = document.createElement('div');
    
    // Get translated alert message based on alert type
    let messageKey;
    switch(alert.type) {
        case 'DEW_WARNING':
            messageKey = 'weather_alerts.alert_dew_warning';
            break;
        case 'WIND_WARNING':
            messageKey = 'weather_alerts.alert_wind_warning';
            break;
        default:
            messageKey = 'weather_alerts.section_title';
    }
    
    alertDiv.textContent = i18n.t(messageKey);
    container.appendChild(alertDiv);
}
```

### Backend Usage

#### 1. Python Translation Utilities
```python
from i18n_utils import get_translated_message, I18nManager, create_translated_alert

# Simple translation
message = get_translated_message('common.loading', language='fr')

# Using manager instance
manager = I18nManager('en')
title = manager.t('astro_weather.section_title')

# Get translation with parameters
alert_msg = manager.t('weather_alerts.critical_dew_risk', time='14:30')

# Get entire namespace
weather_namespace = manager.get_namespace('weather_alerts')
```

#### 2. Translated API Responses
```python
from flask import jsonify
from i18n_utils import create_translated_alert, I18nManager

@app.route('/api/weather/alerts', methods=['GET'])
@login_required
def get_weather_alerts_api():
    """Get weather alerts with translation support"""
    
    # Get user's preferred language (could come from request headers or DB)
    language = request.args.get('lang', 'en')
    
    # Create alerts with translated messages
    alerts = [
        create_translated_alert(
            alert_type='DEW_WARNING',
            severity='HIGH',
            time=alert_time,
            language=language
        ),
        # ... more alerts
    ]
    
    return jsonify({'alerts': alerts})
```

#### 3. Request-Level i18n Initialization
```python
from i18n_utils import init_i18n_for_request

@app.before_request
def setup_i18n():
    """Initialize i18n for each request"""
    language = request.args.get('lang', 'en')
    g.i18n = init_i18n_for_request(language)

# Later in route handler
@app.route('/api/some-endpoint', methods=['GET'])
def some_endpoint():
    message = g.i18n.t('some.key')
    # ...
```

### Translation Key Structure

Keys are organized by component/namespace using dot notation. Hierarchy:
1. **Namespace** (top level) - Component or feature name
2. **Section** (optional) - Logical grouping within namespace
3. **Key** - Specific translation key

Example structure:
```json
{
  "common": {
    "loading": "Loading...",
    "error": "Error"
  },
  "astro_weather": {
    "section_title": "🌡️ Current Conditions",
    "loading_message": "☁️ Loading...",
    "no_data": "No data available"
  },
  "weather_alerts": {
    "alert_dew_warning": "Critical dew risk",
    "critical_dew_risk": "Critical dew risk starting at {time}"
  }
}
```

### Guidelines for Implementing Translations

#### When Adding New User-Facing Text
1. **Define translation keys** in both `en.json` and `fr.json`
2. **Use descriptive key names** that reflect the content location
3. **Group related keys** in the same namespace
4. **Include context in comments** if key meaning is ambiguous

#### For HTML Templates
```html
<!-- GOOD: Static content with data-i18n attribute -->
<h2 data-i18n="page.section_name">Section Name</h2>

<!-- AVOID: Hardcoded strings -->
<h2>Section Name</h2>
```

#### For JavaScript Components
```javascript
// GOOD: Use i18n.t() for dynamic content
const element = document.createElement('div');
element.textContent = i18n.t('namespace.key');

// AVOID: Hardcoded strings
element.textContent = 'This is a message';
```

#### For Backend API Responses
```python
# GOOD: Use translated messages in API responses
return jsonify({
    'status': 'error',
    'message': i18n.t('common.error')
})

# AVOID: Hardcoded English strings
return jsonify({
    'status': 'error',
    'message': 'An error occurred'
})
```

#### API Language Propagation Rule

- Frontend must send current language via `?lang=<code>` for endpoints returning translated content.
- Backend must normalize language from query param first, then `Accept-Language`, then fallback to `en`.
- Applies to weather alerts, astro-analysis alerts, events, and any future translated API payload.

### Adding a New Language

1. Create new translation file: `static/i18n/[language].json`
2. Copy structure from `en.json`
3. Translate all keys to the new language
4. Update `SUPPORTED_LANGUAGES` in `backend/i18n_utils.py`
5. Languages will be automatically available in the UI

### Translation Quality Assurance
- **Scientific accuracy** - Translations must maintain accuracy for astronomical terms
- **Consistency** - Use consistent terminology across all translations
- **Testing** - Test UI with multiple languages before merging
- **Missing keys** - Check logs for any missing translation keys in production

### Common Issues & Troubleshooting

**Issue**: Text appears untranslated (shows key instead of value)
- Check if key exists in translation file
- Verify key path matches exactly (case-sensitive)
- Check browser console for i18n loading errors
- Verify `i18n.js` loads before dependent scripts

**Issue**: Translations not updating when language changes
- Ensure UI has listener for `i18nLanguageChanged` event
- Update static content using `data-i18n` attributes
- Update dynamic content by re-rendering components

**Issue**: Backend returns untranslated messages
- Check if `i18n_utils.py` is imported correctly
- Verify language parameter is being passed properly
- Check translation files exist in `/app/static/i18n/`

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
