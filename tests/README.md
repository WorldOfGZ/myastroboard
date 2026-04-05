# Tests Directory

This directory contains comprehensive unit tests for the MyAstroBoard application.

## Test Coverage

The test suite includes **317 tests** covering:

- **Astronomical Calculations** (`test_astronomical.py`): Moon and sun phase calculations, twilight times, dark sky windows
- **Astrodex** (`test_astrodex.py`, `test_astrodex_api.py`): Collection management and API endpoints
- **Authentication** (`test_auth.py`): Login, logout, password change, session handling
- **Cache Management** (`test_cache_store.py`, `test_cache_scheduler.py`): Cache data structures, TTL, and scheduler
- **Catalogue Aliases** (`test_catalogue_aliases.py`): Cross-catalogue name resolution
- **Configuration** (`test_config.py`): Configuration loading, saving, and validation
- **Constants** (`test_constants.py`): Application constants and environment variables
- **Equipment Profiles** (`test_equipment_profiles.py`): Telescope, camera, mount, filter, accessory, combination management
- **Events** (`test_new_event_services.py`): Planetary events, phenomena, solar system events
- **Horizon Graph** (`test_horizon_graph.py`): Custom horizon profile and graph data
- **i18n** (`test_i18n_utils.py`): Translation loading and key resolution
- **ISS Passes** (`test_iss_passes.py`): ISS pass prediction
- **Logging** (`test_logging_config.py`): Logger configuration
- **Moon Eclipse** (`test_moon_eclipse.py`): Lunar eclipse calculations
- **Plan My Night** (`test_plan_my_night_api.py`): Observation plan CRUD and timeline
- **SkyTonight API** (`test_skytonight_api.py`): SkyTonight HTTP endpoints
- **SkyTonight Bodies** (`test_skytonight_bodies.py`): Solar-system body target building
- **SkyTonight Catalogue Builder** (`test_skytonight_catalogue_builder.py`): Dataset assembly from PyOngc rows
- **SkyTonight Comets** (`test_skytonight_comets.py`): Comet target loading
- **SkyTonight Scheduler** (`test_skytonight_scheduler.py`): Schedule resolution and missed-run recovery
- **SkyTonight Targets** (`test_skytonight_targets.py`): Target dataset loading and storage
- **Text Configuration** (`test_txtconf_loader.py`): Catalogue and version file loading
- **Utilities** (`test_utils.py`): File operations, coordinate conversion, JSON handling
- **Version Checker** (`test_version_checker.py`): Update check logic and caching
- **Weather** (`test_weather_utils.py`): Weather API client creation

## Running Tests

### Quick Start

```bash
# Run all tests
python -m pytest tests/ -v

# Run all tests (quiet mode)
python -m pytest tests/ -q

# Run specific test file
python -m pytest tests/test_utils.py -v

# Run specific test class
python -m pytest tests/test_utils.py::TestCoordinateConversion -v

# Run specific test
python -m pytest tests/test_utils.py::TestCoordinateConversion::test_dms_to_decimal_positive -v
```

### With Coverage

```bash
# Run tests with coverage report
python -m pytest tests/ --cov=backend --cov-report=term

# Generate HTML coverage report
python -m pytest tests/ --cov=backend --cov-report=html

# View HTML report (opens in browser)
# Report is generated in htmlcov/index.html
```

### Test Options

```bash
# Run tests with detailed output
python -m pytest tests/ -v

# Run tests with short traceback
python -m pytest tests/ --tb=short

# Run tests matching a pattern
python -m pytest tests/ -k "coordinate"

# Stop at first failure
python -m pytest tests/ -x

# Show local variables in tracebacks
python -m pytest tests/ -l
```

## Test Structure

### Test Organization

Tests are organized by module:
- Each backend module has a corresponding test file (e.g., `utils.py` → `test_utils.py`)
- Tests are grouped into classes by functionality
- Each test class focuses on a specific aspect or function

### Fixtures

Common test fixtures are defined in `conftest.py`:
- `temp_dir`: Temporary directory for test files
- `temp_file`: Temporary file for testing
- `sample_config`: Sample configuration dictionary
- `sample_json_file`: Temporary JSON file with sample data
- `sample_coordinates`: Test coordinate data

### Environment Setup

Tests automatically configure environment variables to avoid permissions issues and ensure isolation:
- `DATA_DIR`, `OUTPUT_DIR`, `CONFIG_DIR`: Set to temporary directories
- `LOG_LEVEL`, `CONSOLE_LOG_LEVEL`: Set to ERROR to reduce noise

## Requirements

Test dependencies are listed in `requirements-dev.txt`:

```bash
pip install -r requirements-dev.txt
```

Main testing packages:
- `pytest>=7.4.0`: Test framework
- `pytest-cov>=4.1.0`: Coverage reporting

## CI/CD Integration

Tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Install dependencies
  run: pip install -r requirements-dev.txt

- name: Run tests
  run: python -m pytest tests/ -v --cov=backend --cov-report=xml
```

## Writing New Tests

### Test Naming Convention

- Test files: `test_<module_name>.py`
- Test classes: `Test<Functionality>`
- Test functions: `test_<what_it_tests>`

### Example Test

```python
import pytest
from module_name import function_to_test

class TestFunctionality:
    """Test specific functionality"""
    
    def test_basic_case(self):
        """Test basic usage"""
        result = function_to_test(input_data)
        assert result == expected_output
    
    def test_edge_case(self):
        """Test edge case"""
        result = function_to_test(edge_input)
        assert result is not None
    
    def test_error_handling(self):
        """Test error handling"""
        with pytest.raises(ValueError):
            function_to_test(invalid_input)
```

### Best Practices

1. **One assertion per test** (when possible)
2. **Use descriptive test names** that explain what is being tested
3. **Test both success and failure cases**
4. **Use fixtures** for common setup
5. **Keep tests independent** - no test should depend on another
6. **Mock external dependencies** (APIs, file system when needed)
7. **Test edge cases** and boundary conditions

## Troubleshooting

### Common Issues

1. **Import errors**: Ensure `PYTHONPATH` includes the backend directory
   ```bash
   PYTHONPATH=/path/to/backend python -m pytest tests/
   ```

2. **Permission errors**: Tests use temporary directories, but check environment variables
   ```bash
   DATA_DIR=/tmp/test python -m pytest tests/
   ```

3. **Slow tests**: Some astronomical calculations are computationally intensive
   - Use `-k` to run specific tests during development
   - Full suite takes ~2 minutes to run

## Contributing

When adding new backend functionality:
1. Write tests for the new code
2. Ensure all tests pass: `python -m pytest tests/`
3. Check coverage: `python -m pytest tests/ --cov=backend`
4. Aim for >80% coverage on new code
