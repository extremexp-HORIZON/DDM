from extensions.db import db
from sqlalchemy.sql import func

class User(db.Model):
    __tablename__ = 'users'

    sub = db.Column(db.String(), primary_key=True)
    username = db.Column(db.String(150), nullable=False, unique=True)
    email = db.Column(db.String(255), nullable=True)
    public_key = db.Column(db.String(255), nullable=True)
    profile_pic = db.Column(db.String(255), nullable=True) 
    created = db.Column(db.DateTime(timezone=True), server_default=func.now(), nullable=False)

    def __repr__(self):
        return f"<User {self.sub}, {self.username}>"

    def to_json(self):
        return {
            "sub": self.sub,
            "username": self.username,
            "email": self.email,
            "public_key": self.public_key,
            "profile_pic": self.profile_pic,
            "created": self.created.isoformat() if self.created else None
        }


class UserAction(db.Model):
    __tablename__ = 'user_actions'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(), db.ForeignKey('users.username'), nullable=False)
    file_id = db.Column(db.String(), nullable=True)  # optional, e.g. for login/logout
    action_type = db.Column(db.String(50), nullable=False)  # e.g. 'upload', 'download', 'login', etc.
    timestamp = db.Column(db.DateTime(timezone=True), server_default=func.now(), nullable=False)
    log_metadata = db.Column(db.JSON, nullable=True)
    user = db.relationship("User", backref="actions")

    def to_json(self):
        return {
            "id": self.id,
            "username": self.username,
            "file_id": self.file_id,
            "action_type": self.action_type,
            "timestamp": self.timestamp.isoformat(),
            "metadata": self.log_metadata
        }