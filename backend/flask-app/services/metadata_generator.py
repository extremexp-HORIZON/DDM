from utils.zenoh_file_handler import ZenohFileHandler
import logging
import json
import numpy as np


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

def clean_json(obj):
    """Recursively clean NaN/inf values for JSON serialization"""
    if isinstance(obj, dict):
        return {k: clean_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [clean_json(v) for v in obj]
    elif isinstance(obj, float):
        if np.isnan(obj) or np.isinf(obj):
            return None
        return obj
    return obj

def generate_and_save_dataframe_metadata(df, file_id, project_id):
    """
    Generates rich metadata from a DataFrame and saves it to Zenoh as JSON.
    """
    try:
        raw_metadata = {
            "summary_statistics": df.describe(include="all").to_dict(),
            "schema": df.dtypes.apply(lambda x: str(x)).to_dict(),
            "null_counts": df.isnull().sum().to_dict(),
            "non_null_counts": df.notnull().sum().to_dict(),
            "sample_rows": df.head(5).to_dict(orient="records"),
            "shape": list(df.shape),
            "columns": df.columns.tolist()
        }

        metadata = clean_json(raw_metadata)

        summary_json = json.dumps(metadata, indent=2)
        metadata_path = f"projects/{project_id}/files/{file_id}/{file_id}_file_metadata.json"
        ZenohFileHandler.put_file(metadata_path, summary_json.encode("utf-8"))
        logger.info(f"📊 Metadata saved to Zenoh: {metadata_path}")
        return summary_json
    except Exception as e:
        logger.exception(f"❌ Failed to generate/save dataframe metadata for file {file_id}")
        return None