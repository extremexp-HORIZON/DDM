from celery import shared_task
from web3 import Web3
from extensions.db import db
from models.blockchain import DeployedContract
from web3_scripts.web3_factory import get_w3
from sqlalchemy.exc import SQLAlchemyError, StatementError
from collections import defaultdict
from celery.utils.log import get_task_logger
from utils.tx_helper import _record_tx, _mk_contract, _handle_event, _jsonify_event_args
from celery.exceptions import Retry

log = get_task_logger(__name__)
# ---- CONFIG
BLOCK_BATCH_SIZE = 1_000       # how many blocks per scan step
RETRY_SECS = 60                # re-queue delay
CONFIRMATIONS_DEFAULT = 3
SLEEP_BETWEEN_TX=20  # seconds

@shared_task(bind=True, max_retries=None, default_retry_delay=RETRY_SECS)
def wait_for_receipt_task(
    self,
    network: str,
    tx_hash_hex: str,
    contract_name: str,
    address: str,
    abi: list,
    confirmations: int = CONFIRMATIONS_DEFAULT,
):
    try:
        w3 = get_w3(network)
        tx_hash = Web3.to_bytes(hexstr=tx_hash_hex)
        receipt = w3.eth.get_transaction_receipt(tx_hash)

        latest = w3.eth.block_number
        if latest - receipt.blockNumber < confirmations:
            # ⬇️ schedule retry – DO NOT fall through to generic except
            raise self.retry(
                exc=Exception("Not enough confirmations yet"),
                countdown=RETRY_SECS,
            )

        start_block = max(receipt.blockNumber - 1, 0)

        dc = DeployedContract.query.filter_by(
            network=network,
            address=address,
        ).one_or_none()

        if not dc:
            dc = DeployedContract(
                network=network,
                name=contract_name,
                address=address,
                abi=abi,
                tx_hash=tx_hash_hex,
                start_block=start_block,
                last_scanned_block=start_block,
                confirmations=confirmations,
                status="active",
            )
            db.session.add(dc)
            db.session.commit()

        # kick off scanner starting near deploy block
        scan_events_task.apply_async(
            kwargs=dict(
                network=network,
                address=address,
                abi=abi,
                from_block=start_block,
                poll_secs=RETRY_SECS,
                max_blocks_per_tick=BLOCK_BATCH_SIZE,
            ),
            countdown=1,
        )

        try:
            _record_tx(w3, network, tx_hash_hex, receipt=receipt)
        except Exception as rec_err:
            log.warning(f"tx record failed for deploy tx {tx_hash_hex}: {rec_err}")

        return {"status": "confirmed", "block": receipt.blockNumber}

    # ⬇️ IMPORTANT: handle Retry separately
    except Retry:
        # let Celery do the retry; don't turn this into a result dict
        raise

    except self.MaxRetriesExceededError as e:
        log.error(f"wait_for_receipt_task max retries exceeded for {address}: {e}", exc_info=True)
        db.session.rollback()
        return {"status": "error", "error": "max retries exceeded"}

    except Exception as e:
        log.error(f"scan failed for {address}: {e}", exc_info=True)
        db.session.rollback()
        return {"status": "error", "error": str(e)}

    

@shared_task(bind=True, max_retries=0)
def scan_events_task(
    self,
    network: str,
    address: str,
    abi: list = None,
    from_block: int = None,
    poll_secs: int = RETRY_SECS,
    max_blocks_per_tick: int = BLOCK_BATCH_SIZE,
):
    try:
        w3 = get_w3(network)
        dc = (DeployedContract.query
              .filter_by(network=network, address=address)
              .with_for_update()
              .one_or_none())

        if not dc or dc.status != "active":
            return {"status": "stopped"}

        # override start block once
        if isinstance(from_block, int):
            dc.last_scanned_block = max(int(from_block), dc.start_block)

        use_abi = dc.abi or abi
        if not use_abi:
            db.session.commit()
            return {"status": "no_abi"}

        contract = _mk_contract(w3, dc.address, use_abi)

        latest = w3.eth.block_number
        safe_to = latest - dc.confirmations

        # nothing to do
        if safe_to <= dc.last_scanned_block:
            db.session.commit()
            return {
                "status": "complete",
                "last": dc.last_scanned_block,
                "safe_to": safe_to,
            }

        start = dc.last_scanned_block + 1
        end = safe_to


        print(f"[scan] {dc.name}@{dc.address} blocks {start}-{end}")

        logs = w3.eth.get_logs({
            "fromBlock": start,
            "toBlock":   end,
            "address":   Web3.to_checksum_address(dc.address),
        })
        seen_txs = set()
        for log in logs:
            tx_hash_hex = log["transactionHash"].hex()
            try:
                evt = contract.events._find_matching_event_abi(log["topics"])[0]
                event = contract.events[evt["name"]]().process_log(log)
                _handle_event(dc, event)
                seen_txs.add(tx_hash_hex)
            except Exception:
                # brute-force attempt all known events
                for e_name in contract.events.__dict__:
                    if not e_name[:1].isupper():
                        continue
                    try:
                        event = getattr(contract.events, e_name)().process_log(log)
                        _handle_event(dc, event)
                        seen_txs.add(tx_hash_hex)
                        break
                    except Exception:
                        pass
        # persist each transaction once (serially)
        for txh in seen_txs:
            try:
                _record_tx(w3, network, txh)
            except Exception as rec_err:
                log.warning(f"tx record failed for {txh}: {rec_err}")
               
        dc.last_scanned_block = end
        db.session.commit()

        return {
            "status": "scanned",
            "from": start,
            "to": end,
            "count": len(logs),
        }

    except Exception as e:
        log.error(f"scan failed for {address}: {e}", exc_info=True)
        return {"status": "error", "error": str(e)}


@shared_task(bind=True, max_retries=0)
def kick_scan_all_contracts(self, max_blocks_per_tick: int = BLOCK_BATCH_SIZE, sleep_between_contracts: float = 1.5):
    import time
    checked = scanned = no_abi = idle = errors = 0

    rows = (DeployedContract.query
            .filter_by(status="active")
            .order_by(DeployedContract.network, DeployedContract.name)
            .all())
    if not rows:
        log.info("kick_scan.no_active_contracts")
        return {"checked": 0, "scanned": 0, "no_abi": 0, "idle": 0, "errors": 0}

    by_net = defaultdict(list)
    for dc in rows:
        by_net[dc.network].append(dc)

    for network, contracts in by_net.items():
        try:
            w3 = get_w3(network)
            latest = w3.eth.block_number
        except Exception as e:
            log.error(f"[kick] network={network} init failed: {e}", exc_info=True)
            errors += len(contracts)
            continue

        for dc in contracts:
            checked += 1

            if not (isinstance(dc.abi, list) and dc.abi):
                no_abi += 1
                log.warning(f"[kick] skip(no_abi) {dc.name}@{dc.address} net={network}")
                continue

            try:
                confs   = dc.confirmations or CONFIRMATIONS_DEFAULT
                safe_to = latest - confs
                cursor  = (dc.last_scanned_block or dc.start_block or 0)

                if safe_to <= cursor:
                    idle += 1
                    continue

                start = cursor + 1
                end   = min(start + max_blocks_per_tick - 1, safe_to)
                if end < start:  # guard (shouldn’t happen, but safe)
                    end = start

                address_cs = Web3.to_checksum_address(dc.address)
                logs = w3.eth.get_logs({
                    "fromBlock": start,
                    "toBlock":   end,
                    "address":   address_cs,
                })

                contract = _mk_contract(w3, dc.address, dc.abi)

                seen_txs = set()

                for log_entry in logs:
                    # always record the tx later even if decode fails
                    txh = log_entry["transactionHash"].hex()
                    seen_txs.add(txh)

                    try:
                        decoded = None
                        try:
                            evt_abi = contract.events._find_matching_event_abi(log_entry["topics"])[0]
                            decoded = contract.events[evt_abi["name"]]().process_log(log_entry)
                        except Exception:
                            # brute-force fallback
                            for e_name in contract.events.__dict__:
                                if e_name[:1].isupper():
                                    try:
                                        decoded = getattr(contract.events, e_name)().process_log(log_entry)
                                        break
                                    except Exception:
                                        pass

                        if decoded:
                            # persist event (idempotent in _handle_event)
                            _handle_event(dc, decoded)

                    except (StatementError, TypeError) as ser:
                        # JSON/DB serialization errors: log & continue
                        db.session.rollback()
                        log.error(f"[kick] event persist failed {dc.name}@{dc.address} tx={txh}: {ser}")
                        errors += 1
                        continue
                    except Exception as e:
                        # unknown per-event failure: log & continue
                        db.session.rollback()
                        log.error(f"[kick] event decode/persist error {dc.name}@{dc.address} tx={txh}: {e}", exc_info=True)
                        errors += 1
                        continue

                # persist the related txs exactly once (serially)
                for txh in seen_txs:
                    try:
                        _record_tx(w3, network, txh)
                    except Exception as rec_err:
                        db.session.rollback()
                        log.warning(f"[kick] tx record failed for {txh}: {rec_err}")
                        # don’t treat as fatal

                # advance cursor even if there were no logs, so we make progress
                dc.last_scanned_block = end
                db.session.commit()

                scanned += 1
                log.info(f"[kick] scanned {dc.name}@{dc.address} {start}-{end} "
                         f"logs={len(logs)} safe_to={safe_to} latest={latest}")

            except SQLAlchemyError as sqle:
                db.session.rollback()
                errors += 1
                log.error(f"[kick] DB error {dc.name}@{dc.address}: {sqle}", exc_info=True)
            except Exception as e:
                db.session.rollback()
                errors += 1
                log.error(f"[kick] scan error {dc.name}@{dc.address}: {e}", exc_info=True)
            finally:
                if sleep_between_contracts:
                    time.sleep(sleep_between_contracts)

    summary = {"checked": checked, "scanned": scanned, "no_abi": no_abi, "idle": idle, "errors": errors}
    log.info(f"[kick] summary {summary}")
    return summary


@shared_task(
    bind=True,
    name="tasks.chain.ingest_tx_task",
    max_retries=3,
    default_retry_delay=30,
    ignore_result=False,
)
def ingest_tx_task(self, network: str, address: str, tx_hash: str):
    try:
        w3 = get_w3(network)

        # 1) Always try to record the tx, even if ABI is missing
        receipt = None
        try:
            receipt = w3.eth.get_transaction_receipt(tx_hash)
            _record_tx(w3=w3, network=network, tx_hash_hex=tx_hash, receipt=receipt)
        except Exception as rec_err:
            log.warning(f"[ingest_tx_task] tx record failed {network} {address} {tx_hash}: {rec_err}")

        # 2) Look up contract row (may not exist yet)
        dc = (
            DeployedContract.query
            .filter_by(network=network, address=address)
            .one_or_none()
        )

        # If we don't know this contract/ABI yet, that's OK – scanner will handle later
        if not dc or not isinstance(dc.abi, list) or not dc.abi:
            return {
                "status": "no_abi_yet",
                "message": "tx recorded but DeployedContract/ABI not available yet",
                "tx": tx_hash,
            }

        # Safety: if we couldn’t get receipt earlier, grab it now
        if receipt is None:
            receipt = w3.eth.get_transaction_receipt(tx_hash)

        # 3) Decode logs for this contract only
        contract = _mk_contract(w3, dc.address, dc.abi)
        for log_entry in receipt["logs"]:
            if log_entry.get("address", "").lower() != dc.address.lower():
                continue

            event_obj = None
            try:
                evt_abi = contract.events._find_matching_event_abi(log_entry["topics"])[0]
                event_obj = contract.events[evt_abi["name"]]().process_log(log_entry)
            except Exception:
                # brute-force fallback over known events
                for e_name in contract.events.__dict__:
                    if not e_name[:1].isupper():
                        continue
                    try:
                        event_obj = getattr(contract.events, e_name)().process_log(log_entry)
                        break
                    except Exception:
                        pass

            if event_obj:
                _handle_event(dc, event_obj)

        # 4) Advance last_scanned_block cursor
        if isinstance(receipt.blockNumber, int):
            dc.last_scanned_block = max(dc.last_scanned_block or 0, receipt.blockNumber)
            db.session.commit()

        return {
            "status": "completed",
            "result": {
                "block": receipt.blockNumber,
                "tx": tx_hash,
            },
        }

    except Exception as e:
        log.error(f"[ingest_tx_task] {network} {address} {tx_hash}: {e}", exc_info=True)
        return {
            "status": "failed",
            "error": str(e),
        }


