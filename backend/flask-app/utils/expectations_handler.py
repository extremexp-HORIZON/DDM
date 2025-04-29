from models.expectations import ValidationResults, ExpectationSuites
from utils.file_handler import get_file_record
from datetime import datetime,timezone
import uuid
from extensions.db import db


def get_expectation_suite(suite_id):
    return ExpectationSuites.query.get(suite_id)


def save_validation_result(file_record, suite, suite_result, zenoh_path):
    dataset_name = file_record.filename or file_record.path.split("/")[-1] or "Unnamed_Dataset"
    result = ValidationResults(
        id=str(uuid.uuid4()),
        user_id=file_record.user_id,
        suite_id=suite.id,
        dataset_name=dataset_name,
        dataset_id=file_record.id,
        result_summary=suite_result.get("summary", {}),
        detailed_results=suite_result,
        run_time=datetime.now(timezone.utc),
        path=zenoh_path
    )
    db.session.add(result)
    db.session.commit()
    return result


def save_expectation_suite(data):
    dataset_id = data.get("dataset_id")
    if not dataset_id:
        raise ValueError("dataset_id is required")

    file_record = get_file_record(dataset_id)
    if not file_record:
        raise ValueError("File not found for given dataset_id")

    # 🔥 First try top-level, fallback to inside expectations.meta
    column_descriptions = data.get("column_descriptions") or data.get("expectations", {}).get("meta", {}).get("column_descriptions", {})
    column_names = data.get("column_names") or list(column_descriptions.keys())

    suite = ExpectationSuites(
        suite_name=data.get("suite_name"),
        datasource_name=data.get("datasource_name", "default"),
        file_types=data.get("file_types", []),
        expectations=data.get("expectations", {}).get("expectations", []),
        user_id=file_record.user_id,
        sample_file_path=file_record.path,
        column_descriptions=column_descriptions,
        column_names=column_names,
        category=data.get("category"),
        description=data.get("description"),
    )

    db.session.add(suite)
    db.session.commit()

    return suite, file_record

