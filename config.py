"""Configuration settings for RefNet."""

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class Config:
    """Base configuration class."""
    
    # Flask settings
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
    DEBUG = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    HOST = os.getenv('FLASK_HOST', '0.0.0.0')
    PORT = int(os.getenv('FLASK_PORT', 8000))
    
    # API settings
    API_RATE_LIMIT_DELAY = float(os.getenv('API_RATE_LIMIT_DELAY', '0.1'))  # Reduced delay for faster processing
    API_MAX_RETRIES = int(os.getenv('API_MAX_RETRIES', '3'))

    # Search settings
    DEFAULT_PAGE_SIZE = int(os.getenv('DEFAULT_PAGE_SIZE', '25'))
    MAX_PAGE_SIZE = int(os.getenv('MAX_PAGE_SIZE', '50'))
    
    # Graph settings
    DEFAULT_ITERATIONS = int(os.getenv('DEFAULT_ITERATIONS', '3'))
    MAX_ITERATIONS = int(os.getenv('MAX_ITERATIONS', '5'))
    DEFAULT_CITED_LIMIT = int(os.getenv('DEFAULT_CITED_LIMIT', '5'))
    MAX_CITED_LIMIT = int(os.getenv('MAX_CITED_LIMIT', '20'))
    DEFAULT_REF_LIMIT = int(os.getenv('DEFAULT_REF_LIMIT', '5'))
    MAX_REF_LIMIT = int(os.getenv('MAX_REF_LIMIT', '20'))
    
    # Cache settings
    ENABLE_CACHE = os.getenv('ENABLE_CACHE', 'True').lower() == 'true'
    CACHE_TTL = int(os.getenv('CACHE_TTL', '3600'))  # 1 hour in seconds


class DevelopmentConfig(Config):
    """Development configuration."""
    DEBUG = True
    API_RATE_LIMIT_DELAY = 0.1  # Faster for development


class ProductionConfig(Config):
    """Production configuration."""
    DEBUG = False
    API_RATE_LIMIT_DELAY = 0.5  # Slower for production


class TestingConfig(Config):
    """Testing configuration."""
    TESTING = True
    API_RATE_LIMIT_DELAY = 0.0  # No delay for testing


# Configuration mapping
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}


def get_config(config_name=None):
    """Get configuration class by name."""
    if config_name is None:
        config_name = os.getenv('FLASK_ENV', 'default')
    
    return config.get(config_name, config['default'])
