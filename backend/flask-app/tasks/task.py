
import eventlet
eventlet.monkey_patch()
from celery import shared_task 
from extensions.db import db
from extensions.llm import llm
from utils.zenoh_file_handler import ZenohFileHandler,merge_file_chunks_from_zenoh,download_file_from_zenoh,save_processed_file
from utils.file_df_loader import load_dataframe 
from utils.file_helpers import  cleanup_files,load_dataframe_or_image, compute_file_hash, download_file_from_url
from utils.file_handler import get_file_record,update_file_record_in_db, store_file_metadata_in_db
from utils.expectations_handler import save_validation_result, get_expectation_suite
from services.expectation_engine import run_expectation_suite, build_expectations_grouped,build_metadata
from services.dataset_profiling import generate_profile_report
from services.metadata_generator import generate_and_save_dataframe_metadata
import traceback
import logging
import requests
import os
import pandas as pd
import json


# Configure logging to print to console and a file
logging.basicConfig(
    level=logging.DEBUG,  # Set logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(),  # Print to console
        logging.FileHandler("app.log")  # Save logs to a file
    ]
)

logger = logging.getLogger(__name__)  # Get a named logger

@shared_task(ignore_result=False)
def process_large_file(file_id_or_result):
    logger.info(f"Received input: {file_id_or_result}")
    file_id = file_id_or_result.get("file_id") if isinstance(file_id_or_result, dict) else file_id_or_result

    if not file_id:
        return {"status": "error", "message": "Missing file_id"}

    try:
        file_record = get_file_record(file_id)
        file_path = file_record.path
        local_path = f"/tmp/{file_id}{os.path.splitext(file_path)[-1]}"
        download_file_from_zenoh(file_path, local_path)

        logger.info(f"✅ File downloaded locally to {local_path}")
        df = load_dataframe_or_image(local_path, file_record)
        if not isinstance(df, pd.DataFrame):
            return df  # Early exit if it was image or error

        # Save metadata
        summary_json = generate_and_save_dataframe_metadata(df, file_id, file_record.project_id)
        if summary_json:
            file_record.file_metadata = summary_json
        db.session.add(file_record)
        db.session.commit()

        # Profile report
        profile_html = generate_profile_report(df, file_id, file_record.project_id)

        # Save processed back to Zenoh
        processed_path = save_processed_file(df, file_path, os.path.splitext(file_path)[-1])
        cleanup_files([local_path, processed_path])

        return {"message": "File processed successfully", "profile_html": profile_html}

    except Exception as e:
        db.session.rollback()
        logger.exception(f"❌ Error processing file {file_id}: {str(e)}")
        return {"error": str(e)}

    finally:
        db.session.remove()


@shared_task(ignore_result=False)
def merge_chunks_task(file_id, project_id, total_chunks, final_filename):
    """Merge file chunks stored in Zenoh and store the final file."""
    try:
        merged_content, error = merge_file_chunks_from_zenoh(file_id, project_id, total_chunks)

        if error:
            return {'status': 'error', 'message': f'Failed to merge file: {error}'}

        file_bytes = merged_content.getvalue()
        file_hash = compute_file_hash(file_bytes)

        # Save final file to Zenoh
        zenoh_file_path = f"projects/{project_id}/files/{file_id}/{final_filename}"
        success = ZenohFileHandler.put_file(zenoh_file_path, file_bytes)
        if not success:
            raise Exception("Failed to store merged file in Zenoh.")

        # Cleanup chunks
        ZenohFileHandler.delete_file(f"projects/{project_id}/files/{file_id}/chunks/**")
        logger.info("🧹 Deleted chunk data from Zenoh")

        # Update database record
        update_file_record_in_db(file_id, zenoh_file_path, len(file_bytes), file_hash)

        db.session.remove()
        logger.info(f"✅ File merge complete and saved at: {zenoh_file_path}")
        return {'status': 'success', 'file_id': file_id}

    except Exception as e:
        logger.error(f"❌ Failed to merge chunks: {str(e)}")
        return {'status': 'error', 'message': f'Failed to merge file: {str(e)}'}


@shared_task(ignore_result=False)
def fetch_file_from_link(file_url, file_id, zenoh_file_path):
    """Fetches a file from a link and stores it in Zenoh."""
    try:
        file_data = download_file_from_url(file_url)
        file_hash = compute_file_hash(file_data)

        if not ZenohFileHandler.put_file(zenoh_file_path, file_data):
            raise Exception(f"Failed to store file in Zenoh at {zenoh_file_path}")

        store_file_metadata_in_db(file_id, zenoh_file_path, len(file_data), file_hash)

        logger.info(f"✅ File successfully retrieved and stored: {zenoh_file_path}")
        return {"file_id": file_id, "zenoh_path": zenoh_file_path}

    except requests.exceptions.RequestException as e:
        logger.error(f"❌ Failed to fetch file from {file_url}: {e}")
        return {"error": "Failed to retrieve file."}
    except Exception as e:
        logger.error(f"❌ Unexpected error: {e}")
        return {"error": str(e)}

    

@shared_task(bind=True, ignore_result=False)
def build_expectations_task(self, zenoh_file_path):
    local_path = os.path.join("/uploads", zenoh_file_path)

    try:
        raw_data = ZenohFileHandler.get_file(zenoh_file_path)

        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        with open(local_path, "wb") as f:
            f.write(raw_data.read())

        df_or_error = load_dataframe(local_path)
        if isinstance(df_or_error, pd.DataFrame):
            df=df_or_error
        else:
            return {"error": df_or_error}
        categorized = build_metadata()
        expectations, table_expectations, column_names = build_expectations_grouped(categorized,df)

        return {
            "categorized" : json.loads(json.dumps(categorized, default=str)),
            "expectations": json.loads(json.dumps(expectations, default=str)),
            "table_expectations": table_expectations,
            "column_names": column_names,
        }

    except Exception as e:
        self.retry(exc=e, countdown=5, max_retries=3)
    finally:
        if os.path.exists(local_path):
            os.remove(local_path)


@shared_task(bind=True, ignore_result=False)
def run_expectation_suites_task(self, file_id, suite_ids):
    try:
        file_record = get_file_record(file_id)
        if not file_record:
            return {"error": "Invalid file_id"}
        path=file_record.path
        project_id = file_record.project_id
        local_path = os.path.join("/uploads", path)
        os.makedirs(os.path.dirname(local_path), exist_ok=True)

        # ✅ Read raw data directly from Zenoh
        raw_data = ZenohFileHandler.get_file(file_record.path)
        if not raw_data:
            return {"error": "File not found in Zenoh"}

        # ✅ Write raw data to local file
        with open(local_path, "wb") as f:
            f.write(raw_data.read() if hasattr(raw_data, "read") else raw_data)

        print(f"✅ Downloaded file to: {local_path}")

        df_or_error = load_dataframe(local_path)
        if not isinstance(df_or_error, pd.DataFrame):
            print(f"❌ load_dataframe failed: {df_or_error}")
            return {"error": "Invalid file format or load error."}

        df = df_or_error
        results_summary = []

        for suite_id in suite_ids:
            suite = get_expectation_suite(suite_id)
            if not suite or not suite.expectations:
                continue

            suite_result, column_descriptions = run_expectation_suite(df, suite.to_json())

            result_json = json.dumps(suite_result, default=str)
            zenoh_file_path = f"projects/{project_id}/files/{file_id}/{file_id}_{suite_id}.json"

            success = ZenohFileHandler.put_file(zenoh_file_path, result_json)
            if success:
                save_validation_result(file_record, suite, suite_result, zenoh_file_path)
            results_summary.append({
                "suite_id": suite_id,
                "zenoh_path": zenoh_file_path,
                "column_descriptions": column_descriptions,
                "summary": suite_result.get("summary", {})
            })
        return {
            "status": "completed",
            "results": results_summary
        }

    except Exception as e:
        traceback.print_exc()
        return {"error": str(e)}

    finally:
        if os.path.exists(local_path):
            os.remove(local_path)


@shared_task(bind=True, ignore_result=False)
def build_column_descriptions_task(self, previous_result):
    try:
        column_names = previous_result.get("column_names")
        if not column_names:
            return {"error": "Missing description prompt."}

        prompt_parts = [
            "You are a helpful data assistant. For each column below, describe its meaning in one short sentence.",
            "Do not number the columns.",
            "Return the output as a JSON array of objects like this:\n\n[\n{ \"column\":\"column_name\",\"description\":\"your description here\" },\n    ...\n]"
        ]

        for col in column_names:
            prompt_parts.append(f"Column: {col}")

        description_prompt = "\n\n".join(prompt_parts)
        result = llm.invoke(description_prompt)

        # ✅ Parse the JSON response
        try:
            parsed_result = json.loads(result)
        except json.JSONDecodeError:
            return {"error": "LLM did not return valid JSON"}

        # 🧼 Cleanup local file
        local_path = previous_result.get("local_path")
        if local_path and os.path.exists(local_path):
            os.remove(local_path)

        return parsed_result  # ✅ Already in correct [{column, description}] format

    except Exception as e:
        print("Failed to generate column descriptions.")
        traceback.print_exc()

        return {"error": str(e)}  # ✅ Return error message instead of retrying
