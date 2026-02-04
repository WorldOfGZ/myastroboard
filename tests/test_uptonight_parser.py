"""
Unit tests for UpTonight parser (uptonight_parser.py)
"""
import pytest
import os
import json
import tempfile


# Import functions to test
from uptonight_parser import (
    parse_uptonight_report,
    parse_objects_report,
    parse_comets_report,
    parse_bodies_report,
    get_catalogue_reports,
    format_value,
    sanitize_alttime_target_name,
    get_alttime_file_name
)


class TestParseObjects:
    """Test parsing of objects (targets) reports"""
    
    @pytest.fixture
    def sample_objects_data(self):
        """Sample objects report data"""
        return {
            "id": {"0": "M31", "1": "M42"},
            "name": {"0": "Andromeda Galaxy", "1": "Orion Nebula"},
            "foto": {"0": 0.85, "1": 0.92},
            "mag": {"0": 3.4, "1": 4.0}
        }
    
    def test_parse_objects_report_valid_data(self, sample_objects_data, temp_dir):
        """Test parsing valid objects report"""
        result = parse_objects_report(sample_objects_data, temp_dir)
        
        assert result['type'] == 'objects'
        assert result['count'] == 2
        assert len(result['objects']) == 2
        
        # Check first object
        obj1 = result['objects'][0]
        assert obj1['id'] == 'M31'
        assert obj1['name'] == 'Andromeda Galaxy'
        assert obj1['foto'] == 0.85
    
    def test_parse_objects_report_empty_data(self, temp_dir):
        """Test parsing empty objects report"""
        empty_data = {}
        result = parse_objects_report(empty_data, temp_dir)
        
        assert result['type'] == 'objects'
        assert result['objects'] == []
    
    def test_parse_objects_report_adds_alttime_file(self, sample_objects_data, temp_dir):
        """Test that alttime_file field is added"""
        result = parse_objects_report(sample_objects_data, temp_dir)
        
        for obj in result['objects']:
            assert 'alttime_file' in obj


class TestParseComets:
    """Test parsing of comets reports"""
    
    @pytest.fixture
    def sample_comets_data(self):
        """Sample comets report data"""
        return {
            "target name": {"0": "Halley", "1": "Hale-Bopp"},
            "visual magnitude": {"0": 8.5, "1": 6.2},
            "altitude": {"0": 45.3, "1": 60.1}
        }
    
    def test_parse_comets_report_valid_data(self, sample_comets_data, temp_dir):
        """Test parsing valid comets report"""
        result = parse_comets_report(sample_comets_data, temp_dir)
        
        assert result['type'] == 'comets'
        assert result['count'] == 2
        assert len(result['comets']) == 2
        
        # Check first comet
        comet1 = result['comets'][0]
        assert comet1['target name'] == 'Halley'
        assert comet1['visual magnitude'] == 8.5
    
    def test_parse_comets_report_empty_data(self, temp_dir):
        """Test parsing empty comets report"""
        empty_data = {}
        result = parse_comets_report(empty_data, temp_dir)
        
        assert result['type'] == 'comets'
        assert result['comets'] == []


class TestParseBodies:
    """Test parsing of bodies (planets) reports"""
    
    @pytest.fixture
    def sample_bodies_data(self):
        """Sample bodies report data"""
        return {
            "target name": {"0": "Jupiter", "1": "Saturn"},
            "visual magnitude": {"0": -2.5, "1": 0.7},
            "altitude": {"0": 55.3, "1": 42.1}
        }
    
    def test_parse_bodies_report_valid_data(self, sample_bodies_data, temp_dir):
        """Test parsing valid bodies report"""
        result = parse_bodies_report(sample_bodies_data, temp_dir)
        
        assert result['type'] == 'bodies'
        assert result['count'] == 2
        assert len(result['bodies']) == 2
        
        # Check first body
        body1 = result['bodies'][0]
        assert body1['target name'] == 'Jupiter'
        assert body1['visual magnitude'] == -2.5


class TestParseUptonightReport:
    """Test main parsing function"""
    
    def test_parse_uptonight_report_nonexistent_file(self, temp_dir):
        """Test parsing non-existent file returns None"""
        result = parse_uptonight_report('/tmp/nonexistent.json', 'objects', temp_dir)
        assert result is None
    
    def test_parse_uptonight_report_objects(self, temp_dir):
        """Test parsing objects report file"""
        data = {
            "id": {"0": "M31"},
            "name": {"0": "Andromeda Galaxy"}
        }
        
        # Create temporary JSON file
        file_path = os.path.join(temp_dir, "test-report.json")
        with open(file_path, 'w') as f:
            json.dump(data, f)
        
        result = parse_uptonight_report(file_path, 'objects', temp_dir)
        assert result is not None
        assert result['type'] == 'objects'
    
    def test_parse_uptonight_report_invalid_json(self, temp_dir):
        """Test parsing invalid JSON returns None"""
        file_path = os.path.join(temp_dir, "invalid.json")
        with open(file_path, 'w') as f:
            f.write("not valid json {")
        
        result = parse_uptonight_report(file_path, 'objects', temp_dir)
        assert result is None
    
    def test_parse_uptonight_report_unknown_type(self, temp_dir):
        """Test parsing with unknown report type"""
        data = {"test": "data"}
        file_path = os.path.join(temp_dir, "test.json")
        with open(file_path, 'w') as f:
            json.dump(data, f)
        
        result = parse_uptonight_report(file_path, 'unknown_type', temp_dir)
        assert result is not None
        assert result['type'] == 'unknown'


class TestGetCatalogueReports:
    """Test getting all reports for a catalogue"""
    
    def test_get_catalogue_reports_nonexistent_dir(self):
        """Test with non-existent directory"""
        result = get_catalogue_reports('/tmp/nonexistent_catalogue_dir')
        assert result == {}
    
    def test_get_catalogue_reports_with_files(self, temp_dir):
        """Test getting reports when files exist"""
        # Create sample JSON reports
        objects_data = {"id": {"0": "M31"}}
        objects_path = os.path.join(temp_dir, "uptonight-report.json")
        with open(objects_path, 'w') as f:
            json.dump(objects_data, f)
        
        # Create a plot file
        plot_path = os.path.join(temp_dir, "uptonight-plot.png")
        open(plot_path, 'w').close()
        
        result = get_catalogue_reports(temp_dir)
        
        assert 'objects' in result
        assert result['objects']['type'] == 'objects'
        assert 'plot' in result
        assert result['plot']['available'] is True


class TestFormatValue:
    """Test value formatting for display"""
    
    def test_format_value_none(self):
        """Test formatting None returns N/A"""
        assert format_value('any_key', None) == 'N/A'
        assert format_value('any_key', '') == 'N/A'
    
    def test_format_value_foto(self):
        """Test formatting foto (percentage)"""
        assert format_value('foto', 0.85) == '85.0%'
        assert format_value('foto', 1.0) == '100.0%'
        assert format_value('foto', 0.0) == '0.0%'
    
    def test_format_value_magnitude(self):
        """Test formatting magnitude"""
        assert format_value('mag', 3.456) == '3.46'
        assert format_value('visual magnitude', -2.5) == '-2.50'
        assert format_value('absolute magnitude', 10.123) == '10.12'
    
    def test_format_value_coordinates(self):
        """Test formatting coordinates"""
        assert format_value('right ascension', 45.678) == '45.68°'
        assert format_value('declination', -30.123) == '-30.12°'
        assert format_value('altitude', 60.5) == '60.50°'
        assert format_value('azimuth', 180.0) == '180.00°'
    
    def test_format_value_distance(self):
        """Test formatting distances"""
        assert format_value('distance', 1.234) == '1.234 AU'
        assert format_value('earth distance', 2.567) == '2.567 AU'
    
    def test_format_value_size(self):
        """Test formatting size"""
        assert format_value('size', 123.456) == '123.5\''
    
    def test_format_value_string(self):
        """Test formatting string values"""
        assert format_value('name', 'M31') == 'M31'
        assert format_value('type', 'Galaxy') == 'Galaxy'
    
    def test_format_value_generic_number(self):
        """Test formatting generic numbers"""
        assert format_value('count', 42) == '42'
        assert format_value('index', 5) == '5'


class TestSanitizeAlttime:
    """Test sanitizing target names for Alttime"""
    
    def test_sanitize_alttime_target_name_lowercase(self):
        """Test name is converted to lowercase"""
        assert sanitize_alttime_target_name('M31') == 'm31'
        assert sanitize_alttime_target_name('NGC7000') == 'ngc7000'
    
    def test_sanitize_alttime_target_name_spaces(self):
        """Test spaces are replaced with dashes"""
        assert sanitize_alttime_target_name('Orion Nebula') == 'orion-nebula'
        assert sanitize_alttime_target_name('North America Nebula') == 'north-america-nebula'
    
    def test_sanitize_alttime_target_name_slashes(self):
        """Test slashes are replaced with dashes"""
        assert sanitize_alttime_target_name('M31/Andromeda') == 'm31-andromeda'
        assert sanitize_alttime_target_name('NGC7000\\NA') == 'ngc7000-na'
    
    def test_sanitize_alttime_target_name_complex(self):
        """Test complex names"""
        assert sanitize_alttime_target_name('M42 / Orion Nebula') == 'm42---orion-nebula'


class TestGetAlttimeFileName:
    """Test getting Alttime file name"""
    
    def test_get_alttime_file_name_exists(self, temp_dir):
        """Test when alttime file exists"""
        # Create a mock alttime file
        target_name = "M31"
        sanitized = sanitize_alttime_target_name(target_name)
        file_path = os.path.join(temp_dir, f"uptonight-alttime-{sanitized}.png")
        open(file_path, 'w').close()
        
        result = get_alttime_file_name(target_name, temp_dir)
        assert result == f"uptonight-alttime-{sanitized}.png"
    
    def test_get_alttime_file_name_not_exists(self, temp_dir):
        """Test when alttime file doesn't exist"""
        result = get_alttime_file_name("NonexistentTarget", temp_dir)
        assert result == ""
    
    def test_get_alttime_file_name_sanitization(self, temp_dir):
        """Test that target name is properly sanitized"""
        target_name = "Orion Nebula"
        sanitized = sanitize_alttime_target_name(target_name)
        file_path = os.path.join(temp_dir, f"uptonight-alttime-{sanitized}.png")
        open(file_path, 'w').close()
        
        result = get_alttime_file_name(target_name, temp_dir)
        assert "orion-nebula" in result
