"""
Advanced Weather Metrics for Astrophotography
Provides specialized weather analysis for astronomical observation and imaging

Features:
- Cloud altitude layer discrimination (high/mid/low)
- Seeing forecast (Pickering scale 1-10)
- Transparency forecast (magnitude limit prediction)
- Jet stream impact on seeing
- Dew point and humidity alerts
- Wind speed impact on tracking
"""
import json
import os
import numpy as np
import pandas as pd
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta

from repo_config import load_config
from constants import URL_OPENMETEO, DATA_DIR, WIND_TRACKING_THRESHOLD
from logging_config import get_logger
from weather_utils import create_weather_client

# Create logger with centralized configuration
logger = get_logger(__name__)

# Astrophotography-specific constants
PICKERING_SCALE_MAX = 10
MAGNITUDE_LIMIT_ZENITH_MIN = 4.0  # Urban limit
MAGNITUDE_LIMIT_ZENITH_MAX = 8.0  # Perfect dark sky
DEW_POINT_WARNING_THRESHOLD = 2.0  # °C difference from ambient
JET_STREAM_ALTITUDE = 9000  # meters (typical jet stream altitude)

class AstroWeatherAnalyzer:
    """Advanced weather analysis for astrophotography"""
    
    def __init__(self):
        self.config = load_config()
        self.location = self.config.get("location", {})
        
    def fetch_extended_weather_data(self, forecast_hours: int = 24) -> Optional[Dict]:
        """
        Fetch extended weather data with additional atmospheric variables
        for astrophotography analysis
        """
        try:
            client = create_weather_client()
            
            # Extended hourly variables for astrophotography
            hourly_vars = [
                # Basic weather
                "temperature_2m", "relative_humidity_2m", "dew_point_2m",
                "wind_speed_10m", "wind_direction_10m", "wind_speed_80m", "wind_speed_120m",
                "surface_pressure", "visibility",
                
                # Cloud layers
                "cloud_cover", "cloud_cover_low", "cloud_cover_mid", "cloud_cover_high",
                
                # Atmospheric stability
                "lifted_index", "convective_inhibition",
                
                # Precipitation
                "precipitation", "precipitation_probability",
                
                # Solar/UV
                "is_day", "uv_index",
                
                # Additional atmospheric data
                "geopotential_height_500hPa", "geopotential_height_850hPa",
                "temperature_500hPa", "temperature_850hPa",
                "wind_speed_500hPa", "wind_direction_500hPa"
            ]
            
            params = {
                "latitude": self.location.get("latitude"),
                "longitude": self.location.get("longitude"),
                "timezone": self.location.get("timezone", "UTC"),
                "hourly": hourly_vars,
                "forecast_hours": forecast_hours
            }
            
            response = client.weather_api(URL_OPENMETEO, params=params)[0]
            return self._parse_extended_data(response, hourly_vars)
            
        except Exception as e:
            logger.exception("Failed to fetch extended weather data")
            return None
    
    def _parse_extended_data(self, response, hourly_vars: List[str]) -> Dict:
        """Parse the extended weather response into organized data structure"""
        hourly = response.Hourly()
        
        # Create time series
        dates = pd.date_range(
            start=pd.to_datetime(hourly.Time(), unit="s", utc=True),
            periods=len(hourly.Variables(0).ValuesAsNumpy()),
            freq=pd.Timedelta(seconds=hourly.Interval())
        )
        
        # Parse timezone
        timezone_str = response.Timezone()
        if isinstance(timezone_str, bytes):
            timezone_str = timezone_str.decode("utf-8")
        
        # Build data dictionary
        data = {"datetime": dates.tz_convert(timezone_str)}
        for i, var_name in enumerate(hourly_vars):
            data[var_name] = hourly.Variables(i).ValuesAsNumpy()
        
        df = pd.DataFrame(data)
        
        return {
            "location": {
                "name": self.location.get("name", "Unknown"),
                "latitude": response.Latitude(),
                "longitude": response.Longitude(),
                "elevation": response.Elevation(),
                "timezone": timezone_str
            },
            "data": df
        }
    
    def analyze_cloud_layers(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Analyze cloud altitude layers for astrophotography impact
        
        Returns:
        - cloud_discrimination: Quality score based on cloud layer analysis
        - high_cloud_impact: Impact of high clouds on imaging
        - mid_cloud_impact: Impact of mid clouds on imaging  
        - low_cloud_impact: Impact of low clouds on imaging
        """
        result = df.copy()
        
        # Cloud layer analysis
        high_clouds = result["cloud_cover_high"]
        mid_clouds = result["cloud_cover_mid"] 
        low_clouds = result["cloud_cover_low"]
        
        # Cloud discrimination score (0-100%)
        # High clouds have least impact, low clouds have most impact
        cloud_discrimination = (
            (100 - high_clouds) * 0.3 +  # High clouds less problematic
            (100 - mid_clouds) * 0.4 +   # Mid clouds moderate impact
            (100 - low_clouds) * 0.6     # Low clouds worst for astronomy
        ).clip(0, 100)
        
        # Individual cloud layer impacts
        high_cloud_impact = self._calculate_cloud_impact(high_clouds, "high")
        mid_cloud_impact = self._calculate_cloud_impact(mid_clouds, "mid")
        low_cloud_impact = self._calculate_cloud_impact(low_clouds, "low")
        
        result["cloud_discrimination"] = cloud_discrimination.round(1)
        result["high_cloud_impact"] = high_cloud_impact
        result["mid_cloud_impact"] = mid_cloud_impact
        result["low_cloud_impact"] = low_cloud_impact
        
        return result
    
    def _calculate_cloud_impact(self, cloud_cover: pd.Series, layer_type: str) -> pd.Series:
        """Calculate specific impact of cloud layer on astrophotography"""
        impact_factors = {
            "high": 0.3,    # High clouds - cirrus, less impact
            "mid": 0.6,     # Mid clouds - altostratus, moderate impact  
            "low": 1.0      # Low clouds - cumulus/stratus, major impact
        }
        
        factor = impact_factors.get(layer_type, 1.0)
        
        # Convert cloud cover percentage to impact score
        impact = (cloud_cover * factor).clip(0, 100)
        
        return impact.round(1)
    
    def calculate_seeing_forecast(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Calculate seeing forecast using Pickering scale (1-10)
        Based on wind speed, atmospheric stability, and jet stream effects
        """
        result = df.copy()
        
        # Wind factor (surface and upper level)
        surface_wind = result["wind_speed_10m"]
        upper_wind_80m = result.get("wind_speed_80m", surface_wind * 1.2)
        upper_wind_120m = result.get("wind_speed_120m", surface_wind * 1.4)
        
        # Wind seeing impact (lower is better for seeing)
        wind_seeing_score = self._wind_to_seeing_score(surface_wind, upper_wind_80m)
        
        # Atmospheric stability from lifted index
        stability_score = self._stability_to_seeing_score(result["lifted_index"])
        
        # Jet stream impact
        jet_stream_score = self._jet_stream_impact(
            result.get("wind_speed_500hPa", surface_wind * 2),
            result.get("temperature_500hPa", result["temperature_2m"] - 30)
        )
        
        # Combined seeing score (Pickering scale 1-10)
        seeing_pickering = (
            wind_seeing_score * 0.4 +
            stability_score * 0.3 +
            jet_stream_score * 0.3
        ).clip(1, 10)
        
        result["seeing_pickering"] = seeing_pickering.round(1)
        result["wind_seeing_component"] = wind_seeing_score.round(1)
        result["stability_seeing_component"] = stability_score.round(1)
        result["jetstream_seeing_component"] = jet_stream_score.round(1)
        
        return result
    
    def _wind_to_seeing_score(self, surface_wind: pd.Series, upper_wind: pd.Series) -> pd.Series:
        """Convert wind speeds to seeing score component"""
        # Average wind effect
        avg_wind = (surface_wind + upper_wind) / 2
        
        # Convert to Pickering scale component (1-10, higher = better seeing)
        # Calm conditions (0-5 km/h) = excellent seeing (8-10)
        # Light winds (5-15 km/h) = good seeing (6-8)
        # Moderate winds (15-25 km/h) = fair seeing (4-6)
        # Strong winds (25+ km/h) = poor seeing (1-4)
        
        seeing_score = np.where(
            avg_wind <= 5, 9,
            np.where(avg_wind <= 15, 7,
                np.where(avg_wind <= 25, 5,
                    np.where(avg_wind <= 35, 3, 1)
                )
            )
        )
        
        return pd.Series(seeing_score, index=surface_wind.index)
    
    def _stability_to_seeing_score(self, lifted_index: pd.Series) -> pd.Series:
        """Convert atmospheric stability (lifted index) to seeing score"""
        # Lifted Index interpretation:
        # > 2: Very stable (excellent seeing)
        # 0 to 2: Stable (good seeing)
        # -2 to 0: Slightly unstable (fair seeing)  
        # < -2: Unstable (poor seeing)
        
        seeing_score = np.where(
            lifted_index > 2, 9,
            np.where(lifted_index > 0, 7,
                np.where(lifted_index > -2, 5,
                    np.where(lifted_index > -4, 3, 1)
                )
            )
        )
        
        return pd.Series(seeing_score, index=lifted_index.index)
    
    def _jet_stream_impact(self, wind_500hpa: pd.Series, temp_500hpa: pd.Series) -> pd.Series:
        """Calculate jet stream impact on seeing conditions"""
        # Strong jet stream winds indicate turbulence
        # Temperature gradient also affects stability
        
        # Jet stream strength indicator
        jet_strength = wind_500hpa
        
        # Convert to seeing impact (1-10 scale)
        seeing_score = np.where(
            jet_strength <= 30, 9,  # Weak jet stream = good seeing
            np.where(jet_strength <= 50, 7,  # Moderate jet stream
                np.where(jet_strength <= 80, 5,  # Strong jet stream
                    np.where(jet_strength <= 100, 3, 1)  # Very strong jet stream
                )
            )
        )
        
        return pd.Series(seeing_score, index=wind_500hpa.index)
    
    def calculate_transparency_forecast(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Calculate transparency forecast with magnitude limit prediction
        Based on humidity, visibility, aerosols, and atmospheric conditions
        """
        result = df.copy()
        
        # Base factors for transparency
        humidity = result["relative_humidity_2m"]
        visibility_m = result["visibility"]
        
        # Humidity impact on transparency
        humidity_factor = self._humidity_to_transparency(humidity)
        
        # Visibility impact
        visibility_factor = self._visibility_to_transparency(visibility_m)
        
        # Atmospheric clarity (inverse of cloud cover)
        cloud_total = (
            result["cloud_cover_high"] * 0.3 +
            result["cloud_cover_mid"] * 0.6 +
            result["cloud_cover_low"] * 1.0
        ) / 1.9  # Normalize
        
        clarity_factor = (100 - cloud_total) / 100
        
        # Combined transparency score (0-100%)
        transparency_score = (
            humidity_factor * 0.4 +
            visibility_factor * 0.4 +
            clarity_factor * 0.2
        ).clip(0, 100)
        
        # Convert to limiting magnitude
        magnitude_limit = self._transparency_to_magnitude_limit(transparency_score)
        
        result["transparency_score"] = transparency_score.round(1)
        result["limiting_magnitude"] = magnitude_limit.round(2)
        result["humidity_transparency"] = (humidity_factor * 100).round(1)
        result["visibility_transparency"] = (visibility_factor * 100).round(1)
        
        return result
    
    def _humidity_to_transparency(self, humidity: pd.Series) -> pd.Series:
        """Convert humidity percentage to transparency factor (0-1)"""
        # Lower humidity = better transparency
        # 30% humidity = excellent (1.0)
        # 50% humidity = good (0.8)
        # 70% humidity = fair (0.6)  
        # 90% humidity = poor (0.2)
        
        transparency = np.where(
            humidity <= 30, 1.0,
            np.where(humidity <= 50, 0.8,
                np.where(humidity <= 70, 0.6,
                    np.where(humidity <= 85, 0.4, 0.2)
                )
            )
        )
        
        return pd.Series(transparency, index=humidity.index)
    
    def _visibility_to_transparency(self, visibility_m: pd.Series) -> pd.Series:
        """Convert visibility distance to transparency factor (0-1)"""
        # Convert meters to km
        visibility_km = visibility_m / 1000
        
        # Visibility impact on transparency
        # 50+ km = excellent (1.0)
        # 30+ km = good (0.8)
        # 20+ km = fair (0.6)
        # 10+ km = poor (0.4)
        # <10 km = very poor (0.2)
        
        transparency = np.where(
            visibility_km >= 50, 1.0,
            np.where(visibility_km >= 30, 0.8,
                np.where(visibility_km >= 20, 0.6,
                    np.where(visibility_km >= 10, 0.4, 0.2)
                )
            )
        )
        
        return pd.Series(transparency, index=visibility_m.index)
    
    def _transparency_to_magnitude_limit(self, transparency_score: pd.Series) -> pd.Series:
        """Convert transparency score to limiting magnitude"""
        # Scale transparency score (0-100) to magnitude limit
        magnitude_range = MAGNITUDE_LIMIT_ZENITH_MAX - MAGNITUDE_LIMIT_ZENITH_MIN
        
        magnitude_limit = (
            MAGNITUDE_LIMIT_ZENITH_MIN + 
            (transparency_score / 100) * magnitude_range
        )
        
        return magnitude_limit
    
    def analyze_dew_point_alerts(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Analyze dew point conditions and generate alerts for astrophotography
        """
        result = df.copy()
        
        temperature = result["temperature_2m"]
        dew_point = result["dew_point_2m"]
        
        # Calculate temperature-dew point spread
        dew_point_spread = temperature - dew_point
        
        # Dew risk levels
        dew_risk = np.where(
            dew_point_spread <= 1, "CRITICAL",  # Dew formation imminent
            np.where(dew_point_spread <= 2, "HIGH",  # High risk of dew
                np.where(dew_point_spread <= 4, "MODERATE",  # Moderate risk
                    np.where(dew_point_spread <= 8, "LOW", "MINIMAL")  # Low/minimal risk
                )
            )
        )
        
        # Dew risk score (0-100, higher = less risk)
        dew_risk_score = np.where(
            dew_point_spread <= 1, 10,
            np.where(dew_point_spread <= 2, 30,
                np.where(dew_point_spread <= 4, 50,
                    np.where(dew_point_spread <= 8, 70, 90)
                )
            )
        )
        
        result["dew_point_spread"] = dew_point_spread.round(1)
        result["dew_risk_level"] = dew_risk
        result["dew_risk_score"] = dew_risk_score
        
        return result
    
    def analyze_wind_tracking_impact(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Analyze wind impact on telescope tracking and mount stability
        """
        result = df.copy()
        
        wind_speed = result["wind_speed_10m"]
        wind_direction = result["wind_direction_10m"]
        
        # Wind impact on tracking
        tracking_impact = np.where(
            wind_speed <= 5, "EXCELLENT",  # No impact
            np.where(wind_speed <= 10, "GOOD",  # Minimal impact
                np.where(wind_speed <= 15, "FAIR",  # Some impact
                    np.where(wind_speed <= 25, "POOR",  # Significant impact
                        "CRITICAL"  # Severe impact
                    )
                )
            )
        )
        
        # Tracking stability score (0-100)
        tracking_score = np.where(
            wind_speed <= 5, 95,
            np.where(wind_speed <= 10, 80,
                np.where(wind_speed <= 15, 60,
                    np.where(wind_speed <= 25, 30, 10)
                )
            )
        )
        
        # Wind gusts estimation (simple model)
        estimated_gusts = wind_speed * 1.3
        
        result["wind_tracking_impact"] = tracking_impact
        result["tracking_stability_score"] = tracking_score
        result["estimated_wind_gusts"] = estimated_gusts.round(1)
        
        return result
    
    def generate_comprehensive_analysis(self, forecast_hours: int = 24) -> Optional[Dict]:
        """
        Generate comprehensive astrophotography weather analysis
        combining all advanced metrics
        """
        try:
            # Fetch extended weather data
            weather_data = self.fetch_extended_weather_data(forecast_hours)
            if not weather_data:
                return None
            
            df = weather_data["data"]
            
            # Apply all analysis methods
            df = self.analyze_cloud_layers(df)
            df = self.calculate_seeing_forecast(df)
            df = self.calculate_transparency_forecast(df)
            df = self.analyze_dew_point_alerts(df)
            df = self.analyze_wind_tracking_impact(df)
            
            # Convert datetime for JSON serialization
            df_json = df.copy()
            df_json["datetime"] = df_json["datetime"].dt.strftime("%Y-%m-%dT%H:%M:%S%z")
            
            # Create summary statistics
            current_conditions = self._generate_current_summary(df.iloc[0] if len(df) > 0 else None)
            best_periods = self._find_best_observation_periods(df)
            alerts = self._generate_weather_alerts(df)
            
            return {
                "location": weather_data["location"],
                "generated_at": datetime.now().isoformat(),
                "forecast_hours": forecast_hours,
                "current_conditions": current_conditions,
                "best_observation_periods": best_periods,
                "weather_alerts": alerts,
                "hourly_data": df_json.to_dict(orient="records")
            }
            
        except Exception as e:
            logger.exception("Failed to generate comprehensive analysis")
            return None
    
    def _generate_current_summary(self, current_row: Optional[pd.Series]) -> Dict:
        """Generate summary of current conditions"""
        if current_row is None:
            return {"status": "No current data available"}
        
        return {
            "seeing_pickering": float(current_row.get("seeing_pickering", 0)),
            "transparency_score": float(current_row.get("transparency_score", 0)),
            "limiting_magnitude": float(current_row.get("limiting_magnitude", 0)),
            "cloud_discrimination": float(current_row.get("cloud_discrimination", 0)),
            "dew_risk_level": current_row.get("dew_risk_level", "UNKNOWN"),
            "dew_point_spread": float(current_row.get("dew_point_spread", 0)),
            "wind_tracking_impact": current_row.get("wind_tracking_impact", "UNKNOWN"),
            "tracking_stability_score": float(current_row.get("tracking_stability_score", 0))
        }
    
    def _find_best_observation_periods(self, df: pd.DataFrame) -> List[Dict]:
        """Find the best periods for astrophotography within the forecast"""
        if len(df) == 0:
            return []
        
        # Calculate overall quality score
        df["overall_quality"] = (
            df["seeing_pickering"] * 10 +  # Convert to percentage scale
            df["transparency_score"] +
            df["cloud_discrimination"] +
            df["tracking_stability_score"]
        ) / 4
        
        # Find periods with quality > 70%
        good_periods = df[df["overall_quality"] >= 70].copy()
        
        if len(good_periods) == 0:
            return []
        
        # Group consecutive good periods
        periods = []
        current_period_start = None
        current_period_end = None
        
        for idx, row in good_periods.iterrows():
            if current_period_start is None:
                current_period_start = row["datetime"]
                current_period_end = row["datetime"]
            else:
                # Check if this row is consecutive to the previous
                time_diff = (row["datetime"] - current_period_end).total_seconds() / 3600
                if time_diff <= 1.5:  # Within 1.5 hours
                    current_period_end = row["datetime"]
                else:
                    # Save current period and start new one
                    periods.append({
                        "start": current_period_start.isoformat(),
                        "end": current_period_end.isoformat(),
                        "duration_hours": (current_period_end - current_period_start).total_seconds() / 3600,
                        "average_quality": float(good_periods[
                            (good_periods["datetime"] >= current_period_start) & 
                            (good_periods["datetime"] <= current_period_end)
                        ]["overall_quality"].mean())
                    })
                    current_period_start = row["datetime"]
                    current_period_end = row["datetime"]
        
        # Don't forget the last period
        if current_period_start is not None:
            periods.append({
                "start": current_period_start.isoformat(),
                "end": current_period_end.isoformat(),
                "duration_hours": (current_period_end - current_period_start).total_seconds() / 3600,
                "average_quality": float(good_periods[
                    (good_periods["datetime"] >= current_period_start) & 
                    (good_periods["datetime"] <= current_period_end)
                ]["overall_quality"].mean())
            })
        
        # Sort by quality and return top 5
        periods.sort(key=lambda x: x["average_quality"], reverse=True)
        return periods[:5]
    
    def _generate_weather_alerts(self, df: pd.DataFrame) -> List[Dict]:
        """Generate weather alerts for astrophotography conditions"""
        alerts = []
        
        if len(df) == 0:
            return alerts
        
        # Check next 6 hours for critical conditions
        next_6h = df.head(6)
        
        # Dew alerts
        critical_dew = next_6h[next_6h["dew_risk_level"] == "CRITICAL"]
        if len(critical_dew) > 0:
            alerts.append({
                "type": "DEW_WARNING",
                "severity": "HIGH",
                "message": f"Critical dew risk starting at {critical_dew.iloc[0]['datetime'].strftime('%H:%M')}",
                "time": critical_dew.iloc[0]["datetime"].isoformat()
            })
        
        # High wind alerts
        critical_wind = next_6h[next_6h["wind_tracking_impact"] == "CRITICAL"]
        if len(critical_wind) > 0:
            alerts.append({
                "type": "WIND_WARNING", 
                "severity": "HIGH",
                "message": f"Critical wind conditions for tracking starting at {critical_wind.iloc[0]['datetime'].strftime('%H:%M')}",
                "time": critical_wind.iloc[0]["datetime"].isoformat()
            })
        
        # Poor seeing alerts
        poor_seeing = next_6h[next_6h["seeing_pickering"] <= 3]
        if len(poor_seeing) > 0:
            alerts.append({
                "type": "SEEING_WARNING",
                "severity": "MEDIUM", 
                "message": f"Poor seeing conditions (≤3) starting at {poor_seeing.iloc[0]['datetime'].strftime('%H:%M')}",
                "time": poor_seeing.iloc[0]["datetime"].isoformat()
            })
        
        # Low transparency alerts
        poor_transparency = next_6h[next_6h["transparency_score"] <= 30]
        if len(poor_transparency) > 0:
            alerts.append({
                "type": "TRANSPARENCY_WARNING",
                "severity": "MEDIUM",
                "message": f"Poor transparency conditions starting at {poor_transparency.iloc[0]['datetime'].strftime('%H:%M')}",
                "time": poor_transparency.iloc[0]["datetime"].isoformat()
            })
        
        return alerts


def get_astro_weather_analysis(hours: int = 24) -> Optional[Dict]:
    """
    Main function to get comprehensive astrophotography weather analysis
    """
    try:
        analyzer = AstroWeatherAnalyzer()
        return analyzer.generate_comprehensive_analysis(hours)
    except Exception as e:
        logger.exception("Failed to get astro weather analysis")
        return None


def get_current_astro_conditions() -> Optional[Dict]:
    """
    Get current astrophotography conditions summary
    """
    try:
        analyzer = AstroWeatherAnalyzer()
        analysis = analyzer.generate_comprehensive_analysis(1)
        if analysis:
            return analysis["current_conditions"]
        return None
    except Exception as e:
        logger.exception("Failed to get current astro conditions")
        return None