# config.py
import eventlet
eventlet.monkey_patch()

import os

class Config:
    # General Flask Configuration
    SECRET_KEY = os.environ.get('SECRET_KEY', 'your_default_secret_key')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_size": 10,        # Number of persistent connections
        "pool_recycle": 1800,   # Recycle connections every 30 minutes
        "pool_timeout": 15      # Wait time before failing to get a connection
    }
    UPLOAD_FOLDER = './uploads'
    # Database Configuration
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL', 'postgresql://postgres:admin@db:5432/mydatabase')
    # Celery configuration
    CELERY_BROKER_URL = "sqla+postgresql://postgres:admin@db:5432/mydatabase"
    CELERY_RESULT_BACKEND = 'sqla+postgresql://postgres:admin@db:5432/mydatabase'

