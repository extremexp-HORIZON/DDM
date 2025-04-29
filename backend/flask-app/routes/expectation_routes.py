from flask import request
from flask_restx import Namespace, Resource, fields
from celery import chain
from tasks.task import build_expectations_task, build_column_descriptions_task
from utils.zenoh_file_handler import ZenohFileHandler
from models.expectations import ExpectationSuites
from utils.file_handler import save_file_record
from utils.expectations_handler import save_expectation_suite
from datetime import datetime, timezone
import mimetypes
import os
from tasks.task import run_expectation_suites_task
from parsers.expectations_parser import expectation_suite_filter_parser 
from dateutil.parser import isoparse
from sqlalchemy import or_


def split_values(value):
    return [v.strip() for v in value.split(',')] if value else []

expectations_ns = Namespace('expectations', description='Operations related to expectations')


# 📌 Swagger Models
file_upload_model = expectations_ns.model('FileUpload', {
    'file': fields.Raw(required=True, description="Upload a sample file"),
    'datasource_name': fields.String(description="Datasource name")
})

expectation_model = expectations_ns.model('Expectation', {
    'suite_name': fields.String(description="Expectation suite name"),
    'datasource_name': fields.String(description="Datasource name"),
    'file_type': fields.String(description="Detected file type"),
    'expectations': fields.Raw(description="Auto-generated expectations"),
    'path': fields.String(description="Sample file path"),
})


# Swagger models
e_suite_model = expectations_ns.model('ExpectationSuite', {
    'suite_name': fields.String(required=True),
    'file_types': fields.List(fields.String, required=True, description="Allowed file types"),
    'expectations': fields.Raw(required=True),
    'category': fields.String(),
    'description': fields.String(),
    'user_id': fields.String(required=True),
    'use_case': fields.String(),
})



# 📌 Utility: Detect File Type
def detect_file_type(file_path):
    mime_type, _ = mimetypes.guess_type(file_path)
    return mime_type or "unknown"



@expectations_ns.route('/upload-sample')
class UploadSample(Resource):
    @expectations_ns.expect(file_upload_model)
    @expectations_ns.doc(security='apikey')
    @expectations_ns.response(202, 'Accepted')
    def post(self):
        """Uploads a file and starts expectation + description tasks."""

        if 'file' not in request.files:
            return {"error": "No file uploaded"}, 400

        uploaded_file = request.files['file']
        if uploaded_file.filename == "":
            return {"error": "File is empty"}, 400

        temp_path = f"/tmp/{uploaded_file.filename}"
        uploaded_file.save(temp_path)

        try:
            if os.stat(temp_path).st_size == 0:
                return {"error": "Uploaded file is empty"}, 400

            # ✅ Get project_id from form (fallback to "default")
            suite_name = request.form.get("suite_name", "default")
            dataset_name = os.path.splitext(uploaded_file.filename)[0]
            zenoh_path = f"projects/{suite_name}/datasets/{dataset_name}/{uploaded_file.filename}"

            with open(temp_path, "rb") as f:
                file_data = f.read()

            stored = ZenohFileHandler.put_file(zenoh_path, file_data)
            if not stored:
                return {"error": "Failed to store file in Zenoh"}, 500

            file_record = {
                "filename": uploaded_file.filename,
                "upload_filename": uploaded_file.filename,
                "path": zenoh_path,
                "file_type": os.path.splitext(uploaded_file.filename)[1].lower().strip("."),  # ✅ extension
                "file_size": os.path.getsize(temp_path),
                "file_hash": None,
                "user_id": "demo-user-id",
                "project_id": suite_name,
                "created": datetime.now(timezone.utc),
            }

            saved_file = save_file_record(file_record)

            task_chain = chain(
                build_expectations_task.s(zenoh_path),
                build_column_descriptions_task.s()
            ).apply_async()

            return {
                "message": "Tasks started",
                "dataset_id": saved_file.id,
                "expectation_task_id": task_chain.parent.id,
                "description_task_id": task_chain.id 
            }, 202

        except Exception as e:
            return {"error": f"Unexpected error: {str(e)}"}, 500

        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)
                



@expectations_ns.route('/suites')
@expectations_ns.doc(security='apikey')
class ExpectationSuiteList(Resource):
    @expectations_ns.expect(expectation_suite_filter_parser)
    def get(self):
        """List all expectation suites with filters"""
        args = expectation_suite_filter_parser.parse_args()

        suite_names = args['suite_name']
        file_types = args['file_types']
        categories = args['category']
        use_cases = args['use_case']
        user_ids = args['user_id']
        created_from = args['created_from']
        created_to = args['created_to']
        sort = args['sort']
        page = args['page']
        per_page = args['perPage']
        suite_ids = args.get('suite_id') or []


        query = ExpectationSuites.query

        if suite_names:
            query = query.filter(or_(*[ExpectationSuites.suite_name.ilike(f"%{v}%") for v in suite_names]))
        if file_types:
            query = query.filter(or_(*[ExpectationSuites.file_types.contains([ft]) for ft in file_types]))
        if categories:
            query = query.filter(or_(*[ExpectationSuites.category.ilike(f"%{v}%") for v in categories]))
        if use_cases:
            query = query.filter(or_(*[ExpectationSuites.use_case.ilike(f"%{v}%") for v in use_cases]))
        if user_ids:
            query = query.filter(or_(*[ExpectationSuites.user_id.ilike(f"%{v}%") for v in user_ids]))
        if suite_ids:
            query = query.filter(ExpectationSuites.suite_id.in_(suite_ids))

        if created_from:
            try:
                query = query.filter(ExpectationSuites.created >= isoparse(created_from))
            except Exception:
                return {"message": "Invalid 'created_from' format"}, 400
        if created_to:
            try:
                query = query.filter(ExpectationSuites.created <= isoparse(created_to))
            except Exception:
                return {"message": "Invalid 'created_to' format"}, 400

        # Sorting
        sort_field, sort_dir = sort.split(',')
        if hasattr(ExpectationSuites, sort_field):
            column = getattr(ExpectationSuites, sort_field)
            query = query.order_by(column.desc() if sort_dir == "desc" else column.asc())

        filtered_total = query.count()
        suites = query.offset((page - 1) * per_page).limit(per_page).all()
        total = ExpectationSuites.query.count()

        return {
            "data": [s.to_json() for s in suites],
            "total": total,
            "filtered_total": filtered_total,
            "page": page,
            "perPage": per_page,
        }



    @expectations_ns.expect(e_suite_model)
    @expectations_ns.doc(security='apikey')
    def post(self):
        """Post a new expectation suite"""

        data = request.json

        try:
            suite, file_record = save_expectation_suite(data)
        except ValueError as e:
            return {"error": str(e)}, 400

        project_id = data.get("suite_name") or "default"

        task = run_expectation_suites_task.delay(file_record.id, [suite.id])

        return {
            "message": "Suite created and validation task started.",
            "suite_id": suite.id,
            "task_id": task.id
        }, 202


@expectations_ns.route('/suites/<string:suite_id>')
@expectations_ns.doc(security='apikey')
class ExpectationSuiteDetail(Resource):
    def get(self, suite_id):
        """Get details of an expectation suite"""
        suite = ExpectationSuites.query.get_or_404(suite_id)
        return suite.to_json()   


