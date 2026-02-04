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
        self._first_run = True

    def start(self):
        self.thread.start()
        logger.info("CacheScheduler started - will update caches immediately then every %d seconds", self.interval)

    def stop(self):
        self._stop_event.set()
        self.thread.join()
        logger.info("CacheScheduler stopped")

    def _run(self):
        while not self._stop_event.is_set():
            try:
                if self._first_run:
                    logger.info("Running initial cache population...")
                    self._first_run = False
                else:
                    logger.info("Running scheduled cache update...")
                self.update_all_caches()
            except Exception as e:
                logger.error(f"Error updating caches: {e}", exc_info=True)
            
            if self._stop_event.wait(self.interval):
                break  # Exit if stop event is set during sleep

    def update_all_caches(self):
        """Update all caches by calling the calculation functions"""
        start_time = datetime.now()
        logger.info("Starting cache update process...")
        try:
            fully_initialize_caches()
            duration = (datetime.now() - start_time).total_seconds()
            logger.info(f"Cache update completed successfully in {duration:.2f} seconds")
        except Exception as e:
            duration = (datetime.now() - start_time).total_seconds()
            logger.error(f"Cache update failed after {duration:.2f} seconds: {e}", exc_info=True)
            raise
