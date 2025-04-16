from utils.file_df_loader import load_dataframe
from models.file import File
import os
import pandas as pd
import logging
from PIL import Image
import json
from extensions.db import db
import hashlib
import requests
from utils.zenoh_file_handler import *
from sqlalchemy.exc import SQLAlchemyError
from utils.file_handler import get_file_records_by_ids 

SUPPORTED_TEXT_FORMATS = [".csv", ".txt", ".parquet"]
SUPPORTED_IMAGE_FORMATS = [".jpg", ".jpeg", ".png", ".tiff", ".bmp", ".gif"]


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



def delete_file_record(file):
    """
    Perform Zenoh cleanup and soft delete a file record in the DB.
    """
    try:
        file_id = file.id
        zenoh_file_path = file.path
        zenoh_metadata_path = f"projects/{file.project_id}/files/{file_id}/user_metadata.json"

        # ✅ Delete from Zenoh
        file_deleted = ZenohFileHandler.delete_file(zenoh_file_path)
        metadata_deleted = ZenohFileHandler.delete_file(zenoh_metadata_path)

        if not (file_deleted and metadata_deleted):
            logger.warning(f"⚠️ One or more Zenoh entries missing: {zenoh_file_path}, {zenoh_metadata_path}")
        else:
            logger.info(f"✅ Zenoh cleaned: {zenoh_file_path}, {zenoh_metadata_path}")

        # ✅ Update DB
        file.uploader_metadata = None
        file.recdeleted = True
        db.session.commit()

        return True, None

    except Exception as e:
        db.session.rollback()
        logger.error(f"❌ Failed to delete file: {str(e)}")
        return False, str(e)



def delete_files_by_ids(file_ids):
    files=get_file_records_by_ids(file_ids)

    if not files or len(files) < len(file_ids):
        return None, "One or more files not found."

    deleted_count = 0

    for file in files:
        if not file.path:
            logger.warning(f"⚠️ File {file.id} has no valid path, skipping...")
            continue

        zenoh_file_path = file.path
        zenoh_metadata_path = f"projects/{file.project_id}/files/{file.id}/user_metadata.json"

        # Zenoh file deletion
        file_deleted = ZenohFileHandler.delete_file(zenoh_file_path)
        if file_deleted:
            logger.info(f"✅ File deleted from Zenoh: {zenoh_file_path}")
        else:
            logger.warning(f"⚠️ File not found in Zenoh: {zenoh_file_path}")

        # Zenoh metadata deletion
        metadata_deleted = ZenohFileHandler.delete_file(zenoh_metadata_path)
        if metadata_deleted:
            logger.info(f"✅ Metadata deleted from Zenoh: {zenoh_metadata_path}")
        else:
            logger.warning(f"⚠️ Metadata not found in Zenoh: {zenoh_metadata_path}")

        # Soft delete in DB
        file.uploader_metadata = None
        file.recdeleted = True
        deleted_count += 1

    try:
        db.session.commit()
        return deleted_count, None
    except Exception as e:
        db.session.rollback()
        logger.error(f"❌ DB commit failed during delete: {str(e)}")
        return None, f"Database error: {str(e)}"
    

def delete_uploader_metadata_from_zenoh(file):
    """Delete only uploader metadata from Zenoh and clear it in the DB."""
    metadata_path = f"projects/{file.project_id}/files/{file.id}/user_metadata.json"

    metadata_deleted = ZenohFileHandler.delete_file(metadata_path)

    try:
        file.uploader_metadata = None
        db.session.commit()
        logger.info(f"✅ Uploader metadata removed for file {file.id}")
    except SQLAlchemyError as e:
        db.session.rollback()
        logger.error(f"❌ DB update failed for file {file.id}: {str(e)}")
        return False, f"DB error: {str(e)}"

    return metadata_deleted, None

def add_or_update_uploader_metadata(file, uploader_metadata):
    """
    Store uploader metadata in Zenoh and update it in the DB.
    """
    try:
        if not uploader_metadata or not isinstance(uploader_metadata, dict):
            return False, "Uploader metadata must be a valid JSON object."

        zenoh_metadata_path = f"projects/{file.project_id}/files/{file.id}/user_metadata.json"
        success = ZenohFileHandler.put_file(zenoh_metadata_path, json.dumps(uploader_metadata).encode('utf-8'))

        if not success:
            return False, "Failed to store metadata in Zenoh."

        file.uploader_metadata = uploader_metadata
        db.session.commit()
        return True, None

    except SQLAlchemyError as e:
        db.session.rollback()
        logger.error(f"❌ Failed to update DB uploader metadata for file {file.id}: {str(e)}")
        return False, f"Database error: {str(e)}"


def load_dataframe_or_image(local_path, file_record):
    df_or_error = load_dataframe(local_path)
    if isinstance(df_or_error, pd.DataFrame):
        return df_or_error
    ext = os.path.splitext(local_path)[-1].lower()
    if ext in SUPPORTED_IMAGE_FORMATS:
        return process_image_file(local_path, file_record)
    raise ValueError(df_or_error)


# 🔹 Function to cleanup temporary files
def cleanup_files(file_paths):
    """Removes temporary files after processing."""
    for file_path in file_paths:
        if os.path.exists(file_path):
            os.remove(file_path)
            logger.info(f"🗑️ Deleted temp file: {file_path}")


# 🔹 Function to process text-based files
def process_text_file(file_path, file_ext):
    """Reads CSV/TXT files and automatically detects delimiters."""
    try:
        return pd.read_csv(file_path, delimiter=None, encoding="utf-8", on_bad_lines="skip")  # Auto-detect delimiter
    except Exception as e:
        logger.error(f"❌ Failed to read {file_ext.upper()} file: {e}")
        raise


# 🔹 Function to process image files
def process_image_file(file_path, file_record):
    """Extract metadata from image files."""
    try:
        with Image.open(file_path) as img:
            metadata = {
                "format": img.format,
                "mode": img.mode,
                "size": img.size,
                "color_palette": img.palette is not None,
            }

            file_record.file_metadata = json.dumps(metadata)
            db.session.add(file_record)
            db.session.commit()

            logger.info(f"✅ Image metadata stored: {metadata}")
            return {"message": "Image metadata processed successfully", "metadata": metadata}
    except Exception as e:
        logger.error(f"❌ Failed to process image: {e}")
        return {"error": str(e)}



def compute_file_hash(data: bytes) -> str:
    return hashlib.sha1(data).hexdigest()


def download_file_from_url(url: str, timeout: int = 15) -> bytes:
    response = requests.get(url, stream=True, timeout=timeout)
    response.raise_for_status()
    return response.content


def calculate_file_hash(file_content):
    """Calculate SHA1 hash of file content."""
    hasher = hashlib.sha1()
    hasher.update(file_content)
    return hasher.hexdigest()


def process_metadata(metadata_file):
    """Process and load metadata from the uploaded file."""
    try:
        metadata_content = metadata_file.read()
        metadata = json.loads(metadata_content)
        return metadata
    except Exception as e:
        logger.error(f"Failed to parse metadata file: {str(e)}")
        raise Exception("Invalid metadata file format.")