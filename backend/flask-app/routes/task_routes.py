
from celery.result import AsyncResult
from flask import Blueprint, jsonify

view_tasks_bp = Blueprint("tasks", __name__, url_prefix="/tasks")


@view_tasks_bp.get("/result/<id>")
def result(id: str) -> dict[str, object]:
    result = AsyncResult(id)
    ready = result.ready()
    return {
        "ready": ready,
        "successful": result.successful() if ready else None,
        "value": result.get() if ready else result.result,
    }


@view_tasks_bp.get("/status/<task_id>")
def get_task_status(task_id):
    task = AsyncResult(task_id)

    if task.state == "PENDING":
        return jsonify({"state": "PENDING", "message": "Task is still in progress."})
    elif task.state == "SUCCESS":
        return jsonify({"state": "SUCCESS", "result": task.result})
    elif task.state == "FAILURE":
        return jsonify({"state": "FAILURE", "error": str(task.info)})
    else:
        return jsonify({"state": task.state, "message": "Task is in an unknown state."})
    

    
