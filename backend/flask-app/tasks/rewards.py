# tasks/rewards.py
import os, time, secrets, json
from typing import Dict, Any, Optional, List, Tuple
from pathlib import Path

from celery import shared_task
from celery.utils.log import get_task_logger
from web3 import Web3
from eth_account import Account

from models.blockchain import DeployedContract
from tasks.ipfs import _upload_with_web3storage, _upload_with_pinata
from web3_scripts.web3_factory import get_network_config

from extensions.db import db
from models.blockchain import OnchainDataset, ContractEvent

from utils.rewards_badge import render_validation_badge_png

log = get_task_logger(__name__)

# --------------------
# helpers
# --------------------
def _choose_ipfs_uploader():
    if os.getenv("WEB3STORAGE_TOKEN"):
        return "web3storage"
    if os.getenv("PINATA_JWT"):
        return "pinata"
    raise RuntimeError("No IPFS provider configured (WEB3STORAGE_TOKEN or PINATA_JWT).")

def _canonical_json(obj: Any) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"))

def _upload_json_blob(name: str, obj: Any) -> str:
    data = _canonical_json(obj).encode("utf-8")
    tmp = Path(f"/tmp/{secrets.token_hex(8)}_{name}")
    tmp.write_bytes(data)

    uploader = _choose_ipfs_uploader()
    if uploader == "web3storage":
        mapping = _upload_with_web3storage([tmp])   # {filename: ipfs://CID/filename}
        return mapping[tmp.name]
    mapping = _upload_with_pinata([tmp])           # {filename: ipfs://CID}
    return mapping[tmp.name]

def _upload_file(path: Path) -> str:
    uploader = _choose_ipfs_uploader()
    if uploader == "web3storage":
        mapping = _upload_with_web3storage([path])
        return mapping[path.name]
    mapping = _upload_with_pinata([path])
    return mapping[path.name]

def _get_deployed(network: str, name: str) -> str:
    row = (DeployedContract.query
           .filter_by(network=network, name=name)
           .order_by(DeployedContract.id.desc())
           .first())
    if not row:
        raise RuntimeError(f"{name} not found in DB for network={network}")
    return row.address

# ---- EIP-712 signing shim (same as your suite task) ----
_HAVE_SIGN_TYPED = hasattr(Account, "sign_typed_data")
try:
    from eth_account.messages import encode_typed_data as _encode_typed_data
    _HAVE_ENCODE_TYPED = True
except Exception:
    _HAVE_ENCODE_TYPED = False

def _sign_typed(typed_data: dict, pkey_hex: str) -> dict:
    acct = Account.from_key(pkey_hex)

    if _HAVE_SIGN_TYPED:
        d = typed_data
        domain  = d["domain"]
        types   = {k: v for k, v in d["types"].items() if k != "EIP712Domain"}
        message = d["message"]
        signed = Account.sign_typed_data(pkey_hex, domain, types, message)
        return {"address": acct.address, "signature": signed.signature.hex()}

    if _HAVE_ENCODE_TYPED:
        smsg = _encode_typed_data(full_message=typed_data)
        signed = Account.sign_message(smsg, private_key=pkey_hex)
        return {"address": acct.address, "signature": signed.signature.hex()}

    raise RuntimeError("No EIP-712 encoder available in this eth-account version")

def _sign_claim_for(
    *,
    verifying_contract: str,
    chain_id: int,
    claimer: str,
    datasetFingerprint: bytes,
    category: str,
    level: bytes,
    metadataURI: str,
    deadline: int
) -> Dict[str, Any]:
    domain = {
        "name": "RewardClaimer",
        "version": "1",
        "chainId": int(chain_id),
        "verifyingContract": Web3.to_checksum_address(verifying_contract),
    }
    types = {
        "ClaimFor": [
            {"name":"claimer",           "type":"address"},
            {"name":"datasetFingerprint","type":"bytes32"},
            {"name":"category",          "type":"string"},
            {"name":"level",             "type":"bytes32"},
            {"name":"metadataURI",       "type":"string"},
            {"name":"deadline",          "type":"uint256"},
        ]
    }
    message = {
        "claimer": Web3.to_checksum_address(claimer),
        "datasetFingerprint": datasetFingerprint,
        "category": category,
        "level": level,
        "metadataURI": metadataURI,
        "deadline": int(deadline),
    }

    full_message = {
        "types": {**types, "EIP712Domain": [
            {"name":"name","type":"string"},
            {"name":"version","type":"string"},
            {"name":"chainId","type":"uint256"},
            {"name":"verifyingContract","type":"address"},
        ]},
        "primaryType": "ClaimFor",
        "domain": domain,
        "message": message,
    }

    signer_pkey = os.getenv("CLAIM_SIGNER_PRIVATE_KEY") or os.getenv("APP_SIGNER_PRIVATE_KEY")
    if not signer_pkey:
        raise RuntimeError("CLAIM_SIGNER_PRIVATE_KEY (or APP_SIGNER_PRIVATE_KEY) missing")

    sig = _sign_typed(full_message, signer_pkey)

    return {
        "domain": domain,
        "types": types,
        "message": message,
        "signer": sig["address"],
        "signature": sig["signature"] if sig["signature"].startswith("0x") else ("0x"+sig["signature"]),
    }

# ---------------------------------------------------------
# ✅ LEVELS DECISION AND REWARD CLAIM TASK
# ---------------------------------------------------------

def decide_level_text_for_dataset(*, network: str, dataset_fingerprint: str) -> str:
    """
    Decide level from backend indexed state.
    Rule (as you described): must have >=3 distinct validators and status=valid.
    """
    fp = (dataset_fingerprint or "").strip()
    if not fp.startswith("0x") or len(fp) != 66:
        raise ValueError("dataset_fingerprint must be bytes32 hex (0x + 64 hex chars)")

    row = (OnchainDataset.query
           .filter_by(network=network, fingerprint=fp)
           .first())

    if not row:
        raise RuntimeError(f"Dataset not found in index for network={network}, fp={fp}")


    if (row.last_status or "").lower() != "valid":
        return "DATASET_INVALID"

    if int(row.validators_count or 0) < 3:
        return "DATASET_INSUFFICIENT_VALIDATIONS"

    return "DATASET_VALIDATED_3"


def collect_validation_artifacts(*, network: str, dataset_fingerprint: str) -> List[Dict[str, Any]]:
    fp = (dataset_fingerprint or "").strip()
    if not fp.startswith("0x") or len(fp) != 66:
        raise ValueError("dataset_fingerprint must be bytes32 hex (0x + 64 hex chars)")

    q = (
        ContractEvent.query
        .filter(ContractEvent.network == network)
        .filter(ContractEvent.name == "ValidationSubmitted") 
        .order_by(ContractEvent.block_number.asc(), ContractEvent.log_index.asc())
    )

    events = q.all()

    out: List[Dict[str, Any]] = []
    for ev in events:
        args = ev.args or {}

        ev_fp = args.get("datasetFingerprint") or args.get("fingerprint") or args.get("dataset")
        if not ev_fp or str(ev_fp).lower() != fp.lower():
            continue

        validator = args.get("validator")
        result_uri = args.get("uri") or args.get("resultURI") or args.get("resultUri")
        report_uri = args.get("reportURI") or args.get("reportUri") or args.get("report_uri")

        successful = args.get("successful")
        if isinstance(successful, str):
            successful = successful.lower() in ("1", "true", "yes")

        out.append({
            "event": ev.name,
            "tx_hash": ev.tx_hash,                  
            "block_number": int(ev.block_number),
            "log_index": int(ev.log_index),
            "validator": Web3.to_checksum_address(validator) if validator else None,
            "successful": bool(successful) if successful is not None else None,
            "result_uri": result_uri,
            "report_uri": report_uri,
        })
    # Deduplicate by validator address (keep first)
    dedup: Dict[str, Dict[str, Any]] = {}
    for it in out:
        v = (it.get("validator") or "").lower()
        key = v if v else f"__no_validator__:{it['tx_hash']}:{it['log_index']}"
        dedup[key] = it

    result = list(dedup.values())
    result.sort(key=lambda x: (x.get("block_number", 0), x.get("log_index", 0)))
    return result

# --------------------
# task
# --------------------
@shared_task(bind=True, ignore_result=False, name="tasks.rewards.prepare_dataset_reward_claim_task")
def prepare_dataset_reward_claim_task(
    self,
    *,
    network: str,
    dataset_fingerprint: str,     # "0x..."
    category: str,                # e.g. "dataset"
    uploader: str,                # address
    dataset_uri: Optional[str] = None,
    suite_hash: Optional[str] = None,
    report_uri: Optional[str] = None,
    expires_in_sec: int = 900,
) -> Dict[str, Any]:
    cfg = get_network_config(network) or {}
    chain_id = int(os.getenv(f"{network.upper()}_CHAIN_ID") or cfg.get("CHAIN_ID") or 0)
    if not chain_id:
        raise RuntimeError(f"[{network}] CHAIN_ID missing")

    reward_claimer_addr = _get_deployed(network, "RewardClaimer")

    # ✅ level decided 
    level_text = decide_level_text_for_dataset(
        network=network,
        dataset_fingerprint=dataset_fingerprint,
    )
    level_bytes32 = Web3.keccak(text=level_text)

    fp_bytes = Web3.to_bytes(hexstr=dataset_fingerprint)
    uploader_checksum = Web3.to_checksum_address(uploader)

    # ✅ collect validation URIs (placeholder)
    validations = collect_validation_artifacts(
        network=network,
        dataset_fingerprint=dataset_fingerprint,
    )

    # ---- Badge image  ----

    uploader_kind = _choose_ipfs_uploader()

    # derive badge text from validation results (example)
    valid_count = sum(1 for v in validations if v.get("successful") is True)
    total_count = len(validations)
    status = "VALID" if valid_count >= 3 else "INVALID"
    status_text = f"{status} — {valid_count}/{max(total_count, 3)} validators"


    badge_path = Path(f"/tmp/{secrets.token_hex(8)}_dataset_validation_badge.png")
    render_validation_badge_png(
        title="Dataset Validation Reward",
        subtitle=f"{network} • {category} • {level_text}",
        status_text=status_text,
        out_path=badge_path,
    )

    if uploader_kind == "web3storage":
        badge_map = _upload_with_web3storage([badge_path])
    else:
        badge_map = _upload_with_pinata([badge_path])

    image_uri = badge_map[badge_path.name]  # ipfs://...

    # ---- Build metadata ----
    created_unix = int(time.time())
    short_fp = dataset_fingerprint[:10] + "…" + dataset_fingerprint[-8:]
    name = f"Dataset Reward • {level_text} • {short_fp}"
    desc = (
        f"Validation reward for dataset {dataset_fingerprint} on {network}. "
        f"Level: {level_text}. Validators: {valid_count}/{max(total_count,3)}."
    )

    attrs = [
        {"trait_type": "network", "value": network},
        {"trait_type": "category", "value": category},
        {"trait_type": "datasetFingerprint", "value": dataset_fingerprint},
        {"trait_type": "uploader", "value": uploader_checksum},
        {"trait_type": "level", "value": level_text},
        {"display_type": "date", "trait_type": "createdAt", "value": created_unix},
    ]
    if dataset_uri:
        attrs.append({"trait_type": "datasetURI", "value": dataset_uri})
    if suite_hash:
        attrs.append({"trait_type": "suiteHash", "value": suite_hash})
    if report_uri:
        attrs.append({"trait_type": "reportURI", "value": report_uri})
        # Flatten a few validation URIs into attributes for wallet display
    for i, v in enumerate(validations[:5], start=1):
        if v.get("validator"):
            attrs.append({"trait_type": f"validator_{i}", "value": v["validator"]})
        if v.get("result_uri"):
            attrs.append({"trait_type": f"validationResultURI_{i}", "value": v["result_uri"]})
        if v.get("report_uri"):
            attrs.append({"trait_type": f"validationReportURI_{i}", "value": v["report_uri"]})
        if v.get("tx_hash"):
            attrs.append({"trait_type": f"validationTx_{i}", "value": v["tx_hash"]})


    properties = {
        "datasetFingerprint": dataset_fingerprint,
        "network": network,
        "levelText": level_text,
        "uploader": uploader_checksum,
        "datasetURI": dataset_uri,
        "suiteHash": suite_hash,
        "reportURI": report_uri,
        "validations": validations,  # full objects
    }


    metadata = {
        "name": name,
        "description": desc,
        "image": image_uri,           
        "external_url": "https://ddm.extremexp-icom.intracom-telecom.com/datasets",
        "attributes": attrs,
        "properties": properties,
        "validations": validations,
    }

    metadataURI = _upload_json_blob("dataset_reward.json", metadata)

    # ---- Sign EIP-712 claim ----
    deadline = int(time.time()) + int(expires_in_sec)
    signed = _sign_claim_for(
        verifying_contract=reward_claimer_addr,
        chain_id=chain_id,
        claimer=uploader_checksum,
        datasetFingerprint=fp_bytes,
        category=category,
        level=level_bytes32,
        metadataURI=metadataURI,
        deadline=deadline,
    )

    return {
        "network": network,
        "chainId": chain_id,
        "rewardClaimer": Web3.to_checksum_address(reward_claimer_addr),
        "datasetFingerprint": dataset_fingerprint,
        "category": category,
        "levelText": level_text,
        "level": "0x" + level_bytes32.hex(),
        "metadataURI": metadataURI,
        "image": image_uri,          
        "deadline": str(deadline),
        "signature": signed["signature"],
        "typedData": {
            "domain": signed["domain"],
            "types": signed["types"],
            "message": {
                **signed["message"],
                "deadline": str(deadline),
                "datasetFingerprint": dataset_fingerprint,
                "level": "0x" + level_bytes32.hex(),
            }
        }
    }
