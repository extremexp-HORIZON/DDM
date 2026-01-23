from flask import request, send_file, Response
from flask_restx import Resource, Namespace, fields
from utils.zenoh_file_handler import ZenohFileHandler
from utils.file_handler import get_file_record, get_file_records_by_ids
from utils.file_helpers import delete_uploader_metadata_from_zenoh, add_or_update_uploader_metadata
from utils.user_file_logger import log_action_with_context
from auth.auth import get_current_username 
import zipfile
import datetime
import io
import logging

logger = logging.getLogger(__name__)  # Get a named logger
# Create a namespace for file operations
file_metadata_ns = Namespace('file_metadata', description='File-Metadata operations')
uploader_metadata_ns = Namespace('uploader_metadata', description='File-Uploader Metadata operations')

# A generic model that accepts any JSON object for Swagger
uploader_metadata_model = file_metadata_ns.model('UploaderMetadataJSON', {
   'uploader_metadata': fields.Raw(description='Uploader metadata (JSON)', required=False),
})

generic_model = file_metadata_ns.model('FileMetadataJSON', {
    'data': fields.Raw(required=True, description='Any (nested) JSON object')  # Raw allows any JSON
})


# Route for updating metadata for a specific file
@uploader_metadata_ns.route('/<string:file_id>')
class FileUploaderMetadataResource(Resource):
    # POST: Attach uploader metadata to a file
    @uploader_metadata_ns.expect(uploader_metadata_model)  # Expect the File model for POST
    @uploader_metadata_ns.doc(security='oauth2')
    @uploader_metadata_ns.response(200, 'Success', uploader_metadata_model)  # Return the File model in response
    @uploader_metadata_ns.response(400, 'Invalid JSON')
    @uploader_metadata_ns.response(404, 'File Not Found')
    def post(self, file_id):
        """Attach uploader metadata to a file."""
        file = get_file_record(file_id)
        if not file:
            return {'message': 'File not found'}, 404

        metadata = request.json.get("uploader_metadata")
        success, error = add_or_update_uploader_metadata(file, metadata)
        if not success:
            return {'message': error}, 400

        return {'message': 'Uploader Metadata added successfully', 'file_id': file.id}, 201

    # PUT: Update uploader metadata for a specific file
    @uploader_metadata_ns.expect(uploader_metadata_model)  # Expect the File model for PUT
    @uploader_metadata_ns.doc(description="Update uploader metadata for a specific file.", security='oauth2')
    @uploader_metadata_ns.response(200, 'Success', uploader_metadata_model)  # Return the File model in response
    @uploader_metadata_ns.response(400, 'Invalid JSON')
    @uploader_metadata_ns.response(404, 'File Not Found')
    def put(self, file_id):
        """Update the uploader_metadata for a specific file."""
        file = get_file_record(file_id)
        if not file:
            return {'message': 'File not found'}, 404

        metadata = request.json.get("uploader_metadata")
        success, error = add_or_update_uploader_metadata(file, metadata)
        if not success:
            return {'message': error}, 400

        return {'message': 'Uploader metadata updated successfully', 'file_id': file.id}, 200


    # GET: Retrieve uploader metadata for a specific file
    @uploader_metadata_ns.response(200, 'Success', uploader_metadata_model)  # Return the File model in response
    @uploader_metadata_ns.response(404, 'File Not Found')
    @uploader_metadata_ns.doc(description="Retrieve uploader metadata for a specific file", security='oauth2')
    def get(self, file_id):
        """Retrieve the uploader_metadata for a specific file."""
        file = get_file_record(file_id)
        if not file:
            return {'message': 'File not found'}, 404
        return {'uploader_metadata': file.uploader_metadata}, 200

    def delete(self, file_id):
        """Delete the uploader_metadata for a specific file (from Zenoh + DB)."""
        file = get_file_record(file_id)
        if not file:
            return {'message': 'File not found'}, 404
        metadata_deleted, error = delete_uploader_metadata_from_zenoh(file)
        if error:
            return {'message': error}, 500
        if metadata_deleted:
            logger.info(f"✅ Metadata deleted from Zenoh for file {file.id}")
        else:
            logger.warning(f"⚠️ Metadata not found in Zenoh for file {file.id}")
        return {'message': 'Uploader metadata deleted successfully'}, 200



@file_metadata_ns.route('/<string:file_id>')
@file_metadata_ns.response(200, 'Success')  
@file_metadata_ns.response(404, 'File Not Found')
@file_metadata_ns.doc(description="Retrieve a file's metadata by file id", security='oauth2')
class FileMetadataResource(Resource):
    def get(self, file_id):
        """Retrieve a single file's metadata by ID."""
        file = get_file_record(file_id)
        if not file:
            return {'message': 'File not found'}, 404
        return file.file_metadata, 200  # ✅ Return only metadata


@file_metadata_ns.route('/')
class MultipleFileMetadataResource(Resource):
    @file_metadata_ns.expect(file_metadata_ns.model('FileIdsRequest', {
        'file_ids': fields.List(fields.String, required=True, description='List of file IDs to retrieve metadata')
    }))
    @file_metadata_ns.doc(description="List of file IDs to retrieve metadata", security='oauth2')

    def post(self):
        """Retrieve metadata for multiple files by their IDs."""
        data = request.json
        file_ids = data.get('file_ids', [])
        files = get_file_records_by_ids(file_ids)
        if not files:
            return {'message': 'No files found for the given IDs'}, 404
        metadata_list = {file.id: file.file_metadata for file in files}
        return {'metadata': metadata_list}, 200
    
@file_metadata_ns.route('/reports')
@file_metadata_ns.expect(file_metadata_ns.model('FileIdsRequest', {
    'file_ids': fields.List(fields.String, required=True, description='List of file IDs to download reports')
}))
@file_metadata_ns.doc(description="Download HTML profile reports for multiple files as a ZIP", security='oauth2')
class FileReportsDownloadResource(Resource):
    def post(self):
        data = request.get_json(silent=True) or {}
        file_ids = data.get("file_ids") or []

        if not isinstance(file_ids, list) or not all(isinstance(x, str) for x in file_ids):
            return {"message": "file_ids must be a list of strings"}, 400

        file_ids = [x.strip() for x in file_ids if x and x.strip()]
        if not file_ids:
            return {"message": "file_ids is required"}, 400

        files, err = get_file_records_by_ids(file_ids)
        if err:
            return {"message": err}, 404  # or 400 depending on your API choice

        # files is now the actual list of ORM objects
        for f in files:
            zenoh_report_path = f"projects/{f.project_id}/files/{f.id}/{f.id}_profile_report.html"



        if files and any(isinstance(x, list) for x in files):
            flat = []
            for x in files:
                if isinstance(x, list):
                    flat.extend(x)
                else:
                    flat.append(x)
            files = flat

        if not files:
            return {"message": "No files found for the given IDs"}, 404

        zip_name = f"reports_{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}.zip"
        buf = io.BytesIO()

        try:
            with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zipf:
                missing = []
                for f in files:
                    zenoh_report_path = f"projects/{f.project_id}/files/{f.id}/{f.id}_profile_report.html"
                    content = ZenohFileHandler.get_file(zenoh_report_path)
                    if content is None:
                        missing.append(f"{f.id} -> {zenoh_report_path}")
                        continue
                    if isinstance(content, str):
                        content_bytes = content.encode("utf-8")
                    else:
                        content_bytes = content  # bytes

                    if not isinstance(content_bytes, (bytes, bytearray)):
                        missing.append(f"{f.id} -> {zenoh_report_path} (unexpected type: {type(content)})")
                        continue

                    base = getattr(f, "upload_filename", None) or f.id
                    base = str(base).replace("/", "_").replace("\\", "_")
                    zipf.writestr(f"{base}_profile_report.html", content_bytes)

                if missing:
                    zipf.writestr("missing_reports.txt", "\n".join(missing) + "\n")

            buf.seek(0)
            return send_file(
                buf,
                as_attachment=True,
                download_name=zip_name,
                mimetype="application/zip",
            )

        except Exception as e:
            logger.exception("❌ Failed to create ZIP file for reports")
            return {"message": f"Failed to download reports: {str(e)}"}, 500

@file_metadata_ns.route('/report/<string:file_id>')
@file_metadata_ns.doc(
    description="Retrieve the HTML profile report for a single file.",
    params={'file_id': 'ID of the file to retrieve the report for'},
    security='oauth2',
    responses={
        200: 'HTML report retrieved successfully',
        404: 'Report not found',
        500: 'Error retrieving the report'
    }
)
class SingleFileReportResource(Resource):
    def get(self, file_id):
        """Retrieve the HTML profile report for a single file."""
        file = get_file_record(file_id)
        username = get_current_username()
        if not file:
            return {'message': 'File not found'}, 404

        try:
            zenoh_report_path = f"projects/{file.project_id}/files/{file.id}/{file.id}_profile_report.html"
            file_content = ZenohFileHandler.get_file(zenoh_report_path)

            if file_content is None:
                return {'message': 'Report not found in Zenoh'}, 404
            log_action_with_context(
                username=username,
                action_type="view_report",
                file_id=file_id,
                metadata={
                    "project_id": file.project_id,
                    "report_path": zenoh_report_path
                }
            )

            # ✅ Return as raw HTML string response
            return Response(file_content, mimetype='text/html')

        except Exception as e:
            logger.error(f"❌ Error retrieving HTML report: {str(e)}")
            return {'message': 'Failed to retrieve the report.'}, 500
