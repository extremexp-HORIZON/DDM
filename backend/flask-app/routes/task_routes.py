
from celery.result import AsyncResult
from flask import Blueprint, jsonify

view_tasks_bp = Blueprint("tasks", __name__, url_prefix="/ddm/tasks")


@view_tasks_bp.get("/result/<id>")
def result(id: str) -> dict[str, object]:
    result = AsyncResult(id)
    ready = result.ready()
    return {
        "ready": ready,
        "successful": result.successful() if ready else None,
        "value": result.get() if ready else result.result,
    }


def _bytes_to_hex(obj):
    """Only convert bytes → 0x… recursively; leave everything else untouched."""
    if isinstance(obj, bytes):
        return "0x" + obj.hex()
    if isinstance(obj, dict):
        return {k: _bytes_to_hex(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_bytes_to_hex(x) for x in obj]
    return obj

@view_tasks_bp.get("/status/<task_id>")
def get_task_status(task_id):
    task = AsyncResult(task_id)

    if task.state == "PENDING":
        return jsonify({"state": "PENDING", "message": "Task is still in progress."})

    if task.state == "SUCCESS":
        try:
            return jsonify({"state": "SUCCESS", "result": task.result})
        except TypeError:
            # Only if it fails (e.g., bytes inside), convert bytes → hex
            safe_result = _bytes_to_hex(task.result)
            return jsonify({"state": "SUCCESS", "result": safe_result})

    if task.state == "FAILURE":
        try:
            return jsonify({"state": "FAILURE", "error": str(task.info)}), 500
        except TypeError:
            return jsonify({"state": "FAILURE", "error": _bytes_to_hex(str(task.info))}), 500

    return jsonify({"state": task.state, "message": "Task is in an unknown state."})
    
