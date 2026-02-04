"""
Manage configuration loading and saving
"""
import os
import json
from constants import DATA_DIR, CONFIG_FILE
from config_defaults import DEFAULT_CONFIG
from utils import load_json_file, save_json_file


def load_config():
    """Load configuration from file"""
    return load_json_file(CONFIG_FILE, DEFAULT_CONFIG.copy())


def save_config(config):
    """Save configuration to file"""
    return save_json_file(CONFIG_FILE, config)