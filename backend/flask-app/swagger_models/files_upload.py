from flask_restx import fields

# ✅ Single File Upload Model
def get_upload_file_url_model(ns):
    return ns.model(
        "UploadFileUrlRequest",
        {
            "file_url": fields.String(
                required=True, description="URL of the file to retrieve"
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

# ✅ Multi-File Upload Request Model
def get_upload_file_urls_model(ns):
    return ns.model(
        "UploadFileUrlsRequest",
        {
            "project_id": fields.String(
                required=True, description="Project ID associated with the files"
            ),
            "files": fields.List(
                fields.Nested(get_upload_file_url_model(ns)),  # ✅ Each file follows `UploadFile`
                required=True,
                description="List of files to upload"
            ),
        },
    )

# ✅ Single File Upload Response Model
def get_upload_file_url_response_model(ns):
    return ns.model(
        "UploadFileUrlResponse",
        {
            "message": fields.String(description="Success message"),
            "file_id": fields.String(description="ID of the uploaded file"),
            "file_url": fields.String(description="URL of the uploaded file"),
            "zenoh_file_path": fields.String(description="Storage path of the file"),
            "fetch_task_id": fields.String(description="ID of the fetch task"),
            "process_task_id": fields.String(description="ID of the processing task"),
        },
    )

# ✅ Multi-File Upload Response Model
def get_upload_file_urls_response_model(ns):
    return ns.model(
        "UploadFileUrlsResponse",
        {
            "message": fields.String(description="Files uploaded successfully"),
            "files": fields.List(
                fields.Nested(get_upload_file_url_response_model(ns)),  # ✅ List of individual file responses
                description="List of uploaded file responses"
            ),
        },
    )
