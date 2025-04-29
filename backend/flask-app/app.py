import eventlet
eventlet.monkey_patch()
from dotenv import load_dotenv
from flask import Flask
from celery import Celery, Task
from extensions.db import db
from extensions.api import api
from models import File
from utils.ollama_util import wait_for_ollama_ready, ensure_mistral_loaded 
from routes.file_routes import file_ns
from routes.files_routes import files_ns
from routes.metadata_routes import file_metadata_ns, uploader_metadata_ns
from routes.catalog import catalog_ns
from routes.expectation_routes import expectations_ns
from routes.validation_routes import validations_ns
from routes.parametric_routes import parametrics_ns
from flask_cors import CORS


# Load environment variables
load_dotenv()



class FlaskTask(Task):
    """Ensures Celery tasks run within Flask's application context."""
    def __call__(self, *args, **kwargs):
        with self.app.app_context():
            return self.run(*args, **kwargs)


def create_app(config_object="config.Config"):
    """Create and configure the Flask app."""
    # Initialize Flask app
    app = Flask(__name__)
    CORS(app, origins="*")  # Allow Cross-Origin Requests

    # Load configuration
    app.config.from_object(config_object)
    app.config.from_mapping(
        CELERY=dict(
            broker_url="sqla+postgresql://postgres:admin@db:5432/mydatabase",
            result_backend="sqla+postgresql://postgres:admin@db:5432/mydatabase",
            task_ignore_result=True,
            broker_connection_retry_on_startup=True
        ),
    )
    celery_init_app(app)
    # Initialize extensions
    db.init_app(app)
    api.init_app(
        app,
        version="1.0",
        title="Extreme XP Decentralized Data Management Swagger Documentation",
        description="API for Extreme XP Decentralized Data Management and File Catalog",
    )

    # Register Namespaces
    api.add_namespace(file_ns)
    api.add_namespace(files_ns)
    api.add_namespace(file_metadata_ns)
    api.add_namespace(uploader_metadata_ns)
    api.add_namespace(catalog_ns)
    api.add_namespace(expectations_ns)
    api.add_namespace(validations_ns)
    api.add_namespace(parametrics_ns)



    # Create database tables if they don't exist
    with app.app_context():
        
        db.create_all()

        from routes.task_routes import view_tasks_bp
        from tasks.task import fetch_file_from_link,merge_chunks_task,process_large_file,build_expectations_task, build_column_descriptions_task


    app.register_blueprint(view_tasks_bp)
    celery_app = app.extensions['celery']
    celery_app.conf.beat_schedule = {
        'check-discord-every-5-minutes': {
            'task': 'tasks.check_discord_chilli',  # Update with your actual task path
            'schedule': 30.0,  # 300 seconds = 5 minutes
        },
    }
    celery_app.conf.timezone = 'UTC'  # Adjust this if you want a different timezone
    wait_for_ollama_ready()
    ensure_mistral_loaded()
    return app


def celery_init_app(app: Flask) -> Celery:
    class FlaskTask(Task):
        def __call__(self, *args: object, **kwargs: object) -> object:
            with app.app_context():
                return self.run(*args, **kwargs)

    celery_app = Celery(app.name, task_cls=FlaskTask)
    celery_app.config_from_object(app.config["CELERY"])
    celery_app.set_default()
    app.extensions["celery"] = celery_app
    return celery_app

