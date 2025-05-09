import io
import logging
import zenoh
import os

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

zenoh_config = zenoh.Config()
zenoh_config.insert_json5("mode", '"client"')
zenoh_config.insert_json5("connect/endpoints", '["tcp/zenoh1:7447"]')

# Open Zenoh session
zenoh_session = zenoh.open(zenoh_config)


class ZenohFileHandler:
    """Handles file storage and retrieval in Zenoh."""

    @staticmethod
    def put_file(file_path, file_content):
        """
        Store a file in Zenoh.

        :param file_path: The Zenoh key (e.g., "projects/1/files/myfile.txt").
        :param file_content: File content as bytes.
        """
        try:
            pub = zenoh_session.declare_publisher(file_path)
            pub.put(file_content)
            logger.info(f"✅ File stored in Zenoh: {file_path}")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to store file in Zenoh: {e}")
            return False
        

    @staticmethod
    def get_file(file_path):
        """
        Retrieve a file from Zenoh as a binary stream.

        :param file_path: The Zenoh key (e.g., "projects/1/files/myfile.txt").
        :return: BytesIO stream of file content or None if not found.
        """
        file_content = None  # Initialize content
        
        replies = zenoh_session.get(file_path, zenoh.Queue())
        for reply in replies:
            logger.info(f"✅ Zenoh Response Received: {reply}")

            if reply.ok:
                file_content = reply.ok.payload
                logger.debug(f"📂 Received binary data ({len(file_content)} bytes)")
                break  # Stop after getting valid response

        if file_content:
            return io.BytesIO(file_content)  # Return as file-like object
        else:
            logger.error(f"❌ File not found in Zenoh: {file_path}")
            return None

    @staticmethod
    def list_files(folder_path):
        """
        List all files stored in a Zenoh folder.

        :param folder_path: The Zenoh key prefix (e.g., "projects/1/files/**").
        :return: List of file paths.
        """
        file_list = []

        replies = zenoh_session.get(folder_path, zenoh.Queue())
        for reply in replies:
            if reply.ok:
                file_list.append(reply.ok.key_expr)
        
        logger.info(f"📂 Found {len(file_list)} files in {folder_path}")
        return file_list

    @staticmethod
    def delete_file(file_path):
        """
        Delete a file from Zenoh.

        :param file_path: The Zenoh key (e.g., "projects/1/files/myfile.txt").
        :return: True if deleted, False otherwise.
        """
        try:
            pub = zenoh_session.declare_publisher(file_path)
            pub.delete()
            logger.info(f"🗑️ File deleted from Zenoh: {file_path}")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to delete file in Zenoh: {e}")
            return False
        


        
def merge_file_chunks_from_zenoh(file_id, project_id, total_chunks):
    merged_file = io.BytesIO()

    for i in range(total_chunks):
        chunk_path = f"projects/{project_id}/files/{file_id}/chunks/chunk_{i}"
        chunk_data = ZenohFileHandler.get_file(chunk_path)

        if not chunk_data:
            logger.error(f"❌ Missing chunk: {chunk_path}")
            return None, f"Missing chunk {i}"

        merged_file.write(chunk_data.read())
        logger.info(f"✅ Merged chunk {i} from {chunk_path}")

    return merged_file, None



def download_file_from_zenoh(file_path, local_path):
    file_data = ZenohFileHandler.get_file(file_path)
    if not file_data:
        raise FileNotFoundError(f"❌ File not found in Zenoh: {file_path}")
    with open(local_path, "wb") as f:
        f.write(file_data.read() if isinstance(file_data, io.BytesIO) else file_data)
    return local_path


def save_processed_file(df, file_path, ext):
    temp_path = f"/tmp/{os.path.basename(file_path)}_processed{ext}"
    if ext != ".parquet":
        df.to_csv(temp_path, index=False)
    else:
        df.to_parquet(temp_path)
    with open(temp_path, "rb") as f:
        ZenohFileHandler.put_file(file_path, f.read())
    return temp_path


