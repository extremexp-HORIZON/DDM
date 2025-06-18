import eventlet
eventlet.monkey_patch()
import os
from dotenv import load_dotenv

load_dotenv()

def require_env(key: str) -> str:
    """Raise an error if a required environment variable is not set."""
    value = os.getenv(key)
    if not value:
        raise RuntimeError(f"Environment variable '{key}' is required but not set.")
    return value


class Config:
    # General Flask Configuration
    SECRET_KEY = require_env('SECRET_KEY')

    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_size": 10,
        "pool_recycle": 1800,
        "pool_timeout": 15,
    }

    UPLOAD_FOLDER = os.getenv('UPLOAD_FOLDER', './uploads')
    ZENOH_ENDPOINTS = os.getenv("ZENOH_ENDPOINTS", '["tcp/localhost:7447"]')

    # Database Configuration
    SQLALCHEMY_DATABASE_URI = require_env('DATABASE_URL')

    # Celery Configuration
    CELERY_BROKER_URL = require_env('CELERY_BROKER_URL')
    CELERY_RESULT_BACKEND = require_env('CELERY_RESULT_BACKEND')

    # OIDC / Auth
    OIDC_OP_TOKEN_ENDPOINT = require_env('OIDC_OP_TOKEN_ENDPOINT')
    USER_AUTH_URL = require_env("USER_AUTH_URL")
    #OLLAMA    
    OLLAMA_BASE_URL = require_env("OLLAMA_HOST")
    OLLAMA_MODEL = require_env("OLLAMA_MODEL")
