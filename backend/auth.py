"""
Authentication and User Management Module
Handles user authentication, authorization, and session management
"""
import json
import os
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
    def __init__(self, username, password_hash, role, created_at=None, last_login=None):
        self.username = username
        self.password_hash = password_hash
        self.role = role
        self.created_at = created_at or datetime.now().isoformat()
        self.last_login = last_login
        
    def to_dict(self):
        """Convert user to dictionary"""
        return {
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
        self.load_users()
        self.ensure_default_admin()
    
    def load_users(self):
        """Load users from file"""
        if os.path.exists(USERS_FILE):
            try:
                with open(USERS_FILE, 'r') as f:
                    data = json.load(f)
                    self.users = {
                        username: User.from_dict(user_data)
                        for username, user_data in data.items()
                    }
                logger.info(f"Loaded {len(self.users)} users from {USERS_FILE}")
            except Exception as e:
                logger.error(f"Error loading users: {e}")
                self.users = {}
        else:
            logger.info("No users file found, starting fresh")
            self.users = {}
    
    def save_users(self):
        """Save users to file"""
        try:
            # Ensure data directory exists
            os.makedirs(os.path.dirname(USERS_FILE), exist_ok=True)
            
            data = {
                username: user.to_dict()
                for username, user in self.users.items()
            }
            with open(USERS_FILE, 'w') as f:
                json.dump(data, f, indent=2)
            logger.info(f"Saved {len(self.users)} users to {USERS_FILE}")
        except Exception as e:
            logger.error(f"Error saving users: {e}")
            raise
    
    def ensure_default_admin(self):
        """Ensure default admin user exists"""
        if DEFAULT_ADMIN_USERNAME not in self.users:
            logger.info("Creating default admin user")
            self.create_user(
                DEFAULT_ADMIN_USERNAME,
                DEFAULT_ADMIN_PASSWORD,
                ROLE_ADMIN
            )
    
    def create_user(self, username, password, role):
        """Create a new user"""
        if username in self.users:
            raise ValueError(f"User {username} already exists")
        
        if role not in [ROLE_ADMIN, ROLE_READ_ONLY]:
            raise ValueError(f"Invalid role: {role}")
        
        user = User(
            username=username,
            password_hash=generate_password_hash(password),
            role=role
        )
        self.users[username] = user
        self.save_users()
        logger.info(f"Created user {username} with role {role}")
        return user
    
    def get_user(self, username):
        """Get user by username"""
        return self.users.get(username)
    
    def update_user(self, username, password=None, role=None):
        """Update user password and/or role"""
        user = self.users.get(username)
        if not user:
            raise ValueError(f"User {username} not found")
        
        if password:
            user.password_hash = generate_password_hash(password)
        
        if role:
            if role not in [ROLE_ADMIN, ROLE_READ_ONLY]:
                raise ValueError(f"Invalid role: {role}")
            user.role = role
        
        self.save_users()
        logger.info(f"Updated user {username}")
        return user
    
    def delete_user(self, username):
        """Delete a user"""
        if username == DEFAULT_ADMIN_USERNAME:
            raise ValueError("Cannot delete default admin user")
        
        if username not in self.users:
            raise ValueError(f"User {username} not found")
        
        del self.users[username]
        self.save_users()
        logger.info(f"Deleted user {username}")
    
    def list_users(self):
        """List all users (without password hashes)"""
        return [
            {
                'username': user.username,
                'role': user.role,
                'created_at': user.created_at,
                'last_login': user.last_login
            }
            for user in self.users.values()
        ]
    
    def authenticate(self, username, password):
        """Authenticate user"""
        user = self.users.get(username)
        if user and user.check_password(password):
            # Update last login
            user.last_login = datetime.now().isoformat()
            self.save_users()
            logger.info(f"User {username} authenticated successfully")
            return user
        logger.warning(f"Authentication failed for user {username}")
        return None


# Global user manager instance
user_manager = UserManager()


# Authentication decorators
def login_required(f):
    """Decorator to require authentication"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'username' not in session:
            logger.warning(f"Unauthorized access attempt to {request.path}")
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated_function


def admin_required(f):
    """Decorator to require admin role"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'username' not in session:
            logger.warning(f"Unauthorized access attempt to {request.path}")
            return jsonify({'error': 'Authentication required'}), 401
        
        user = user_manager.get_user(session['username'])
        if not user or not user.is_admin():
            logger.warning(f"Non-admin user {session.get('username')} tried to access {request.path}")
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
