"""
Weather utility functions for Open-Meteo API
Provides centralized weather client creation to avoid code duplication
"""
import os
import openmeteo_requests
import requests_cache
from retry_requests import retry
from constants import WEATHER_CACHE_TTL, OPENMETEO_RETRY_COUNT, OPENMETEO_BACKOFF_FACTOR, DATA_DIR


def create_weather_client():
    """
    Create a configured Open-Meteo API client with caching and retry logic
    
    Returns:
        openmeteo_requests.Client: Configured client instance with:
            - Cache session (1 hour TTL)
            - Retry logic (5 retries with exponential backoff)
    """
    cache_session = requests_cache.CachedSession(os.path.join(DATA_DIR, ".weather_cache"), expire_after=WEATHER_CACHE_TTL)
    retry_session = retry(cache_session, retries=OPENMETEO_RETRY_COUNT, backoff_factor=OPENMETEO_BACKOFF_FACTOR)
    client = openmeteo_requests.Client(session=retry_session)
    return client
