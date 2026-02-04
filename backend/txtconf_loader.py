""" 
Uptonight Catalogue List, & Version Loader
Only loads the LIST of available catalogues, not their content
The actual target data comes from uptonight-generated JSON reports
Load versions from *txt files
"""
import os
from logging_config import get_logger

# Initialize logger for this module
logger = get_logger(__name__)


def get_available_catalogues():
    """
    Load the list of available catalogues from catalogues.conf
    This is the SINGLE source of truth for which catalogues are available.
    To add a new catalogue from uptonight, just add its name to catalogues.conf
    
    Returns:
        List[str]: List of catalogue names (e.g., ['Messier', 'Herschel400', ...])
    """
    catalogue_file = os.path.join(os.path.dirname(__file__), '..', 'catalogues.conf')
    catalogues = []
    
    try:
        if os.path.exists(catalogue_file):
            with open(catalogue_file, 'r') as f:
                for line in f:
                    line = line.strip()
                    # Skip comments and empty lines
                    if line and not line.startswith('#'):
                        catalogues.append(line)
        else:
            # Fallback to default catalogues if config file doesn't exist
            catalogues = ['GaryImm', 'Herschel400', 'LBN', 'LDN', 'Messier', 'OpenIC', 'OpenNGC']
      
        return catalogues
    except Exception as e:
        logger.error(f"Error loading catalogues list: {e}")
        # Fallback to defaults
        return ['GaryImm', 'Herschel400', 'LBN', 'LDN', 'Messier', 'OpenIC', 'OpenNGC']

def get_uptonight_version():
    """
    Load the Uptonight version from UPTONIGHT_VERSION file
    
    Returns:
        str: Uptonight version string (e.g., "v1.2.3")
    """
    version_file = os.path.join(os.path.dirname(__file__), '..', 'UPTONIGHT_VERSION')
    
    try:
        with open(version_file, 'r') as f:
            version = f.read().strip()
            return version
    except Exception as e:
        logger.error(f"Error loading Uptonight version: {e}")
        return "2.5"
    

def get_uptonight_image_name():
    """
    Load the Uptonight version from UPTONIGHT_VERSION file
    
    Returns:
        str: Uptonight image string with version (e.g., "mawinkler/uptonight:2.3")
    """
    version = get_uptonight_version()
    version = version.strip()
    return f'mawinkler/uptonight:{version}'

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