from flask_restx import Resource, Namespace
from flask import request, jsonify
from models.file import File
from datetime import datetime
from sqlalchemy import or_, String
from dateutil.parser import isoparse

# Create a new namespace for catalog operations
catalog_ns = Namespace(name='catalog',description='File catalog operations', path=None)

from datetime import datetime

# Simple File Listing Endpoint (in the catalog namespace)
@catalog_ns.route('/')
class FileCatalogResource(Resource):
    def get(self):
        """Endpoint for listing files with filters including size range and parent files"""
        filenames = request.args.get('filename')
        use_cases = request.args.get('use_case')
        project_ids = request.args.get('project_id')
        created_from = request.args.get('created_from')
        created_to = request.args.get('created_to')
        user_ids = request.args.get('user_id')
        file_types = request.args.get('file_type')
        parent_files = request.args.get('parent_files')
        size_from = request.args.get('size_from', type=int)
        size_to = request.args.get('size_to', type=int)
        sort = request.args.get('sort', default='id,asc')
        page = int(request.args.get('page', default=1))
        per_page = int(request.args.get('perPage', default=10))

        query = File.query
        query = query.filter(File.recdeleted != True)  # ⬅️ exclude soft-deleted files


        # 🔹 Filter by filename (matches partial names)
        if filenames:
            filenames = filenames.split(',')
            query = query.filter(or_(*[File.upload_filename.like(f"%{name}%") for name in filenames]))
        if project_ids:
            project_ids = project_ids.split(',')
            query = query.filter(or_(*[File.project_id.like(f"%{pid}%") for pid in project_ids]))

        # 🔹 Filter by use cases
        if use_cases:
            use_cases = use_cases.split(',')
            query = query.filter(or_(*[File.use_case.contains([case]) for case in use_cases]))

        # 🔹 Filter by creation date range
        if created_from:
            try:
                query = query.filter(File.created >= isoparse(created_from))
            except ValueError:
                return {'message': 'Invalid created_from datetime format'}, 400

        if created_to:
            try:
                query = query.filter(File.created <= isoparse(created_to))
            except ValueError:
                return {'message': 'Invalid created_to datetime format'}, 400

        # 🔹 Filter by user IDs
        if user_ids:
            user_ids = user_ids.split(',')
            query = query.filter(or_(*[File.user_id.like(f"%{uid}%") for uid in user_ids]))

        # 🔹 Filter by file types
        if file_types:
            file_types = file_types.split(',')
            query = query.filter(or_(*[File.file_type.like(f"%{ftype}%") for ftype in file_types]))

        # 🔹 Filter by parent files (checking if they exist in the list)
        if parent_files:
            parent_files = parent_files.split(',')
            query = query.filter(or_(*[File.parent_files.cast(String).like(f"%{pfile}%") for pfile in parent_files]))

        # 🔹 Filter by file size range
        # Convert size filters to integers if present
        if size_from is not None:
            query = query.filter(File.file_size >= int(size_from))

        if size_to is not None:
            query = query.filter(File.file_size <= int(size_to))

        # Count total after filters
        filtered_total = query.count()

        # 🔹 Sort the query
        if sort:
            sort_parts = sort.split(',')
            sort_field = sort_parts[0]
            sort_direction = sort_parts[1] if len(sort_parts) > 1 else 'asc'
            if hasattr(File, sort_field):
                col = getattr(File, sort_field)
                col = col.desc() if sort_direction == 'desc' else col
                query = query.order_by(col)
        else:
            query = query.order_by(File.created.desc())

        # 🔹 Pagination
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
class FileCatalogResource(Resource):
    def get(self):
        """Endpoint for listing files with filters including size range and parent files"""
        filenames = request.args.get('filename')
        use_cases = request.args.get('use_case')
        project_ids = request.args.get('project_id')
        created_from = request.args.get('created_from')
        created_to = request.args.get('created_to')
        user_ids = request.args.get('user_id')
        file_types = request.args.get('file_type')
        parent_files = request.args.get('parent_files')
        size_from = request.args.get('size_from', type=int)
        size_to = request.args.get('size_to', type=int)
        sort = request.args.get('sort', default='id,asc')
        page = int(request.args.get('page', default=1))
        per_page = int(request.args.get('perPage', default=10))

        # query = File.query.filter(File.user_id == request.user.id)

        query = File.query
        query = query.filter(File.recdeleted != True)  # ⬅️ exclude soft-deleted files


        # 🔹 Filter by filename (matches partial names)
        if filenames:
            filenames = filenames.split(',')
            query = query.filter(or_(*[File.upload_filename.like(f"%{name}%") for name in filenames]))
        if project_ids:
            project_ids = project_ids.split(',')
            query = query.filter(or_(*[File.project_id.like(f"%{pid}%") for pid in project_ids]))

        # 🔹 Filter by use cases
        if use_cases:
            use_cases = use_cases.split(',')
            query = query.filter(or_(*[File.use_case.contains([case]) for case in use_cases]))

        # 🔹 Filter by creation date range
        if created_from:
            query = query.filter(File.created >= datetime.fromisoformat(created_from))
        if created_to:
            query = query.filter(File.created <= datetime.fromisoformat(created_to))

        # 🔹 Filter by user IDs
        if user_ids:
            user_ids = user_ids.split(',')
            query = query.filter(or_(*[File.user_id.like(f"%{uid}%") for uid in user_ids]))

        # 🔹 Filter by file types
        if file_types:
            file_types = file_types.split(',')
            query = query.filter(or_(*[File.file_type.like(f"%{ftype}%") for ftype in file_types]))

        # 🔹 Filter by parent files (checking if they exist in the list)
        if parent_files:
            parent_files = parent_files.split(',')
            query = query.filter(or_(*[File.parent_files.cast(String).like(f"%{pfile}%") for pfile in parent_files]))

        # 🔹 Filter by file size range
        # Convert size filters to integers if present
        if size_from is not None:
            query = query.filter(File.file_size >= int(size_from))

        if size_to is not None:
            query = query.filter(File.file_size <= int(size_to))

        # Count total after filters
        filtered_total = query.count()

        # 🔹 Sort the query
        if sort:
            sort_parts = sort.split(',')
            sort_field = sort_parts[0]
            sort_direction = sort_parts[1] if len(sort_parts) > 1 else 'asc'
            if hasattr(File, sort_field):
                col = getattr(File, sort_field)
                col = col.desc() if sort_direction == 'desc' else col
                query = query.order_by(col)
        else:
            query = query.order_by(File.created.desc())

        # 🔹 Pagination
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
