from werkzeug.utils import secure_filename
from extensions.db import db
from models.file import File
import logging
from sqlalchemy.exc import SQLAlchemyError
from werkzeug.utils import secure_filename

logger = logging.getLogger(__name__)




def get_file_record(file_id):
    file_record = File.query.get(file_id)
    if not file_record:
        raise ValueError(f"❌ File ID {file_id} not found in DB.")
    return file_record


def get_file_records_by_ids(file_ids):
    """
    Retrieve file records by a list of IDs.
    Returns a tuple: (records, error_message)
    """
    if not file_ids:
        return None, "No file IDs provided."

    records = File.query.filter(File.id.in_(file_ids)).all()

    if not records or len(records) < len(file_ids):
        found_ids = {str(file.id) for file in records}
        missing_ids = list(set(file_ids) - found_ids)
        return None, f"One or more files not found: {', '.join(missing_ids)}"

    return records, None



def save_file_record(file_data):
    """Create and save a file record in the DB with error handling."""
    try:
        new_file = File(**file_data)
        db.session.add(new_file)
        db.session.commit()
        return new_file
    except SQLAlchemyError as e:
        db.session.rollback()
        logger.error(f"❌ Failed to save file record: {str(e)}")
        raise  # or return None / False if you'd rather handle it that way


def update_file_record_in_db(file_id, path, file_size, file_hash, uploader_metadata=None, filename=None):
    """Update file record with storage info."""
    try:
        file_record = File.query.get(file_id)
        if not file_record:
            raise ValueError(f"File ID {file_id} not found in database.")

        file_record.path = path
        file_record.file_size = file_size
        file_record.file_hash = file_hash
        if uploader_metadata is not None:
            file_record.uploader_metadata = uploader_metadata
        if filename is not None:
            file_record.filename=filename

        db.session.commit()
        return True

    except SQLAlchemyError as e:
        db.session.rollback()
        logger.error(f"❌ DB commit failed for file {file_id}: {str(e)}")
        raise  # You can re-raise or return False if you prefer


def update_multiple_file_records(file_updates):
    updated_files = []
    errors = []

    for file_info in file_updates:
        file_id = file_info.get("file_id")

        if not file_id:
            errors.append({"file_id": None, "message": "Missing file_id."})
            continue

        file = File.query.get(file_id)

        if not file:
            errors.append({"file_id": file_id, "message": "File not found."})
            continue

        if file.nft_metadata:
            errors.append({"file_id": file_id, "message": "File is already registered as NFT, cannot be updated."})
            continue

        # ✅ Allowed Fields to Update
        allowed_fields = {"project_id", "description", "use_case", "upload_filename"}

        for key, value in file_info.items():
            if key in allowed_fields and value is not None:
                if key == "upload_filename":
                    file.upload_filename = secure_filename(value)
                elif key == "use_case":
                    if not isinstance(value, list):
                        errors.append({"file_id": file_id, "message": "use_case must be a list."})
                        continue
                    file.use_case = value
                else:
                    setattr(file, key, value)

        updated_files.append(file)

    try:
        if updated_files:
            db.session.commit()

        return [file.to_json() for file in updated_files], errors

    except SQLAlchemyError as e:
        db.session.rollback()
        return None, [{"message": f"Database error: {str(e)}"}]
    


def store_file_metadata_in_db(file_id, path, size, file_hash):
    file_record = File.query.get(file_id)
    if not file_record:
        raise ValueError(f"File ID {file_id} not found in DB")

    file_record.path = path
    file_record.file_size = size
    file_record.file_hash = file_hash

    db.session.add(file_record)
    db.session.commit()
