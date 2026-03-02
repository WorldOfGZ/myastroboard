"""
Version update checker with caching to avoid GitHub API rate limiting.
Checks for new releases on GitHub and caches results.
"""
import time
import requests
from logging_config import get_logger
import cache_store
from constants import VERSION_UPDATE_CACHE_TTL
from txtconf_loader import get_repo_version

logger = get_logger(__name__)

GITHUB_API_RELEASES_URL = "https://api.github.com/repos/WorldOfGZ/myastroboard/releases/latest"
REQUEST_TIMEOUT = 10  # seconds


def is_newer_version(current_version, latest_version):
    """
    Compare two semantic version strings.
    Returns True if latest_version is newer than current_version.
    """
    try:
        # Remove 'v' prefix if present
        current = current_version.replace('v', '').strip()
        latest = latest_version.replace('v', '').strip()
        
        # Split by '.' and convert to integers
        current_parts = [int(x) for x in current.split('.')]
        latest_parts = [int(x) for x in latest.split('.')]
        
        # Compare each part
        for i in range(max(len(current_parts), len(latest_parts))):
            current_num = current_parts[i] if i < len(current_parts) else 0
            latest_num = latest_parts[i] if i < len(latest_parts) else 0
            
            if latest_num > current_num:
                return True
            elif latest_num < current_num:
                return False
        
        return False  # Versions are equal
    except Exception as e:
        logger.error(f"Error comparing versions: {e}")
        return False


def check_for_updates():
    """
    Check for available updates from GitHub.
    Uses cache to avoid excessive API calls (respects rate limits).
    Returns dict with update information or None if check failed.
    """
    # Sync from shared cache first (for multi-worker support)
    cache_store.sync_cache_from_shared("version_update", cache_store._version_update_cache)
    
    # Check cache first
    if cache_store.is_cache_valid(cache_store._version_update_cache, VERSION_UPDATE_CACHE_TTL):
        logger.debug("Returning cached version update information")
        return cache_store._version_update_cache["data"]
    
    # Cache expired or empty, fetch from GitHub
    try:
        logger.info("Checking for updates from GitHub...")
        
        # Get current version
        current_version = get_repo_version().strip()
        
        # Fetch latest release from GitHub
        response = requests.get(
            GITHUB_API_RELEASES_URL,
            timeout=REQUEST_TIMEOUT,
            headers={'Accept': 'application/vnd.github.v3+json'}
        )
        
        if response.status_code == 404:
            logger.warning("GitHub API returned 404 - repository or releases not found")
            result = {
                "current_version": current_version,
                "update_available": False,
                "error": "Repository not found"
            }
            # Update both local and shared cache
            cache_store._version_update_cache["data"] = result
            cache_store._version_update_cache["timestamp"] = time.time()
            cache_store.update_shared_cache_entry(
                "version_update",
                cache_store._version_update_cache["data"],
                cache_store._version_update_cache["timestamp"]
            )
            return result
        
        if response.status_code == 403:
            logger.warning("GitHub API rate limit exceeded")
            result = {
                "current_version": current_version,
                "update_available": False,
                "error": "Rate limit exceeded"
            }
            # Still cache the error to avoid hammering GitHub
            cache_store._version_update_cache["data"] = result
            cache_store._version_update_cache["timestamp"] = time.time()
            cache_store.update_shared_cache_entry(
                "version_update",
                cache_store._version_update_cache["data"],
                cache_store._version_update_cache["timestamp"]
            )
            return result
        
        response.raise_for_status()
        release_data = response.json()
        
        # Extract version information
        latest_version = release_data.get('tag_name', '').replace('v', '').strip()
        release_url = release_data.get('html_url', '')
        release_name = release_data.get('name', '')
        published_at = release_data.get('published_at', '')
        
        # Compare versions
        update_available = is_newer_version(current_version, latest_version)
        
        result = {
            "current_version": current_version,
            "latest_version": latest_version,
            "update_available": update_available,
            "release_url": release_url,
            "release_name": release_name,
            "published_at": published_at
        }
        
        # Update both local and shared cache
        cache_store._version_update_cache["data"] = result
        cache_store._version_update_cache["timestamp"] = time.time()
        cache_store.update_shared_cache_entry(
            "version_update",
            cache_store._version_update_cache["data"],
            cache_store._version_update_cache["timestamp"]
        )
        
        if update_available:
            logger.info(f"Update available: v{current_version} -> v{latest_version}")
        else:
            logger.info(f"No update available (current: v{current_version}, latest: v{latest_version})")
        
        return result
        
    except requests.Timeout:
        logger.warning("GitHub API request timed out")
        result = {
            "current_version": get_repo_version().strip(),
            "update_available": False,
            "error": "Request timed out"
        }
        # Cache timeout error to avoid repeated attempts
        cache_store._version_update_cache["data"] = result
        cache_store._version_update_cache["timestamp"] = time.time()
        cache_store.update_shared_cache_entry(
            "version_update",
            cache_store._version_update_cache["data"],
            cache_store._version_update_cache["timestamp"]
        )
        return result
    except requests.RequestException as e:
        logger.error(f"Error checking for updates from GitHub: {e}")
        result = {
            "current_version": get_repo_version().strip(),
            "update_available": False,
            "error": str(e)
        }
        # Cache error to avoid repeated attempts
        cache_store._version_update_cache["data"] = result
        cache_store._version_update_cache["timestamp"] = time.time()
        cache_store.update_shared_cache_entry(
            "version_update",
            cache_store._version_update_cache["data"],
            cache_store._version_update_cache["timestamp"]
        )
        return result
    except Exception as e:
        logger.error(f"Unexpected error checking for updates: {e}", exc_info=True)
        result = {
            "current_version": get_repo_version().strip(),
            "update_available": False,
            "error": "Internal error"
        }
        # Cache error to avoid repeated attempts
        cache_store._version_update_cache["data"] = result
        cache_store._version_update_cache["timestamp"] = time.time()
        cache_store.update_shared_cache_entry(
            "version_update",
            cache_store._version_update_cache["data"],
            cache_store._version_update_cache["timestamp"]
        )
        return result
