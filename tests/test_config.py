"""
Unit tests for configuration management (repo_config.py, config_defaults.py)
"""
import pytest
import os
import json
import tempfile


# Import modules to test
from repo_config import load_config, save_config
from config_defaults import (
    DEFAULT_LOCATION,
    DEFAULT_FEATURES,
    DEFAULT_CONSTRAINTS,
    DEFAULT_HORIZON,
    DEFAULT_CONFIG
)


class TestDefaultConfig:
    """Test default configuration constants"""
    
    def test_default_location_structure(self):
        """Test DEFAULT_LOCATION has required fields"""
        assert "name" in DEFAULT_LOCATION
        assert "latitude" in DEFAULT_LOCATION
        assert "longitude" in DEFAULT_LOCATION
        assert "elevation" in DEFAULT_LOCATION
        assert "timezone" in DEFAULT_LOCATION
    
    def test_default_location_values(self):
        """Test DEFAULT_LOCATION has valid values"""
        assert isinstance(DEFAULT_LOCATION["name"], str)
        assert isinstance(DEFAULT_LOCATION["latitude"], (int, float))
        assert isinstance(DEFAULT_LOCATION["longitude"], (int, float))
        assert isinstance(DEFAULT_LOCATION["elevation"], (int, float))
        assert isinstance(DEFAULT_LOCATION["timezone"], str)
        
        # Validate coordinate ranges
        assert -90 <= DEFAULT_LOCATION["latitude"] <= 90
        assert -180 <= DEFAULT_LOCATION["longitude"] <= 180
    
    def test_default_features_structure(self):
        """Test DEFAULT_FEATURES has expected fields"""
        expected_features = ["horizon", "objects", "bodies", "comets", "alttime"]
        for feature in expected_features:
            assert feature in DEFAULT_FEATURES
            assert isinstance(DEFAULT_FEATURES[feature], bool)
    
    def test_default_constraints_structure(self):
        """Test DEFAULT_CONSTRAINTS has required fields"""
        expected_constraints = [
            "altitude_constraint_min",
            "altitude_constraint_max",
            "airmass_constraint",
            "size_constraint_min",
            "size_constraint_max",
            "moon_separation_min"
        ]
        for constraint in expected_constraints:
            assert constraint in DEFAULT_CONSTRAINTS
    
    def test_default_constraints_valid_ranges(self):
        """Test constraint values are in valid ranges"""
        assert 0 <= DEFAULT_CONSTRAINTS["altitude_constraint_min"] <= 90
        assert 0 <= DEFAULT_CONSTRAINTS["altitude_constraint_max"] <= 90
        assert DEFAULT_CONSTRAINTS["altitude_constraint_min"] < DEFAULT_CONSTRAINTS["altitude_constraint_max"]
        assert DEFAULT_CONSTRAINTS["airmass_constraint"] > 0
        assert DEFAULT_CONSTRAINTS["size_constraint_min"] < DEFAULT_CONSTRAINTS["size_constraint_max"]
        assert 0 <= DEFAULT_CONSTRAINTS["moon_separation_min"] <= 180
    
    def test_default_horizon_structure(self):
        """Test DEFAULT_HORIZON structure"""
        assert "step_size" in DEFAULT_HORIZON
        assert "anchor_points" in DEFAULT_HORIZON
        assert isinstance(DEFAULT_HORIZON["step_size"], (int, float))
        assert isinstance(DEFAULT_HORIZON["anchor_points"], list)
    
    def test_default_config_complete(self):
        """Test DEFAULT_CONFIG has all required top-level keys"""
        expected_keys = [
            "location",
            "selected_catalogues",
            "min_altitude",
            "use_constraints",
            "features",
            "constraints",
            "bucket_list",
            "done_list",
            "custom_targets",
            "horizon",
            "output_datestamp"
        ]
        for key in expected_keys:
            assert key in DEFAULT_CONFIG, f"Missing key: {key}"
    
    def test_default_config_references_other_defaults(self):
        """Test that DEFAULT_CONFIG uses the other default constants"""
        assert DEFAULT_CONFIG["location"] == DEFAULT_LOCATION
        assert DEFAULT_CONFIG["features"] == DEFAULT_FEATURES
        assert DEFAULT_CONFIG["constraints"] == DEFAULT_CONSTRAINTS
        assert DEFAULT_CONFIG["horizon"] == DEFAULT_HORIZON


class TestConfigLoading:
    """Test configuration loading functionality"""
    
    def test_load_config_nonexistent_file(self, temp_dir):
        """Test loading config when file doesn't exist returns defaults"""
        # Temporarily override CONFIG_FILE to ensure clean test
        import constants
        import repo_config
        original_config_file_const = constants.CONFIG_FILE
        original_config_file_repo = repo_config.CONFIG_FILE
        test_config_file = os.path.join(temp_dir, "load_test_nonexistent.json")
        
        try:
            constants.CONFIG_FILE = test_config_file
            repo_config.CONFIG_FILE = test_config_file
            
            config = load_config()
            assert isinstance(config, dict)
            # Should return default config
            assert "location" in config
            assert "selected_catalogues" in config
        finally:
            constants.CONFIG_FILE = original_config_file_const
            repo_config.CONFIG_FILE = original_config_file_repo
    
    def test_load_config_returns_dict(self):
        """Test load_config always returns a dictionary"""
        config = load_config()
        assert isinstance(config, dict)
    
    def test_load_config_has_required_fields(self, temp_dir):
        """Test loaded config has required fields"""
        import constants
        import repo_config
        original_config_file_const = constants.CONFIG_FILE
        original_config_file_repo = repo_config.CONFIG_FILE
        test_config_file = os.path.join(temp_dir, "load_test_required.json")
        
        try:
            constants.CONFIG_FILE = test_config_file
            repo_config.CONFIG_FILE = test_config_file
            
            config = load_config()
            required_fields = ["location", "selected_catalogues", "features", "constraints"]
            for field in required_fields:
                assert field in config
        finally:
            constants.CONFIG_FILE = original_config_file_const
            repo_config.CONFIG_FILE = original_config_file_repo


class TestConfigSaving:
    """Test configuration saving functionality"""
    
    def test_save_config_success(self, temp_dir, sample_config):
        """Test saving configuration successfully"""
        # Temporarily override CONFIG_FILE in both constants and repo_config
        import constants
        import repo_config
        original_config_file_const = constants.CONFIG_FILE
        original_config_file_repo = repo_config.CONFIG_FILE
        test_config_file = os.path.join(temp_dir, "save_test_config.json")
        
        try:
            # Update in both modules
            constants.CONFIG_FILE = test_config_file
            repo_config.CONFIG_FILE = test_config_file
            
            result = save_config(sample_config)
            assert result is True
            assert os.path.exists(test_config_file)
            
            # Verify saved content
            with open(test_config_file, 'r') as f:
                saved_config = json.load(f)
            assert saved_config == sample_config
        finally:
            constants.CONFIG_FILE = original_config_file_const
            repo_config.CONFIG_FILE = original_config_file_repo
    
    def test_save_config_creates_parent_directory(self, temp_dir, sample_config):
        """Test that save_config creates parent directory if needed"""
        import constants
        import repo_config
        original_config_file_const = constants.CONFIG_FILE
        original_config_file_repo = repo_config.CONFIG_FILE
        test_config_file = os.path.join(temp_dir, "nested", "dir", "save_nested_config.json")
        
        try:
            constants.CONFIG_FILE = test_config_file
            repo_config.CONFIG_FILE = test_config_file
            
            result = save_config(sample_config)
            assert result is True
            assert os.path.exists(test_config_file)
        finally:
            constants.CONFIG_FILE = original_config_file_const
            repo_config.CONFIG_FILE = original_config_file_repo
    
    def test_save_and_load_roundtrip(self, temp_dir, sample_config):
        """Test saving and loading config preserves data"""
        import constants
        import repo_config
        original_config_file_const = constants.CONFIG_FILE
        original_config_file_repo = repo_config.CONFIG_FILE
        test_config_file = os.path.join(temp_dir, "roundtrip_config.json")
        
        try:
            constants.CONFIG_FILE = test_config_file
            repo_config.CONFIG_FILE = test_config_file
            
            # Save config
            save_result = save_config(sample_config)
            assert save_result is True
            
            # Load it back
            loaded_config = load_config()
            assert loaded_config == sample_config
        finally:
            constants.CONFIG_FILE = original_config_file_const
            repo_config.CONFIG_FILE = original_config_file_repo
    
    def test_save_config_with_unicode(self, temp_dir):
        """Test saving config with unicode characters"""
        import constants
        import repo_config
        original_config_file_const = constants.CONFIG_FILE
        original_config_file_repo = repo_config.CONFIG_FILE
        test_config_file = os.path.join(temp_dir, "unicode_config.json")
        
        unicode_config = {
            "location": {
                "name": "Montréal",
                "latitude": 45.5,
                "longitude": -73.5,
                "timezone": "America/Montreal"
            }
        }
        
        try:
            constants.CONFIG_FILE = test_config_file
            repo_config.CONFIG_FILE = test_config_file
            
            result = save_config(unicode_config)
            assert result is True
            
            loaded = load_config()
            assert loaded["location"]["name"] == "Montréal"
        finally:
            constants.CONFIG_FILE = original_config_file_const
            repo_config.CONFIG_FILE = original_config_file_repo


class TestConfigIntegration:
    """Integration tests for config loading and saving"""
    
    def test_modify_and_save_config(self, temp_dir):
        """Test loading, modifying, and saving config"""
        import constants
        import repo_config
        import utils
        
        original_config_file_const = constants.CONFIG_FILE
        original_config_file_repo = repo_config.CONFIG_FILE
        test_config_file = os.path.join(temp_dir, "integration_config.json")
        
        try:
            constants.CONFIG_FILE = test_config_file
            repo_config.CONFIG_FILE = test_config_file
            
            # Load default config
            config = load_config()
            
            # Modify it
            config["location"]["name"] = "Modified Location"
            config["min_altitude"] = 25
            
            # Save it
            save_config(config)
            
            # Load again and verify changes
            reloaded = load_config()
            assert reloaded["location"]["name"] == "Modified Location"
            assert reloaded["min_altitude"] == 25
        finally:
            # Restore originals
            constants.CONFIG_FILE = original_config_file_const
            repo_config.CONFIG_FILE = original_config_file_repo
            # Cleanup the test config file
            if os.path.exists(test_config_file):
                os.remove(test_config_file)
