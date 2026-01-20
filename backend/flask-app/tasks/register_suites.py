# tasks/suite.py
import os, io, json, secrets, time
from pathlib import Path
from typing import Tuple, Optional, Dict, Any
from models.expectations import ExpectationSuites
from celery import shared_task
from web3 import Web3
from eth_account import Account
from extensions.db import db
from models.blockchain import DeployedContract
from web3_scripts.web3_factory import get_network_config
from utils.suites import build_flat_suite_from_selected, build_docs_html
from utils.expectation_helpers import build_metadata_index, extract_expectation_descriptions
from utils.suites_badge import render_suite_badge_png  
from celery.utils.log import get_task_logger
# Reuse your IPFS helpers
from tasks.ipfs import _upload_with_web3storage, _upload_with_pinata
log = get_task_logger(__name__)
# --- helpers ---

def _to_jsonable(obj):
    if isinstance(obj, bytes):
        # represent raw bytes as 0x-prefixed hex
        return "0x" + obj.hex()
    if isinstance(obj, (list, tuple)):
        return [ _to_jsonable(x) for x in obj ]
    if isinstance(obj, dict):
        return { k: _to_jsonable(v) for k, v in obj.items() }
    return obj

def _canonical_json(obj: Any) -> str:
    # stable, minified, deterministic
    return json.dumps(obj, sort_keys=True, separators=(",", ":"))

def _choose_ipfs_uploader():
    if os.getenv("WEB3STORAGE_TOKEN"):
        return "web3storage"
    if os.getenv("PINATA_JWT"):
        return "pinata"
    raise RuntimeError("No IPFS provider configured (WEB3STORAGE_TOKEN or PINATA_JWT).")

def _upload_json_blob(name: str, obj: Any) -> str:
    # upload a single JSON file
    canonical = _canonical_json(obj).encode("utf-8")
    tmp = Path(f"/tmp/{secrets.token_hex(8)}_{name}")
    tmp.write_bytes(canonical)

    if os.getenv("WEB3STORAGE_TOKEN"):
        mapping = _upload_with_web3storage([tmp])             # returns {filename: ipfs://CID/filename}
        return mapping[tmp.name]
    # Pinata: upload individually
    if os.getenv("PINATA_JWT"):
        mapping = _upload_with_pinata([tmp])                  # returns {filename: ipfs://CID}
        return mapping[tmp.name]
    raise RuntimeError("No IPFS provider configured.")

def _get_srr_address_and_chainid(network: str) -> Tuple[str, int]:
    cfg = get_network_config(network) or {}
    chain_id = int(os.getenv(f"{network.upper()}_CHAIN_ID") or cfg.get("CHAIN_ID") or 0)
    if not chain_id:
        raise RuntimeError(f"[{network}] CHAIN_ID missing")

    row = (DeployedContract.query
           .filter_by(network=network, name="DatasetRequestRegistry")
           .order_by(DeployedContract.id.desc())
           .first())
    if not row:
        raise RuntimeError("DatasetRequestRegistry not found in DB (deploy first).")
    return row.address, chain_id

# ----- EIP-712 signing shim (version-agnostic) -----

_HAVE_SIGN_TYPED = hasattr(Account, "sign_typed_data")
try:
    from eth_account.messages import encode_typed_data as _encode_typed_data
    _HAVE_ENCODE_TYPED = True
except Exception:
    _HAVE_ENCODE_TYPED = False

if not _HAVE_ENCODE_TYPED:
    # Older fallbacks
    try:
        from eth_account.messages import (
            encode_structured_data,
            SignableMessage,
            _hash_eip191_message,
        )
        # Define fallbacks for hash_domain, hash_message, load_and_parse_structured_message, validate_structured_data
        def hash_domain(parsed):
            return _hash_eip191_message(parsed.domain_hash_struct)

        def hash_message(parsed):
            return _hash_eip191_message(parsed.message_hash_struct)

        def load_and_parse_structured_message(typed_data):
            return encode_structured_data(primitive=typed_data)

        def validate_structured_data(typed_data):
            # No-op for newer eth-account
            pass
    except ImportError:
        raise ImportError("Your installed eth-account version does not support EIP-712 structured data signing. Please upgrade eth-account to >=0.5.7.")

def _sign_typed(typed_data: dict, pkey_hex: str) -> dict:
    """
    Signs EIP-712 'typed_data' and returns {'address', 'signature'}.
    Works across eth-account versions.
    """
    acct = Account.from_key(pkey_hex)

    if _HAVE_SIGN_TYPED:
        # IMPORTANT: 'types' here must EXCLUDE EIP712Domain.
        d = typed_data
        domain  = d["domain"]
        types   = {k: v for k, v in d["types"].items() if k != "EIP712Domain"}
        message = d["message"]
        signed = Account.sign_typed_data(pkey_hex, domain, types, message)
        return {"address": acct.address, "signature": signed.signature.hex()}

    if _HAVE_ENCODE_TYPED:
        # Provide full_message (includes EIP712Domain) to encoder
        smsg = _encode_typed_data(full_message=typed_data)
        signed = Account.sign_message(smsg, private_key=pkey_hex)
        return {"address": acct.address, "signature": signed.signature.hex()}

    # Oldest fallback: reconstruct SignableMessage
    validate_structured_data(typed_data)
    parsed = load_and_parse_structured_message(typed_data)
    domain_sep = hash_domain(parsed)  # keccak(domain)
    msg_hash   = hash_message(parsed) # keccak(primaryType,message)
    smsg = SignableMessage(b"\x01", domain_sep, msg_hash)
    signed = Account.sign_message(smsg, private_key=pkey_hex)
    return {"address": acct.address, "signature": signed.signature.hex()}

def _sign_suite_create(
    *, network: str, verifying_contract: str, chain_id: int,
    requester: str, suiteHash: str, suiteURI: str, docsURI: str, certificateURI: str,
    category: str, fileFormat: str, deadline: int, totalExpected: int,
    nonce: int, expiresAt: int
) -> Dict[str, Any]:
    domain = {
        "name": "DatasetRequestRegistry",
        "version": "1",
        "chainId": int(chain_id),
        "verifyingContract": Web3.to_checksum_address(verifying_contract),
    }
    types = {
        "DatasetRequestCreate": [
            {"name":"requester",     "type":"address"},
            {"name":"suiteHash",     "type":"bytes32"},
            {"name":"suiteURI",      "type":"string"},
            {"name":"docsURI",       "type":"string"},
            {"name":"certificateURI","type":"string"},
            {"name":"category",      "type":"string"},
            {"name":"fileFormat",    "type":"string"},
            {"name":"deadline",      "type":"uint256"},
            {"name":"totalExpected", "type":"uint256"},
            {"name":"nonce",         "type":"uint256"},
            {"name":"expiresAt",     "type":"uint256"},
        ]
    }

    # Coerce suiteHash to bytes32 (prevents "structured data cannot be resolved")
    suite_hash_bytes = Web3.to_bytes(hexstr=suiteHash) if isinstance(suiteHash, str) else suiteHash

    message = {
        "requester": requester,
        "suiteHash": suite_hash_bytes,   # bytes32, not hex string
        "suiteURI": suiteURI or "",
        "docsURI": docsURI or "",
        "certificateURI": certificateURI or "",
        "category": category or "",
        "fileFormat": fileFormat or "",
        "deadline": int(deadline),
        "totalExpected": int(totalExpected),
        "nonce": int(nonce),
        "expiresAt": int(expiresAt),
    }

    full_message = {
        "types": {**types, "EIP712Domain": [
            {"name":"name","type":"string"},
            {"name":"version","type":"string"},
            {"name":"chainId","type":"uint256"},
            {"name":"verifyingContract","type":"address"},
        ]},
        "primaryType": "DatasetRequestCreate",
        "domain": domain,
        "message": message,
    }

    validator_pkey = (
        os.getenv("APP_SIGNER_PRIVATE_KEY")   # preferred: same key used to grant SIGNER_ROLE
        or os.getenv("VALIDATOR_PRIVATE_KEY") # fallback name
    )
    if not validator_pkey:
        raise RuntimeError("APP_SIGNER_PRIVATE_KEY (or VALIDATOR_PRIVATE_KEY) missing")

    sig = _sign_typed(full_message, validator_pkey)

    return {
        "domain": domain,
        "types": types,     # NOTE: excludes EIP712Domain by design
        "message": message,
        "address": sig["address"],
        "signature": sig["signature"],
    }

# --- Celery task ---
def _append_uri_lines(desc: str, suiteURI: str, docsURI: str, certificateURI: str) -> str:
    lines = [desc.rstrip(), ""]
    if suiteURI:
        lines.append(f"• suiteURI: {suiteURI}")
    if docsURI:
        lines.append(f"• docsURI: {docsURI}")
    if certificateURI:
        lines.append(f"• certificateURI: {certificateURI}")
    return "\n".join([l for l in lines if l is not None and l != ""])



@shared_task(bind=True, ignore_result=False, name="tasks.suite.create_suite_artifacts_task")
def create_suite_artifacts_task(
    self,
    *,
    network: str,
    requester: str,
    suite_object: Dict[str, Any],
    category: str,
    fileFormat: str,
    deadline: int,
    totalExpected: int,
    docs_html: Optional[str] = None,
    certificate_json: Optional[Dict[str, Any]] = None,
    expires_in_sec: int = 900,
    expectation_suite_id: Optional[str] = None
) -> Dict[str, Any]:

    # ---- 1) Build flat suite (only selected) & upload suite.json ----
    flat_suite = build_flat_suite_from_selected(suite_object)
    exps = flat_suite.get("expectations")
    if isinstance(exps, dict):
        exps = exps.get("expectations") or []
    elif not isinstance(exps, list):
        exps = []
    meta_index = build_metadata_index()
    flat_suite["expectation_descriptions"] = extract_expectation_descriptions(exps, meta_index)

    suiteURI = _upload_json_blob("suite.json", flat_suite)

    # ---- 2) docs: use provided or auto-generate from flat suite; upload ----
    uploader = _choose_ipfs_uploader()
    docsURI = ""
    html_text = docs_html.strip() if isinstance(docs_html, str) and docs_html.strip() else build_docs_html(flat_suite)

    tmp_html = Path(f"/tmp/{secrets.token_hex(8)}_suite.html")
    tmp_html.write_text(html_text, encoding="utf-8")
    if uploader == "web3storage":
        docs_map = _upload_with_web3storage([tmp_html])
    else:
        docs_map = _upload_with_pinata([tmp_html])
    docsURI = docs_map[tmp_html.name]

    # ---- 3) Create badge.png (PNG thumbnail for wallets) & upload ----
    badge_path = Path(f"/tmp/{secrets.token_hex(8)}_badge.png")
    title    = flat_suite.get("suite_name") or "Validation Suite"
    subtitle = f"{category} • {fileFormat}"
    render_suite_badge_png(title=title, subtitle=subtitle, out_path=badge_path)
    if uploader == "web3storage":
        badge_map = _upload_with_web3storage([badge_path])
    else:
        badge_map = _upload_with_pinata([badge_path])
    image_uri = badge_map[badge_path.name]  # ipfs://...

    # ---- 4) Suite hash from canonical JSON of *flat* suite ----
    canon = _canonical_json(flat_suite)
    suite_hash_bytes = Web3.keccak(text=canon)
    suiteHash = suite_hash_bytes.hex()  # this usually returns '0x...' but we will normalize anyway

    # 🔴 normalize for DB
    normalized_suite_hash = (
        suiteHash if isinstance(suiteHash, str) and suiteHash.startswith("0x")
        else f"0x{suiteHash}"
    )

    if expectation_suite_id is not None:
        es = ExpectationSuites.query.get(expectation_suite_id)
        if es:
            es.suite_hash = normalized_suite_hash
            db.session.commit()

  
    log.info(f"[create_suite_artifacts_task] expectation_suite_id={expectation_suite_id} suiteHash={suiteHash} ")

    # ---- 5) Wallet-compatible certificate metadata (or merge/override) ----
    created_unix = int(time.time())
    srr_addr, chain_id = _get_srr_address_and_chainid(network)

    if certificate_json is None:
        certificate_json = {
            "name": f"Expectation Suite Certificate — {title}",
            "description": (
                f"Certificate for a DDM Expectation Suite created by {Web3.to_checksum_address(requester)}.\n"
                f"Category: {category} • Format: {fileFormat}"
            ),
            "image": image_uri,
            "external_url": f"https://ddm.extremexp-icom.intracom-telecom.com/expectation-suites",
            "attributes": [
                {"trait_type": "category", "value": category},
                {"trait_type": "fileFormat", "value": fileFormat},
                {"trait_type": "suiteName", "value": title},
                {"trait_type": "network", "value": network},
                {"trait_type": "requester", "value": Web3.to_checksum_address(requester)},
                {"trait_type": "suiteHash", "value": suiteHash},
                {"display_type": "date", "trait_type": "createdAt", "value": created_unix},
                {"display_type": "number", "trait_type": "totalExpected", "value": int(totalExpected)},
                {"trait_type": "suiteURI", "value": suiteURI},
                {"trait_type": "docsURI", "value": docsURI},
            ],
            "animation_url": docsURI  # rich preview
        }
    else:
        # ensure mandatory keys for wallet compatibility
        certificate_json.setdefault("image", image_uri)
        certificate_json.setdefault("attributes", [])
        certificate_json.setdefault("external_url","https://ddm.extremexp-icom.intracom-telecom.com/expectation-suites/")
        # append guaranteed traits if missing
        def _ensure_trait(trait_type, value, display_type=None):
            exists = any(
                (t.get("trait_type") == trait_type) for t in certificate_json["attributes"]
            )
            if not exists:
                item = {"trait_type": trait_type, "value": value}
                if display_type:
                    item["display_type"] = display_type
                certificate_json["attributes"].append(item)

        _ensure_trait("category", category)
        _ensure_trait("fileFormat", fileFormat)
        _ensure_trait("suiteName", title)
        _ensure_trait("network", network)
        _ensure_trait("requester", Web3.to_checksum_address(requester))
        _ensure_trait("suiteHash", suiteHash)
        _ensure_trait("createdAt", created_unix, display_type="date")
        _ensure_trait("totalExpected", int(totalExpected), display_type="number")
        _ensure_trait("suiteURI", suiteURI)
        _ensure_trait("docsURI", docsURI)

        
        certificate_json.setdefault("animation_url", docsURI)
        existing_desc = certificate_json.get("description", "") or ""
        certificate_json["description"] = _append_uri_lines(existing_desc, suiteURI, docsURI, certificateURI)

    certificateURI = _upload_json_blob("certificate.json", certificate_json)

    # ---- 6) EIP-712 sign DatasetRequestCreate ----
    nonce = secrets.randbits(64)
    expiresAt = int(time.time()) + int(expires_in_sec)
    signed = _sign_suite_create(
        network=network,
        verifying_contract=srr_addr,
        chain_id=chain_id,
        requester=Web3.to_checksum_address(requester),
        suiteHash=suiteHash,
        suiteURI=suiteURI,
        docsURI=docsURI,
        certificateURI=certificateURI,
        category=category,
        fileFormat=fileFormat,
        deadline=int(deadline),
        totalExpected=int(totalExpected),
        nonce=nonce,
        expiresAt=expiresAt
    )

    # ---- 7) Return JS-safe payload (uints as strings) ----
    payload = {
        "suiteURI": suiteURI,
        "docsURI": docsURI,
        "certificateURI": certificateURI,
        "suiteHash":normalized_suite_hash,
        "nonce": str(int(nonce)),
        "expiresAt": str(int(expiresAt)),
        "verifyingContract": Web3.to_checksum_address(srr_addr),
        "chainId": chain_id,
        "signature": signed["signature"] if signed["signature"].startswith("0x") else ("0x" + signed["signature"]),
        "typedData": {
            "domain": signed["domain"],
            "types":  signed["types"],  # excludes EIP712Domain
            "message": {
                **signed["message"],
                "deadline": str(int(deadline)),
                "totalExpected": str(int(totalExpected)),
                "nonce": str(int(nonce)),
                "expiresAt": str(int(expiresAt)),
            },
        },
    }
    return _to_jsonable(payload)
