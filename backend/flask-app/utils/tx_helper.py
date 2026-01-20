from celery import chain
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.sql import func
from web3 import Web3
from hexbytes import HexBytes
from decimal import Decimal
from extensions.db import db
from models.user import User, UserNotification
from models.blockchain import (
    ContractEvent,
    ContractTx,
    OnchainDataset,
    OnchainDatasetRequest,
)
from models.expectations import ExpectationSuites
from typing import Optional



def _record_tx(w3: Web3, network: str, tx_hash_hex: str, receipt=None):
    try:

        exists = db.session.query(ContractTx.id).filter_by(
            network=network, tx_hash=tx_hash_hex
        ).first()
        if exists:
            return

        tx = w3.eth.get_transaction(tx_hash_hex)
        rc = receipt or w3.eth.get_transaction_receipt(tx_hash_hex)

        blk = w3.eth.get_block(rc.blockNumber)
        ts = int(blk.timestamp) if hasattr(blk, "timestamp") else None

        row = ContractTx(
            network        = network,
            tx_hash        = tx_hash_hex,
            block_number   = rc.blockNumber,
            tx_index       = rc.transactionIndex,
            frm            = tx["from"],
            to             = tx["to"],
            value_wei      = tx["value"],
            status         = rc.status,
            gas_used       = rc.gasUsed,
            effective_gas_price = getattr(rc, "effectiveGasPrice", None),
            nonce          = tx["nonce"],
            input          = (tx["input"] if isinstance(tx["input"], (bytes, bytearray))
                              else bytes.fromhex(tx["input"][2:]) if isinstance(tx["input"], str) and tx["input"].startswith("0x") else None),
            contract_address = rc.contractAddress,
            block_timestamp  = ts,
            extra          = {
                "type": tx.get("type"),
                "maxFeePerGas": getattr(tx, "maxFeePerGas", None),
                "maxPriorityFeePerGas": getattr(tx, "maxPriorityFeePerGas", None),
            }
        )
        db.session.add(row)
        db.session.commit()
    except Exception as e:
        try:
            db.session.rollback()
        except Exception:
            pass
        print(f"[deploy] failed to record tx {tx_hash_hex}: {e}")


def _jsonify_event_args(v):
    if isinstance(v, dict):
        return {k: _jsonify_event_args(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [_jsonify_event_args(x) for x in v]
    if isinstance(v, (bytes, bytearray)):
        return "0x" + v.hex()
    if isinstance(v, HexBytes):
        return v.hex()  # already '0x...' string
    # common scalars are OK
    if isinstance(v, (str, int, bool)) or v is None:
        return v
    # last resort: stringify
    try:
        import json
        json.dumps(v)
        return v
    except Exception:
        return str(v)

def _update_onchain_dataset_state(dc, name, args, blk, tx_hash, log_index):
    # Dataset registered
    if dc.name == "DatasetRegistry" and name == "DatasetRegistered":
        fp = args.get("fingerprint") or args.get("datasetFingerprint")
        if not fp:
            return

        key = {
            "fingerprint": str(fp),
            "network": dc.network,
        }

        row = OnchainDataset.query.filter_by(**key).one_or_none()
        if not row:
            row = OnchainDataset(
                **key,
                dataset_registry_address=dc.address,
            )
            db.session.add(row)

        row.suite_hash  = args.get("suiteHash") or row.suite_hash
        row.file_format = args.get("fileFormat") or row.file_format
        row.uploader    = args.get("uploader") or row.uploader
        row.uri         = args.get("uri") or row.uri

        # event-provided timestamp
        ts = args.get("registeredAt")
        if ts is not None:
            row.registered_at_ts = int(ts)

        # provenance
        if row.registered_block is None:
            row.registered_block = blk
            row.registered_tx_hash = tx_hash

    # Validation submitted
    if dc.name == "ValidationRegistry" and name == "ValidationSubmitted":
        fp = args.get("datasetFingerprint") or args.get("fingerprint") or args.get("dataset")
        if not fp:
            return

        key = {
            "fingerprint": str(fp),
            "network": dc.network,
        }

        row = OnchainDataset.query.filter_by(**key).one_or_none()
        if not row:
            row = OnchainDataset(
                **key,
                dataset_registry_address="",  # unknown yet
                validation_registry_address=dc.address,
            )
            db.session.add(row)

        # maintain counts
        row.validations_count = (row.validations_count or 0) + 1

        # maintain validators set
        vaddr = args.get("validator")
        validators = set(row.validators_set or [])
        if vaddr:
            validators.add(vaddr)
        row.validators_set = list(validators)
        row.validators_count = len(validators)

        # status
        succ = args.get("successful")
        if succ is True or succ == "true":
            row.last_status = "valid"
        else:
            if row.last_status != "valid":  # once valid, keep valid
                row.last_status = "invalid"


def _update_onchain_suite_state(dc, name, args, blk, tx_hash, log_index):
    # Only for DatasetRequestRegistry
    if dc.name != "DatasetRequestRegistry":
        return

    try:
        suite_id = int(args.get("id"))
    except (TypeError, ValueError):
        return

    key = {
        "network": dc.network,
        "contract_address": dc.address,
        "id": suite_id,
    }

    row = OnchainDatasetRequest.query.filter_by(**key).one_or_none()
    if not row:
        row = OnchainDatasetRequest(**key)
        db.session.add(row)

        # provenance for first event (DatasetRequestCreated)
        row.created_block = blk
        row.created_tx_hash = tx_hash

    # Always advance "last seen" cursor for this suite
    row.last_event_block = blk
    row.last_event_log_index = log_index

    if name == "DatasetRequestCreated":
        row.requester      = args.get("requester") or row.requester
        row.suite_hash     = args.get("suiteHash") or row.suite_hash
        row.category       = args.get("category") or row.category
        row.file_format    = args.get("fileFormat") or row.file_format
        row.bounty_wei     = _as_decimal(args.get("bounty")) if args.get("bounty") is not None else row.bounty_wei
        row.total_expected = int(args.get("expected") or row.total_expected or 0)
        row.deadline       = int(args.get("deadline") or row.deadline or 0)

        row.suite_uri       = args.get("suiteURI") or row.suite_uri
        row.docs_uri        = args.get("docsURI") or row.docs_uri
        row.certificate_uri = args.get("certificateURI") or row.certificate_uri

        # link to ExpectationSuites via some key
        sh = row.suite_hash
        if sh:
            es = (
                ExpectationSuites.query
                .filter(ExpectationSuites.suite_hash == sh)
                .order_by(ExpectationSuites.created.desc())
                .first()
            )
            if es:
                row.expectation_suite_id = es.id
                row.user_id = es.user_id


    elif name == "DatasetRewardClaimed":
        amount = _as_decimal(args.get("amount") or 0)
        row.total_claims = (row.total_claims or 0) + 1
        row.claimed_wei = (row.claimed_wei or Decimal(0)) + amount

    elif name == "DatasetRequestClosed":
        row.is_closed = True
        row.closed_by = args.get("by") or row.closed_by
        if args.get("refund") is not None:
            row.refund_wei = _as_decimal(args.get("refund"))




def _create_notifications_for_event(
    dc,
    name,
    args,
    blk,
    tx_hash,
    log_index,
    evt_row: Optional[ContractEvent] = None,
):
    event_id = evt_row.id if evt_row else None

    # ---- DatasetRequestRegistry events ----
    if dc.name == "DatasetRequestRegistry":
        try:
            suite_id = int(args.get("id"))
        except (TypeError, ValueError):
            suite_id = None

        requester = None

        # 1) For DatasetRequestCreated we get requester directly in the event args
        if args.get("requester"):
            requester = args.get("requester")

        # 2) For DatasetRewardClaimed / DatasetRequestClosed, derive from OnchainDatasetRequest
        if requester is None and suite_id is not None:
            odr = (
                OnchainDatasetRequest.query
                .filter_by(
                    network=dc.network,
                    contract_address=dc.address,
                    id=suite_id,
                )
                .one_or_none()
            )
            if odr and odr.requester:
                requester = odr.requester

        if not requester:
            return

        user_sub = _find_user_sub_by_address(requester)
        if not user_sub:
            return

        if name == "DatasetRequestCreated":
            kind = "suite_created"
        elif name == "DatasetRewardClaimed":
            kind = "reward_claimed"
        elif name == "DatasetRequestClosed":
            kind = "suite_closed"
        else:
            return

        notif = UserNotification(
            user_sub=user_sub,
            kind=kind,
            network=dc.network,
            contract_address=dc.address,
            suite_id=suite_id,
            tx_hash=tx_hash,
            event_id=event_id,
            payload=args,
        )
        db.session.add(notif)
        return

    # ---- Dataset / Validation events -> notify uploader (if mapped) ----
    if dc.name in ("DatasetRegistry", "ValidationRegistry"):
        fp = (
            args.get("datasetFingerprint")
            or args.get("fingerprint")
            or args.get("dataset")
        )
        if not fp:
            return

        od = OnchainDataset.query.filter_by(
            fingerprint=str(fp),
            network=dc.network,
        ).one_or_none()

        if not od:
            return

        uploader = od.uploader or args.get("uploader")
        user_sub = _find_user_sub_by_address(uploader)
        if not user_sub:
            return

        if name == "DatasetRegistered":
            kind = "dataset_registered"
        elif name == "ValidationSubmitted":
            kind = "dataset_validated"
        else:
            return

        notif = UserNotification(
            user_sub=user_sub,
            kind=kind,
            network=dc.network,
            contract_address=dc.address,
            suite_id=None,
            dataset_fingerprint=str(fp),
            tx_hash=tx_hash,
            event_id=event_id,
            payload=args,
        )
        db.session.add(notif)





def _handle_event(dc, event):
    from tasks.task import run_expectation_suites_task
    from tasks.ethical_assessment import run_ethical_assessment_task
    from utils.file_handler import get_file_record
    from tasks.ethical_assessment import run_ethical_assessment_task, submit_onchain_ethical_validation_task
    from tasks.validation import build_onchain_validation_artifacts_task, submit_onchain_validation_task
    

    name      = event["event"]
    args_raw  = dict(event["args"])
    args_safe = _jsonify_event_args(args_raw)

    blk       = int(event["blockNumber"])
    tx_hash   = event["transactionHash"].hex()
    log_index = int(event["logIndex"])

    # 1) Store low-level event row (idempotent)
    stmt = pg_insert(ContractEvent).values(
        network=dc.network,
        address=dc.address,
        name=name,
        tx_hash=tx_hash,
        block_number=blk,
        log_index=log_index,
        args=args_safe,
    ).on_conflict_do_nothing(
        constraint="uq_tx_log"
    )
    db.session.execute(stmt)
    db.session.flush()

    # re-fetch to get ID for notifications
    evt_row = (
        ContractEvent.query
        .filter_by(tx_hash=tx_hash, log_index=log_index)
        .one_or_none()
    )

    # 2) Update denormalized tables
    try:
        _update_onchain_suite_state(dc, name, args_safe, blk, tx_hash, log_index)
        _update_onchain_dataset_state(dc, name, args_safe, blk, tx_hash, log_index)
        _create_notifications_for_event(dc, name, args_safe, blk, tx_hash, log_index, evt_row)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        raise

     # 3) 🔥 DATASET REGISTERED → run full validation pipeline via existing tasks
    if dc.name == "DatasetRegistry" and name == "DatasetRegistered":
        fp         = args_safe.get("fingerprint") or args_safe.get("datasetFingerprint")
        uri        = args_safe.get("uri")
        suite_hash = args_safe.get("suiteHash")
        uploader   = args_safe.get("uploader")

        if not (fp and uri and suite_hash):
            return

        # ---------------------------------------------
        # 3.1 Resolve local file_id & project_id from uri
        #     Expecting: projects/<project_id>/files/<file_id>/filename.ext
        # ---------------------------------------------
        file_id = None
        project_id = None
        try:
            parts = uri.split("/")
            # ["projects", "<project_id>", "files", "<file_id>", "filename.ext"]
            idx_projects = parts.index("projects")
            project_id = parts[idx_projects + 1]
            idx_files = parts.index("files")
            file_id = parts[idx_files + 1]
        except Exception:
            print(f"[handle_event] could not parse file_id/project_id from uri={uri}")

        if not file_id:
            print(
                f"[handle_event] DatasetRegistered: no file_id could be derived from uri={uri}"
            )
            return

        # ---------------------------------------------
        # 3.2 Resolve ExpectationSuite id via OnchainDatasetRequest
        # ---------------------------------------------
        suite_row = (
            OnchainDatasetRequest.query
            .filter_by(network=dc.network, suite_hash=suite_hash)
            .order_by(OnchainDatasetRequest.created_block.asc())
            .first()
        )

        suite_id = suite_row.expectation_suite_id if suite_row else None
        if not suite_id:
            print(
                f"[handle_event] no expectation_suite_id for suite_hash={suite_hash}"
            )
            # you can still run ethics later, but no GE validation
            return

        # ---------------------------------------------
        # 3.3 Resolve username from file record (same as your other tasks)
        # ---------------------------------------------
        fr = get_file_record(file_id)
        if not fr:
            print(f"[handle_event] no local file_record for file_id={file_id}")
            return

        username = fr.user_id  # same field you already log with

        # ---------------------------------------------
        # 3.4 Build Celery chain:
        #     1) run_expectation_suites_task  (existing)
        #     2) build_onchain_validation_artifacts_task (new)
        #     3) submit_onchain_validation_task (new)
        #     4) run_ethical_assessment_task (existing)
        # ---------------------------------------------

        first = run_expectation_suites_task.s(
            file_id=file_id,
            suite_ids=[suite_id],
            username=username,
        )

        second = build_onchain_validation_artifacts_task.s(
            network=dc.network,
            dataset_fingerprint=str(fp),
            dataset_uri=uri,
            suite_hash=suite_hash,
            uploader=uploader,
            project_id=project_id,
            file_id=file_id,
            suite_id=suite_id,
            username=username
        )

        third = submit_onchain_validation_task.s(
            network=dc.network,
            dataset_fingerprint=str(fp),
        )

        # last step: ethical assessment – immutable (ignore previous result)
        fourth = run_ethical_assessment_task.si(
            network=dc.network,
            dataset_fingerprint=str(fp),
            dataset_uri=uri,
            suite_hash=suite_hash,
            uploader=uploader,
            trigger_tx_hash=tx_hash,
            trigger_event_id=evt_row.id if evt_row else None,
        )

         # 5) submit ethical result as separate validation
        fifth = submit_onchain_ethical_validation_task.s(
            network=dc.network,
            dataset_fingerprint=str(fp),
            username=username,
            project_id=project_id,
            file_id=file_id,
            suite_id=suite_id,
            category=suite_row.category if suite_row else None,
        )

        chain(first, second, third, fourth, fifth).apply_async()

def _mk_contract(w3: Web3, address: str, abi: list):
    return w3.eth.contract(address=Web3.to_checksum_address(address), abi=abi)


def _find_user_sub_by_address(addr: str) -> Optional[str]:
    if not addr:
        return None
    # assuming User.public_key holds the wallet address
    u = (
        User.query
        .filter(func.lower(User.public_key) == addr.lower())
        .one_or_none()
    )
    return u.sub if u else None


def _as_decimal(v):
    if v is None:
        return None
    if isinstance(v, Decimal):
        return v
    return Decimal(str(v))
