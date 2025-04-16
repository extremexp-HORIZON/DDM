from models.expectations import ExpectationResults, ExpectationSuites
from utils.file_handler import get_file_record
from datetime import datetime,timezone
import uuid
from extensions.db import db


def get_expectation_suite(suite_id):
    return ExpectationSuites.query.get(suite_id)


def save_expectation_result(file_record, suite, suite_result, zenoh_path):
    result = ExpectationResults(
        id=str(uuid.uuid4()),
        user_id=file_record.user_id,
        suite_id=suite.id,
        dataset_name=file_record.filename,
        result_summary=suite_result.get("summary", {}),
        detailed_results=suite_result,
        run_time=datetime.now(timezone.utc),
        path=zenoh_path
    )
    db.session.add(result)
    db.session.commit()
    return result


def save_expectation_suite(data):
    dataset_id = data.pop("dataset_id", None) 

    if not dataset_id:
        raise ValueError("dataset_id is required")

    file_record = get_file_record(dataset_id)
    if not file_record:
        raise ValueError("File not found for given dataset_id")

    suite = ExpectationSuites(**data)  # won't include dataset_id
    suite.sample_file_path = file_record.path
    suite.user_id=file_record.user_id

    db.session.add(suite)
    db.session.commit()

    return suite, file_record
