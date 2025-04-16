from flask import request, send_file
from flask_restx import Resource, Namespace, fields
from celery import chain
from tasks.task import process_large_file,fetch_file_from_link
from swagger_models.files_upload import get_upload_file_urls_response_model, get_upload_file_urls_model
from swagger_models.files_update import get_files_update_model, get_files_update_response_model
from parsers.files_parser import upload_parser
from utils.zenoh_file_handler import ZenohFileHandler
from utils.file_helpers import calculate_file_hash,delete_files_by_ids
from utils.file_handler import save_file_record,secure_filename,update_file_record_in_db,save_file_record, update_file_record_in_db, get_file_records_by_ids,update_multiple_file_records,secure_filename
import logging
from datetime import datetime
import json
import zipfile
import os


#Logging
logger = logging.getLogger(__name__)

# Create a namespace for file operations
files_ns = Namespace('files',path='/files', description='Multiple File-related operations')


upload_file_urls_model = get_upload_file_urls_model(files_ns)
upload_file_urls_response_model = get_upload_file_urls_response_model(files_ns)
files_update_model = get_files_update_model(files_ns)
files_update_response_model = get_files_update_response_model(files_ns)



@files_ns.route('/upload')  # Endpoint for multiple file uploads
class MultipleFileUploadResource(Resource):
    @files_ns.expect(upload_parser)
    @files_ns.doc(
        description="Upload many files withe their metadata.",
        security='apikey')
    def post(self):
        """Upload multiple files with metadata, store in Zenoh, and start processing tasks."""
        current_user_id = 'current_user_id_placeholder'  # Replace with actual JWT identity
        # Parse request data
        args = upload_parser.parse_args()
        files = args['files']
        metadata_files = args.get('metadata-files')
        project_id = args.get('project_id')
        user_filenames = args.get('user_filenames') or []
        descriptions = args.get('descriptions') or []
        use_cases = args.get('use_case') or []
        if not files:
            return {'message': 'No files uploaded.'}, 400
        if not project_id:
            return {'message': 'Project ID is required.'}, 400

        uploaded_files = []
        parsed_metadata = []

        # ✅ Handle metadata files (optional)
        if metadata_files:
            for metadata_file in metadata_files:
                try:
                    metadata_content = metadata_file.read()
                    parsed_metadata.append(json.loads(metadata_content))
                except Exception as e:
                    logger.error(f"❌ Failed to parse metadata file: {str(e)}")
                    return {'message': 'Invalid metadata file format.'}, 400

        # ✅ Process each file
        for i, file in enumerate(files):
            filename = secure_filename(file.filename)
            file_parts = filename.rsplit('.', 1)
            file_extension = file_parts[1] if len(file_parts) > 1 else ''

            # Use user-provided filename if available
            upload_filename = user_filenames[i] if i < len(user_filenames) and user_filenames[i] else file_parts[0]
            description = descriptions[i] if i < len(descriptions) and descriptions[i] else ""

            # Convert JSON strings to lists if provided
            try:
                use_case = json.loads(use_cases[i]) if i < len(use_cases) and use_cases[i] else []
            except json.JSONDecodeError:
                return {'message': 'Invalid JSON format for use_case'}, 400

            # ✅ Create a new file record in DB
            try:
                file_data = {
                    "filename": "",
                    "upload_filename": upload_filename,
                    "description": description,
                    "path": "",
                    "user_id": current_user_id,
                    "project_id": project_id,
                    "file_metadata": {},
                    "nft_metadata": {},
                    "use_case": use_case,
                    "file_type": file_extension
                }
                new_file = save_file_record(file_data)
                file_id = new_file.id
                final_filename = f"{file_id}.{file_extension}"
                zenoh_file_path = f"projects/{project_id}/files/{file_id}/{final_filename}"

                # ✅ Read file content
                file_content = file.read()
                file_size = len(file_content)

                # Calculate file hash
                file_hash = calculate_file_hash(file_content)

                # ✅ Store File in Zenoh
                success1 = ZenohFileHandler.put_file(zenoh_file_path, file_content)
                if not success1:
                    raise Exception("Failed to store file in Zenoh.")
                logger.info(f"✅ File stored in Zenoh: {zenoh_file_path}")

                # ✅ Store Metadata in Zenoh
                metadata = parsed_metadata[i] if i < len(parsed_metadata) else {}
                zenoh_metadata_path = f"projects/{project_id}/files/{file_id}/user_metadata.json"
                success2 = ZenohFileHandler.put_file(zenoh_metadata_path, json.dumps(metadata).encode('utf-8'))
                if not success2:
                    raise Exception("Failed to store metadata in Zenoh.")
                logger.info(f"✅ Metadata stored in Zenoh: {zenoh_metadata_path}")

                try:
                    # ✅ Update DB record
                    update_file_record_in_db(
                        file_id=file_id,
                        path=zenoh_file_path,
                        file_size=file_size,
                        file_hash=file_hash,
                        uploader_metadata=metadata
                    )
                except Exception as e:
                    logger.error(f"❌ Error updating file record: {str(e)}")
                    return {'message': 'Failed to update file record.'}, 500

                # ✅ Start Metadata Processing Task
                metadata_task = process_large_file.delay(file_id)
                metadata_task_id = metadata_task.id

                uploaded_files.append({
                    **new_file.to_json(),
                    "metadata_task_id": metadata_task_id  # ✅ Include task ID for polling
                })

            except Exception as e:
                logger.error(f"❌ Error updating file record: {str(e)}")
                return {'message': 'Failed to update file record.'}, 500

        return {'message': f'{len(files)} file(s) uploaded successfully!', 'files': uploaded_files}, 200



@files_ns.route('/download')
class MultipleFileDownloadResource(Resource):
    @files_ns.expect(files_ns.model('DownloadFileIds', {
        'file_ids': fields.List(fields.String, required=True, description='List of file IDs to download')
    }))
    @files_ns.doc(
        description='Download multiple files by their IDs from Zenoh Storage',
        security='apikey',
        responses={
            200: 'Files downloaded successfully as a ZIP archive',
            400: 'No file IDs provided.',
            404: 'One or more files not found in Zenoh.',
            500: 'Failed to create ZIP file.'
        }
    )
    def post(self):
        """Download multiple files as a ZIP archive (Fetched from Zenoh)."""
        data = request.json
        file_ids = data.get('file_ids')

        file_ids = data.get('file_ids')
        files, error = get_file_records_by_ids(file_ids)

        if error:
            return {'message': error}, 404

        # ✅ Generate a temporary ZIP file path
        zip_filename = f"files_{datetime.now().strftime('%Y%m%d%H%M%S')}.zip"
        zip_temp_path = os.path.join("/tmp", zip_filename) 

        try:
            with zipfile.ZipFile(zip_temp_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                for file in files:
                    file_path = file.path  # Zenoh key
                    file_content = ZenohFileHandler.get_file(file_path)  # 🔥 Fetch from Zenoh
                    
                    if file_content is None:
                        logger.error(f"❌ File not found in Zenoh: {file_path}")
                        continue  # Skip missing files instead of failing

                    # ✅ Convert to in-memory file and add to ZIP
                    with zipf.open(os.path.basename(file_path), 'w') as f:
                        f.write(file_content.read())  # Write binary data to ZIP

            # ✅ Return the ZIP file for download
            return send_file(zip_temp_path, as_attachment=True, download_name=zip_filename, mimetype="application/zip")

        except Exception as e:
            logger.error(f"❌ Failed to create ZIP file: {str(e)}")
            return {'message': 'Failed to download files.'}, 500



@files_ns.route('/update')
class MultipleFilesUpdateResource(Resource):
    @files_ns.doc(
        description="Update multiple files project_id, description, use_case, filename at once",
        security='apikey',
        responses={
            200: ("Files updated successfully", files_update_response_model),
            400: "Invalid request (Missing file list)",
            404: "One or more files not found",
            500: "Server error",
        },
    )
    @files_ns.expect(files_update_model)  # ✅ Expect bulk update format
    @files_ns.marshal_with(files_update_response_model, code=200, mask=False)
    def patch(self):
        """Update multiple files"""
        data = request.json
        files_to_update = data.get("files", [])

        if not files_to_update:
            return {"message": "files array is required!"}, 400

        updated_files, errors = update_multiple_file_records(files_to_update)

        if updated_files is None:
            return {"message": "Database update failed", "errors": errors}, 500

        return {
            "message": f"{len(updated_files)} file(s) updated successfully.",
            "updated_files": updated_files,
            "errors": errors if errors else None
        }, 200


@files_ns.route('/delete')  # Endpoint to delete multiple files by IDs
class MultipleFileDeleteResource(Resource):
    @files_ns.expect(files_ns.model('DeleteFileIds', {
        'file_ids': fields.List(fields.String, required=True, description='List of file IDs to delete')
    }))
    @files_ns.doc(
        description='Delete multiple files by their IDs',
        security='apikey',
        responses={
            200: 'Files deleted successfully',
            404: 'One or more files not found',
            500: 'Failed to delete files'
        }
    )
    def delete(self):
        """Delete multiple files with Zenoh cleanup and metadata handling."""
        data = request.json
        file_ids = data.get('file_ids')
        if not file_ids:
            return {'message': 'No file IDs provided.'}, 400
        deleted_count, error = delete_files_by_ids(file_ids)
        if error:
            return {'message': error}, 404 if "not found" in error else 500
        return {'message': f'{deleted_count} file(s) deleted successfully.'}, 200


@files_ns.route("/upload-links")
class UploadFilesFromLinks(Resource):
    @files_ns.doc(
        description="Retrieve multiple files from given links and begin processing.",
        security='apikey',
        responses={
            200: ("Files retrieved successfully", get_upload_file_urls_response_model(files_ns)),
            400: "Invalid request (files array and project_id are required)",
            500: "Server error",
        },
    )
    @files_ns.expect(get_upload_file_urls_model(files_ns))  # ✅ Expect multiple files
    @files_ns.marshal_with(get_upload_file_urls_response_model(files_ns), code=202, mask=False)
    def post(self):
        """Retrieve multiple files from URLs and start Celery processing"""
        current_user_id = 'current_user_id_placeholder'
        data = request.json
        project_id = data.get("project_id")
        files = data.get("files", [])  # ✅ Expect `files` list, not `file_urls`

        if not files or not project_id:
            return {"message": "files array and project_id are required!"}, 400

        response_data = []

        try:
            for file_info in files:
                file_url = file_info.get("file_url")
                description = file_info.get("description", "")
                use_cases = file_info.get("use_cases", [])
                metadata = file_info.get("metadata", {})

                if not file_url:
                    continue  # Skip invalid entries

                # 🔥 Secure filename from URL
                filename = secure_filename(file_url.split("/")[-1])
                file_extension = filename.rsplit(".", 1)[-1] if "." in filename else "csv"

                # 🔥 Create File Entry in DB with `file_url` inside `parent_files`

                file_data = {
                    "filename": "",
                    "upload_filename": secure_filename(filename),
                    "description": description,
                    "path": "",
                    "user_id": current_user_id,
                    "project_id": project_id,
                    "file_metadata": metadata,
                    "nft_metadata": {},
                    "use_case": use_cases,
                    "parent_files" : {"external": file_url},
                    "file_type": file_extension
                }
                new_file = save_file_record(file_data)
                file_id = new_file.id

                # ✅ Generate Correct Zenoh Storage Path
                final_filename = f"{file_id}.{file_extension}"
                zenoh_file_path = f"projects/{project_id}/files/{file_id}/{final_filename}"
                if metadata:
                    zenoh_metadata_path = f"projects/{project_id}/files/{file_id}/user_metadata.json"
                    success = ZenohFileHandler.put_file(zenoh_metadata_path, json.dumps(metadata).encode('utf-8'))
                    if not success:
                        raise Exception("Failed to store metadata in Zenoh.")

                # 🔥 Start Celery Chain:
                task_chain = chain(
                    fetch_file_from_link.s(file_url, file_id, zenoh_file_path),
                    process_large_file.s()
                ).apply_async()

                response_data.append({
                    "message": "File retrieval started!",
                    "file_id": file_id,
                    "zenoh_file_path": zenoh_file_path,
                    "fetch_task_id": task_chain.parent.id if task_chain.parent else None,
                    "process_task_id": task_chain.id if task_chain else None,
                    "file_url": file_url
                })

            return {"message": "File retrieval started!", "files": response_data}, 202

        except Exception as e:
            logger.error(f"Unexpected error: {str(e)}")
            return {"message": "Internal server error!"}, 500

