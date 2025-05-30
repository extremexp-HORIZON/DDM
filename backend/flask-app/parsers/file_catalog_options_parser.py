from flask_restx import reqparse

file_options_parser = reqparse.RequestParser()
file_options_parser.add_argument("project_id", type=str, required=False)
file_options_parser.add_argument("name", type=str, required=False)

