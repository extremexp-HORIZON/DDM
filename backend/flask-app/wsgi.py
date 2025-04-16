# run.py
import eventlet
eventlet.monkey_patch()

from app import create_app

app  = create_app()
celery_app = app.extensions['celery']

if __name__ == '__main__':
    app.run()
