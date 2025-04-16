from werkzeug.datastructures import FileStorage
from flask_restx import reqparse

# Define the file upload parser
upload_parser = reqparse.RequestParser()
upload_parser.add_argument(
    'project_id',
    type=str,
    required=True,
    help='Project ID is required for organizing uploaded files.'
)
upload_parser.add_argument(
    'files',
    location='files',
    type=FileStorage,
    required=True,
    action='append',
    help='The file(s) to upload.'
)
upload_parser.add_argument(
    'metadata-files',
    location='files',
    type=FileStorage,
    required=False,
    action='append',
    help='Optional JSON metadata files for the uploaded files.'
)
upload_parser.add_argument(
    'user_filenames',
    type=str,
    required=False,
    action='append',
    help='File Name.'
)
upload_parser.add_argument(
    'descriptions',
    type=str,
    required=False,
    action='append',
    help='File Description.'
)
upload_parser.add_argument(
    'use_case',
    type=str,
    required=False,
    action='append',
    help='List of use cases.'
)