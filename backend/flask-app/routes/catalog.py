from flask_restx import Resource, Namespace
from flask import request, jsonify
from models.file import File
from extensions import db
from utils.file_handler import apply_catalog_filters, apply_catalog_sorting
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
    @catalog_ns.expect(tree_query_parser)
    def get(self):
        """Lazy-load tree data: paginated, filterable, sortable."""
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

        if not parent:
            subfolder_query = (
                File.query
                .with_entities(File.project_id)
                .filter(File.project_id.isnot(None))
                .filter(~File.project_id.contains("/"))
                .filter(File.recdeleted != True)
                .distinct()
            )

            # Apply filtering to folders
            if name_filter or filter_text:
                keyword = f"%{name_filter or filter_text}%"
                matching_projects = (
                    File.query
                    .filter(File.recdeleted != True)
                    .filter(File.filename.ilike(keyword))
                    .with_entities(File.project_id)
                    .all()
                )
                # Extract top-level folders
                top_folders = set(p[0].split("/")[0] for p in matching_projects if p[0])
                if not top_folders:
                    return {"nodes": [], "totalRecords": 0}

                subfolder_query = subfolder_query.filter(File.project_id.in_(top_folders))

            # Apply sorting
            if sort:
                sort_field, direction = sort.split(",")
                reverse = direction == "desc"

                if sort_field == "name":
                    nodes.sort(key=lambda n: n["data"]["name"].lower(), reverse=reverse)
                elif sort_field == "size":
                    nodes.sort(key=lambda n: n["data"]["size"], reverse=reverse)

            total = len(nodes)
            paginated_folders = subfolder_query.offset(page * perPage).limit(perPage).all()

            nodes = []
            for (folder,) in paginated_folders:
                folder_size = (
                    File.query
                    .filter(File.project_id == folder)  # direct files
                    .filter(File.recdeleted != True)
                    .with_entities(func.sum(File.file_size))
                )

                nested_size = (
                    File.query
                    .filter(File.project_id.startswith(folder + "/"))  # nested files
                    .filter(File.recdeleted != True)
                    .with_entities(func.sum(File.file_size))
                )

                total_folder_size = (folder_size.scalar() or 0) + (nested_size.scalar() or 0)


                nodes.append({
                    "key": f"folder-{folder}",
                    "data": {
                        "name": folder,
                        "path": folder,
                        "type": "folder",
                        "size": total_folder_size or 0
                    },
                    "leaf": False
                })
                
            if sort:
                sort_field, direction = sort.split(",")
                reverse = direction == "desc"

                if sort_field == "name":
                    nodes.sort(key=lambda n: n["data"]["name"].lower(), reverse=reverse)
                elif sort_field == "size":
                    nodes.sort(key=lambda n: n["data"]["size"], reverse=reverse)
            
            total = subfolder_query.count()
            paginated_folders = subfolder_query.offset(page * perPage).limit(perPage).all()

            return {
                "nodes": nodes,
                "totalRecords": total
            }


        # Sub-level: get folder contents
        folder_path = parent.replace("folder-", "")
        folder_prefix = folder_path + '/'

        # Subfolders
        subfolder_query = (
            File.query
            .with_entities(File.project_id)
            .filter(File.project_id.startswith(folder_prefix))
            .filter(File.recdeleted != True)
            .filter(File.project_id != folder_path)  # prevent self
            .distinct()
        )

        # Filter subfolders (based on immediate child name)
        if name_filter or filter_text:
            subfolder_query = subfolder_query.filter(File.project_id.ilike(f"%{name_filter or filter_text}%"))

        # Sort
        if sort and sort.startswith("name"):
            direction = sort.split(",")[1]
            subfolder_query = subfolder_query.order_by(File.project_id.desc() if direction == "desc" else File.project_id.asc())

        subfolders_all = subfolder_query.all()

        seen = set()
        for (subfolder,) in subfolder_query:
            remainder = subfolder.replace(folder_prefix, "")
            if "/" not in remainder:
                continue  # skip flat files
            relative = remainder.split("/")[0]
            full_path = folder_prefix + relative
            if full_path in seen:
                continue
            seen.add(full_path)

            if filter_text and filter_text not in relative.lower():
                continue

            # ✅ Correct folder size (direct + nested)
            direct_size = (
                File.query
                .filter(File.project_id == full_path)
                .filter(File.recdeleted != True)
                .with_entities(func.sum(File.file_size))
                .scalar()
            )
            nested_size = (
                File.query
                .filter(File.project_id.startswith(full_path + "/"))
                .filter(File.recdeleted != True)
                .with_entities(func.sum(File.file_size))
                .scalar()
            )
            folder_size = (direct_size or 0) + (nested_size or 0)

            nodes.append({
                "key": f"folder-{full_path}",
                "data": {
                    "name": relative,
                    "path": full_path,
                    "type": "folder",
                    "size": folder_size
                },
                "leaf": False
            })

        # Files
        file_query = base_query.filter(File.project_id == folder_path)

        if filter_text:
            file_query = file_query.filter(File.filename.ilike(f"%{filter_text}%"))
        if name_filter:
            file_query = file_query.filter(File.filename.ilike(f"%{name_filter}%"))
        if size_filter:
            file_query = file_query.filter(File.file_size == size_filter)
        if type_filter:
            file_query = file_query.filter(File.extension.ilike(f"%{type_filter}%"))

        if sort:
            sort_field, direction = sort.split(',')
            sort_col = getattr(File, sort_field, File.created)
            file_query = file_query.order_by(sort_col.desc() if direction == "desc" else sort_col.asc())
        else:
            file_query = file_query.order_by(File.created.desc())

        total_files = file_query.count()
        files = file_query.offset(page * perPage).limit(perPage).all()

        for f in files:
            nodes.append({
                "key": f"file-{f.id}",
                "data": {
                    "id": f.id,
                    "name": f.filename,
                    "path": f.project_id,
                    "size": getattr(f, "file_size", "Unknown"),
                    "type": getattr(f, "extension", "file")
                },
                "leaf": True
            })

        return {
            "nodes": nodes,
            "totalRecords": total_files + len(subfolders_all)
        }


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
