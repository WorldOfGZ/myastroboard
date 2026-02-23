"""
Aurora Borealis Prediction System
Predicts aurora visibility based on geomagnetic activity (Kp index) and observer latitude.
Uses NOAA Space Weather Prediction Center data.
"""

import requests
import json
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List
import math
from repo_config import load_config
from constants import CACHE_TTL
from logging_config import get_logger

logger = get_logger(__name__)

# NOAA Space Weather API endpoints
NOAA_KP_API = "https://services.swpc.noaa.gov/products/noaa-estimated-planetary-kp-index-1m.json"
NOAA_3DAY_FORECAST = "https://services.swpc.noaa.gov/products/noaa-3-day-forecast.json"
NOAA_GEOMAGNETIC_ALERT = "https://services.swpc.noaa.gov/products/noaa-estimated-planetary-kp-index.json"

# Timeout for API requests
REQUEST_TIMEOUT = 10


class AuroraService:
    """Service for aurora predictions and analysis"""

    def __init__(self, latitude: float, longitude: float, timezone_str: str):
        """
        Initialize aurora service with observer location
        
        Args:
            latitude: Observer latitude (-90 to 90)
            longitude: Observer longitude (-180 to 180)
            timezone_str: IANA timezone string (e.g., 'Europe/Paris')
        """
        self.latitude = latitude
        self.longitude = longitude
        self.timezone_str = timezone_str

    def fetch_current_kp_index(self) -> Optional[float]:
        """
        Fetch current Kp index from NOAA API
        
        Returns:
            Latest Kp index value or None if fetch fails
        """
        try:
            response = requests.get(NOAA_GEOMAGNETIC_ALERT, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
            data = response.json()
            
            if isinstance(data, list) and len(data) > 1:
                # Get the most recent entry (skip header)
                latest = data[-1]
                if isinstance(latest, list) and len(latest) > 1:
                    try:
                        kp_value = float(latest[1])
                        logger.debug(f"Fetched current Kp index: {kp_value}")
                        return kp_value
                    except (ValueError, TypeError):
                        logger.warning(f"Could not parse Kp value from {latest}")
                        return None
            return None
        except requests.RequestException as e:
            logger.warning(f"Failed to fetch current Kp index from NOAA: {e}")
            return None
        except Exception as e:
            logger.error(f"Error fetching Kp index: {e}")
            return None

    def fetch_kp_forecast(self) -> Optional[List[Dict[str, Any]]]:
        """
        Fetch 3-day Kp index forecast from NOAA
        
        Returns:
            List of forecast entries with timestamp and Kp value or None if fetch fails
        """
        try:
            response = requests.get(NOAA_3DAY_FORECAST, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
            data = response.json()
            
            forecast_data = []
            
            # Find the Kp index forecast section
            if isinstance(data, dict):
                # Structure varies, look for forecast array
                for key in ['kp_forecast', 'Kp']:
                    if key in data and isinstance(data[key], list):
                        for entry in data[key]:
                            if isinstance(entry, dict) and 'Kp' in entry:
                                forecast_data.append({
                                    'timestamp': entry.get('TimeStamp', ''),
                                    'kp': float(entry.get('Kp', 0))
                                })
            
            logger.debug(f"Fetched Kp forecast: {len(forecast_data)} entries")
            return forecast_data if forecast_data else None
        except requests.RequestException as e:
            logger.warning(f"Failed to fetch Kp forecast from NOAA: {e}")
            return None
        except Exception as e:
            logger.error(f"Error fetching Kp forecast: {e}")
            return None

    def calculate_aurora_probability(self, kp_index: float) -> float:
        """
        Calculate aurora visibility probability based on Kp index and observer latitude
        
        Args:
            kp_index: Current geomagnetic Kp index (0-9)
        
        Returns:
            Aurora probability 0-100%
        """
        # Absolute latitude is used (aurora visible at both poles)
        abs_latitude = abs(self.latitude)
        
        # Base aurora oval extends from approximately 65-72 degrees magnetic latitude
        # Magnetic latitude differs from geographic, simplified here
        base_aurora_latitude = 67
        
        # Rule of thumb: Aurora oval expands equatorward when Kp is high
        # Each Kp increase lowers the aurora latitude by ~3-4 degrees
        aurora_edge_latitude = base_aurora_latitude - (kp_index * 3.5)
        
        # Probability based on proximity to aurora oval
        if abs_latitude < aurora_edge_latitude - 5:
            # Well inside aurora oval
            probability = min(100, 80 + (kp_index * 2))
        elif abs_latitude < aurora_edge_latitude:
            # At edge of aurora oval
            probability = min(100, 50 + (kp_index * 3))
        elif abs_latitude < aurora_edge_latitude + 5:
            # Just outside aurora oval
            probability = min(100, max(0, 30 + (kp_index * 2)))
        else:
            # Far from aurora oval
            probability = max(0, (kp_index - 2) * 5)
        
        return max(0, min(100, probability))

    def get_aurora_score(self, kp_index: float) -> Dict[str, Any]:
        """
        Calculate comprehensive aurora visibility score
        
        Args:
            kp_index: Current geomagnetic Kp index (0-9)
        
        Returns:
            Dictionary with aurora score and details
        """
        probability = self.calculate_aurora_probability(kp_index)
        
        # Determine visibility level
        if kp_index < 3:
            visibility = "None"
            visibility_description = "No aurora activity expected"
        elif kp_index < 4:
            visibility = "Very Low"
            visibility_description = "Aurora possible only at very high latitudes"
        elif kp_index < 5:
            visibility = "Low"
            visibility_description = "Aurora possible at high latitudes"
        elif kp_index < 6:
            visibility = "Moderate"
            visibility_description = "Aurora likely at high latitudes"
        elif kp_index < 7:
            visibility = "Good"
            visibility_description = "Aurora likely visible across northern regions"
        elif kp_index < 8:
            visibility = "Excellent"
            visibility_description = "Aurora very likely, possibly at lower latitudes"
        else:
            visibility = "Severe Storm"
            visibility_description = "Intense aurora activity, visible at lower latitudes"
        
        # Best viewing window (typically between 22:00 and 02:00 local time)
        best_window_start = 22
        best_window_end = 2
        
        return {
            "kp_index": kp_index,
            "kp_index_max": 9,
            "probability": round(probability, 1),
            "visibility_level": visibility,
            "visibility_description": visibility_description,
            "observer_latitude": self.latitude,
            "best_viewing_window": {
                "start_hour": best_window_start,
                "end_hour": best_window_end,
                "description": "22:00 - 02:00 local time (best aurora activity period)"
            },
            "color_description": self._get_aurora_color_description(kp_index),
        }

    def _get_aurora_color_description(self, kp_index: float) -> Dict[str, str]:
        """
        Describe expected aurora colors based on Kp index and altitude
        
        Args:
            kp_index: Current geomagnetic Kp index
        
        Returns:
            Dictionary with color information
        """
        colors = {}
        
        # Green aurora (oxygen, 100-300 km) - most common
        colors["green"] = "Green (most common, 100-300 km altitude)"
        
        # Red aurora (high altitude oxygen, >300 km)
        if kp_index >= 4:
            colors["red"] = "Red (high altitude, >300 km, with strong activity)"
        
        # Blue/Purple aurora (nitrogen) - rare, only during severe storms
        if kp_index >= 8:
            colors["blue_purple"] = "Blue/Purple (nitrogen, rare, during severe storms)"
        
        # Pink/Magenta (high altitude mix)
        if kp_index >= 6:
            colors["pink"] = "Pink/Magenta (high altitude, during strong activity)"
        
        return colors

    def get_detailed_report(self) -> Optional[Dict[str, Any]]:
        """
        Generate comprehensive aurora report for observer location
        
        Returns:
            Detailed aurora report with current and forecast data
        """
        try:
            # Fetch current Kp index
            current_kp = self.fetch_current_kp_index()
            if current_kp is None:
                logger.warning("Could not fetch current Kp index")
                # Use a reasonable default
                current_kp = 3.0
            
            # Calculate aurora score
            aurora_score = self.get_aurora_score(current_kp)
            
            # Build report
            report = {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "location": {
                    "latitude": self.latitude,
                    "longitude": self.longitude,
                    "timezone": self.timezone_str
                },
                "current": aurora_score,
                "forecast": [],
                "cache_ttl": CACHE_TTL
            }
            
            # Try to fetch forecast
            kp_forecast = self.fetch_kp_forecast()
            if kp_forecast:
                for forecast_entry in kp_forecast[:8]:  # Use first 8 forecast entries (3 days)
                    kp_val = forecast_entry.get('kp', 0)
                    report["forecast"].append(self.get_aurora_score(kp_val))
            
            logger.info(f"Generated aurora report for lat={self.latitude}, lon={self.longitude}")
            return report
            
        except Exception as e:
            logger.error(f"Error generating aurora report: {e}")
            return None


def get_aurora_report(latitude: float, longitude: float, timezone_str: str) -> Optional[Dict[str, Any]]:
    """
    Convenience function to get aurora report for a location
    
    Args:
        latitude: Observer latitude
        longitude: Observer longitude
        timezone_str: IANA timezone string
    
    Returns:
        Aurora report or None if failed
    """
    service = AuroraService(latitude, longitude, timezone_str)
    return service.get_detailed_report()
