from flask import request
from flask_restx import Namespace, Resource, fields
from tasks.task import run_expectation_suites_task
from extensions.db import db
from parsers.expectations_parser import validation_results_filter_parser 
from dateutil.parser import isoparse
from sqlalchemy import or_
from models.expectations import ValidationResults
from auth.auth import get_current_username
from utils.file_handler import get_file_records_by_ids, get_file_record

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
@validations_ns.doc(security='oauth2')
class ValidationResultsList(Resource):
    @validations_ns.expect(result_model)
    @validations_ns.doc(security='oauth2')
    def post(self):
        """Save the result of an expectation suite validation on a dataset"""
        data = request.json
        result = ValidationResults(**data)
        db.session.add(result)
        db.session.commit()
        return {'message': 'Result saved', 'id': result.id}, 201

    @validations_ns.doc(security='oauth2')
    @validations_ns.expect(validation_results_filter_parser)
    def get(self):
        """Get all validation results with filters"""
        username=get_current_username()
        args = validation_results_filter_parser.parse_args()

        dataset_names = args.get('dataset_name')
        if dataset_names and not isinstance(dataset_names, list):
            dataset_names = [dataset_names]
        else:
            dataset_names = dataset_names or []

        dataset_ids = args.get('dataset_id')
        if dataset_ids and not isinstance(dataset_ids, list):
            dataset_ids = [dataset_ids]
        else:
            dataset_ids = dataset_ids or []

        user_ids = args.get('user_id')
        if user_ids and not isinstance(user_ids, list):
            user_ids = [user_ids]
        else:
            user_ids = user_ids or []

        suite_ids = args.get('suite_id')
        if suite_ids and not isinstance(suite_ids, list):
            suite_ids = [suite_ids]
        else:
            suite_ids = suite_ids or []

        run_from = args.get('run_time_from')
        run_to = args.get('run_time_to')
        sort = args.get('sort', 'run_time,desc')
        page = args.get('page', 1)
        per_page = args.get('perPage', 10)

        query = ValidationResults.query.filter(ValidationResults.user_id==username)
        if dataset_names:
            query = query.filter(or_(*[ValidationResults.dataset_name.ilike(f"%{v}%") for v in dataset_names]))
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
        total = ValidationResults.query.filter(ValidationResults.user_id == username).count()


        return {
            "data": [r.to_json() for r in results],
            "total": total,
            "filtered_total": filtered_total,
            "page": page,
            "perPage": per_page,
        }




@validations_ns.route('/results/<string:result_id>')
class ExpectationResultDetail(Resource):
    @validations_ns.doc(security='oauth2')
    def get(self, result_id):
        """Get a detailed result entry"""
        username=get_current_username()
        result = ValidationResults.query.get_or_404(result_id)
        if not result.user_id==username:
            return{"message": "You are not authorized to view this result."}, 403
        return result.to_json()


@validations_ns.route('/validate/files-against-suite')
class ValidateFilesAgainstSuite(Resource):
    @validations_ns.expect(validate_files_against_suite_model)
    @validations_ns.doc(security='oauth2')
    @validations_ns.response(202, 'Validation tasks started')
    @validations_ns.doc(description="Validate multiple files against a single expectation suite.")
    def post(self):
        """Validate multiple files against a single expectation suite."""
        username = get_current_username()

        data = request.get_json(silent=True) or {}
        suite_id = data.get("suite_id")
        file_ids = data.get("file_ids", [])

        if not suite_id or not file_ids:
            return {"error": "Both suite_id and file_ids are required."}, 400

        files, err = get_file_records_by_ids(file_ids)  # if your helper returns (files, err)
        if err:
            return {"message": err}, 404

        if not files:
            return {"message": "No files found for the given IDs"}, 404

        allowed = [f for f in files if getattr(f, "user_id", None) == username]
        denied = [f.id for f in files if getattr(f, "user_id", None) != username]

        if denied:
            return {
                "message": "You are not authorized to validate one or more files.",
                "denied_file_ids": denied
            }, 403

        allowed_ids = [f.id for f in allowed]

        tasks = []
        already_validated = []

        for file_id in allowed_ids:
            # ✅ IMPORTANT: scope "already validated" to THIS user + THIS suite
            existing = (
                ValidationResults.query
                .filter_by(dataset_id=file_id, suite_id=suite_id, user_id=username)
                .first()
            )

            if existing:
                already_validated.append(file_id)
                continue

            task = run_expectation_suites_task.delay(file_id, [suite_id], username)
            tasks.append({"file_id": file_id, "task_id": task.id})

        if already_validated and not tasks:
            return {
                "message": "All requested files already have validation results for this suite.",
                "already_validated_file_ids": already_validated
            }, 409

        return {
            "message": f"Started validation for {len(tasks)} file(s) against suite {suite_id}.",
            "tasks": tasks,
            "already_validated_file_ids": already_validated
        }, 202


@validations_ns.route('/validate/file-against-suites')
class ValidateFileAgainstSuites(Resource):
    @validations_ns.expect(validate_file_against_suites_model)
    @validations_ns.doc(security='oauth2')
    @validations_ns.response(202, 'Validation task started')
    @validations_ns.doc(description="Validate a single file against multiple expectation suites.")
    def post(self):
        username = get_current_username()
        data = request.get_json(silent=True) or {}

        file_id = data.get("file_id")
        suite_ids = data.get("suite_ids", [])

        if not file_id or not suite_ids:
            return {"error": "Both file_id and suite_ids are required."}, 400

        # ✅ Load file + ownership check
        file = get_file_record(file_id)
        if not file:
            return {"message": "File not found"}, 404

        if file.user_id != username:
            return {"message": "You are not authorized to validate this file."}, 403

        # ✅ Check existing results (recommended: user-scoped)
        existing_results = (
            ValidationResults.query
            .filter(
                ValidationResults.dataset_id == file_id,
                ValidationResults.suite_id.in_(suite_ids),
                ValidationResults.user_id == username,   # <-- important
            )
            .all()
        )

        if existing_results:
            existing_suite_ids = [res.suite_id for res in existing_results]
            return {
                "error": "Validation results already exist for some suites (for this user).",
                "existing_suite_ids": existing_suite_ids
            }, 409

        # ✅ Proceed
        task = run_expectation_suites_task.delay(file_id, suite_ids, username)

        return {
            "message": f"Started validation for file {file_id} against {len(suite_ids)} suite(s).",
            "task_id": task.id
        }, 202
