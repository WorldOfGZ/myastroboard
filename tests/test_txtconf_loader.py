"""
Unit Tests for conf text files loader
"""
import unittest
import sys
import os
from unittest.mock import patch, mock_open
from io import StringIO

# Add backend directory to the Python path to import backend modules
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend'))

from txtconf_loader import get_repo_version, get_available_catalogues_TODELETE


DEFAULT_CATALOGUES = ['GaryImm', 'Herschel400', 'LBN', 'LDN', 'Messier', 'OpenIC', 'OpenNGC']


class TestRepoVersionLoader(unittest.TestCase):
    """Test repository version loading functionality"""
    
    def test_get_repo_version_file_exists(self):
        """Test if file exists and is read correctly"""
        # Capture error messages
        with patch('sys.stdout', new_callable=StringIO) as mock_stdout:
            version = get_repo_version()
            
            # 1. Verify return is a string
            self.assertIsInstance(version, str)
            
            # 2. Verify version is not empty
            self.assertGreater(len(version), 0)
            
            # 3. Verify there was NO error message
            output = mock_stdout.getvalue()
            self.assertNotIn("Error loading repository version", output, 
                           f"Expected file to be read correctly, but got error: {output.strip()}")
            
            print(f"✅ Version read from file: {version}")
    
    def test_get_repo_version_file_missing(self):
        """Test when file doesn't exist - should use default value"""
        # Simulate missing file
        with patch('builtins.open', side_effect=FileNotFoundError("File not found")):
            version = get_repo_version()
            
            # Should still return a string (the default value)
            self.assertIsInstance(version, str)
            self.assertEqual(version, "1.0.0", 
                           f"Expected default value '1.0.0', but got '{version}'")
            
            print(f"✅ Default value used: {version}")
    
    def test_get_repo_version_with_specific_content(self):
        """Test with specific simulated content"""
        mock_content = "4.2.0"
        
        with patch('builtins.open', mock_open(read_data=mock_content)):
            version = get_repo_version()
            
            # Should return exactly the mocked file content
            self.assertEqual(version, "4.2.0", 
                           f"Expected mocked content '4.2.0', but got '{version}'")
            
            print(f"✅ Mocked version read correctly: {version}")


class TestCatalogueListLoader(unittest.TestCase):
    """Test catalogue list loading functionality"""

    def test_get_available_catalogues_file_exists(self):
        """Should load catalogues from JSON payload when file exists"""
        payload = '{"catalogues": ["Messier", "OpenNGC"]}'

        with patch('txtconf_loader.os.path.exists', return_value=True), \
             patch('builtins.open', mock_open(read_data=payload)):
            catalogues = get_available_catalogues_TODELETE()

        self.assertEqual(catalogues, ["Messier", "OpenNGC"])

    def test_get_available_catalogues_file_missing_uses_defaults(self):
        """Should use default catalogue list when config file is absent"""
        with patch('txtconf_loader.os.path.exists', return_value=False):
            catalogues = get_available_catalogues_TODELETE()

        self.assertEqual(catalogues, DEFAULT_CATALOGUES)

    def test_get_available_catalogues_non_dict_payload_returns_empty(self):
        """Should return empty list when payload is not a dictionary"""
        with patch('txtconf_loader.os.path.exists', return_value=True), \
             patch('builtins.open', mock_open(read_data='["Messier"]')):
            catalogues = get_available_catalogues_TODELETE()

        self.assertEqual(catalogues, [])

    def test_get_available_catalogues_exception_uses_defaults(self):
        """Should fall back to defaults when JSON loading fails"""
        with patch('txtconf_loader.os.path.exists', return_value=True), \
             patch('builtins.open', side_effect=OSError("boom")):
            catalogues = get_available_catalogues_TODELETE()

        self.assertEqual(catalogues, DEFAULT_CATALOGUES)


if __name__ == '__main__':
    unittest.main()
