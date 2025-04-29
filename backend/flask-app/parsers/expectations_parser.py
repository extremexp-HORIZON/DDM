# api/parsers.py
from flask_restx import reqparse

expectation_suite_filter_parser = reqparse.RequestParser()
expectation_suite_filter_parser.add_argument('suite_name', type=str, action='split', help="Suite names ")
expectation_suite_filter_parser.add_argument('suite_id', type=str, action='split', help="Suite IDs ")
expectation_suite_filter_parser.add_argument('file_types', type=str,action='split', help="File Types ")
expectation_suite_filter_parser.add_argument('category', type=str,action='split', help="Categories ")
expectation_suite_filter_parser.add_argument('use_case', type=str,action='split', help="Use cases ")
expectation_suite_filter_parser.add_argument('user_id', type=str, action='split', help="User IDs ")
expectation_suite_filter_parser.add_argument('created_from', type=str, help="Start datetime (ISO 8601)")
expectation_suite_filter_parser.add_argument('created_to', type=str, help="End datetime (ISO 8601)")
expectation_suite_filter_parser.add_argument('sort', type=str, default="created,desc", help='Sort: field,asc|desc')
expectation_suite_filter_parser.add_argument('page', type=int, default=1, help='Page number')
expectation_suite_filter_parser.add_argument('perPage', type=int, default=10, help='Results per page')


validation_results_filter_parser = reqparse.RequestParser()
validation_results_filter_parser.add_argument('dataset_name', type=str, action='split', help="Dataset names ")
validation_results_filter_parser.add_argument('dataset_id', type=str, action='split', help="Dataset IDs ")
validation_results_filter_parser.add_argument('user_id', type=str, action='split', help="User IDs ")
validation_results_filter_parser.add_argument('suite_id', type=str, action='split', help="Suite IDs ")
validation_results_filter_parser.add_argument('run_time_from', type=str, help="Start datetime (ISO 8601)")
validation_results_filter_parser.add_argument('run_time_to', type=str, help="End datetime (ISO 8601)")
validation_results_filter_parser.add_argument('sort', type=str, default='run_time,desc', help="Sort: field,asc|desc")
validation_results_filter_parser.add_argument('page', type=int, default=1, help="Page number")
validation_results_filter_parser.add_argument('perPage', type=int, default=10, help="Results per page")
