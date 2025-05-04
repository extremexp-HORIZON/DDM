from flask import request
from flask_restx import Namespace, Resource, fields
from tasks.task import run_expectation_suites_task
from extensions.db import db
from parsers.expectations_parser import validation_results_filter_parser 
from dateutil.parser import isoparse
from sqlalchemy import or_
from models.expectations import ValidationResults

def split_values(value):
    return [v.strip() for v in value.split(',')] if value else []

validations_ns = Namespace('validations', description='Operations related to validations.')

result_model = validations_ns.model('ValidationResult', {
    'user_id': fields.String(required=True),
    'suite_id': fields.String(required=True),
    'suite_name': fields.String(required=False),
    'dataset_name': fields.String(required=True),
    'result_summary': fields.Raw(),
    'detailed_results': fields.Raw(),
    'path': fields.String(description="Results file path")
})


validate_files_against_suite_model = validations_ns.model('ValidateFilesAgainstSuite', {
    'suite_id': fields.String(required=True, description="Expectation suite ID"),
    'file_ids': fields.List(fields.String, required=True, description="List of file IDs to validate")
})

validate_file_against_suites_model = validations_ns.model('ValidateFileAgainstSuites', {
    'file_id': fields.String(required=True, description="ID of the file to validate"),
    'suite_ids': fields.List(fields.String, required=True, description="List of suite IDs to validate against")
})




@validations_ns.route('/results')
@validations_ns.doc(security='apikey')
class ValidationResultsList(Resource):
    @validations_ns.expect(result_model)
    @validations_ns.doc(security='apikey')
    def post(self):
        """Save the result of an expectation suite validation on a dataset"""
        data = request.json
        result = ValidationResults(**data)
        db.session.add(result)
        db.session.commit()
        return {'message': 'Result saved', 'id': result.id}, 201

    
    @validations_ns.doc(security='apikey')
    @validations_ns.expect(validation_results_filter_parser)
    def get(self):
        """Get all validation results with filters"""
        args = validation_results_filter_parser.parse_args()

        dataset_names = args.get('dataset_name') or []
        dataset_ids = args.get('dataset_id') or []
        user_ids = args.get('user_id') or []
        suite_ids = args.get('suite_id') or []
        run_from = args.get('run_time_from')
        run_to = args.get('run_time_to')
        sort = args.get('sort', 'run_time,desc')
        page = args.get('page', 1)
        per_page = args.get('perPage', 10)

        query = ValidationResults.query

        if dataset_names:
            query = query.filter(or_(*[ValidationResults.dataset_name.ilike(f"%{v}%") for v in dataset_names]))
        if user_ids:
            query = query.filter(or_(*[ValidationResults.user_id.ilike(f"%{v}%") for v in user_ids]))
        if suite_ids:
            query = query.filter(ValidationResults.suite_id.in_(suite_ids))
        if dataset_ids:
            query = query.filter(ValidationResults.dataset_id.in_(dataset_ids))
        if run_from:
            try:
                query = query.filter(ValidationResults.run_time >= isoparse(run_from))
            except Exception:
                return {"message": "Invalid 'run_time_from' format"}, 400
        if run_to:
            try:
                query = query.filter(ValidationResults.run_time <= isoparse(run_to))
            except Exception:
                return {"message": "Invalid 'run_time_to' format"}, 400

        # Sorting
        try:
            sort_field, sort_dir = sort.split(',')
            if hasattr(ValidationResults, sort_field):
                column = getattr(ValidationResults, sort_field)
                query = query.order_by(column.desc() if sort_dir == "desc" else column.asc())
        except ValueError:
            return {"message": "Invalid sort format. Use 'field,asc|desc'"}, 400

        filtered_total = query.count()
        results = query.offset((page - 1) * per_page).limit(per_page).all()
        total = ValidationResults.query.count()

        return {
            "data": [r.to_json() for r in results],
            "total": total,
            "filtered_total": filtered_total,
            "page": page,
            "perPage": per_page,
        }



@validations_ns.route('/results/<string:result_id>')
class ExpectationResultDetail(Resource):
    @validations_ns.doc(security='apikey')
    def get(self, result_id):
        """Get a detailed result entry"""
        result = ValidationResults.query.get_or_404(result_id)
        return result.to_json()



@validations_ns.route('/validate/files-against-suite')
class ValidateFilesAgainstSuite(Resource):
    @validations_ns.expect(validate_files_against_suite_model)
    @validations_ns.doc(security='apikey')
    @validations_ns.response(202, 'Validation tasks started')
    @validations_ns.doc(description="Validate multiple files against a single expectation suite.")
    def post(self):
        """Validate multiple files against a single expectation suite."""
        data = request.json
        suite_id = data.get("suite_id")
        file_ids = data.get("file_ids", [])

        if not suite_id or not file_ids:
            return {"error": "Both suite_id and file_ids are required."}, 400

        tasks = []
        already_validated = []

        for file_id in file_ids:
            existing = ValidationResults.query.filter_by(dataset_id=file_id).first()
            if existing:
                already_validated.append(file_id)
            else:
                task = run_expectation_suites_task.delay(file_id, [suite_id])
                tasks.append({
                    "file_id": file_id,
                    "task_id": task.id
                })

        if already_validated:
            return {
                "error": "Some files already have validation results.",
                "already_validated_file_ids": already_validated
            }, 409  # Conflict

        return {
            "message": f"Started validation for {len(tasks)} file(s) against suite {suite_id}.",
            "tasks": tasks
        }, 202



@validations_ns.route('/validate/file-against-suites')
class ValidateFileAgainstSuites(Resource):
    @validations_ns.expect(validate_file_against_suites_model)
    @validations_ns.doc(security='apikey')
    @validations_ns.response(202, 'Validation task started')
    @validations_ns.doc(description="Validate a single file against multiple expectation suites.")
    def post(self):
        """Validate a single file against multiple expectation suites."""
        data = request.json
        file_id = data.get("file_id")
        suite_ids = data.get("suite_ids", [])

        if not file_id or not suite_ids:
            return {"error": "Both file_id and suite_ids are required."}, 400

        # 🛡️ Check if ValidationResults already exist
        existing = ValidationResults.query.filter_by(dataset_id=file_id).first()
        if existing:
            return {"error": "Validation results already exist for this file."}, 409  

        # ✅ No results yet — proceed with task
        task = run_expectation_suites_task.delay(file_id, suite_ids)

        return {
            "message": f"Started validation for file {file_id} against {len(suite_ids)} suite(s).",
            "task_id": task.id
        }, 202
