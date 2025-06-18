from flask_restx import reqparse

tree_query_parser = reqparse.RequestParser()
tree_query_parser.add_argument("parent", type=str, required=False, help="Parent folder path")
tree_query_parser.add_argument("name", type=str, required=False, help="Filter by name")
tree_query_parser.add_argument("size", type=int, required=False, help="Filter by file size (bytes)")
tree_query_parser.add_argument("type", type=str, required=False, help="Filter by type")
tree_query_parser.add_argument("sort", type=str, required=False)
tree_query_parser.add_argument("page", type=int, required=False, default=0)
tree_query_parser.add_argument("perPage", type=int, required=False, default=20, help="Page size")
tree_query_parser.add_argument("filter", type=str, required=False)  # general text search
