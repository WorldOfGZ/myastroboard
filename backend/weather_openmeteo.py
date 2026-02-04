"""
Manage weather from Open-Meteo API
https://open-meteo.com/en/docs
"""
from http.client import responses
import json
import os
import pandas as pd
from repo_config import load_config
from constants import URL_OPENMETEO, DATA_DIR, CONFIG_FILE, CONDITIONS_FILE
from logging_config import get_logger
from weather_utils import create_weather_client

# Create logger with centralized configuration
logger = get_logger(__name__)

def fetch_weather(latitude, longitude, timezone, hourly_vars, forecast_hours=12):
    """Call Open-Meteo API and return raw response"""
    client = create_weather_client()

    params = {
        "latitude": latitude,
        "longitude": longitude,
        "timezone": timezone,
        "hourly": hourly_vars,
        "forecast_hours": forecast_hours
    }

    response = client.weather_api(URL_OPENMETEO, params=params)[0]
    return response

def parse_hourly(response, hourly_vars, timezone_str="UTC"):
    """Transform raw response into pandas DataFrame, apply timezone"""

    hourly = response.Hourly()

    # Dates in UTC
    dates = pd.date_range(
        start=pd.to_datetime(hourly.Time(), unit="s", utc=True),
        periods=len(hourly.Variables(0).ValuesAsNumpy()),
        freq=pd.Timedelta(seconds=hourly.Interval())
    )

    data = {"date": dates}

    for i, name in enumerate(hourly_vars):
        data[name] = hourly.Variables(i).ValuesAsNumpy()

    df = pd.DataFrame(data)

    # Convert to requested timezone
    try:
        # Ensure the timezone string is valid and convert
        if timezone_str and timezone_str != "UTC":
            # Test if the timezone string is valid first
            import zoneinfo
            try:
                zoneinfo.ZoneInfo(timezone_str)
                df["date"] = df["date"].dt.tz_convert(timezone_str)
            except zoneinfo.ZoneInfoNotFoundError:
                logger.warning(f"Unknown timezone '{timezone_str}', keeping dates in UTC")
                # Keep dates in UTC if timezone is invalid
        # If timezone_str is None, empty, or UTC, keep as UTC
    except Exception as e:
        logger.warning(f"Failed to convert timezone to {timezone_str}: {e}")
        # Keep dates in UTC if conversion fails

    # -----------------------------
    # Cloudless %
    # -----------------------------
    df["cloudless"] = 100 - df["cloud_cover"]
    df["cloudless_low"] = 100 - df["cloud_cover_low"]
    df["cloudless_mid"] = 100 - df["cloud_cover_mid"]
    df["cloudless_high"] = 100 - df["cloud_cover_high"]

    # -----------------------------
    # Seeing proxy (%)
    # -----------------------------
    wind_factor = (100 - df["wind_speed_10m"] * 3).clip(0, 100)

    stability_factor = (50 + df["lifted_index"] * 5).clip(0, 100)

    seeing_percent = (wind_factor * 0.7 + stability_factor * 0.3).clip(0, 100)

    # -----------------------------
    # Transparency proxy (%)
    # -----------------------------
    humidity_factor = (100 - df["relative_humidity_2m"]).clip(0, 100)

    visibility_km = df["visibility"] / 1000
    visibility_factor = (visibility_km / 30 * 100).clip(0, 100)

    transparency_percent = (
        humidity_factor * 0.4 +
        visibility_factor * 0.6
    ).clip(0, 100)

    # -----------------------------
    # Calm (%)
    # -----------------------------
    calm_percent = (100 - df["wind_speed_10m"] * 5).clip(0, 100)

    # -----------------------------
    # Fog probability (%)
    # -----------------------------
    fog_percent = pd.Series(0, index=df.index)

    mask1 = df["relative_humidity_2m"] > 90
    fog_percent[mask1] = ((df["relative_humidity_2m"] - 90) * 10).clip(0, 100)

    mask2 = (df["relative_humidity_2m"] > 80) & (~mask1)
    fog_percent[mask2] = ((df["relative_humidity_2m"] - 80) * 5).clip(0, 100)

    # -----------------------------
    # Overall astro condition score
    # -----------------------------
    condition_percent = (
        df["cloudless"] * 0.5 +
        seeing_percent * 0.25 +
        transparency_percent * 0.25
    ).clip(0, 100)

    # -----------------------------
    # Store final metrics
    # -----------------------------
    df["condition"] = condition_percent.round(1)
    df["seeing"] = seeing_percent.round(1)
    df["calm"] = calm_percent.round(1)
    df["fog"] = fog_percent.round(1)
    df["transparency"] = transparency_percent.round(1)

    return df


def get_hourly_forecast():
    """Return location info + DataFrame of the next 12 hours of weather data"""
    try:
        config = load_config()
        hourly_vars = [
            "temperature_2m",
            "relative_humidity_2m",
            "dew_point_2m",
            "precipitation_probability",
            "precipitation",
            "rain",
            "weather_code",
            "visibility",
            "wind_speed_10m",
            "wind_direction_10m",
            "cloud_cover",
            "cloud_cover_low",
            "cloud_cover_mid",
            "cloud_cover_high",
            "lifted_index",
            "sunshine_duration",
            "is_day",
            "uv_index",
            "surface_pressure"
        ]

        response = fetch_weather(
            latitude=config["location"]["latitude"],
            longitude=config["location"]["longitude"],
            timezone=config["location"]["timezone"],
            hourly_vars=hourly_vars
        )

        location_info = {
            "name": config["location"]["name"],
            "latitude": response.Latitude(),
            "longitude": response.Longitude(),
            "elevation": response.Elevation(),
            "timezone": response.Timezone()
        }

        # Because the timezone is returned as bytes
        timezone_str = response.Timezone()
        if isinstance(timezone_str, bytes):
            timezone_str = timezone_str.decode("utf-8")

        hourly_df = parse_hourly(response, hourly_vars, timezone_str=timezone_str)
        return {
            "location": location_info,
            "hourly": hourly_df
        }

    except Exception:
        logger.exception("Error while fetching hourly forecast")
        return None


def get_uptonight_conditions():
    """Return current uptonight conditions summary (1h forecast)"""
    try:
        config = load_config()

        hourly_vars = [
            "temperature_2m",
            "relative_humidity_2m",
            "surface_pressure"
        ]

        response = fetch_weather(
            latitude=config["location"]["latitude"],
            longitude=config["location"]["longitude"],
            timezone=config["location"]["timezone"],
            hourly_vars=hourly_vars,
            forecast_hours=1
        )

        hourly = response.Hourly()

        # Extract first hour only
        temperature = float(hourly.Variables(0).ValuesAsNumpy()[0])
        humidity = float(hourly.Variables(1).ValuesAsNumpy()[0]) / 100  
        pressure = float(hourly.Variables(2).ValuesAsNumpy()[0]) / 1000

        conditions = {
            "temperature": round(temperature, 1),
            "relative_humidity": round(humidity, 2),
            "pressure": round(pressure, 3)
        }

        # Save JSON
        os.makedirs(os.path.dirname(CONDITIONS_FILE), exist_ok=True)
        with open(CONDITIONS_FILE, "w") as f:
            json.dump(conditions, f, indent=2)

        return conditions

    except Exception:
        logger.exception("Error while fetching uptonight conditions")
        return None



