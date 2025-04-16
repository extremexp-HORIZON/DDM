from flask_restx import fields

# ✅ Single File Update Model
def get_file_update_model(ns):
    return ns.model(
        "FileUpdate",
        {
            "file_id": fields.String(description="ID of the file to update", required=True),  # 🔥 Added file_id
            "project_id": fields.String(description="Updated project ID", required=False),
            "description": fields.String(description="Updated file description", required=False),
            "filename": fields.String(description="Updated filename", required=False),
            "use_case": fields.List(fields.String, description="Updated use cases (List)", required=False),
        },
    )

# ✅ Multi-File Update Model
def get_files_update_model(ns):
    return ns.model(
        "FilesUpdateRequest",
        {
            "files": fields.List(
                fields.Nested(get_file_update_model(ns)),  # ✅ Each file update follows `FileUpdate`
                required=True,
                description="List of files to update"
            )
        },
    )

# ✅ Multi-File Update Response Model
def get_files_update_response_model(ns):
    return ns.model(
        "FilesUpdateResponse",
        {
            "message": fields.String(description="Update success message"),
            "updated_files": fields.List(
                fields.Nested(get_file_update_model(ns)),
                description="List of updated files"
            )
        },
    )
