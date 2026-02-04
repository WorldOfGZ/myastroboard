"""
Astrodex Module - Pokédex-style collection system for astrophotography objects
Manages user collections of celestial objects they have photographed
"""
import json
import os
import uuid
from datetime import datetime
from typing import Dict, List, Optional
from logging_config import get_logger

logger = get_logger(__name__)

# Astrodex data directory
ASTRODEX_DIR = os.path.join(os.environ.get('DATA_DIR', '/app/data'), 'astrodex')
ASTRODEX_IMAGES_DIR = os.path.join(ASTRODEX_DIR, 'images')

# Default image for items without pictures
DEFAULT_IMAGE = 'default_astro_object.png'


def ensure_astrodex_directories():
    """Ensure astrodex directories exist"""
    os.makedirs(ASTRODEX_DIR, exist_ok=True)
    os.makedirs(ASTRODEX_IMAGES_DIR, exist_ok=True)


def get_user_astrodex_file(username: str) -> str:
    """Get the path to a user's astrodex data file"""
    ensure_astrodex_directories()
    return os.path.join(ASTRODEX_DIR, f'{username}_astrodex.json')


def load_user_astrodex(username: str) -> Dict:
    """Load a user's astrodex data"""
    file_path = get_user_astrodex_file(username)
    
    if not os.path.exists(file_path):
        return {
            'username': username,
            'created_at': datetime.now().isoformat(),
            'items': []
        }
    
    try:
        with open(file_path, 'r') as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        # JSON is corrupted - try to recover or reset
        logger.error(f"Error loading astrodex for {username}: {e}")
        logger.error(f"Corrupted file will be backed up and reset")
        
        # Create backup of corrupted file
        backup_path = file_path + '.corrupted.' + datetime.now().strftime('%Y%m%d_%H%M%S')
        try:
            import shutil
            shutil.copy2(file_path, backup_path)
            logger.info(f"Backed up corrupted file to {backup_path}")
        except Exception as backup_error:
            logger.error(f"Failed to backup corrupted file: {backup_error}")
        
        # Return fresh astrodex (file will be overwritten on next save)
        return {
            'username': username,
            'created_at': datetime.now().isoformat(),
            'items': []
        }
    except Exception as e:
        logger.error(f"Error loading astrodex for {username}: {e}")
        return {
            'username': username,
            'created_at': datetime.now().isoformat(),
            'items': []
        }


def validate_astrodex_json(file_path: str) -> tuple[bool, str]:
    """
    Validate that a file contains valid astrodex JSON
    
    Args:
        file_path: Path to JSON file to validate
    
    Returns:
        Tuple of (is_valid, error_message)
    """
    try:
        with open(file_path, 'r') as f:
            data = json.load(f)
        
        # Check required top-level fields
        if not isinstance(data, dict):
            return False, "JSON root is not a dictionary"
        
        if 'username' not in data:
            return False, "Missing 'username' field"
        
        if 'items' not in data or not isinstance(data['items'], list):
            return False, "Missing or invalid 'items' field"
        
        # Validate each item has required fields
        for idx, item in enumerate(data['items']):
            if 'id' not in item:
                return False, f"Item {idx} missing 'id' field"
            if 'name' not in item:
                return False, f"Item {idx} missing 'name' field"
        
        return True, ""
    
    except json.JSONDecodeError as e:
        return False, f"Invalid JSON: {e}"
    except Exception as e:
        return False, f"Validation error: {e}"


def save_user_astrodex(username: str, astrodex_data: Dict) -> bool:
    """
    Save a user's astrodex data with backup and recovery mechanism
    
    Process:
    1. Create backup of existing file (if exists)
    2. Write new data to temporary file
    3. Validate the temporary file
    4. Atomically replace original with temp file
    5. Delete backup on success, restore on failure
    
    Args:
        username: User's username
        astrodex_data: Astrodex data to save
    
    Returns:
        True on success, False on failure
    """
    file_path = get_user_astrodex_file(username)
    temp_path = file_path + '.tmp'
    backup_path = file_path + '.backup'
    
    # Track if we created a backup (for cleanup)
    backup_created = False
    
    try:
        astrodex_data['updated_at'] = datetime.now().isoformat()
        
        # Step 1: Create backup of existing file
        if os.path.exists(file_path):
            try:
                import shutil
                shutil.copy2(file_path, backup_path)
                backup_created = True
                logger.debug(f"Created backup: {backup_path}")
            except Exception as backup_error:
                logger.error(f"Failed to create backup for {username}: {backup_error}")
                # Continue anyway - atomic write still provides some safety
        
        # Step 2: Write to temporary file
        with open(temp_path, 'w') as f:
            json.dump(astrodex_data, f, indent=2)
        logger.debug(f"Wrote temporary file: {temp_path}")
        
        # Step 3: Validate the temporary file
        is_valid, error_msg = validate_astrodex_json(temp_path)
        if not is_valid:
            raise ValueError(f"JSON validation failed: {error_msg}")
        logger.debug(f"Validated temporary file successfully")
        
        # Step 4: Atomic rename (on POSIX systems, this is atomic)
        os.replace(temp_path, file_path)
        logger.info(f"Successfully saved astrodex for {username}")
        
        # Step 5: Clean up backup on success
        if backup_created and os.path.exists(backup_path):
            try:
                os.remove(backup_path)
                logger.debug(f"Removed backup: {backup_path}")
            except Exception as cleanup_error:
                logger.warning(f"Failed to remove backup: {cleanup_error}")
                # Not critical - backup will be overwritten next time
        
        return True
        
    except Exception as e:
        logger.error(f"Error saving astrodex for {username}: {e}")
        
        # Restore from backup if it exists
        if backup_created and os.path.exists(backup_path):
            try:
                import shutil
                shutil.copy2(backup_path, file_path)
                logger.info(f"Restored astrodex from backup for {username}")
            except Exception as restore_error:
                logger.error(f"Failed to restore from backup: {restore_error}")
        
        # Clean up temporary file if it exists
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception as cleanup_error:
                logger.warning(f"Failed to remove temp file: {cleanup_error}")
        
        # Clean up backup file
        if backup_created and os.path.exists(backup_path):
            try:
                os.remove(backup_path)
            except Exception as cleanup_error:
                logger.warning(f"Failed to remove backup file: {cleanup_error}")
        
        return False


def create_astrodex_item(username: str, item_data: Dict) -> Optional[Dict]:
    """
    Create a new item in user's astrodex
    
    Args:
        username: User's username
        item_data: Dictionary containing item information:
            - name: Object name (required)
            - type: Object type (galaxy, nebula, etc.)
            - catalogue: Source catalogue
            - ra: Right ascension
            - dec: Declination
            - constellation: Constellation
            - magnitude: Magnitude
            - size: Angular size
            - notes: User notes
    
    Returns:
        Created item with ID, or None on error
    """
    astrodex = load_user_astrodex(username)
    
    # Check if item already exists (by name)
    item_name = item_data.get('name', '').strip()
    if not item_name:
        logger.error("Item name is required")
        return None
    
    # Check for duplicate
    for item in astrodex['items']:
        if item['name'].lower() == item_name.lower():
            logger.warning(f"Item {item_name} already exists in astrodex")
            return None
    
    # Create new item
    new_item = {
        'id': str(uuid.uuid4()),
        'name': item_name,
        'type': item_data.get('type', 'Unknown'),
        'catalogue': item_data.get('catalogue', ''),
        'ra': item_data.get('ra', ''),
        'dec': item_data.get('dec', ''),
        'constellation': item_data.get('constellation', ''),
        'magnitude': item_data.get('magnitude', ''),
        'size': item_data.get('size', ''),
        'notes': item_data.get('notes', ''),
        'pictures': [],
        'created_at': datetime.now().isoformat(),
        'updated_at': datetime.now().isoformat()
    }
    
    astrodex['items'].append(new_item)
    
    if save_user_astrodex(username, astrodex):
        return new_item
    return None


def get_astrodex_item(username: str, item_id: str) -> Optional[Dict]:
    """Get a specific item from user's astrodex"""
    astrodex = load_user_astrodex(username)
    
    for item in astrodex['items']:
        if item['id'] == item_id:
            return item
    
    return None


def update_astrodex_item(username: str, item_id: str, updates: Dict) -> Optional[Dict]:
    """Update an existing item in user's astrodex"""
    astrodex = load_user_astrodex(username)
    
    for item in astrodex['items']:
        if item['id'] == item_id:
            # Update allowed fields
            allowed_fields = ['type', 'constellation', 'magnitude', 'size', 'notes']
            for field in allowed_fields:
                if field in updates:
                    item[field] = updates[field]
            
            item['updated_at'] = datetime.now().isoformat()
            
            if save_user_astrodex(username, astrodex):
                return item
            return None
    
    return None


def delete_astrodex_item(username: str, item_id: str) -> bool:
    """Delete an item from user's astrodex"""
    astrodex = load_user_astrodex(username)
    
    # Find the item to delete and get all picture filenames
    item_to_delete = None
    for item in astrodex['items']:
        if item['id'] == item_id:
            item_to_delete = item
            break
    
    # Delete all associated image files
    if item_to_delete and 'pictures' in item_to_delete:
        for picture in item_to_delete['pictures']:
            filename = picture.get('filename')
            if filename:
                try:
                    file_path = os.path.join(ASTRODEX_IMAGES_DIR, filename)
                    if os.path.exists(file_path):
                        os.remove(file_path)
                        logger.info(f"Deleted image file: {file_path}")
                except (OSError, IOError) as e:
                    logger.error(f"Error deleting image file {filename}: {e}")
                    # Continue anyway - the metadata will still be removed
    
    # Remove the item from the list
    original_count = len(astrodex['items'])
    astrodex['items'] = [item for item in astrodex['items'] if item['id'] != item_id]
    
    if len(astrodex['items']) < original_count:
        return save_user_astrodex(username, astrodex)
    
    return False


def add_picture_to_item(username: str, item_id: str, picture_data: Dict) -> Optional[Dict]:
    """
    Add a picture to an astrodex item
    
    Args:
        username: User's username
        item_id: Item ID
        picture_data: Dictionary containing:
            - filename: Image filename
            - date: Observation date
            - exposition_time: Exposition time
            - device: Device/telescope used
            - filters: Filters used
            - notes: Picture notes
    
    Returns:
        Created picture with ID, or None on error
    """
    astrodex = load_user_astrodex(username)
    
    for item in astrodex['items']:
        if item['id'] == item_id:
            # Create new picture entry
            new_picture = {
                'id': str(uuid.uuid4()),
                'filename': picture_data.get('filename', ''),
                'date': picture_data.get('date', ''),
                'exposition_time': picture_data.get('exposition_time', ''),
                'device': picture_data.get('device', ''),
                'filters': picture_data.get('filters', ''),
                'iso': picture_data.get('iso', ''),
                'frames': picture_data.get('frames', ''),
                'notes': picture_data.get('notes', ''),
                'is_main': False,  # New pictures are not main by default
                'created_at': datetime.now().isoformat()
            }
            
            # If this is the first picture, make it main
            if not item['pictures']:
                new_picture['is_main'] = True
            
            item['pictures'].append(new_picture)
            item['updated_at'] = datetime.now().isoformat()
            
            if save_user_astrodex(username, astrodex):
                return new_picture
            return None
    
    return None


def update_picture(username: str, item_id: str, picture_id: str, updates: Dict) -> Optional[Dict]:
    """Update a picture in an astrodex item"""
    astrodex = load_user_astrodex(username)
    
    for item in astrodex['items']:
        if item['id'] == item_id:
            for picture in item['pictures']:
                if picture['id'] == picture_id:
                    # Update allowed fields
                    allowed_fields = ['date', 'exposition_time', 'device', 'filters', 'iso', 'frames', 'notes']
                    for field in allowed_fields:
                        if field in updates:
                            picture[field] = updates[field]
                    
                    item['updated_at'] = datetime.now().isoformat()
                    
                    if save_user_astrodex(username, astrodex):
                        return picture
                    return None
    
    return None


def delete_picture(username: str, item_id: str, picture_id: str) -> bool:
    """Delete a picture from an astrodex item"""
    astrodex = load_user_astrodex(username)
    
    for item in astrodex['items']:
        if item['id'] == item_id:
            original_count = len(item['pictures'])
            was_main = False
            deleted_filename = None
            
            # Check if deleted picture was main and get filename
            for pic in item['pictures']:
                if pic['id'] == picture_id:
                    if pic.get('is_main', False):
                        was_main = True
                    deleted_filename = pic.get('filename')
                    break
            
            # Remove the picture from the list
            item['pictures'] = [pic for pic in item['pictures'] if pic['id'] != picture_id]
            
            # If we deleted the main picture and there are other pictures, make the first one main
            if was_main and item['pictures']:
                item['pictures'][0]['is_main'] = True
            
            if len(item['pictures']) < original_count:
                item['updated_at'] = datetime.now().isoformat()
                
                # Delete the physical file if it exists
                if deleted_filename:
                    try:
                        file_path = os.path.join(ASTRODEX_IMAGES_DIR, deleted_filename)
                        if os.path.exists(file_path):
                            os.remove(file_path)
                            logger.info(f"Deleted image file: {file_path}")
                    except (OSError, IOError) as e:
                        logger.error(f"Error deleting image file {deleted_filename}: {e}")
                        # Continue anyway - the metadata is still removed
                
                return save_user_astrodex(username, astrodex)
    
    return False


def set_main_picture(username: str, item_id: str, picture_id: str) -> bool:
    """Set a picture as the main picture for an item"""
    astrodex = load_user_astrodex(username)
    
    for item in astrodex['items']:
        if item['id'] == item_id:
            # First, unset all pictures as main
            for picture in item['pictures']:
                picture['is_main'] = False
            
            # Then set the specified picture as main
            for picture in item['pictures']:
                if picture['id'] == picture_id:
                    picture['is_main'] = True
                    item['updated_at'] = datetime.now().isoformat()
                    return save_user_astrodex(username, astrodex)
    
    return False


def get_main_picture(item: Dict) -> Optional[Dict]:
    """Get the main picture for an item, or None if no pictures"""
    if not item.get('pictures'):
        return None
    
    # Find main picture
    for picture in item['pictures']:
        if picture.get('is_main', False):
            return picture
    
    # If no main picture is set, return first picture
    return item['pictures'][0] if item['pictures'] else None


def is_item_in_astrodex(username: str, item_name: str) -> bool:
    """Check if an item is already in user's astrodex by name"""
    astrodex = load_user_astrodex(username)
    
    item_name_lower = item_name.lower().strip()
    for item in astrodex['items']:
        if item['name'].lower().strip() == item_name_lower:
            return True
    
    return False


def get_astrodex_stats(username: str) -> Dict:
    """Get statistics about user's astrodex"""
    astrodex = load_user_astrodex(username)
    
    total_items = len(astrodex['items'])
    items_with_pictures = sum(1 for item in astrodex['items'] if item.get('pictures'))
    total_pictures = sum(len(item.get('pictures', [])) for item in astrodex['items'])
    
    # Count by type
    types_count = {}
    for item in astrodex['items']:
        item_type = item.get('type', 'Unknown')
        types_count[item_type] = types_count.get(item_type, 0) + 1
    
    return {
        'total_items': total_items,
        'items_with_pictures': items_with_pictures,
        'items_without_pictures': total_items - items_with_pictures,
        'total_pictures': total_pictures,
        'types': types_count
    }
