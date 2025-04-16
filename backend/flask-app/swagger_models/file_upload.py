from flask_restx import fields

def get_upload_file_url_model(ns):
    return ns.model(
        "UploadFileUrlRequest",
        {
            "file_url": fields.String(
                required=True, description="URL of the file to retrieve"
            ),
            "project_id": fields.String(
                required=True, description="Project ID associated with the file"
            ),
            "description": fields.String(
                required=False, description="Short description of the file"
            ),
            "use_cases": fields.List(
                fields.String, required=False, description="List of use cases"
            ),
            "metadata": fields.Raw(
                required=False, description="Additional metadata (JSON object)"
            ),
        },
    )


def get_upload_file_url_response_model(ns):
    return ns.model(
        "UploadFileUrlResponse",
        {
            "message": fields.String(description="Success message"),
            "file_id": fields.String(description="ID of the uploaded file"),
            "zenoh_file_path": fields.String(description="Storage path of the file"),
            "fetch_task_id": fields.String(description="ID of the fetch task"),
            "process_task_id": fields.String(description="ID of the processing task"),
        },
    )


def get_upload_multiple_files_response_model(ns):
    return fields.List(fields.Nested(get_upload_file_url_response_model(ns)))
