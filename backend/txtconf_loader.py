""" 
Uptonight Catalogue List, & Version Loader
Only loads the LIST of available catalogues, not their content
The actual target data comes from uptonight-generated JSON reports
Load versions from *txt files
"""
import json
import os
from logging_config import get_logger

# Initialize logger for this module
logger = get_logger(__name__)


def get_available_catalogues_TODELETE():
    """
    Load the list of available catalogues from backend/catalogues.json
    This is the SINGLE source of truth for which catalogues are available.
    To add a new catalogue from uptonight, add the YAML to targets/ and
    run scripts/analyse_catalogues.py
    
    Returns:
        List[str]: List of catalogue names (e.g., ['Messier', 'Herschel400', ...])
    """
    catalogue_file = os.path.join(os.path.dirname(__file__), 'catalogues.json')
    catalogues = []
    
    try:
        if os.path.exists(catalogue_file):
            with open(catalogue_file, 'r', encoding='utf-8') as f:
                payload = json.load(f)
                catalogues = payload.get('catalogues', []) if isinstance(payload, dict) else []
        else:
            # Fallback to default catalogues if config file doesn't exist
            catalogues = ['GaryImm', 'Herschel400', 'LBN', 'LDN', 'Messier', 'OpenIC', 'OpenNGC']
      
        return catalogues
    except Exception as e:
        logger.error(f"Error loading catalogues list: {e}")
        # Fallback to defaults
        return ['GaryImm', 'Herschel400', 'LBN', 'LDN', 'Messier', 'OpenIC', 'OpenNGC']

def get_repo_version():
    """
    Load the repository version from VERSION file
    
    Returns:
        str: Repository version string (e.g., "v0.9.0")
    """
    version_file = os.path.join(os.path.dirname(__file__), '..', 'VERSION')
    
    try:
        with open(version_file, 'r') as f:
            version = f.read().strip()
            return version
    except Exception as e:
        logger.error(f"Error loading repository version: {e}")
        return "1.0.0"