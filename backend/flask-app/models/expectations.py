import uuid
from datetime import datetime, timezone
from extensions.db import db
from sqlalchemy.dialects.postgresql import JSONB
from services.expectation_engine import build_metadata, extract_expectation_descriptions

def generate_uuid():
    return str(uuid.uuid4())

class ExpectationSuites(db.Model):
    __tablename__ = 'expectation_suites'

    id = db.Column(db.String(), primary_key=True, default=generate_uuid)
    suite_name = db.Column(db.String(255), nullable=False)
    datasource_name = db.Column(db.String(255), nullable=False)
    file_types = db.Column(JSONB)
    sample_file_path = db.Column(db.String())
    expectations = db.Column(JSONB, nullable=True)
    category = db.Column(db.String(255), nullable=True)
    description = db.Column(db.Text, nullable=True)
    user_id = db.Column(db.String(), nullable=False)
    use_case = db.Column(db.String(), nullable=True)
    column_descriptions = db.Column(JSONB, nullable=True)
    column_names = db.Column(JSONB, nullable=True)
    created = db.Column(db.DateTime, default=datetime.now(timezone.utc), nullable=False)

    def __repr__(self):
        return f"<ExpectationSuite {self.suite_name}>"

    def to_json(self):

        metadata = build_metadata()
        expectations_data = self.expectations
        if isinstance(expectations_data, dict):
            expectations_list = expectations_data.get("expectations", [])
        elif isinstance(expectations_data, list):
            expectations_list = expectations_data
        else:
            expectations_list = []

        return {
            "id": self.id,
            "suite_name": self.suite_name,
            "datasource_name": self.datasource_name,
            "file_types": self.file_types,
            "expectations": self.expectations,
            "category": self.category,
            "description": self.description,
            "user_id": self.user_id,
            "column_descriptions": self.column_descriptions,
            "column_names" : self.column_names,
            "created": self.created.isoformat() if self.created else None,
            "expectation_descriptions": extract_expectation_descriptions(expectations_list, metadata)
        }

    @classmethod
    def get_all_tuples(cls):
        """Returns (id, suite_name, description) tuples for UI dropdowns or selection."""
        return [(suite.id, suite.suite_name, suite.use_case) for suite in cls.query.all()]


class ValidationResults(db.Model):
    __tablename__ = 'validation_results'

    id = db.Column(db.String(), primary_key=True, default=generate_uuid)
    user_id = db.Column(db.String(), nullable=False)
    suite_id = db.Column(db.String(), db.ForeignKey('expectation_suites.id'), nullable=False)
    dataset_name = db.Column(db.String(255), nullable=False)
    dataset_id = db.Column(db.String(255), nullable=False)
    result_summary = db.Column(JSONB, nullable=True)
    detailed_results = db.Column(JSONB, nullable=True)
    run_time = db.Column(db.DateTime, default=datetime.now(timezone.utc), nullable=False)
    path = db.Column(db.String(), nullable=False)
    suite = db.relationship("ExpectationSuites", backref="results")


    def __repr__(self):
        return f"<ExpectationResult {self.dataset_name} on suite {self.suite_id}>"

    def to_json(self):

        metadata = build_metadata()

        if isinstance(self.suite.expectations, dict):
            expectations_list = self.suite.expectations.get("expectations", [])
        elif isinstance(self.suite.expectations, list):
            expectations_list = self.suite.expectations
        else:
            expectations_list = []

        return {
            "id": self.id,
            "user_id": self.user_id,
            "suite_id": self.suite_id,
            "dataset_name": self.dataset_name,
            "dataset_id": self.dataset_id,
            "result_summary": self.result_summary,
            "detailed_results": self.detailed_results,
            "column_descriptions": self.suite.column_descriptions if self.suite else None,
            "column_names": self.suite.column_names if self.suite else None,
            "expectation_descriptions": extract_expectation_descriptions(expectations_list, metadata),
            "run_time": self.run_time.isoformat() if self.run_time else None
        }

