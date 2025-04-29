from extensions.db import db
from sqlalchemy.dialects.postgresql import JSONB
from datetime import datetime, timezone
import uuid
import zenoh
import io
import logging

logging.basicConfig(level=logging.DEBUG, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)
## Should be handled with respect to ABAC
zenoh_session=zenoh.open()

def generate_uuid():
    return str(uuid.uuid4())

class File(db.Model):
    __tablename__ = 'files'
    
    # Define the fields in the model
    id = db.Column(db.String(), primary_key=True, default=generate_uuid)
    filename = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text(), nullable=True)
    use_case = db.Column(JSONB, nullable=True)
    project_id = db.Column(db.String(255), nullable=True)
    upload_filename= db.Column(db.String(255), nullable=True)
    path = db.Column(db.String(), nullable=False)
    user_id = db.Column(db.String(), nullable=False)
    created = db.Column(db.DateTime, default=datetime.now(timezone.utc), nullable=False)
    parent_files = db.Column(JSONB)  # Optional list of parent files
    file_size=db.Column(db.Integer())
    file_type = db.Column(db.String())  # Type of the file (e.g., PDF, CSV)
    file_hash = db.Column(db.String())  # Hash for file integrity check
    recdeleted = db.Column(db.Boolean, default=False)  # Soft delete flag
    uploader_metadata = db.Column(JSONB)  # Store metadata in JSONB format (PostgreSQL)
    nft_metadata = db.Column(JSONB)  # Optional metadata related to NFTs
    file_metadata = db.Column(JSONB)  # Store metadata in JSONB format (PostgreSQL)

    def __repr__(self):
        return f"<File {self.id}, {self.filename}>"
    
    def to_json(self):
        """Converts the File model to a JSON-serializable dictionaryfor my catalog and api."""
        return {
            'id': self.id,
            'filename': self.filename,  
            'upload_filename': self.upload_filename, 
            'description': self.description,
            'use_case': self.use_case if isinstance(self.use_case, list) else [], 
            'path': self.path,
            'user_id': self.user_id,
            'created': self.created.isoformat() if self.created else None,
            'parent_files': self.parent_files,
            'project_id': self.project_id,
            'file_size': self.file_size,
            'file_type': self.file_type,
            'recdeleted': self.recdeleted
        }
    
    def to_catalog(self):
        """Converts the File model to a JSON-serializable dictionary for catalog."""
        return {
            'id': self.id,
            'filename': self.filename,  
            'upload_filename': self.upload_filename, 
            'description': self.description,
            'use_case': self.use_case if isinstance(self.use_case, list) else [], 
            'path': self.path,
            'user_id': self.user_id,
            'created': self.created.isoformat() if self.created else None,
            'parent_files': self.parent_files,
            'project_id': self.project_id,
            'file_size': self.file_size,
            'file_type': self.file_type,
            'recdeleted': self.recdeleted,
            'file_metadata': self.file_metadata
        }
    
    @staticmethod
    def filter_files(filters):
        """Apply filters to query the files in the database."""
        query = db.session.query(File)

        # Apply filters (example for 'created' and 'use_case')
        for key, value in filters.items():
            if key == 'created':
                query = query.filter(File.created >= value)
            elif key == 'use_case':
                query = query.filter(File.use_case == value)
            elif key == 'user_id':
                query = query.filter(File.user_id.in_(value))
            elif key == 'metadata':
                query = query.filter(File.file_metadata != None)

        return query.all()
    


    @classmethod
    def get_file(cls, file_path):
        """Retrieve a file from Zenoh as a binary stream."""
        file_content = None  # Initialize content
        
        # Get Zenoh responses
        replies = zenoh_session.get(file_path, zenoh.Queue())
        for reply in replies:
            logger.info(f"✅ Zenoh Response Received: {reply}")

            # Ensure it's a successful response
            if reply.ok:
                file_content = reply.ok.payload  # Extract actual data
                logger.debug(f"📂 Received binary data ({len(file_content)} bytes)")
                break  # Stop after getting valid response

        if file_content:
            return io.BytesIO(file_content)  # Return as file-like object
        else:
            logger.error(f"❌ File not found in Zenoh: {file_path}")
            return None  # File not retrieved
        

        