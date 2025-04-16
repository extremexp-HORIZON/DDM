from flask import request, jsonify
from flask_restx import Namespace, Resource, fields
from celery import chain
from tasks.task import build_expectations_task, build_column_descriptions_task
from utils.expectation_helpers import get_expectation_details, categorize_expectations
from utils.zenoh_file_handler import ZenohFileHandler
from models.expectations import ExpectationSuites, ExpectationSuites, ExpectationResults
from utils.file_handler import save_file_record
from utils.expectations_handler import save_expectation_suite
from datetime import datetime, timezone
import mimetypes
import os
from tasks.task import run_expectation_suites_task
from extensions.db import db

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
    'datasource_name': fields.String(required=True),
    'file_types': fields.List(fields.String, required=True, description="Allowed file types"),
    'expectations': fields.Raw(required=True),
    'category': fields.String(),
    'description': fields.String(),
    'user_id': fields.String(required=True),
    'use_case': fields.String(),
})

result_model = expectations_ns.model('ExpectationResult', {
    'user_id': fields.String(required=True),
    'suite_id': fields.String(required=True),
    'dataset_name': fields.String(required=True),
    'result_summary': fields.Raw(),
    'detailed_results': fields.Raw(),
    'path': fields.String(description="Results file path")
})


validate_files_against_suite_model = expectations_ns.model('ValidateFilesAgainstSuite', {
    'suite_id': fields.String(required=True, description="Expectation suite ID"),
    'file_ids': fields.List(fields.String, required=True, description="List of file IDs to validate")
})

validate_file_against_suites_model = expectations_ns.model('ValidateFileAgainstSuites', {
    'file_id': fields.String(required=True, description="ID of the file to validate"),
    'suite_ids': fields.List(fields.String, required=True, description="List of suite IDs to validate against")
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


                

@expectations_ns.route('/categorized-expectations')
@expectations_ns.doc(security='apikey')
class CategorizedExpectations(Resource):
    def get(self):
        """Returns all available Great Expectations validation rules categorized by data quality issues."""
        categorized = categorize_expectations()
        return jsonify(categorized)

@expectations_ns.route('/all-expectations')
@expectations_ns.doc(security='apikey')
class AllExpectations(Resource):
    def get(self):
        """Returns a list of all available Great Expectations validation rules with descriptions and arguments."""
        expectations = get_expectation_details()
        return jsonify({"all_expectations": expectations})


@expectations_ns.route('/suites')
@expectations_ns.doc(security='apikey')
class ExpectationSuiteList(Resource):
    def get(self):
        """List all expectation suites"""
        suites = ExpectationSuites.query.all()
        return jsonify([suite.to_json() for suite in suites])

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

        task = run_expectation_suites_task.delay(file_record.id, project_id, [suite.id])

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


@expectations_ns.route('/suite-tuples')
@expectations_ns.doc(security='apikey')
class SuiteTuples(Resource):
    def get(self):
        """Get tuples of (id, name, use_case) for dropdowns"""
        data = ExpectationSuites.get_all_tuples()
        return jsonify(data)


@expectations_ns.route('/results')
@expectations_ns.doc(security='apikey')
class ExpectationResultsList(Resource):
    @expectations_ns.expect(result_model)
    @expectations_ns.doc(security='apikey')
    def post(self):
        """Save the result of an expectation suite test on a dataset"""
        data = request.json
        result = ExpectationResults(**data)
        db.session.add(result)
        db.session.commit()
        return {'message': 'Result saved', 'id': result.id}, 201

    def get(self):
        """Get all expectation results (summary only)"""
        results = ExpectationResults.query.all()
        return jsonify([result.to_json() for result in results])


@expectations_ns.route('/results/<string:result_id>')
class ExpectationResultDetail(Resource):
    @expectations_ns.doc(security='apikey')
    def get(self, result_id):
        """Get a detailed result entry"""
        result = ExpectationResults.query.get_or_404(result_id)
        return result.to_json()



@expectations_ns.route('/validate/files-against-suite')
class ValidateFilesAgainstSuite(Resource):
    @expectations_ns.expect(validate_files_against_suite_model)
    @expectations_ns.doc(security='apikey')
    @expectations_ns.response(202, 'Validation tasks started')
    @expectations_ns.doc(description="Validate multiple files against a single expectation suite.")
    def post(self):
        """Validate multiple files against a single expectation suite."""
        data = request.json
        suite_id = data.get("suite_id")
        file_ids = data.get("file_ids", [])

        if not suite_id or not file_ids:
            return {"error": "Both suite_id and file_ids are required."}, 400

        tasks = []
        for file_id in file_ids:
            task = run_expectation_suites_task.delay(file_id, [suite_id])
            tasks.append({
                "file_id": file_id,
                "task_id": task.id
            })

        return {
            "message": f"Started validation for {len(file_ids)} file(s) against suite {suite_id}.",
            "tasks": tasks
        }, 202



@expectations_ns.route('/validate/file-against-suites')
class ValidateFileAgainstSuites(Resource):
    @expectations_ns.expect(validate_file_against_suites_model)
    @expectations_ns.doc(security='apikey')
    @expectations_ns.response(202, 'Validation task started')
    @expectations_ns.doc(description="Validate a single file against multiple expectation suites.")
    def post(self):
        """Validate a single file against multiple expectation suites."""
        data = request.json
        file_id = data.get("file_id")
        suite_ids = data.get("suite_ids", [])

        if not file_id or not suite_ids:
            return {"error": "Both file_id and suite_ids are required."}, 400

        task = run_expectation_suites_task.delay(file_id, suite_ids)

        return {
            "message": f"Started validation for file {file_id} against {len(suite_ids)} suite(s).",
            "task_id": task.id
        }, 202
