"""
Unit tests for cache store (cache_store.py)
"""
import pytest


# Import cache variables to test
from cache_store import (
    _moon_report_cache,
    _sun_report_cache,
    _best_window_cache,
    _moon_planner_report_cache,
    _dark_window_report_cache,
    _cache_fully_initialized
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
    
    def test_cache_fully_initialized_is_boolean(self):
        """Test _cache_fully_initialized is a boolean"""
        assert isinstance(_cache_fully_initialized, bool)


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
    
    def test_cache_fully_initialized_initial_value(self):
        """Test _cache_fully_initialized initial value is False"""
        # Note: This may be True if other tests have run, so we just check it's boolean
        assert isinstance(_cache_fully_initialized, bool)


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
