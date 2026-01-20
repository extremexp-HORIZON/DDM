from extensions.db import db
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import JSONB

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


class UserNotification(db.Model):
    __tablename__ = "user_notifications"

    id = db.Column(db.BigInteger, primary_key=True)

    # Canonical link to User (OIDC subject)
    user_sub = db.Column(
        db.String(),
        db.ForeignKey("users.sub"),
        index=True,
        nullable=False,
    )

    kind = db.Column(db.String(64), nullable=False, index=True)
    # e.g. "suite_created", "reward_claimed", "suite_closed",
    #      "dataset_registered", "dataset_validated"

    network = db.Column(db.String(64), nullable=True)
    contract_address = db.Column(db.String(66), nullable=True)
    suite_id = db.Column(db.BigInteger, nullable=True)
    dataset_fingerprint = db.Column(db.String(), nullable=True)
    tx_hash = db.Column(db.String(80), nullable=True)
    event_id = db.Column(db.BigInteger, nullable=True)  # FK to ContractEvent.id (optional)

    payload = db.Column(JSONB, nullable=True) 
    is_read = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(
        db.DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    read_at = db.Column(db.DateTime(timezone=True), nullable=True)

    def to_json(self):
        return {
            "id": self.id,
            "user_sub": self.user_sub,
            "kind": self.kind,
            "network": self.network,
            "contract_address": self.contract_address,
            "suite_id": self.suite_id,
            "dataset_fingerprint": self.dataset_fingerprint,
            "tx_hash": self.tx_hash,
            "event_id": self.event_id,
            "payload": self.payload,
            "is_read": self.is_read,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "read_at": self.read_at.isoformat() if self.read_at else None,
        }



class PreferredQuery(db.Model):
    __tablename__ = "preferred_queries"

    id = db.Column(db.BigInteger, primary_key=True)
    user_sub = db.Column(
        db.String(),
        db.ForeignKey("users.sub"),
        index=True,
        nullable=False,
    )

    name = db.Column(db.String(255), nullable=True)   # optional label like "My filter 1"
    query_json = db.Column(JSONB, nullable=False)          # store react-querybuilder JSON
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), nullable=False)

    def to_json(self):
        return {
            "id": self.id,
            "user_sub": self.user_sub,
            "name": self.name,
            "query": self.query_json,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
