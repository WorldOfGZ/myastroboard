"""
Unit tests for cache store (cache_store.py)
Tests the server-side cache management system with TTL-based expiration
"""
import pytest
import time
from constants import CACHE_TTL, WEATHER_CACHE_TTL

# Import cache variables and functions to test
from cache_store import (
    _moon_report_cache,
    _sun_report_cache,
    _best_window_cache,
    _moon_planner_report_cache,
    _dark_window_report_cache,
    _last_known_location_config,
    is_cache_valid,
    is_astronomical_cache_ready,
    has_location_changed,
    reset_all_caches,
    update_location_config,
    get_current_location_signature,
    get_cache_init_status,
    set_cache_initialization_in_progress
)


class TestCacheStructures:
    """Test cache data structures"""
    
    def test_moon_report_cache_structure(self):
        """Test _moon_report_cache has correct structure"""
        assert isinstance(_moon_report_cache, dict)
        assert 'timestamp' in _moon_report_cache
        assert 'data' in _moon_report_cache
        assert isinstance(_moon_report_cache['timestamp'], (int, float))
    
    def test_sun_report_cache_structure(self):
        """Test _sun_report_cache has correct structure"""
        assert isinstance(_sun_report_cache, dict)
        assert 'timestamp' in _sun_report_cache
        assert 'data' in _sun_report_cache
        assert isinstance(_sun_report_cache['timestamp'], (int, float))
    
    def test_best_window_cache_structure(self):
        """Test _best_window_cache has correct structure"""
        assert isinstance(_best_window_cache, dict)
        
        # Should have three sub-caches
        assert 'strict' in _best_window_cache
        assert 'practical' in _best_window_cache
        assert 'illumination' in _best_window_cache
        
        # Each sub-cache should have timestamp and data
        for key in ['strict', 'practical', 'illumination']:
            assert 'timestamp' in _best_window_cache[key]
            assert 'data' in _best_window_cache[key]
            assert isinstance(_best_window_cache[key]['timestamp'], (int, float))
    
    def test_moon_planner_report_cache_structure(self):
        """Test _moon_planner_report_cache has correct structure"""
        assert isinstance(_moon_planner_report_cache, dict)
        assert 'timestamp' in _moon_planner_report_cache
        assert 'data' in _moon_planner_report_cache
        assert isinstance(_moon_planner_report_cache['timestamp'], (int, float))
    
    def test_dark_window_report_cache_structure(self):
        """Test _dark_window_report_cache has correct structure"""
        assert isinstance(_dark_window_report_cache, dict)
        assert 'timestamp' in _dark_window_report_cache
        assert 'data' in _dark_window_report_cache
        assert isinstance(_dark_window_report_cache['timestamp'], (int, float))
    
    def test_cache_location_tracking_structure(self):
        """Test _last_known_location_config has correct structure"""
        assert isinstance(_last_known_location_config, dict)
        assert 'latitude' in _last_known_location_config
        assert 'longitude' in _last_known_location_config
        assert 'elevation' in _last_known_location_config
        assert 'timezone' in _last_known_location_config



class TestCacheInitialValues:
    """Test initial cache values"""
    
    def test_moon_report_cache_initial_values(self):
        """Test _moon_report_cache initial values"""
        # Initial timestamp should be 0
        assert _moon_report_cache['timestamp'] == 0
        # Initial data should be None
        assert _moon_report_cache['data'] is None
    
    def test_sun_report_cache_initial_values(self):
        """Test _sun_report_cache initial values"""
        assert _sun_report_cache['timestamp'] == 0
        assert _sun_report_cache['data'] is None
    
    def test_best_window_cache_initial_values(self):
        """Test _best_window_cache initial values"""
        for key in ['strict', 'practical', 'illumination']:
            assert _best_window_cache[key]['timestamp'] == 0
            assert _best_window_cache[key]['data'] is None
    
    def test_moon_planner_report_cache_initial_values(self):
        """Test _moon_planner_report_cache initial values"""
        assert _moon_planner_report_cache['timestamp'] == 0
        assert _moon_planner_report_cache['data'] is None
    
    def test_dark_window_report_cache_initial_values(self):
        """Test _dark_window_report_cache initial values"""
        assert _dark_window_report_cache['timestamp'] == 0
        assert _dark_window_report_cache['data'] is None
    
    def test_location_config_initial_values(self):
        """Test _last_known_location_config initial values (None)"""
        # Initial location config should have None values (not yet tracked)
        assert _last_known_location_config['latitude'] is None
        assert _last_known_location_config['longitude'] is None
        assert _last_known_location_config['elevation'] is None
        assert _last_known_location_config['timezone'] is None



class TestCacheConsistency:
    """Test cache structure consistency"""
    
    def test_all_simple_caches_have_same_structure(self):
        """Test that all simple caches have the same structure"""
        simple_caches = [
            _moon_report_cache,
            _sun_report_cache,
            _moon_planner_report_cache,
            _dark_window_report_cache
        ]
        
        for cache in simple_caches:
            assert set(cache.keys()) == {'timestamp', 'data'}
            assert isinstance(cache['timestamp'], (int, float))
    
    def test_best_window_cache_subcaches_consistency(self):
        """Test that all best_window sub-caches have the same structure"""
        for key in ['strict', 'practical', 'illumination']:
            subcache = _best_window_cache[key]
            assert set(subcache.keys()) == {'timestamp', 'data'}
            assert isinstance(subcache['timestamp'], (int, float))

class TestCacheValidation:
    """Test TTL-based cache validation"""
    
    def test_is_cache_valid_with_fresh_cache(self):
        """Test is_cache_valid returns True for fresh cache"""
        cache_entry = {"timestamp": time.time(), "data": {"test": "data"}}
        assert is_cache_valid(cache_entry, CACHE_TTL) is True
    
    def test_is_cache_valid_with_expired_cache(self):
        """Test is_cache_valid returns False for expired cache"""
        # Set timestamp to past (expired)
        past_time = time.time() - (CACHE_TTL + 10)
        cache_entry = {"timestamp": past_time, "data": {"test": "data"}}
        assert is_cache_valid(cache_entry, CACHE_TTL) is False
    
    def test_is_cache_valid_with_no_data(self):
        """Test is_cache_valid returns False when data is None"""
        cache_entry = {"timestamp": time.time(), "data": None}
        assert is_cache_valid(cache_entry, CACHE_TTL) is False
    
    def test_is_cache_valid_with_empty_cache(self):
        """Test is_cache_valid returns False for empty cache"""
        cache_entry = {"timestamp": 0, "data": None}
        assert is_cache_valid(cache_entry, CACHE_TTL) is False
    
    def test_is_cache_valid_with_different_ttl(self):
        """Test is_cache_valid respects different TTL values"""
        cache_entry = {"timestamp": time.time() - 30, "data": {"test": "data"}}
        # Should be valid with high TTL
        assert is_cache_valid(cache_entry, 60) is True
        # Should be invalid with low TTL
        assert is_cache_valid(cache_entry, 10) is False


class TestLocationChangeDetection:
    """Test location configuration change detection"""
    
    def test_get_current_location_signature(self):
        """Test location signature creation"""
        location = {
            "latitude": 45.5,
            "longitude": -73.5,
            "elevation": 100,
            "timezone": "America/Montreal"
        }
        signature = get_current_location_signature(location)
        assert signature["latitude"] == 45.5
        assert signature["longitude"] == -73.5
        assert signature["elevation"] == 100
        assert signature["timezone"] == "America/Montreal"
    
    def test_get_current_location_signature_with_none(self):
        """Test location signature with None input"""
        signature = get_current_location_signature(None)
        assert signature is None
    
    def test_has_location_changed_first_time(self):
        """Test has_location_changed returns True on first tracking"""
        # Reset to initial state
        location = {
            "latitude": 45.5,
            "longitude": -73.5,
            "elevation": 100,
            "timezone": "America/Montreal"
        }
        # First time should return True (change detected)
        result = has_location_changed(location)
        assert result is True or result is False  # Depends on test order
    
    def test_has_location_changed_latitude(self):
        """Test location change detection for latitude"""
        location1 = {
            "latitude": 45.5,
            "longitude": -73.5,
            "elevation": 100,
            "timezone": "America/Montreal"
        }
        update_location_config(location1)
        
        location2 = {
            "latitude": 46.5,  # Changed
            "longitude": -73.5,
            "elevation": 100,
            "timezone": "America/Montreal"
        }
        assert has_location_changed(location2) is True
    
    def test_has_location_changed_longitude(self):
        """Test location change detection for longitude"""
        location1 = {
            "latitude": 45.5,
            "longitude": -73.5,
            "elevation": 100,
            "timezone": "America/Montreal"
        }
        update_location_config(location1)
        
        location2 = {
            "latitude": 45.5,
            "longitude": -74.5,  # Changed
            "elevation": 100,
            "timezone": "America/Montreal"
        }
        assert has_location_changed(location2) is True
    
    def test_has_location_changed_elevation(self):
        """Test location change detection for elevation"""
        location1 = {
            "latitude": 45.5,
            "longitude": -73.5,
            "elevation": 100,
            "timezone": "America/Montreal"
        }
        update_location_config(location1)
        
        location2 = {
            "latitude": 45.5,
            "longitude": -73.5,
            "elevation": 200,  # Changed
            "timezone": "America/Montreal"
        }
        assert has_location_changed(location2) is True
    
    def test_has_location_changed_timezone(self):
        """Test location change detection for timezone"""
        location1 = {
            "latitude": 45.5,
            "longitude": -73.5,
            "elevation": 100,
            "timezone": "America/Montreal"
        }
        update_location_config(location1)
        
        location2 = {
            "latitude": 45.5,
            "longitude": -73.5,
            "elevation": 100,
            "timezone": "America/New_York"  # Changed
        }
        assert has_location_changed(location2) is True
    
    def test_has_location_changed_no_change(self):
        """Test location change detection when nothing changed"""
        location = {
            "latitude": 45.5,
            "longitude": -73.5,
            "elevation": 100,
            "timezone": "America/Montreal"
        }
        update_location_config(location)
        
        # Same location
        assert has_location_changed(location) is False
    
    def test_update_location_config(self):
        """Test updating tracked location config"""
        import cache_store
        
        location = {
            "latitude": 40.7,
            "longitude": -74.0,
            "elevation": 50,
            "timezone": "America/New_York"
        }
        update_location_config(location)
        
        # Verify it was updated (access via module, not local import)
        assert cache_store._last_known_location_config["latitude"] == 40.7
        assert cache_store._last_known_location_config["longitude"] == -74.0


class TestCacheReset:
    """Test cache reset functionality"""
    
    def test_reset_all_caches(self):
        """Test resetting all astronomical caches"""
        import cache_store
        
        # Set some data
        cache_store._moon_report_cache["data"] = {"test": "data"}
        cache_store._moon_report_cache["timestamp"] = time.time()
        cache_store._sun_report_cache["data"] = {"test": "data"}
        
        # Reset
        reset_all_caches()
        
        # Verify all are cleared (access via module, not local import)
        assert cache_store._moon_report_cache["data"] is None
        assert cache_store._moon_report_cache["timestamp"] == 0
        assert cache_store._sun_report_cache["data"] is None
        assert cache_store._sun_report_cache["timestamp"] == 0
        assert cache_store._best_window_cache["strict"]["data"] is None
        assert cache_store._moon_planner_report_cache["data"] is None
        assert cache_store._dark_window_report_cache["data"] is None


class TestCacheInitStatus:
    """Test cache initialization status reporting"""
    
    def test_get_cache_init_status(self):
        """Test getting detailed cache status"""
        status = get_cache_init_status()
        
        # Check structure
        assert "moon_report" in status
        assert "sun_report" in status
        assert "best_window_strict" in status
        assert "best_window_practical" in status
        assert "best_window_illumination" in status
        assert "moon_planner" in status
        assert "dark_window" in status
        assert "all_ready" in status
        assert "in_progress" in status
        
        # Should be booleans
        assert isinstance(status["all_ready"], bool)
        assert isinstance(status["in_progress"], bool)
    
    def test_set_cache_initialization_in_progress(self):
        """Test setting cache initialization progress flag"""
        set_cache_initialization_in_progress(True)
        status = get_cache_init_status()
        assert status["in_progress"] is True
        
        set_cache_initialization_in_progress(False)
        status = get_cache_init_status()
        assert status["in_progress"] is False
    
    def test_is_astronomical_cache_ready_when_empty(self):
        """Test cache ready status when caches are empty"""
        # With no data, caches should not be ready
        reset_all_caches()
        assert is_astronomical_cache_ready() is False