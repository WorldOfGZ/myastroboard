"""
Tests for Astrodex module
"""
import pytest
import os
import json
import tempfile
import sys

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import astrodex
import catalogue_aliases


@pytest.fixture
def temp_data_dir(monkeypatch):
    """Create a temporary directory for astrodex data"""
    with tempfile.TemporaryDirectory() as tmpdir:
        monkeypatch.setenv('DATA_DIR', tmpdir)
        # Reset module-level variables
        astrodex.ASTRODEX_DIR = os.path.join(tmpdir, 'astrodex')
        astrodex.ASTRODEX_IMAGES_DIR = os.path.join(astrodex.ASTRODEX_DIR, 'images')
        yield tmpdir


class TestAstrodexDataModel:
    """Test Astrodex data model and storage"""
    
    def test_ensure_directories(self, temp_data_dir):
        """Test directory creation"""
        astrodex.ensure_astrodex_directories()
        assert os.path.exists(astrodex.ASTRODEX_DIR)
        assert os.path.exists(astrodex.ASTRODEX_IMAGES_DIR)
    
    def test_load_empty_astrodex(self, temp_data_dir):
        """Test loading empty astrodex"""
        data = astrodex.load_user_astrodex('testuser', username='testuser')
        assert data['username'] == 'testuser'
        assert data['items'] == []
        assert 'created_at' in data
    
    def test_create_item(self, temp_data_dir):
        """Test creating an astrodex item"""
        item_data = {
            'name': 'M31',
            'type': 'Galaxy',
            'constellation': 'Andromeda',
            'magnitude': '3.44',
            'notes': 'Andromeda Galaxy'
        }
        
        item = astrodex.create_astrodex_item('testuser', item_data)
        
        assert item is not None
        assert item['name'] == 'M31'
        assert item['type'] == 'Galaxy'
        assert item['constellation'] == 'Andromeda'
        assert 'id' in item
        assert item['pictures'] == []
    
    def test_duplicate_item(self, temp_data_dir):
        """Test that duplicate items are rejected"""
        item_data = {
            'name': 'M31',
            'type': 'Galaxy'
        }
        
        # Create first item
        item1 = astrodex.create_astrodex_item('testuser', item_data)
        assert item1 is not None
        
        # Try to create duplicate
        item2 = astrodex.create_astrodex_item('testuser', item_data)
        assert item2 is None
    
    def test_get_item(self, temp_data_dir):
        """Test retrieving an item"""
        item_data = {'name': 'M42', 'type': 'Nebula'}
        created_item = astrodex.create_astrodex_item('testuser', item_data)
        
        retrieved_item = astrodex.get_astrodex_item('testuser', created_item['id'])
        
        assert retrieved_item is not None
        assert retrieved_item['id'] == created_item['id']
        assert retrieved_item['name'] == 'M42'
    
    def test_update_item(self, temp_data_dir):
        """Test updating an item"""
        item_data = {'name': 'M42', 'type': 'Nebula'}
        created_item = astrodex.create_astrodex_item('testuser', item_data)
        
        updates = {
            'notes': 'Great Orion Nebula',
            'constellation': 'Orion'
        }
        
        updated_item = astrodex.update_astrodex_item('testuser', created_item['id'], updates)
        
        assert updated_item is not None
        assert updated_item['notes'] == 'Great Orion Nebula'
        assert updated_item['constellation'] == 'Orion'
    
    def test_delete_item(self, temp_data_dir):
        """Test deleting an item"""
        item_data = {'name': 'M45', 'type': 'Star Cluster'}
        created_item = astrodex.create_astrodex_item('testuser', item_data)
        
        # Delete the item
        result = astrodex.delete_astrodex_item('testuser', created_item['id'])
        assert result is True
        
        # Verify it's gone
        retrieved_item = astrodex.get_astrodex_item('testuser', created_item['id'])
        assert retrieved_item is None
    
    def test_is_item_in_astrodex(self, temp_data_dir):
        """Test checking if item is in astrodex"""
        item_data = {'name': 'NGC 2244', 'type': 'Star Cluster'}
        astrodex.create_astrodex_item('testuser', item_data)
        
        assert astrodex.is_item_in_astrodex('testuser', 'NGC 2244') is True
        assert astrodex.is_item_in_astrodex('testuser', 'M31') is False
    
    def test_user_isolation(self, temp_data_dir):
        """Test that users have separate astrodex collections"""
        item_data = {'name': 'M31', 'type': 'Galaxy'}
        
        # Create item for user1
        astrodex.create_astrodex_item('user1', item_data)
        
        # Check user2 doesn't have it
        assert astrodex.is_item_in_astrodex('user2', 'M31') is False


class TestAstrodexPictures:
    """Test picture management"""
    
    def test_add_picture(self, temp_data_dir):
        """Test adding a picture to an item"""
        item_data = {'name': 'M31', 'type': 'Galaxy'}
        item = astrodex.create_astrodex_item('testuser', item_data)
        
        picture_data = {
            'filename': 'test_image.jpg',
            'date': '2024-01-15',
            'exposition_time': '120x30s',
            'device': 'Canon EOS',
            'filters': 'LRGB'
        }
        
        picture = astrodex.add_picture_to_item('testuser', item['id'], picture_data)
        
        assert picture is not None
        assert picture['filename'] == 'test_image.jpg'
        assert picture['date'] == '2024-01-15'
        assert picture['is_main'] is True  # First picture is main
    
    def test_add_multiple_pictures(self, temp_data_dir):
        """Test adding multiple pictures"""
        item_data = {'name': 'M42', 'type': 'Nebula'}
        item = astrodex.create_astrodex_item('testuser', item_data)
        
        # Add first picture
        pic1_data = {'filename': 'pic1.jpg', 'date': '2024-01-15'}
        pic1 = astrodex.add_picture_to_item('testuser', item['id'], pic1_data)
        
        # Add second picture
        pic2_data = {'filename': 'pic2.jpg', 'date': '2024-01-16'}
        pic2 = astrodex.add_picture_to_item('testuser', item['id'], pic2_data)
        
        assert pic1['is_main'] is True
        assert pic2['is_main'] is False
        
        # Verify item has both pictures
        updated_item = astrodex.get_astrodex_item('testuser', item['id'])
        assert len(updated_item['pictures']) == 2
    
    def test_set_main_picture(self, temp_data_dir):
        """Test setting a different picture as main"""
        item_data = {'name': 'M31', 'type': 'Galaxy'}
        item = astrodex.create_astrodex_item('testuser', item_data)
        
        # Add two pictures
        pic1 = astrodex.add_picture_to_item('testuser', item['id'], {'filename': 'pic1.jpg'})
        pic2 = astrodex.add_picture_to_item('testuser', item['id'], {'filename': 'pic2.jpg'})
        
        # Set second picture as main
        result = astrodex.set_main_picture('testuser', item['id'], pic2['id'])
        assert result is True
        
        # Verify
        updated_item = astrodex.get_astrodex_item('testuser', item['id'])
        assert updated_item['pictures'][0]['is_main'] is False
        assert updated_item['pictures'][1]['is_main'] is True
    
    def test_delete_picture(self, temp_data_dir):
        """Test deleting a picture"""
        item_data = {'name': 'M42', 'type': 'Nebula'}
        item = astrodex.create_astrodex_item('testuser', item_data)
        
        # Add pictures
        pic1 = astrodex.add_picture_to_item('testuser', item['id'], {'filename': 'pic1.jpg'})
        pic2 = astrodex.add_picture_to_item('testuser', item['id'], {'filename': 'pic2.jpg'})
        
        # Delete first picture (which is main)
        result = astrodex.delete_picture('testuser', item['id'], pic1['id'])
        assert result is True
        
        # Verify second picture became main
        updated_item = astrodex.get_astrodex_item('testuser', item['id'])
        assert len(updated_item['pictures']) == 1
        assert updated_item['pictures'][0]['is_main'] is True
    
    def test_get_main_picture(self, temp_data_dir):
        """Test getting main picture"""
        item_data = {'name': 'M31', 'type': 'Galaxy'}
        item = astrodex.create_astrodex_item('testuser', item_data)
        
        # No pictures
        main_pic = astrodex.get_main_picture(item)
        assert main_pic is None
        
        # Add pictures
        pic1 = astrodex.add_picture_to_item('testuser', item['id'], {'filename': 'pic1.jpg'})
        pic2 = astrodex.add_picture_to_item('testuser', item['id'], {'filename': 'pic2.jpg'})
        
        updated_item = astrodex.get_astrodex_item('testuser', item['id'])
        main_pic = astrodex.get_main_picture(updated_item)
        
        assert main_pic is not None
        assert main_pic['filename'] == 'pic1.jpg'


class TestAstrodexStats:
    """Test statistics generation"""
    
    def test_stats_empty(self, temp_data_dir):
        """Test stats for empty astrodex"""
        stats = astrodex.get_astrodex_stats('testuser')
        
        assert stats['total_items'] == 0
        assert stats['items_with_pictures'] == 0
        assert stats['items_without_pictures'] == 0
        assert stats['total_pictures'] == 0
        assert stats['types'] == {}
    
    def test_stats_with_items(self, temp_data_dir):
        """Test stats with items"""
        # Create items
        astrodex.create_astrodex_item('testuser', {'name': 'M31', 'type': 'Galaxy'})
        astrodex.create_astrodex_item('testuser', {'name': 'M42', 'type': 'Nebula'})
        astrodex.create_astrodex_item('testuser', {'name': 'M45', 'type': 'Star Cluster'})
        
        # Add picture to one item
        item = astrodex.get_astrodex_item('testuser', 
                                          astrodex.load_user_astrodex('testuser')['items'][0]['id'])
        astrodex.add_picture_to_item('testuser', item['id'], {'filename': 'test.jpg'})
        
        stats = astrodex.get_astrodex_stats('testuser')
        
        assert stats['total_items'] == 3
        assert stats['items_with_pictures'] == 1
        assert stats['items_without_pictures'] == 2
        assert stats['total_pictures'] == 1
        assert stats['types']['Galaxy'] == 1
        assert stats['types']['Nebula'] == 1
        assert stats['types']['Star Cluster'] == 1


class TestAstrodexBackupMechanism:
    """Test backup and recovery mechanism for data safety"""
    
    def test_validate_astrodex_json_valid(self, temp_data_dir):
        """Test validation of valid astrodex JSON"""
        # Create a valid astrodex file
        item_data = {'name': 'M31', 'type': 'Galaxy'}
        item = astrodex.create_astrodex_item('testuser', item_data)
        
        file_path = astrodex.get_user_astrodex_file('testuser')
        is_valid, error_msg = astrodex.validate_astrodex_json(file_path)
        
        assert is_valid is True
        assert error_msg == ""
    
    def test_validate_astrodex_json_invalid(self, temp_data_dir):
        """Test validation of invalid JSON"""
        file_path = astrodex.get_user_astrodex_file('testuser')
        
        # Write invalid JSON
        with open(file_path, 'w') as f:
            f.write("{ invalid json }")
        
        is_valid, error_msg = astrodex.validate_astrodex_json(file_path)
        
        assert is_valid is False
        assert "Invalid JSON" in error_msg
    
    def test_validate_astrodex_json_missing_fields(self, temp_data_dir):
        """Test validation of JSON with missing required fields"""
        file_path = astrodex.get_user_astrodex_file('testuser')
        
        # Write JSON without required fields
        with open(file_path, 'w') as f:
            json.dump({'invalid': 'data'}, f)
        
        is_valid, error_msg = astrodex.validate_astrodex_json(file_path)
        
        assert is_valid is False
        assert "username" in error_msg or "items" in error_msg
    
    def test_backup_created_during_save(self, temp_data_dir):
        """Test that backup is created during save operation"""
        # Create initial item
        item_data = {'name': 'M31', 'type': 'Galaxy'}
        item = astrodex.create_astrodex_item('testuser', item_data)
        
        file_path = astrodex.get_user_astrodex_file('testuser')
        backup_path = file_path + '.backup'
        
        # Backup should not exist after successful save
        assert not os.path.exists(backup_path)
        
        # Update item (triggers save)
        astrodex.update_astrodex_item('testuser', item['id'], {'notes': 'Test update'})
        
        # Backup should still not exist (cleaned up after success)
        assert not os.path.exists(backup_path)
    
    def test_save_recovery_from_corruption(self, temp_data_dir, monkeypatch):
        """Test that backup is restored if write fails"""
        # Create initial valid item
        item_data = {'name': 'M31', 'type': 'Galaxy'}
        item = astrodex.create_astrodex_item('testuser', item_data)
        
        file_path = astrodex.get_user_astrodex_file('testuser')
        
        # Read original content
        with open(file_path, 'r') as f:
            original_content = f.read()
        
        # Monkey patch json.dump to fail
        original_dump = json.dump
        def failing_dump(*args, **kwargs):
            raise ValueError("Simulated write failure")
        
        monkeypatch.setattr(json, 'dump', failing_dump)
        
        # Try to update - should fail but restore backup
        result = astrodex.update_astrodex_item('testuser', item['id'], {'notes': 'Should fail'})
        
        # Restore original json.dump
        monkeypatch.setattr(json, 'dump', original_dump)
        
        assert result is None  # Update failed
        
        # Original file should still be intact (restored from backup)
        with open(file_path, 'r') as f:
            current_content = f.read()
        
        assert current_content == original_content
    
    def test_validation_prevents_corrupt_save(self, temp_data_dir, monkeypatch):
        """Test that validation prevents saving corrupt data"""
        # Create initial item
        item_data = {'name': 'M31', 'type': 'Galaxy'}
        item = astrodex.create_astrodex_item('testuser', item_data)
        
        file_path = astrodex.get_user_astrodex_file('testuser')
        
        # Read original content
        with open(file_path, 'r') as f:
            original_data = json.load(f)
        
        # Monkey patch validation to fail
        def failing_validation(*args, **kwargs):
            return False, "Simulated validation failure"
        
        monkeypatch.setattr(astrodex, 'validate_astrodex_json', failing_validation)
        
        # Try to update - should fail validation
        result = astrodex.update_astrodex_item('testuser', item['id'], {'notes': 'Should fail validation'})
        
        assert result is None  # Update failed
        
        # Original file should still be intact
        with open(file_path, 'r') as f:
            current_data = json.load(f)
        
        assert current_data == original_data
    
    def test_temp_file_cleanup_on_error(self, temp_data_dir, monkeypatch):
        """Test that temporary files are cleaned up on error"""
        # Create initial item
        item_data = {'name': 'M31', 'type': 'Galaxy'}
        item = astrodex.create_astrodex_item('testuser', item_data)
        
        file_path = astrodex.get_user_astrodex_file('testuser')
        temp_path = file_path + '.tmp'
        backup_path = file_path + '.backup'
        
        # Monkey patch validation to fail
        def failing_validation(*args, **kwargs):
            return False, "Simulated validation failure"
        
        monkeypatch.setattr(astrodex, 'validate_astrodex_json', failing_validation)
        
        # Try to update - should fail
        result = astrodex.update_astrodex_item('testuser', item['id'], {'notes': 'Should fail'})
        
        assert result is None
        
        # Temporary and backup files should be cleaned up
        assert not os.path.exists(temp_path)
        assert not os.path.exists(backup_path)
    
    def test_save_works_for_new_user(self, temp_data_dir):
        """Test that save works correctly for new user with no existing file"""
        item_data = {'name': 'M31', 'type': 'Galaxy'}
        item = astrodex.create_astrodex_item('newuser', item_data)


class TestAstrodexAliases:
    """Test aliases table integration in Astrodex"""

    @staticmethod
    def _fake_alias_entry(catalogue: str, object_name: str) -> dict:
        entry = {
            'group_id': 'OBJ000001',
            'aliases': {
                'GaryImm': 'M81',
                'Messier': 'M 81',
                'OpenNGC': 'NGC 3031'
            }
        }

        if catalogue == 'GaryImm' and object_name == 'M81':
            return entry
        if catalogue == 'Messier' and object_name == 'M 81':
            return entry
        if catalogue == 'OpenNGC' and object_name == 'NGC 3031':
            return entry
        return {}

    def test_alias_deduplication_across_catalogues(self, temp_data_dir, monkeypatch):
        """Test duplicate detection using catalogue aliases"""
        monkeypatch.setattr(catalogue_aliases, 'get_alias_entry', self._fake_alias_entry)

        item_data = {
            'name': 'M81',
            'type': 'Galaxy',
            'catalogue': 'GaryImm'
        }
        item = astrodex.create_astrodex_item('testuser', item_data)
        assert item is not None

        assert astrodex.is_item_in_astrodex('testuser', 'NGC 3031', 'OpenNGC') is True

    def test_alias_matching_with_decorated_target_name(self, temp_data_dir, monkeypatch):
        """Test matching still works when target labels contain extra description text."""
        monkeypatch.setattr(catalogue_aliases, 'get_alias_entry', self._fake_alias_entry)

        item = astrodex.create_astrodex_item(
            'testuser',
            {'name': 'M81', 'type': 'Galaxy', 'catalogue': 'GaryImm'}
        )
        assert item is not None

        label = 'Bode\'s Galaxy (M 81, size: 27\', foto: 0.65, mag: 6.9)'
        assert astrodex.is_item_in_astrodex('testuser', label, 'Messier') is True

    def test_alias_matching_catalogue_key_case_insensitive(self, temp_data_dir, monkeypatch):
        """Test matching with different catalogue key casing."""
        monkeypatch.setattr(catalogue_aliases, 'get_alias_entry', self._fake_alias_entry)

        item = astrodex.create_astrodex_item(
            'testuser',
            {'name': 'M81', 'type': 'Galaxy', 'catalogue': 'GaryImm'}
        )
        assert item is not None

        assert astrodex.is_item_in_astrodex('testuser', 'NGC 3031', 'openngc') is True

    def test_alias_metadata_enrichment(self, temp_data_dir, monkeypatch):
        """Test alias metadata is attached to items when available"""
        monkeypatch.setattr(catalogue_aliases, 'get_alias_entry', self._fake_alias_entry)

        item_data = {
            'name': 'M81',
            'type': 'Galaxy',
            'catalogue': 'GaryImm'
        }
        item = astrodex.create_astrodex_item('testuser', item_data)
        assert item is not None

        enriched = astrodex.enrich_item_with_catalogue_aliases(item)
        assert enriched.get('catalogue_group_id') == 'OBJ000001'
        assert enriched.get('catalogue_aliases', {}).get('OpenNGC') == 'NGC 3031'

    def test_switch_item_catalogue_name(self, temp_data_dir, monkeypatch):
        """Test switching displayed name to another catalogue alias"""
        monkeypatch.setattr(catalogue_aliases, 'get_alias_entry', self._fake_alias_entry)

        item_data = {
            'name': 'M81',
            'type': 'Galaxy',
            'catalogue': 'GaryImm'
        }
        item = astrodex.create_astrodex_item('testuser', item_data)
        assert item is not None

        updated = astrodex.switch_item_catalogue_name('testuser', item['id'], 'OpenNGC')
        assert updated is not None
        assert updated['name'] == 'NGC 3031'
        assert updated['catalogue'] == 'OpenNGC'

    def test_switch_item_catalogue_name_duplicate(self, temp_data_dir, monkeypatch):
        """Test switching fails when an equivalent object already exists"""
        monkeypatch.setattr(catalogue_aliases, 'get_alias_entry', self._fake_alias_entry)

        first_item = astrodex.create_astrodex_item(
            'testuser',
            {'name': 'M81', 'type': 'Galaxy', 'catalogue': 'GaryImm'}
        )
        assert first_item is not None

        astrodex_data = astrodex.load_user_astrodex('testuser')
        astrodex_data['items'].append({
            'id': 'manual-duplicate',
            'name': 'NGC 3031',
            'type': 'Galaxy',
            'catalogue': 'OpenNGC',
            'catalogue_aliases': {
                'GaryImm': 'M81',
                'OpenNGC': 'NGC 3031'
            },
            'catalogue_group_id': 'OBJ000001',
            'pictures': [],
            'created_at': first_item['created_at'],
            'updated_at': first_item['updated_at']
        })
        assert astrodex.save_user_astrodex('testuser', astrodex_data)

        with pytest.raises(ValueError):
            astrodex.switch_item_catalogue_name('testuser', first_item['id'], 'OpenNGC')
