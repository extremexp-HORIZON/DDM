from werkzeug.datastructures import FileStorage
from flask_restx import reqparse

# Define the file upload parser
single_upload_parser = reqparse.RequestParser()
single_upload_parser.add_argument(
    'project_id',
    type=str,
    required=True,
    help='Project ID is required for file organization.'
)
single_upload_parser.add_argument(
    'file',
    location='files',
    type=FileStorage,
    required=True,
    help='A file is required for this upload.'
)
single_upload_parser.add_argument(
    'user_filename',
    type=str,
    required=False,
    help='File Name.'
)
single_upload_parser.add_argument(
    'description',
    type=str,
    required=False,
    help='File Description.'
)
single_upload_parser.add_argument(
    'use_case',
    type=str,
    action='append',  # ✅ Accept multiple values as a list
    required=False,
    help='Use cases (List).'
)
single_upload_parser.add_argument(
    'metadata-file',
    type=FileStorage,
    location='files',
    required=False,
    help='JSON metadata file for the file.'
)


