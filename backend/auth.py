"""
Authentication and User Management Module
Handles user authentication, authorization, and session management
"""
import json
import os
import uuid
from datetime import datetime
from functools import wraps
from flask import session, jsonify, request
from werkzeug.security import generate_password_hash, check_password_hash
from logging_config import get_logger

logger = get_logger(__name__)

# User roles
ROLE_ADMIN = 'admin'
ROLE_READ_ONLY = 'read-only'

# Default admin credentials
DEFAULT_ADMIN_USERNAME = 'admin'
DEFAULT_ADMIN_PASSWORD = 'admin'

# Users storage file
USERS_FILE = os.path.join(os.environ.get('DATA_DIR', '/app/data'), 'users.json')


class User:
    """User model"""
    def __init__(self, username, password_hash, role, user_id=None, created_at=None, last_login=None):
        self.user_id = user_id or str(uuid.uuid4())
        self.username = username
        self.password_hash = password_hash
        self.role = role
        self.created_at = created_at or datetime.now().isoformat()
        self.last_login = last_login
        
    def to_dict(self):
        """Convert user to dictionary"""
        return {
            'user_id': self.user_id,
            'username': self.username,
            'password_hash': self.password_hash,
            'role': self.role,
            'created_at': self.created_at,
            'last_login': self.last_login
        }
    
    @staticmethod
    def from_dict(data):
        """Create user from dictionary"""
        return User(
            user_id=data.get('user_id'),
            username=data['username'],
            password_hash=data['password_hash'],
            role=data['role'],
            created_at=data.get('created_at'),
            last_login=data.get('last_login')
        )
    
    def check_password(self, password):
        """Check if password matches"""
        return check_password_hash(self.password_hash, password)
    
    def is_admin(self):
        """Check if user is admin"""
        return self.role == ROLE_ADMIN
    
    def is_using_default_password(self):
        """Check if user is still using default password"""
        if self.username == DEFAULT_ADMIN_USERNAME:
            return check_password_hash(self.password_hash, DEFAULT_ADMIN_PASSWORD)
        return False


class UserManager:
    """Manages user storage and operations"""
    
    def __init__(self):
        self.users = {}
        self._users_mtime = None
        self.load_users()
        self.ensure_default_admin()
    
    def load_users(self):
        """Load users from file"""
        if os.path.exists(USERS_FILE):
            try:
                with open(USERS_FILE, 'r') as f:
                    data = json.load(f)
                    self.users = {
                        key: User.from_dict(user_data)
                        for key, user_data in data.items()
                    }
                self._users_mtime = os.path.getmtime(USERS_FILE)
                logger.debug(f"Loaded {len(self.users)} users from {USERS_FILE}")
            except Exception as e:
                logger.error(f"Error loading users: {e}")
                self.users = {}
                self._users_mtime = None
        else:
            logger.info("No users file found, starting fresh")
            self.users = {}
            self._users_mtime = None

    def _reload_users_if_changed(self):
        """Reload users from disk when file changed (multi-worker sync)."""
        try:
            if not os.path.exists(USERS_FILE):
                if self.users:
                    self.users = {}
                self._users_mtime = None
                return

            current_mtime = os.path.getmtime(USERS_FILE)
            if self._users_mtime is None or current_mtime != self._users_mtime:
                self.load_users()
        except Exception as e:
            logger.warning(f"Failed to check users file freshness: {e}")
    
    def save_users(self):
        """Save users to file"""
        try:
            # Ensure data directory exists
            os.makedirs(os.path.dirname(USERS_FILE), exist_ok=True)
            
            data = {
                user_id: user.to_dict()
                for user_id, user in self.users.items()
            }
            with open(USERS_FILE, 'w') as f:
                json.dump(data, f, indent=2)
            self._users_mtime = os.path.getmtime(USERS_FILE)
            logger.debug(f"Saved {len(self.users)} users to {USERS_FILE}")
        except Exception as e:
            logger.error(f"Error saving users: {e}")
            raise
    
    def ensure_default_admin(self):
        """Ensure default admin user exists"""
        # Check by username, not by key
        if not self.get_user_by_username(DEFAULT_ADMIN_USERNAME):
            logger.info("Creating default admin user")
            self.create_user(
                DEFAULT_ADMIN_USERNAME,
                DEFAULT_ADMIN_PASSWORD,
                ROLE_ADMIN
            )
    
    def create_user(self, username, password, role):
        """Create a new user"""
        self._reload_users_if_changed()

        if self.get_user_by_username(username):
            raise ValueError(f"User {username} already exists")
        
        if role not in [ROLE_ADMIN, ROLE_READ_ONLY]:
            raise ValueError(f"Invalid role: {role}")
        
        user = User(
            username=username,
            password_hash=generate_password_hash(password),
            role=role
        )
        self.users[user.user_id] = user
        self.save_users()
        logger.info(f"Created user {username} (ID: {user.user_id}) with role {role}")
        return user
    
    def get_user_by_username(self, username):
        """Get user by username"""
        self._reload_users_if_changed()
        for user in self.users.values():
            if user.username == username:
                return user
        return None
    
    def get_user_by_id(self, user_id):
        """Get user by UUID"""
        self._reload_users_if_changed()
        return self.users.get(user_id)
    
    def get_user(self, username):
        """Get user by username (for backwards compatibility)"""
        return self.get_user_by_username(username)
    
    def update_user(self, user_id, username=None, password=None, role=None):
        """Update user username, password and/or role"""
        self._reload_users_if_changed()
        user = self.get_user_by_id(user_id)
        if not user:
            raise ValueError(f"User with ID {user_id} not found")
        
        # If changing username, check for conflicts
        if username and username != user.username:
            existing_user = self.get_user_by_username(username)
            if existing_user and existing_user.user_id != user_id:
                raise ValueError(f"Username {username} already taken")
            logger.info(f"Changing username from {user.username} to {username}")
            user.username = username
        
        if password:
            user.password_hash = generate_password_hash(password)
        
        if role:
            if role not in [ROLE_ADMIN, ROLE_READ_ONLY]:
                raise ValueError(f"Invalid role: {role}")
            user.role = role
        
        self.save_users()
        logger.info(f"Updated user {user.username} (ID: {user_id})")
        return user
    
    def delete_user(self, user_id, current_user_id=None):
        """Delete a user"""
        self._reload_users_if_changed()
        user = self.get_user_by_id(user_id)
        if not user:
            raise ValueError(f"User with ID {user_id} not found")
        
        # Prevent deleting your own account
        if current_user_id and user_id == current_user_id:
            raise ValueError("Cannot delete your own account")
        
        username = user.username
        del self.users[user_id]
        self.save_users()
        logger.info(f"Deleted user {username} (ID: {user_id})")
        
        # Also delete user's astrodex file and images
        try:
            from astrodex import ASTRODEX_DIR, ASTRODEX_IMAGES_DIR
            astrodex_file = os.path.join(ASTRODEX_DIR, f'{user_id}_astrodex.json')
            image_filenames = set()

            if os.path.exists(astrodex_file):
                try:
                    with open(astrodex_file, 'r') as f:
                        astrodex_data = json.load(f)
                    for item in astrodex_data.get('items', []):
                        for picture in item.get('pictures', []):
                            filename = picture.get('filename')
                            if filename:
                                image_filenames.add(filename)
                except Exception as read_error:
                    logger.warning(f"Failed to read astrodex file for cleanup: {read_error}")

            # Delete images referenced by the astrodex file
            for filename in image_filenames:
                file_path = os.path.join(ASTRODEX_IMAGES_DIR, filename)
                if os.path.exists(file_path):
                    try:
                        os.remove(file_path)
                    except Exception as remove_error:
                        logger.warning(f"Failed to delete astrodex image {filename}: {remove_error}")

            # Delete any remaining images that match the user_id prefix
            if os.path.exists(ASTRODEX_IMAGES_DIR):
                for filename in os.listdir(ASTRODEX_IMAGES_DIR):
                    if filename.startswith(f"{user_id}_"):
                        file_path = os.path.join(ASTRODEX_IMAGES_DIR, filename)
                        try:
                            os.remove(file_path)
                        except Exception as remove_error:
                            logger.warning(f"Failed to delete astrodex image {filename}: {remove_error}")

            if os.path.exists(astrodex_file):
                os.remove(astrodex_file)
                logger.info(f"Deleted astrodex file for {username}")
        except Exception as e:
            logger.warning(f"Failed to delete astrodex file: {e}")
    
    def list_users(self):
        """List all users (without password hashes)"""
        self._reload_users_if_changed()
        return [
            {
                'user_id': user.user_id,
                'username': user.username,
                'role': user.role,
                'created_at': user.created_at,
                'last_login': user.last_login
            }
            for user in self.users.values()
        ]
    
    def authenticate(self, username, password):
        """Authenticate user"""
        self._reload_users_if_changed()
        user = self.get_user_by_username(username)
        if user and user.check_password(password):
            # Update last login
            user.last_login = datetime.now().isoformat()
            self.save_users()
            logger.info(f"Successful authentication for user {username}")
            return user
        # Log failure without revealing if username exists
        logger.warning(f"Failed authentication attempt for username: {username}")
        return None


# Global user manager instance
user_manager = UserManager()


# Authentication decorators
def login_required(f):
    """Decorator to require authentication"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'username' not in session:
            # Log failed authentication attempt via cookie
            client_ip = request.remote_addr
            logger.warning(f"Unauthorized access attempt to {request.path} from {client_ip} (no valid session cookie)")
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated_function


def admin_required(f):
    """Decorator to require admin role"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'username' not in session:
            client_ip = request.remote_addr
            logger.warning(f"Unauthorized access attempt to {request.path} from {client_ip} (no valid session cookie)")
            return jsonify({'error': 'Authentication required'}), 401
        
        user = user_manager.get_user(session['username'])
        if not user or not user.is_admin():
            client_ip = request.remote_addr
            logger.warning(f"Non-admin user {session.get('username')} from {client_ip} attempted to access {request.path}")
            return jsonify({'error': 'Admin access required'}), 403
        
        return f(*args, **kwargs)
    return decorated_function


def get_current_user():
    """Get current logged-in user"""
    if 'username' in session:
        return user_manager.get_user(session['username'])
    return None


def is_user_admin():
    """Check if current user is admin"""
    user = get_current_user()
    return user and user.is_admin()
