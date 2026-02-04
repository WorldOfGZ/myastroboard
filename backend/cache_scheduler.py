import threading
import time
from datetime import datetime
from logging_config import get_logger
from cache_updater import fully_initialize_caches

# Initialize logger for this module
logger = get_logger(__name__)

class CacheScheduler:
    def __init__(self, interval_seconds=3600):
        """
        Scheduler to pre-compute heavy caches in the background.
        interval_seconds: frequency of calculations
        """
        self.interval = interval_seconds
        self._stop_event = threading.Event()
        self.thread = threading.Thread(target=self._run, daemon=True)

    def start(self):
        self.thread.start()
        logger.info("CacheScheduler started")

    def stop(self):
        self._stop_event.set()
        self.thread.join()
        logger.info("CacheScheduler stopped")

    def _run(self):
        while not self._stop_event.is_set():
            try:
                self.update_all_caches()
            except Exception as e:
                logger.error(f"Error updating caches: {e}")
            time.sleep(self.interval)

    def update_all_caches(self):
        """Update all caches by calling the calculation functions"""
        fully_initialize_caches()
