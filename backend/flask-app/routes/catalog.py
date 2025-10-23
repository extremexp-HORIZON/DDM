from flask_restx import Resource, Namespace
from flask import request, jsonify
from models.file import File
from extensions import db
from utils.file_handler import apply_catalog_filters, apply_catalog_sorting
from utils.advanced_filtering import filter_files
from parsers.file_catalog_filter_parser import file_catalog_filter_parser
from parsers.file_catalog_options_parser import file_options_parser
from parsers.file_catalog_tree import tree_query_parser
from auth.auth import get_current_username
from sqlalchemy import func, String
from sqlalchemy import func

catalog_ns = Namespace(name='catalog', description='File catalog operations', path=None)


@catalog_ns.route('/list')
class FileCatalogResource(Resource):
    @catalog_ns.doc(
        description="Retrieve a paginated list of files with optional filters and sorting.",
        security='oauth2',
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
        security='oauth2',
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
    
        query = File.query.filter(File.recdeleted != True, File.user_id == get_current_username())
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
        security='oauth2',
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
    

@catalog_ns.route('/tree')
class FileTreeResource(Resource):
    @catalog_ns.doc(
        description="Lazy-load tree data: paginated, filterable, sortable..",
        security='oauth2',
        responses={
            200: 'Files loaded successfully',
            400: 'Invalid JSON format',
            500: 'Internal server error'
        }
    )
    @catalog_ns.expect(tree_query_parser)
    def get(self):
        args = tree_query_parser.parse_args()
        parent = args.get("parent", "")
        page = args.get("page", 0)
        perPage = args.get("perPage", 10)
        sort = args.get("sort")
        filter_text = (args.get("filter") or "").strip().lower()
        name_filter = args.get("name")
        size_filter = args.get("size")
        type_filter = args.get("type")

        base_query = File.query.filter(File.recdeleted != True)
        nodes = []

        def apply_sorting(queryset, field, direction):
            if field == "name":
                return sorted(queryset, key=lambda n: n["data"]["name"].lower(), reverse=(direction == "desc"))
            if field == "size":
                return sorted(queryset, key=lambda n: n["data"].get("size", 0), reverse=(direction == "desc"))
            return queryset

        if not parent:
            subfolder_query = (
                File.query
                .with_entities(File.project_id)
                .filter(File.project_id.isnot(None))
                .filter(File.recdeleted != True)
                .distinct()
            )

            all_projects = [p[0] for p in subfolder_query if p[0]]
            top_folders = {p.split("/")[0] for p in all_projects}

            if name_filter or filter_text:
                keyword = f"%{name_filter or filter_text}%"
                matching = (
                    File.query
                    .filter(File.recdeleted != True)
                    .filter(File.filename.ilike(keyword))
                    .with_entities(File.project_id)
                    .all()
                )
                matched_folders = {p[0].split("/")[0] for p in matching if p[0]}
                top_folders &= matched_folders

            top_folders = sorted(top_folders)
            paginated = top_folders[page * perPage:(page + 1) * perPage]

            for folder in paginated:
                direct = File.query.filter(File.project_id == folder, File.recdeleted != True).with_entities(func.sum(File.file_size)).scalar() or 0
                nested = File.query.filter(File.project_id.startswith(folder + "/"), File.recdeleted != True).with_entities(func.sum(File.file_size)).scalar() or 0
                nodes.append({
                    "key": f"folder-{folder}",
                    "data": {
                        "name": folder,
                        "path": folder,
                        "type": "folder",
                        "size": direct + nested
                    },
                    "leaf": False
                })

            if sort:
                field, direction = sort.split(',')
                nodes = apply_sorting(nodes, field, direction)

            return {"nodes": nodes, "totalRecords": len(top_folders)}

        folder_path = parent.replace("folder-", "")
        folder_prefix = folder_path + '/' if not folder_path.endswith('/') else folder_path

        subfolders_query = (
            File.query
            .with_entities(File.project_id)
            .filter(File.project_id.startswith(folder_prefix), File.project_id != folder_path, File.recdeleted != True)
            .distinct()
        )

        seen = set()
        for (proj,) in subfolders_query:
            if not proj or not proj.startswith(folder_prefix):
                continue
            remainder = proj[len(folder_prefix):]
            name = remainder.split("/")[0]
            path = folder_prefix + name
            if path not in seen:
                seen.add(path)
                direct = File.query.filter(File.project_id == path, File.recdeleted != True).with_entities(func.sum(File.file_size)).scalar() or 0
                nested = File.query.filter(File.project_id.startswith(path + "/"), File.recdeleted != True).with_entities(func.sum(File.file_size)).scalar() or 0
                nodes.append({
                    "key": f"folder-{path}",
                    "data": {"name": name, "path": path, "type": "folder", "size": direct + nested},
                    "leaf": False
                })

        file_query = base_query.filter(File.project_id == folder_path)
        if filter_text:
            file_query = file_query.filter(File.filename.ilike(f"%{filter_text}%"))
        if name_filter:
            file_query = file_query.filter(File.filename.ilike(f"%{name_filter}%"))
        if size_filter:
            file_query = file_query.filter(File.file_size == size_filter)
        if type_filter:
            file_query = file_query.filter(File.file_type.ilike(f"%{type_filter}%"))

        if sort:
            sort_field, direction = sort.split(',')
            sort_col = getattr(File, sort_field, File.created)
            file_query = file_query.order_by(sort_col.desc() if direction == "desc" else sort_col.asc())
        else:
            file_query = file_query.order_by(File.created.desc())

        files = file_query.offset(page * perPage).limit(perPage).all()
        for f in files:
            nodes.append({
                "key": f"file-{f.id}",
                "data": {
                    "id": f.id,
                    "name": f.filename,
                    "path": f.project_id,
                    "size": f.file_size,
                    "type": f.file_type or "file"
                },
                "leaf": True
            })

        return {"nodes": nodes, "totalRecords": file_query.count() + len(seen)}


# Advanced File Query Endpoint (in the catalog namespace)
@catalog_ns.route('/advanced')
class FileAdvancedQueryResource(Resource):
    @catalog_ns.doc(
        description="Supports complex JSON expressions for advanced file filtering.",
        security='oauth2',
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
            query = filter_files(filters)
            files = query.all()
        except Exception as e:
            return {'message': 'Invalid query', 'error': str(e)}, 400


        return jsonify([{
            'id': file.id,
            'filename': file.upload_filename,
            'use_case': file.use_case,
            'created': file.created,
            'file_metadata': file.file_metadata
        } for file in files])
