from flask import request, send_file
from flask_restx import Resource, Namespace
from celery import chain 
from tasks.task import process_large_file,merge_chunks_task,fetch_file_from_link
from utils.file_helpers import process_metadata,calculate_file_hash,delete_file_record
from utils.zenoh_file_handler import ZenohFileHandler
from utils.file_handler import save_file_record,secure_filename,update_file_record_in_db,get_file_record
from swagger_models.file_upload import get_upload_file_url_model, get_upload_file_url_response_model
from swagger_models.file_update import get_file_update_model
from parsers.file_parser import single_upload_parser
import json
import mimetypes
import logging

CHUNK_SIZE = 2 * 1024 * 1024  # 2MB per chunk
UPLOAD_FOLDER = './uploads'

# Configure logging to print to console and a file
logging.basicConfig(
    level=logging.DEBUG,  # Set logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(),  # Print to console
        logging.FileHandler("app.log")  # Save logs to a file
    ]
)

logger = logging.getLogger(__name__)  # Get a named logger


# Create a namespace for file operations
file_ns = Namespace('file', description='File-related operations')

upload_file_url_model = get_upload_file_url_model(file_ns)
upload_file_url_response_model = get_upload_file_url_response_model(file_ns)
file_update_model = get_file_update_model(file_ns)
@file_ns.expect(single_upload_parser)
@file_ns.route('/upload')
class SingleFileUploadWithMetadataResource(Resource):
    @file_ns.doc(
        description="Upload a single file with optional JSON metadata file.",
        security='apikey',
        consumes=['multipart/form-data'],
        responses={
            200: 'File uploaded successfully',
            400: 'No file uploaded or invalid metadata or invalid project_id.',
            500: 'Failed to save file.'
        }
    )
    def post(self):
        """Upload a file with optional metadata and store in Zenoh, then start metadata processing task."""
        current_user_id = 'current_user_id_placeholder'  # Replace with actual JWT identity

        # Parse the file upload form
        args = single_upload_parser.parse_args()
        file = args['file']
        user_filename = args['user_filename']
        description = args['description']
        metadata_file = args.get('metadata-file')
        project_id = args.get('project_id')
        use_case = args.get('use_case', [])

        if not file:
            return {'message': 'No file uploaded.'}, 400
        if not project_id:
            return {'message': 'Project ID is required.'}, 400 

        # Secure the filename
        original_filename = secure_filename(file.filename)
        if user_filename:
            original_filename = secure_filename(user_filename)
        file_parts = original_filename.rsplit('.', 1)
        upload_filename = file_parts[0]
        file_extension = file_parts[1] if len(file_parts) > 1 else ''

        try:
            file_data = {
                "filename": "",
                "upload_filename": original_filename,
                "description": description,
                "path": "",
                "user_id": current_user_id,
                "project_id": project_id,
                "file_metadata": {},
                "nft_metadata": {},
                "use_case": use_case,
                "file_type": file.file_extension
            }
            new_file = save_file_record(file_data)
            file_id = new_file.id

            final_filename = f"{file_id}.{file_extension}"
            file_path = f"projects/{project_id}/files/{file_id}/{final_filename}"

            # Read file content
            file_content = file.read()
            file_size = len(file_content)

            # Calculate file hash
            file_hash = calculate_file_hash(file_content)

            # **Store File in Zenoh**
            success1 = ZenohFileHandler.put_file(file_path, file_content)
            if not success1:
                raise Exception("Failed to store file in Zenoh.")

            logger.info(f"✅ File published to Zenoh at: {file_path}")

            # **Handle metadata**
            metadata = {}
            if metadata_file:
                metadata = process_metadata(metadata_file)

            # **Store Metadata in Zenoh**
            zenoh_metadata_path = f"projects/{project_id}/files/{file_id}/user_metadata.json"
            success2 = ZenohFileHandler.put_file(zenoh_metadata_path, json.dumps(metadata).encode('utf-8'))
            if not success2:
                raise Exception("Failed to store metadata in Zenoh.")
            logger.info(f"✅ Metadata published to Zenoh at: {zenoh_metadata_path}")
            try:
                # ✅ Update DB record
                update_file_record_in_db(
                    file_id=file_id,
                    filename = final_filename,
                    path=file_path,
                    file_size=file_size,
                    file_hash=file_hash,
                    uploader_metadata=metadata
                )
            except Exception as e:
                logger.error(f"❌ Error updating file record: {str(e)}")
                return {'message': 'Failed to update file record.'}, 500

            # 🔥 **Start Metadata Processing Task**
            metadata_task = process_large_file.delay(file_id)  # Celery task
            metadata_task_id = metadata_task.id  # Get the task ID

            # ✅ **Return response with `metadata_task_id`**
            return {
                'message': '✅ File uploaded successfully!',
                'file': {
                    'id': file_id,
                    'filename': final_filename,
                    'upload_filename': upload_filename,
                    'file_path': file_path,
                    'zenoh_metadata_path': zenoh_metadata_path,
                    'project_id': project_id,
                    'metadata': metadata,
                    'file_hash': file_hash,
                    'metadata_task_id': metadata_task_id  # ✅ Include task ID for polling
                }
            }, 200

        except Exception as e:
            logger.error(f"❌ Error during file upload: {str(e)}")
            return {'message': f'Error during file upload: {str(e)}'}, 500


@file_ns.route('/update/<string:file_id>')
class FileResource(Resource):
    @file_ns.doc(
        description="Update project_id, description, use_case, filename of a file.",
        security='apikey',
        responses={
            200: "File updated successfully",
            400: "No valid fields provided or NFT restriction",
            404: "File not found",
            500: "Error updating file"
        },
        params={"file_id": "The ID of the file to update"}
    )
    @file_ns.expect(file_update_model) 
    def patch(self, file_id):
        """Update project_id, description, use_case, filename"""
        data = request.json

        file=get_file_record(file_id)
        if not file:
            return {"message": "File not found"}, 404

        if file.nft_metadata:
            return {"message": "File is already registered as NFT, cannot be updated"}, 400

        # Validate use_case if present
        if "use_case" in data:
            use_case = data["use_case"]
            if not isinstance(use_case, list):
                return {"message": "use_case must be a list"}, 400
            file.use_case = use_case

        try:
            # ✅ Use your helper for everything else
            update_file_record_in_db(
                file_id=file_id,
                path=data.get("path", file.path),
                file_size=data.get("file_size", file.file_size),
                file_hash=data.get("file_hash", file.file_hash),
                uploader_metadata=data.get("uploader_metadata", file.uploader_metadata),
                filename=secure_filename(data["upload_filename"]) if "upload_filename" in data else file.filename
            )

            return {
                "message": "File updated successfully",
                "updated_data": file.to_json()
            }, 200

        except Exception as e:
            return {"message": f"Error updating file: {str(e)}"}, 500
        

@file_ns.route('/<string:file_id>')    
class FileDownloadResource(Resource):
    @file_ns.doc(
        description='Download a file by its ID',
        security='apikey',
        responses={
            200: 'File downloaded successfully',
            404: 'File not found'
        }
    )
    def get(self, file_id):
        """Download a file."""
        file=get_file_record(file_id)
        if not file:
            return {'message': 'File not found.'}, 404
        file_path = file.path
        file_content = ZenohFileHandler.get_file(file_path)

        if file_content is None:
            return {'message': 'File not found in Zenoh Storage.'}, 404  

        # Detect file MIME type (to serve it properly)
        filename = file_path.split('/')[-1]  # ✅ Extract filename from path
        mime_type, _ = mimetypes.guess_type(filename)  
        return send_file(
            file_content,
            mimetype=mime_type,
            download_name=filename,  # Extract filename
            as_attachment=True
        )


# File Delete Endpoint
@file_ns.route('/<file_id>/delete')  # Endpoint to delete a file by ID
class FileDeleteResource(Resource):
    @file_ns.doc(
        description='Delete a file by its ID, including Zenoh storage and metadata cleanup.',
        security='apikey',
        responses={
            200: 'File deleted successfully',
            404: 'File not found',
            500: 'Failed to delete file'
        }
    )
    def delete(self, file_id):
        """Soft delete a file and remove it from Zenoh if no metadata remains."""
        file = get_file_record(file_id)
        if not file:
            return {'message': 'File not found.'}, 404
        if file.nft_metadata:
            return {'message': 'Cannot delete file. NFT restriction'}, 400

        success, error = delete_file_record(file)
        if success:
            return {'message': 'File deleted successfully.'}, 200
        else:
            return {'message': f'Failed to delete file: {error}'}, 500



@file_ns.route('/upload/async')
class AsyncFileUploadResource(Resource):
    @file_ns.doc(
        description="Upload large file asynchronously in chunks and store each chunk directly in Zenoh.",
        security='apikey',
        consumes=['multipart/form-data'],
        responses={
            200: 'Chunk uploaded successfully',
            202: 'File upload completed and merging started!',
            400: 'No file uploaded or invalid metadata.',
            500: 'Failed to save file.'
        }
    )
    @file_ns.expect(single_upload_parser)
    def post(self):
        """Upload a file asynchronously in chunks and store directly in Zenoh."""
        current_user_id = 'current_user_id_placeholder'  # Replace with actual JWT identity
        args = request.files
        file = args.get('file')
        chunk_index = int(request.form.get('chunk_index', 0))
        total_chunks = int(request.form.get('total_chunks', 0))
        filename = request.form.get('filename')
        project_id = request.form.get('project_id')

        if not file:
            return {'message': 'No file uploaded.'}, 400
        if not project_id:
            return {'message': 'Project ID is required.'}, 400

        # Secure filename
        original_filename = secure_filename(filename)
        file_parts = original_filename.rsplit('.', 1)
        upload_filename = file_parts[0]
        file_extension = file_parts[1] if len(file_parts) > 1 else ''

        # If this is the first chunk, create a file record in DB
        if chunk_index == 0:
            try:
                file_data = {
                    "filename": "",
                    "upload_filename": upload_filename,
                    "path": "",
                    "user_id": current_user_id,
                    "project_id": project_id,
                    "file_metadata": {},
                    "nft_metadata": {},
                    "file_type": file_extension
                }
                new_file = save_file_record(file_data)
                file_id = new_file.id
            except Exception as e:
                logger.error(f"Failed to create file record: {str(e)}")
                return {'message': f'Failed to create file record: {str(e)}'}, 500
        else:
            file_id = request.form.get('file_id')
            
        if not file_id:
            logger.error("❌ file_id is missing before merging.")
            return {'message': 'Internal Error: file_id is missing.'}, 500

        # Read chunk data
        chunk_data = file.read()

        # Store chunk in Zenoh
        zenoh_chunk_path = f"projects/{project_id}/files/{file_id}/chunks/chunk_{chunk_index}"
        pub_chunk=ZenohFileHandler.put_file(file_path=zenoh_chunk_path,file_content=chunk_data)


        # ✅ **If this is the last chunk, trigger Celery to merge**
        if chunk_index + 1 == total_chunks:
            final_filename = f"{file_id}.{file_extension}"
            zenoh_file_path = f"projects/{project_id}/files/{file_id}/{final_filename}"
            chunked_file=get_file_record(file_id)
            if chunked_file:

                update_file_record_in_db(
                    file_id=chunked_file.id,
                    filename = final_filename,
                    path=zenoh_file_path,
                    file_size=chunked_file.file_size,
                    file_hash=chunked_file.file_hash
                )
                # 🔥 **Trigger Celery merge task**
                chunk_data_chain=chain(
                    merge_chunks_task.s(file_id, project_id, total_chunks, final_filename),  
                    process_large_file.s()
                ).apply_async()
            else:
                return {'message': f'An error occured'}, 500

            return {
                'message': 'File upload completed and merging started!',
                'file_id': file_id,
                'zenoh_file_path': zenoh_file_path,
                'merge_task_id': chunk_data_chain.parent.id,  # Return Celery Task ID
                'metadata_task_id': chunk_data_chain.id,
                'project_id': project_id
            }, 202

        return {'file_id': file_id,'message': f'Chunk {chunk_index + 1}/{total_chunks} uploaded successfully.'}, 200


@file_ns.route("/upload-link")
class UploadFileFromLink(Resource):
    @file_ns.doc(
        description="Retrieve a file from a given link and begin processing.",
        security='apikey',
        responses={
            200: ("File retrieved successfully", upload_file_url_response_model),
            400: "Invalid request (file_url and project_id are required)",
            500: "Server error",
        },
    )

    @file_ns.expect(upload_file_url_model)  # ✅ Expect the request format
    @file_ns.marshal_with(upload_file_url_response_model, code=200, mask=False)  # ✅ Response format
    def post(self):
        """Retrieve file from URL and start Celery processing"""
        current_user_id = 'current_user_id_placeholder'  # Replace with actual JWT identity
        data = request.json
        file_url = data.get("file_url")
        project_id = data.get("project_id")
        description = data.get("description", "")
        use_cases = data.get("use_cases", [])
        metadata = data.get("metadata", {})

        if not file_url or not project_id:
            return {"message": "file_url and project_id are required!"}, 400

        try:
            # 🔥 Secure filename from URL
            filename = secure_filename(file_url.split("/")[-1])
            file_extension = filename.rsplit(".", 1)[-1] if "." in filename else "csv"
            file_data = {
                "filename": "",
                "upload_filename": filename,
                "description": description,
                "path": "",
                "user_id": current_user_id,
                "project_id": project_id,
                "file_metadata": {},
                "nft_metadata": {},
                "use_case": use_cases,
                "parent_files" : {"external": file_url},
                "file_type": file_extension
            }
            new_file = save_file_record(file_data)
            file_id = new_file.id
            # 🔥 Generate Zenoh storage path
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
                process_large_file.s(),
            ).apply_async()

            return {
                "message": "File retrieval started!",
                "file_id": file_id,
                "zenoh_file_path": zenoh_file_path,
                "fetch_task_id": task_chain.parent.id,
                "process_task_id": task_chain.id,
                "file_url": file_url
            }, 200

        except Exception as e:
            logger.error(f"Unexpected error: {str(e)}")
            return {"message": "Internal server error!"}, 500
