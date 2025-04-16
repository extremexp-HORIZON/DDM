from utils.file_utils import GROUPED_SUPPORTED_EXTENSIONS,GROUPED_DF_SUPPORTED_EXTENSIONS

from flask_restx import Resource, Namespace

# Create a namespace for file operations
parametrics_ns = Namespace('parametrics',path='/parametrics', description='Parametric Info')

@parametrics_ns.route("/df-supported-file-types")
class SupportedFileTypes(Resource):
    @parametrics_ns.doc(security='apikey')
    def get(self):
        """Returns a list of supported file types for dataframes."""
        return GROUPED_DF_SUPPORTED_EXTENSIONS

@parametrics_ns.route("/all-supported-file-types")
@parametrics_ns.doc(security='apikey')
class SupportedFileTypes(Resource):
    def get(self):
        """Returns a list of all supported file types."""   
        return GROUPED_SUPPORTED_EXTENSIONS