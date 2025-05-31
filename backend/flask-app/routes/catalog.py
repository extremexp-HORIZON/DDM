from flask_restx import Resource, Namespace
from flask import request, jsonify
from models.file import File
from utils.file_handler import apply_catalog_filters, apply_catalog_sorting
from parsers.file_catalog_filter_parser import file_catalog_filter_parser
from parsers.file_catalog_options_parser import file_options_parser

import logging
logger = logging.getLogger(__name__)

catalog_ns = Namespace(name='catalog', description='File catalog operations', path=None)


@catalog_ns.route('/list')
class FileCatalogResource(Resource):
    @catalog_ns.doc(
        description="Retrieve a paginated list of files with optional filters and sorting.",
        security='apikey',
        responses={
            200: 'Files retrieved successfully',
            400: 'Invalid request parameters',
            500: 'Internal server error'
        }
    )
    @catalog_ns.expect(file_catalog_filter_parser)
    def get(self):
        """Retrieve a paginated list of files with optional filters and sorting."""
        args = file_catalog_filter_parser.parse_args()
        logger.info(f"Received args: {args}")
        sort = args.get('sort')
        page = args.get('page')
        per_page = args.get('perPage')

        query = File.query.filter(File.recdeleted != True)
        query = apply_catalog_filters(query, args)

        filtered_total = query.count()

        query = apply_catalog_sorting(query, sort)

        total = query.count()
        start = (page - 1) * per_page
        files = query.offset(start).limit(per_page).all()

        return {
            "data": [file.to_json() for file in files],
            "total": total,
            "page": page,
            "perPage": per_page,
            "filtered_total": filtered_total
        }


@catalog_ns.route('/my-catalog')
class MyFileCatalogResource(Resource):
    @catalog_ns.doc(
        description="Retrieve the catalog of files uploaded by the current user.",
        security='apikey',
        responses={
            200: 'User files retrieved successfully',
            400: 'Invalid request parameters',
            500: 'Internal server error'
        }
    )
    @catalog_ns.expect(file_catalog_filter_parser)
    def get(self):
        """Retrieve the catalog of files uploaded by the current user."""
        args = file_catalog_filter_parser.parse_args()
        sort = args.get('sort')
        page = args.get('page')
        per_page = args.get('perPage')

        query = File.query.filter(File.recdeleted != True)
        query = apply_catalog_filters(query, args)

        filtered_total = query.count()

        query = apply_catalog_sorting(query, sort)

        total = query.count()
        start = (page - 1) * per_page
        files = query.offset(start).limit(per_page).all()

        return {
            "data": [file.to_catalog() for file in files],
            "total": total,
            "page": page,
            "perPage": per_page,
            "filtered_total": filtered_total
        }


@catalog_ns.route('/options')
class FileOptionsResource(Resource):
    @catalog_ns.doc(
        description="Retrieve file options based on project ID, filename, or user ID.",
        security='apikey',
        responses={
            200: 'Options retrieved successfully',
            400: 'Invalid query parameters',
            500: 'Internal server error'
        }
    )
    @catalog_ns.expect(file_options_parser)
    def get(self):
        """Retrieve file options based on project ID, filename, or user ID."""
        args = file_options_parser.parse_args()
        project_id = args.get("project_id")
        filename = args.get("filename")
        user_id = args.get("user_id")
        query = File.query.filter(File.recdeleted != True)
        if project_id:
            query = query.filter(File.project_id == project_id)
        if filename:
            query = query.filter(File.filename == filename)
        if user_id:
            query = query.filter(File.user_id == user_id)
        files = query.order_by(File.created.desc()).limit(100).all()
        return [
            {
                "id": f.id,
                "filename": f.filename,
                "project_id": f.project_id,
            }
            for f in files
        ]

# Advanced File Query Endpoint (in the catalog namespace)
@catalog_ns.route('/advanced')
class FileAdvancedQueryResource(Resource):
    @catalog_ns.doc(
        description="Supports complex JSON expressions for advanced file filtering.",
        security='apikey',
        responses={
            200: 'Files filtered successfully',
            400: 'Invalid JSON format',
            500: 'Internal server error'
        }
    )
    def post(self):
        """Supports complex JSON expressions for file filtering."""
        try:
            filters = request.json
        except Exception as e:
            return {'message': 'Invalid JSON format.', 'error': str(e)}, 400

        # Fetch the files using the filter function
        files = File.filter_files(filters)

        return jsonify([{
            'id': file.id,
            'filename': file.upload_filename,
            'use_case': file.use_case,
            'timestamp': file.timestamp,
            'file_metadata': file.file_metadata
        } for file in files])
