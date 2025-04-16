import uuid
from datetime import datetime, timezone
from extensions.db import db
from sqlalchemy.dialects.postgresql import JSONB

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
    created = db.Column(db.DateTime, default=datetime.now(timezone.utc), nullable=False)

    def __repr__(self):
        return f"<ExpectationSuite {self.suite_name}>"

    def to_json(self):
        return {
            "id": self.id,
            "suite_name": self.suite_name,
            "datasource_name": self.datasource_name,
            "file_types": self.file_types,
            "expectations": self.expectations,
            "category": self.category,
            "description": self.description,
            "user_id": self.user_id,
            "created": self.created.isoformat() if self.created else None
        }

    @classmethod
    def get_all_tuples(cls):
        """Returns (id, suite_name, description) tuples for UI dropdowns or selection."""
        return [(suite.id, suite.suite_name, suite.use_case) for suite in cls.query.all()]


class ExpectationResults(db.Model):
    __tablename__ = 'expectation_results'

    id = db.Column(db.String(), primary_key=True, default=generate_uuid)
    user_id = db.Column(db.String(), nullable=False)
    suite_id = db.Column(db.String(), db.ForeignKey('expectation_suites.id'), nullable=False)
    
    dataset_name = db.Column(db.String(255), nullable=False)
    result_summary = db.Column(JSONB, nullable=True)
    detailed_results = db.Column(JSONB, nullable=True)
    run_time = db.Column(db.DateTime, default=datetime.now(timezone.utc), nullable=False)
    path = db.Column(db.String(), nullable=False)
    suite = db.relationship("ExpectationSuites", backref="results")

    def __repr__(self):
        return f"<ExpectationResult {self.dataset_name} on suite {self.suite_id}>"

    def to_json(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "suite_id": self.suite_id,
            "dataset_name": self.dataset_name,
            "result_summary": self.result_summary,
            "detailed_results": self.detailed_results,
            "run_time": self.run_time.isoformat() if self.run_time else None
        }

