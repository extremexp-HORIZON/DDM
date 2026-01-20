# models/ethics.py
from datetime import datetime, timezone
from sqlalchemy.dialects.postgresql import JSONB
from extensions.db import db


class DatasetEthicalAssessment(db.Model):
    __tablename__ = "dataset_ethical_assessments"

    id = db.Column(db.Integer, primary_key=True)

    # which chain + dataset
    network = db.Column(db.String(64), nullable=False, index=True)
    dataset_fingerprint = db.Column(db.String(66), nullable=False, index=True)  # 0x... bytes32

    # assessment
    score   = db.Column(db.Float, nullable=True)   # e.g. 0.0–1.0
    label   = db.Column(db.String(32), nullable=True)  # "low", "medium", "high", etc.
    summary = db.Column(db.Text, nullable=True)
    details = db.Column(JSONB, nullable=True)

    # provenance
    suite_hash       = db.Column(db.String(66), nullable=True)
    uploader         = db.Column(db.String(128), nullable=True)
    assessed_at      = db.Column(db.DateTime(timezone=True), nullable=True)

    trigger_tx_hash  = db.Column(db.String(80), nullable=True, index=True)
    trigger_event_id = db.Column(db.Integer, nullable=True, index=True)

    __table_args__ = (
        db.UniqueConstraint("network", "dataset_fingerprint", name="uq_ethics_dataset"),
    )
    def to_json(self):
        return {
            "id": self.id,
            "network": self.network,
            "dataset_fingerprint": self.dataset_fingerprint,
            "score": self.score,
            "label": self.label,
            "summary": self.summary,
            "details": self.details,
            "suite_hash": self.suite_hash,
            "uploader": self.uploader,
            "assessed_at": self.assessed_at.isoformat() if self.assessed_at else None,
            "trigger_tx_hash": self.trigger_tx_hash,
            "trigger_event_id": self.trigger_event_id,
        }