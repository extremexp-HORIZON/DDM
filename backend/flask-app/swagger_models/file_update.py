from flask_restx import fields

def get_file_update_model(ns):
    return ns.model(
        "FileUpdate",
        {
            "project_id": fields.String(description="Updated project ID", required=False),
            "description": fields.String(description="Updated file description", required=False),
            "filename": fields.String(description="Updated filename", required=False),
            "use_case": fields.List(fields.String, description="Updated use cases (List)", required=False),
        },
    )
