import eventlet
eventlet.monkey_patch()

from app import create_app

flask_app = create_app()
celery_app = flask_app.extensions["celery"]