# Cache System - Server-Side Management

## Overview

The cache system has been redesigned to be managed **entirely server-side** with automatic TTL-based expiration and intelligent cache invalidation when location parameters change.

## Key Features

### Server-Side Only Management
- **No browser-side refresh required** - pressing F5 works normally
- All cache calculations happen on the server
- Cache is automatically refreshed on schedule

### TTL-Based Expiration
- **Astronomical Cache TTL**: 1800 seconds (30 minutes) - `CACHE_TTL`
- **Weather Cache TTL**: 3600 seconds (60 minutes) - `WEATHER_CACHE_TTL`
- Caches automatically expire after TTL and are recalculated on next scheduler interval

**Note on Weather Data:**
- **UI Weather Forecast**: Cached for 1 hour (suitable for display)
- **Uptonight Conditions**: NOT cached - always fetches fresh real-time data
  - Uptonight requires accurate current conditions (temperature, pressure, humidity)
  - Each uptonight run bypasses cache to get live conditions from Open-Meteo API

### Automatic Location Change Detection
When any of these location parameters change, **all astronomical caches are immediately reset**:
- Latitude
- Longitude
- Elevation
- Timezone

This ensures calculations are always relevant to the current observer location.

### Background Cache Scheduler
- Runs in a dedicated daemon thread
- Starts automatically on app/container startup
- Updates all caches immediately on first run
- Then updates every `CACHE_TTL` seconds (by default 1800 seconds/30 minutes)
- Uses file locking to ensure only one scheduler runs across multiple workers

## Architecture

### Components

#### 1. **`cache_store.py`** - Cache Storage & Validation
- Maintains cache entries with timestamps
- Tracks location configuration changes
- Provides TTL validation functions
- Functions:
  - `is_cache_valid(cache_entry, ttl_seconds)` - Check if cache is still fresh
  - `is_astronomical_cache_ready()` - Check if all astronomical caches are valid
  - `has_location_changed(location_config)` - Detect location parameter changes
  - `reset_all_caches()` - Immediately reset all astronomical caches
  - `get_cache_init_status()` - Get detailed cache status

#### 2. **`cache_updater.py`** - Cache Calculation
- Contains all cache update functions
- `check_and_handle_config_changes()` - Automatically detects and resets caches on location change
- `fully_initialize_caches()` - Main entry point, called by scheduler
- Updates these caches:
  - Moon report
  - Sun report
  - Moon planner (next 7 nights)
  - Best observation windows (strict, practical, illumination modes)
  - Dark window report
  - Weather forecast (from Open-Meteo API)

#### 3. **`cache_scheduler.py`** - Background Task Management
- `CacheScheduler` class runs cache updates on schedule
- Uses file locking to prevent multiple instances
- Calls `fully_initialize_caches()` periodically

#### 4. **`weather_utils.py`** - Dual Weather Client System
- **Cached Client** (`create_weather_client()`):
  - Uses HTTP-level caching (1 hour TTL)
  - Used for UI hourly forecasts
  - Reduces API calls for display data
- **Fresh Client** (`create_fresh_weather_client()`):
  - NO caching - always fresh data
  - Used for uptonight real-time conditions
  - Ensures accurate current conditions for astronomical planning

**Why Two Clients?**
- **UI needs**: Hourly forecast data is fine cached for 1 hour (it doesn't change much)
- **Uptonight needs**: Current conditions (temperature, pressure, humidity) must be real-time
- Uptonight runs at specific times and needs exact current atmospheric conditions for calculations
- A 1-hour old temperature reading would be inaccurate for precise astronomical planning

### Cache Flow

```
App Startup
    ↓
Cache Scheduler starts
    ↓
Initial cache population (immediately)
    ├─ Check location config
    ├─ Update all caches
    └─ Set timestamps
    ↓
Wait for TTL interval (CACHE_TTL seconds)
    ↓
Periodic cache refresh
    ├─ Check if location changed
    ├─ If changed: reset caches immediately
    ├─ Recalculate all caches
    └─ Update timestamps
    ↓
API Requests
    ├─ Check cache validity (TTL)
    ├─ Return data if valid
    └─ Return 202 Pending if not valid
```

## Configuration Changes

When location is updated via `/api/config` POST endpoint:

1. **System detects change** in latitude, longitude, elevation, or timezone
2. **Caches are immediately reset** (cleared)
3. **Configuration saved** to file
4. **Next scheduler run** (or manual trigger) will recalculate all caches for new location
5. **Browser receives confirmation** including `"cache_reset": true`

## API Endpoints

### `/api/cache` - Cache Status (GET)
**Purpose**: Informational only - allows UI to display cache status
**Returns**:
```json
{
  "cache_status": true,  // true if all astronomical caches are valid
  "details": {
    "moon_report": true,
    "sun_report": true,
    "best_window_strict": true,
    "best_window_practical": true,
    "best_window_illumination": true,
    "moon_planner": true,
    "dark_window": true,
    "weather_forecast": true,
    "all_ready": true,
    "in_progress": false
  }
}
```

### `/api/config` - Configuration Update (POST)
**Location Change Handling**:
- Detects if latitude, longitude, elevation, or timezone changed
- Immediately resets caches
- Returns response with `"cache_reset": true` when location changed

### Data Endpoints (Astronomical Data)
These endpoints return **from cache only**:
- `/api/moon/report` - Moon report
- `/api/moon/dark-window` - Dark window
- `/api/moon/next-7-nights` - Moon planner
- `/api/sun/today` - Sun report
- `/api/tonight/best-window` - Best observation window

**Response codes**:
- `200`: Data returned (cache is valid)
- `202`: Pending - cache being prepared (retry shortly)

## Browser Behavior

### F5 Refresh
- **Before**: Browser would check cache status and potentially delay page load
- **After**: **F5 works immediately** - no cache checking blocking the UI

### Cache Status Banner
- Shows when astronomical caches are being initialized/refreshed
- Informational only - updates automatically
- Does not block any UI functionality
- Checks cache status every 30 seconds when banner is visible

### No User Action Required
- Users no longer need to refresh for cache updates
- Cache updates happen automatically on the server
- Location changes automatically invalidate caches

## Scheduler Behavior

### Initial Startup
```
Container starts
    ↓
Cache Scheduler created
    ↓
First run: Populate ALL caches immediately
    ├─ Initialize location config tracking
    ├─ Calculate all astronomical and weather data
    └─ Cache becomes ready (200 responses from API)
    ↓
Timeline: ~30-60 seconds typically
```

### Regular Intervals
```
Wait CACHE_TTL (default 1800 seconds / 30 minutes)
    ↓
Run scheduled cache update
    ├─ Check location config
    ├─ If location changed: reset caches, update tracking
    ├─ Recalculate all caches
    └─ Update timestamps
    ↓
Next interval...
```

### Manual Trigger
```
Admin calls: POST /api/scheduler/trigger
    ↓
Uptonight scheduler runs reports
    ↓
When complete: User can see results
```

## Performance Impact

### Benefits
**No browser delays** - F5 refresh is instant
**Consistent calculations** - Always use fresh server-side cache
**Efficient resource use** - Heavy calculations run once, results served many times
**Automatic location handling** - No stale data when location changes
**Lower bandwidth** - Repeated requests get cached responses

### Cache Sizes (Typical)
- Moon report: ~5-10 KB
- Sun report: ~3-5 KB
- Best windows: ~5-8 KB each (×3 modes)
- Moon planner: ~20-30 KB
- Dark window: ~1-2 KB
- Total: ~50-100 KB in memory

## Troubleshooting

### Cache Always Shows "Pending"
1. Check cache scheduler is running: `GET /api/scheduler/status`
2. Check server logs for errors in cache calculations
3. Verify location configuration is complete
4. Check system has enough resources/memory

### Cache Not Updating After Location Change
1. Verify location parameters actually changed
2. Watch server logs for "Location configuration changed" message
3. Check `/api/cache` endpoint shows caches as not ready
4. Wait for next refresh interval (max 30 minutes)

### Multiple Cache Updates Running
- This should not happen - file locking prevents it
- If it does, check for cache_scheduler.lock file conflicts

### Uptonight Getting Stale Weather Conditions
- **This should NOT happen** - uptonight always fetches fresh data
- Uptonight uses `get_uptonight_conditions()` with `use_cache=False`
- Check server logs for "Using Open-Meteo uptonight conditions"
- Each uptonight run bypasses HTTP cache for real-time conditions
- If conditions seem old, check Open-Meteo API availability

## Technical Implementation Details

### Location Change Detection
```python
# Signature-based comparison
new_signature = {
    "latitude": 45.5,
    "longitude": -73.5,
    "elevation": 100,
    "timezone": "America/Montreal"
}

# If any value differs from last known, triggers reset
```

### TTL Validation
```python
current_time = time.time()
elapsed = current_time - cache_entry["timestamp"]
is_valid = elapsed < CACHE_TTL  # True if < 1800 seconds
```

### Atomic Config Update
1. Load current config
2. Load old config
3. Compare location fields
4. Detect changes
5. Save new config
6. If changed: Reset caches + Update tracking
7. Return response with status
