"""
Unit Tests for conf text files loader
"""
import unittest
import sys
import os
from unittest.mock import patch, mock_open
from io import StringIO

# Add the parent directory to the Python path to import backend modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.txtconf_loader import get_available_catalogues, get_uptonight_version, get_repo_version


class TestCataloguesLoader(unittest.TestCase):
    """Test target catalogue loading functionality"""
    
    def test_get_available_catalogues(self):
        """Simple test: file opened, returns list, list not empty"""
        catalogues = get_available_catalogues()
        
        # 1. Verify return is a list
        self.assertIsInstance(catalogues, list)
        
        # 2. Verify list is not empty
        self.assertGreater(len(catalogues), 0)
        
        # 3. If we reach here, the file was successfully opened
        print(f"✅ File opened successfully, {len(catalogues)} catalogues found")


class TestUptonightVersionLoader(unittest.TestCase):
    """Test Uptonight version loading functionality"""
    
    def test_get_uptonight_version_file_exists(self):
        """Test if file exists and is read correctly"""
        # Capture error messages
        with patch('sys.stdout', new_callable=StringIO) as mock_stdout:
            version = get_uptonight_version()
            
            # 1. Verify return is a string
            self.assertIsInstance(version, str)
            
            # 2. Verify version is not empty
            self.assertGreater(len(version), 0)
            
            # 3. Verify there was NO error message
            output = mock_stdout.getvalue()
            self.assertNotIn("Error loading Uptonight version", output, 
                           f"Expected file to be read correctly, but got error: {output.strip()}")
            
            print(f"✅ Version read from file: {version}")
    
    def test_get_uptonight_version_file_missing(self):
        """Test when file doesn't exist - should use default value"""
        # Simulate missing file
        with patch('builtins.open', side_effect=FileNotFoundError("File not found")):
            version = get_uptonight_version()
            
            # Should still return a string (the default value)
            self.assertIsInstance(version, str)
            self.assertEqual(version, "2.5", 
                           f"Expected default value '2.5', but got '{version}'")
            
            print(f"✅ Default value used: {version}")
    
    def test_get_uptonight_version_with_specific_content(self):
        """Test with specific simulated content"""
        mock_content = "3.1.4"
        
        with patch('builtins.open', mock_open(read_data=mock_content)):
            version = get_uptonight_version()
            
            # Should return exactly the mocked file content
            self.assertEqual(version, "3.1.4", 
                           f"Expected mocked content '3.1.4', but got '{version}'")
            
            print(f"✅ Mocked version read correctly: {version}")


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


if __name__ == '__main__':
    unittest.main()