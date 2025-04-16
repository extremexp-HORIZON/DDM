from utils.zenoh_file_handler import ZenohFileHandler
import logging

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

def generate_and_save_dataframe_metadata(df, file_id, project_id):
    """
    Generates descriptive metadata from a DataFrame using `.describe()`
    and saves it to Zenoh as JSON.

    :param df: pandas DataFrame
    :param file_id: ID of the file
    :param project_id: ID of the project
    :return: summary_json (str) if successful, None otherwise
    """
    try:
        summary_json = df.describe(include="all").to_json()
        metadata_path = f"projects/{project_id}/files/{file_id}/{file_id}_file_metadata.json"
        ZenohFileHandler.put_file(metadata_path, summary_json.encode("utf-8"))
        logger.info(f"📊 Metadata saved to Zenoh: {metadata_path}")
        return summary_json
    except Exception as e:
        logger.error(f"❌ Failed to generate/save dataframe metadata: {e}")
        return None
