"""
Shared pytest fixtures and configuration for all tests
"""
import os
import tempfile

# Set up environment variables BEFORE any imports from backend
# This prevents permission errors when modules try to create directories
if 'DATA_DIR' not in os.environ:
    os.environ['DATA_DIR'] = tempfile.gettempdir()
if 'OUTPUT_DIR' not in os.environ:
    os.environ['OUTPUT_DIR'] = tempfile.gettempdir()
if 'CONFIG_DIR' not in os.environ:
    os.environ['CONFIG_DIR'] = tempfile.gettempdir()
if 'LOG_LEVEL' not in os.environ:
    os.environ['LOG_LEVEL'] = 'ERROR'
if 'CONSOLE_LOG_LEVEL' not in os.environ:
    os.environ['CONSOLE_LOG_LEVEL'] = 'ERROR'

import pytest
import sys
import shutil
import json
from pathlib import Path

# Add backend to Python path
backend_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'backend')
sys.path.insert(0, backend_path)


@pytest.fixture(scope="session", autouse=True)
def setup_test_environment():
    """Set up test environment variables before any tests run"""
    # Create temporary directories for testing
    test_data_dir = tempfile.mkdtemp(prefix="test_data_")
    test_output_dir = tempfile.mkdtemp(prefix="test_output_")
    test_config_dir = tempfile.mkdtemp(prefix="test_config_")
    
    # Set environment variables
    os.environ['DATA_DIR'] = test_data_dir
    os.environ['OUTPUT_DIR'] = test_output_dir
    os.environ['CONFIG_DIR'] = test_config_dir
    os.environ['LOG_LEVEL'] = 'ERROR'
    os.environ['CONSOLE_LOG_LEVEL'] = 'ERROR'
    
    yield {
        'data_dir': test_data_dir,
        'output_dir': test_output_dir,
        'config_dir': test_config_dir
    }
    
    # Cleanup temporary directories
    shutil.rmtree(test_data_dir, ignore_errors=True)
    shutil.rmtree(test_output_dir, ignore_errors=True)
    shutil.rmtree(test_config_dir, ignore_errors=True)


@pytest.fixture
def temp_dir():
    """Create a temporary directory for a test"""
    tmp = tempfile.mkdtemp()
    yield tmp
    shutil.rmtree(tmp, ignore_errors=True)


@pytest.fixture
def temp_file():
    """Create a temporary file for a test"""
    fd, path = tempfile.mkstemp()
    os.close(fd)
    yield path
    try:
        os.remove(path)
    except FileNotFoundError:
        pass


@pytest.fixture
def sample_config():
    """Return a sample configuration dictionary"""
    return {
        "location": {
            "name": "Test Location",
            "latitude": 45.5,
            "longitude": -73.5,
            "elevation": 50,
            "timezone": "America/Montreal"
        },
        "selected_catalogues": ["Messier", "Herschel400"],
        "min_altitude": 30,
        "use_constraints": True,
        "features": {
            "horizon": False,
            "objects": True,
            "bodies": True,
            "comets": True,
            "alttime": True
        },
        "constraints": {
            "altitude_constraint_min": 30,
            "altitude_constraint_max": 80,
            "airmass_constraint": 2,
            "size_constraint_min": 10,
            "size_constraint_max": 300,
            "moon_separation_min": 45
        }
    }


@pytest.fixture
def sample_json_file(temp_file, sample_config):
    """Create a temporary JSON file with sample config"""
    with open(temp_file, 'w') as f:
        json.dump(sample_config, f)
    return temp_file


@pytest.fixture
def mock_catalogues_file(temp_dir):
    """Create a mock catalogues.conf file"""
    catalogues_path = os.path.join(temp_dir, 'catalogues.conf')
    with open(catalogues_path, 'w') as f:
        f.write("# Test catalogues\n")
        f.write("Messier\n")
        f.write("Herschel400\n")
        f.write("OpenNGC\n")
    return catalogues_path


@pytest.fixture
def sample_coordinates():
    """Return sample coordinate data for testing"""
    return [
        {"dms": "48d38m36.16s", "decimal": 48.64337777777778},
        {"dms": "2d20m14.025s", "decimal": 2.337229166666667},
        {"dms": "-45d30m0s", "decimal": -45.5},
        {"dms": "0d0m0s", "decimal": 0.0},
    ]
