import eventlet
eventlet.monkey_patch()  # ✅ Ensure this is at the top before importing anything else
import zenoh
import argparse
import logging
import io

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

zenoh_config = zenoh.Config()
zenoh_config.insert_json5("mode", '"client"')
zenoh_config.insert_json5("connect/endpoints", '["tcp/zenoh16:17447"]')

# Open Zenoh session
zenoh_session = zenoh.open(zenoh_config)

info = zenoh_session.info()
zid = str(info.zid())
routers = [str(router) for router in info.routers_zid()]
print(f"✅ Connected to Zenoh at {routers}")

def put_file(zenoh_key, local_path):
    """
    Upload a file to Zenoh.
    :param zenoh_key: The Zenoh key where the file will be stored.
    :param local_path: Path to the local file.
    """
    try:
        with open(local_path, "rb") as f:
            content = f.read()

        pub = zenoh_session.declare_publisher(zenoh_key)
        pub.put(content)
        logger.info(f"✅ File uploaded to Zenoh: {zenoh_key}")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to upload file: {e}")
        return False

def get_file(zenoh_key, local_path):
    """
    Download a file from Zenoh.
    :param zenoh_key: The Zenoh key where the file is stored.
    :param local_path: Path to save the file locally.
    """
    try:
        replies = zenoh_session.get(zenoh_key, zenoh.Queue())
        for reply in replies:
            if reply.ok:
                with open(local_path, "wb") as f:
                    f.write(reply.ok.payload)
                logger.info(f"✅ File downloaded from Zenoh to {local_path}")
                return True
        logger.error(f"❌ File not found in Zenoh: {zenoh_key}")
        return False
    except Exception as e:
        logger.error(f"❌ Failed to download file: {e}")
        return False

def list_files(folder_path):
    """
    List files stored in a Zenoh folder.
    :param folder_path: The Zenoh key prefix (e.g., "projects/1/files/**").
    """
    try:
        file_list = []
        replies = zenoh_session.get(folder_path, zenoh.Queue())
        for reply in replies:
            if reply.ok:
                file_list.append(reply.ok.key_expr)

        if file_list:
            logger.info(f"📂 Found {len(file_list)} files in {folder_path}")
            for file in file_list:
                print(f" - {file}")
        else:
            logger.warning(f"❌ No files found in {folder_path}")
    except Exception as e:
        logger.error(f"❌ Failed to list files: {e}")

def delete_file(zenoh_key):
    """
    Delete a file from Zenoh.
    :param zenoh_key: The Zenoh key of the file.
    """
    try:
        pub = zenoh_session.declare_publisher(zenoh_key)
        pub.delete()
        logger.info(f"🗑️ File deleted from Zenoh: {zenoh_key}")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to delete file: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description="Zenoh File CLI")
    parser.add_argument("action", choices=["upload", "download", "list", "delete"], help="Action to perform")
    parser.add_argument("--local", help="Local file path for upload/download")
    parser.add_argument("--zenoh", help="Zenoh key (e.g., 'projects/1/files/results.csv')")

    args = parser.parse_args()

    if args.action == "upload":
        if not args.local or not args.zenoh:
            print("❌ Error: --local and --zenoh arguments are required for upload")
            return
        success = put_file(args.zenoh, args.local)
        if success:
            print(f"✅ Uploaded {args.local} to Zenoh at {args.zenoh}")
        else:
            print("❌ Upload failed")

    elif args.action == "download":
        if not args.zenoh or not args.local:
            print("❌ Error: --zenoh and --local arguments are required for download")
            return
        success = get_file(args.zenoh, args.local)
        if success:
            print(f"✅ Downloaded {args.zenoh} to {args.local}")
        else:
            print("❌ Download failed")

    elif args.action == "list":
        if not args.zenoh:
            print("❌ Error: --zenoh argument (folder path) is required for listing files")
            return
        list_files(args.zenoh)

    elif args.action == "delete":
        if not args.zenoh:
            print("❌ Error: --zenoh argument is required for deletion")
            return
        success = delete_file(args.zenoh)
        if success:
            print(f"🗑️ Deleted {args.zenoh} from Zenoh")
        else:
            print("❌ Deletion failed")

if __name__ == "__main__":
    main()
