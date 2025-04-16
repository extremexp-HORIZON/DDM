from flask import request,send_file
from flask_restx import Resource, Namespace, fields
from utils.zenoh_file_handler import ZenohFileHandler
from utils.file_handler import get_file_record, get_file_records_by_ids
from utils.file_helpers import delete_uploader_metadata_from_zenoh, add_or_update_uploader_metadata
import zipfile
import datetime
import os
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
    @uploader_metadata_ns.doc(security='apikey')
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
@uploader_metadata_ns.doc(description="Update uploader metadata for a specific file.", security='apikey')
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
@uploader_metadata_ns.doc(description="Retrieve uploader metadata for a specific file", security='apikey')
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
@file_metadata_ns.doc(description="Retrieve a file's metadata by file id", security='apikey')
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
    @file_metadata_ns.doc(description="List of file IDs to retrieve metadata", security='apikey')

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
@file_metadata_ns.doc(description="List of file IDs to download reports", security='apikey')
class FileReportsDownloadResource(Resource):
    
    def post(self):
        """Retrieve HTML reports for multiple files from Zenoh."""
        data = request.json
        file_ids = data.get('file_ids', [])
        files = get_file_records_by_ids(file_ids)
        if not files:
            return {'message': 'No files found for the given IDs'}, 404

        zip_filename = f"reports_{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}.zip"
        zip_temp_path = os.path.join("/tmp", zip_filename)  # ✅ Use /tmp for safe storage

        try:
            with zipfile.ZipFile(zip_temp_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                for file in files:

                    zenoh_report_path = f"projects/{file.project_id}/files/{file.id}/{file.id}_profile_report.html"
                    file_content = ZenohFileHandler.get_file(zenoh_report_path)

                    if file_content is None:
                        logger.warning(f"⚠️ Report not found in Zenoh: {zenoh_report_path}")
                        continue  # Skip missing reports

                    # ✅ Store report in ZIP
                    with zipf.open(f"{file.upload_filename}_profile_report.html", 'w') as report_file:
                        report_file.write(file_content.read())

            return send_file(zip_temp_path, as_attachment=True, download_name=zip_filename, mimetype="application/zip")

        except Exception as e:
            logger.error(f"❌ Failed to create ZIP file for reports: {str(e)}")
            return {'message': 'Failed to download reports.'}, 500


@file_metadata_ns.route('/report/<string:file_id>')
@file_metadata_ns.doc(
    description="Retrieve the HTML profile report for a single file.",
    params={'file_id': 'ID of the file to retrieve the report for'},
    security='apikey',
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
        if not file:
            return {'message': 'File not found'}, 404

        try:
            zenoh_report_path = f"projects/{file.project_id}/files/{file.id}/{file.id}_profile_report.html"
            file_content = ZenohFileHandler.get_file(zenoh_report_path)

            if file_content is None:
                return {'message': 'Report not found in Zenoh'}, 404

            # Return as an HTML response (not a file download)
            return send_file(
                file_content,
                mimetype='text/html',
                download_name=f"{file.upload_filename}_profile_report.html",
                as_attachment=False  # 👈 Serve inline
            )

        except Exception as e:
            logger.error(f"❌ Error retrieving HTML report: {str(e)}")
            return {'message': 'Failed to retrieve the report.'}, 500
