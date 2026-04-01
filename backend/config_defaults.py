"""
Default configuration constants for SkyTonight
Centralized location for all default configuration values
"""

from copy import deepcopy

# Default location configuration
DEFAULT_LOCATION = {
    "name": "Paris",
    "latitude": 48.866669,
    "longitude": 2.33333,
    "elevation": 35,
    "timezone": "Europe/Paris"
}

# Default feature flags
DEFAULT_FEATURES = {
    "horizon": False,
    "objects": True,
    "bodies": True,
    "comets": True,
    "alttime": True
}

# Default feature flags
DEFAULT_ASTRODEX = {
    "private": False
}


# Default constraint values
DEFAULT_CONSTRAINTS = {
    "altitude_constraint_min": 30,
    "altitude_constraint_max": 80,
    "airmass_constraint": 2,
    "size_constraint_min": 10,
    "size_constraint_max": 300,
    "moon_separation_min": 45,
    "moon_separation_use_illumination": True,
    "fraction_of_time_observable_threshold": 0.5,
    "max_number_within_threshold": 60,
    "north_to_east_ccw": False
}

# Default horizon configuration
DEFAULT_HORIZON = {
    "step_size": 5,
    "anchor_points": []
}


DEFAULT_SKYTONIGHT_SCHEDULER = {
    "mode": "fallback-6h",
    "server_time_valid": False,
    "next_run": None,
    "last_run": None,
}


DEFAULT_SKYTONIGHT_DATASETS = {
    "catalogues": {
        "deep_sky": True,
        "bodies": True,
        "comets": True,
    },
    "comets": {
        "source": "mpc+jpl",
        "auto_update": True,
    },
}


DEFAULT_SKYTONIGHT = {
    "enabled": True,
    "constraints_always_enabled": True,
    "preferred_name_order": ["OpenNGC", "Messier", "OpenIC", "Caldwell"],
    "constraints": deepcopy(DEFAULT_CONSTRAINTS),
    "scheduler": deepcopy(DEFAULT_SKYTONIGHT_SCHEDULER),
    "datasets": deepcopy(DEFAULT_SKYTONIGHT_DATASETS),
}

# Default complete configuration
DEFAULT_CONFIG = {
    "location": DEFAULT_LOCATION,
    "selected_catalogues": ["Messier"],
    "min_altitude": 30,
    "use_constraints": False,
    "features": DEFAULT_FEATURES,
    "constraints": DEFAULT_CONSTRAINTS,
    "bucket_list": [],
    "done_list": [],
    "custom_targets": [],
    "horizon": DEFAULT_HORIZON,
    "output_datestamp": False,
    "astrodex": DEFAULT_ASTRODEX,
    "skytonight": DEFAULT_SKYTONIGHT,
}