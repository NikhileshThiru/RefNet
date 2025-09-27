"""Rate limiting utilities for API calls."""

import time
from typing import Optional


class RateLimiter:
    """Simple rate limiter to control API call frequency."""
    
    def __init__(self, delay: float = 0.2, max_retries: int = 1):
        """
        Initialize rate limiter.
        
        Args:
            delay: Minimum delay between API calls in seconds
            max_retries: Maximum number of retries for failed calls
        """
        self.delay = delay
        self.max_retries = max_retries
        self.last_call_time = 0.0
    
    def wait_if_needed(self) -> None:
        """Wait if necessary to respect rate limits."""
        now = time.time()
        time_since_last_call = now - self.last_call_time
        
        if time_since_last_call < self.delay:
            sleep_time = self.delay - time_since_last_call
            time.sleep(sleep_time)
        
        self.last_call_time = time.time()
    
    def should_retry(self, attempt: int) -> bool:
        """
        Check if we should retry a failed operation.
        
        Args:
            attempt: Current attempt number (0-based)
            
        Returns:
            True if we should retry, False otherwise
        """
        return attempt < self.max_retries

