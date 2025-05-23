from flask_restx import Resource, Namespace
from flask import request, jsonify
from models.file import File
from utils.file_handler import apply_catalog_filters, apply_catalog_sorting
from parsers.file_catalog_filter_parser import file_catalog_filter_parser

catalog_ns = Namespace(name='catalog', description='File catalog operations', path=None)


@catalog_ns.route('/list')
class FileCatalogResource(Resource):
    @catalog_ns.expect(file_catalog_filter_parser)
    def get(self):
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
            "data": [file.to_json() for file in files],
            "total": total,
            "page": page,
            "perPage": per_page,
            "filtered_total": filtered_total
        }


@catalog_ns.route('/my-catalog')
class MyFileCatalogResource(Resource):
    @catalog_ns.expect(file_catalog_filter_parser)
    def get(self):
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



# Advanced File Query Endpoint (in the catalog namespace)
@catalog_ns.route('/advanced')
class FileAdvancedQueryResource(Resource):
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
