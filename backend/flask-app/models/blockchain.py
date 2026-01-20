# models/blockchain.py
from typing import Optional, Any, Dict
from extensions.db import db
from sqlalchemy.dialects.postgresql import JSONB, NUMERIC
from sqlalchemy import func

class DeployedContract(db.Model):
    __tablename__ = "deployed_contracts"

    id                 = db.Column(db.Integer, primary_key=True)
    network            = db.Column(db.String(64), nullable=False)
    name               = db.Column(db.String(128), nullable=False)
    address            = db.Column(db.String(66), nullable=False, index=True)  # 0x...
    abi                = db.Column(JSONB, nullable=False)
    tx_hash            = db.Column(db.String(80), nullable=True)
    start_block        = db.Column(db.Integer, nullable=False)                 # where to start logs
    last_scanned_block = db.Column(db.Integer, nullable=False)                 # cursor
    confirmations      = db.Column(db.Integer, nullable=False, default=3)
    status             = db.Column(db.String(32), nullable=False, default="active")  # active|paused|error

    __table_args__ = (db.UniqueConstraint('network', 'address', name='uq_network_address'),)

    def to_json(self, include_abi: bool = False, events_count: Optional[int] = None) -> Dict[str, Any]:
        data: Dict[str, Any] = {
            "id": self.id,
            "network": self.network,
            "name": self.name,
            "address": self.address,
            "tx_hash": self.tx_hash,
            "start_block": self.start_block,
            "last_scanned_block": self.last_scanned_block,
            "confirmations": self.confirmations,
            "status": self.status,
        }
        if include_abi:
            data["abi"] = self.abi
        if events_count is not None:
            data["events_count"] = int(events_count)
        return data



class ContractTx(db.Model):
    __tablename__ = "contract_txs"

    id              = db.Column(db.BigInteger, primary_key=True)
    network         = db.Column(db.String(64), index=True, nullable=False)
    tx_hash         = db.Column(db.String(80), index=True, nullable=False)
    block_number    = db.Column(db.Integer, index=True, nullable=False)
    tx_index        = db.Column(db.Integer, nullable=True)

    frm             = db.Column(db.String(66), index=True, nullable=True)   # from
    to              = db.Column(db.String(66), index=True, nullable=True)
    value_wei       = db.Column(db.Numeric(78, 0), nullable=True)

    status          = db.Column(db.Integer, nullable=True)   # 1=success, 0=revert (from receipt.status)
    gas_used        = db.Column(db.Numeric(78, 0), nullable=True)
    effective_gas_price = db.Column(db.Numeric(78, 0), nullable=True)

    nonce           = db.Column(db.Integer, nullable=True)
    input           = db.Column(db.LargeBinary, nullable=True)      # raw calldata (optional)
    contract_address = db.Column(db.String(66), index=True, nullable=True)  # if a creation tx

    block_timestamp = db.Column(db.Integer, index=True, nullable=True)      # unix ts
    extra           = db.Column(JSONB, nullable=True)  # room for anything else

    __table_args__ = (db.UniqueConstraint('network', 'tx_hash', name='uq_network_txhash'),)

    def to_json(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "network": self.network,
            "tx_hash": self.tx_hash,
            "block_number": self.block_number,
            "tx_index": self.tx_index,
            "from": self.frm,
            "to": self.to,
            "value_wei": str(self.value_wei) if self.value_wei is not None else None,
            "status": self.status,
            "gas_used": str(self.gas_used) if self.gas_used is not None else None,
            "effective_gas_price": str(self.effective_gas_price) if self.effective_gas_price is not None else None,
            "nonce": self.nonce,
            "contract_address": self.contract_address,
            "block_timestamp": self.block_timestamp,
            "extra": self.extra,
        }


class ContractEvent(db.Model):
    __tablename__ = "contract_events"

    id           = db.Column(db.BigInteger, primary_key=True)
    network      = db.Column(db.String(64), index=True, nullable=False)
    address      = db.Column(db.String(66), index=True, nullable=False)
    name         = db.Column(db.String(128), index=True, nullable=False)
    tx_hash      = db.Column(db.String(80), index=True, nullable=False)
    block_number = db.Column(db.Integer, index=True, nullable=False)
    log_index    = db.Column(db.Integer, nullable=False)
    args         = db.Column(JSONB, nullable=False)

    __table_args__ = (db.UniqueConstraint('tx_hash', 'log_index', name='uq_tx_log'),)

    def to_json(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "network": self.network,
            "address": self.address,
            "name": self.name,
            "tx_hash": self.tx_hash,
            "block_number": self.block_number,
            "log_index": self.log_index,
            "args": self.args,
        }


class OnchainDatasetRequest(db.Model):
    """
    Denormalized "current state" for a DatasetRequestRegistry suite.

    One row per (network, contract_address, suite_id).
    """
    __tablename__ = "onchain_dataset_requests"

    id = db.Column(db.BigInteger, primary_key=True)  # on-chain suiteId
    network = db.Column(db.String(64), nullable=False, index=True)
    contract_address = db.Column(db.String(66), nullable=False, index=True)

    # Optional links to your app domain
    expectation_suite_id = db.Column(
        db.String(), db.ForeignKey("expectation_suites.id"), nullable=True
    )
    user_id = db.Column(db.String(), nullable=True, index=True)

    # On-chain data from DatasetRequested
    requester = db.Column(db.String(66), nullable=False, index=True)
    suite_hash = db.Column(db.String(66), nullable=False, index=True)
    category = db.Column(db.String(255), nullable=True, index=True)
    file_format = db.Column(db.String(64), nullable=True, index=True)

    bounty_wei = db.Column(NUMERIC(78, 0), nullable=True)
    total_expected = db.Column(db.Integer, nullable=True)
    deadline = db.Column(db.Integer, nullable=True)  # unix ts

    suite_uri = db.Column(db.String(), nullable=True)
    docs_uri = db.Column(db.String(), nullable=True)
    certificate_uri = db.Column(db.String(), nullable=True)

    # Aggregated from RewardClaimed / SuiteClosed
    total_claims = db.Column(db.Integer, nullable=False, default=0)
    claimed_wei = db.Column(NUMERIC(78, 0), nullable=False, default=0)

    is_closed = db.Column(db.Boolean, nullable=False, default=False)
    closed_by = db.Column(db.String(66), nullable=True)
    refund_wei = db.Column(NUMERIC(78, 0), nullable=True)

    # Provenance
    created_block = db.Column(db.Integer, nullable=True)
    created_tx_hash = db.Column(db.String(80), nullable=True)
    created_block_ts = db.Column(db.Integer, nullable=True)

    last_event_block = db.Column(db.Integer, nullable=True)
    last_event_log_index = db.Column(db.Integer, nullable=True)

    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = db.Column(db.DateTime(timezone=True), server_default=func.now(),
                           onupdate=func.now(), nullable=False)

    __table_args__ = (
        db.UniqueConstraint(
            "network", "contract_address", "id",
            name="uq_onchain_dataset_req_network_contract_id",
        ),
    )


    def to_json(self):
        return {
            "id": self.id,
            "network": self.network,
            "contract_address": self.contract_address,
            "expectation_suite_id": self.expectation_suite_id,
            "user_id": self.user_id,
            "requester": self.requester,
            "suite_hash": self.suite_hash,
            "category": self.category,
            "file_format": self.file_format,
            "bounty_wei": str(self.bounty_wei) if self.bounty_wei is not None else None,
            "total_expected": self.total_expected,
            "deadline": self.deadline,
            "suite_uri": self.suite_uri,
            "docs_uri": self.docs_uri,
            "certificate_uri": self.certificate_uri,
            "total_claims": self.total_claims,
            "claimed_wei": str(self.claimed_wei) if self.claimed_wei is not None else None,
            "is_closed": self.is_closed,
            "closed_by": self.closed_by,
            "refund_wei": str(self.refund_wei) if self.refund_wei is not None else None,
            "created_block": self.created_block,
            "created_tx_hash": self.created_tx_hash,
            "created_block_ts": self.created_block_ts,
            "last_event_block": self.last_event_block,
            "last_event_log_index": self.last_event_log_index,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

class OnchainDataset(db.Model):
    """
    Aggregated view of a dataset fingerprint across DatasetRegistry & ValidationRegistry.
    """
    __tablename__ = "onchain_datasets"

    fingerprint = db.Column(db.String(), primary_key=True)  # bytes32 hex as string
    network = db.Column(db.String(64), nullable=False, index=True)
    dataset_registry_address = db.Column(db.String(66), nullable=False, index=True)
    validation_registry_address = db.Column(db.String(66), nullable=True, index=True)

    suite_hash = db.Column(db.String(66), nullable=True, index=True)
    file_format = db.Column(db.String(64), nullable=True, index=True)

    uploader = db.Column(db.String(66), nullable=True, index=True)
    uri = db.Column(db.String(), nullable=True)

    registered_at_ts = db.Column(db.Integer, nullable=True)   # from event arg
    registered_block = db.Column(db.Integer, nullable=True)
    registered_tx_hash = db.Column(db.String(80), nullable=True)

    validations_count = db.Column(db.Integer, nullable=False, default=0)
    validators_count = db.Column(db.Integer, nullable=False, default=0)
    last_status = db.Column(db.String(32), nullable=True)   # "valid", "invalid", None

    validators_set = db.Column(JSONB, nullable=True)  # list of addresses for convenience

    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = db.Column(db.DateTime(timezone=True), server_default=func.now(),
                           onupdate=func.now(), nullable=False)

    def to_json(self):
        return {
            "fingerprint": self.fingerprint,
            "network": self.network,
            "dataset_registry_address": self.dataset_registry_address,
            "validation_registry_address": self.validation_registry_address,
            "suite_hash": self.suite_hash,
            "file_format": self.file_format,
            "uploader": self.uploader,
            "uri": self.uri,
            "registered_at_ts": self.registered_at_ts,
            "registered_block": self.registered_block,
            "registered_tx_hash": self.registered_tx_hash,
            "validations_count": self.validations_count,
            "validators_count": self.validators_count,
            "last_status": self.last_status,
            "validators": self.validators_set or [],
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
