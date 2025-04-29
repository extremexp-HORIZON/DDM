from utils.file_utils import GROUPED_SUPPORTED_EXTENSIONS,GROUPED_DF_SUPPORTED_EXTENSIONS
from utils.expectation_helpers import collect_all_expectations,build_metadata
from models.expectations import ExpectationSuites
from flask_restx import Resource, Namespace
from flask import jsonify

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
    


@parametrics_ns.route('/categorized-expectations')
@parametrics_ns.doc(security='apikey')
class CategorizedExpectations(Resource):
    def get(self):
        """Returns all available Great Expectations validation rules categorized by data quality issues."""
        categorized = build_metadata()
        return jsonify(categorized)


@parametrics_ns.route('/all-expectations')
@parametrics_ns.doc(security='apikey')
class AllExpectations(Resource):
    def get(self):
        """Returns a list of all available Great Expectations validation rules with descriptions and arguments."""
        expectations = collect_all_expectations()
        return jsonify({"all_expectations": expectations})


@parametrics_ns.route('/suite-tuples')
@parametrics_ns.doc(security='apikey')
class SuiteTuples(Resource):
    def get(self):
        """Get tuples of (id, name, use_case) for dropdowns"""
        data = ExpectationSuites.get_all_tuples()
        return jsonify(data)