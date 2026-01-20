from utils.zenoh_file_handler import ZenohFileHandler
from tasks.chain import ingest_tx_task
from eth_account import Account
from web3_scripts.web3_factory import get_w3
# tasks/validation.py
import os
import io
import json
import secrets
from pathlib import Path
from datetime import datetime, timezone
import traceback
import decimal
from utils.user_file_logger import log_action_with_context
from extensions.llm import llm
import pandas as pd
import requests
from celery import shared_task
from celery.utils.log import get_task_logger
from web3 import Web3
from eth_account import Account
from models.blockchain import DeployedContract, OnchainDataset, OnchainDatasetRequest
from models.expectations import ExpectationSuites
from web3_scripts.web3_factory import get_w3
from services.expectation_engine import run_expectation_suite
from tasks.ipfs import _upload_with_web3storage, _upload_with_pinata
from tasks.chain import ingest_tx_task
from typing import Optional
from urllib.parse import urlparse
from utils.file_df_loader import load_dataframe   
from utils.zenoh_file_handler import ZenohFileHandler
from utils.file_df_loader import load_dataframe  
from extensions.db import db
from utils.expectation_helpers import extract_expectation_descriptions


log = get_task_logger(__name__)

def _normalize_ge_result(ge_result: dict) -> dict:
    if not isinstance(ge_result, dict):
        return {"results": [], "statistics": {}, "success": False}

    raw_results = ge_result.get("results") or []
    if not isinstance(raw_results, list):
        raw_results = []

    norm_results = []
    for r in raw_results:
        if not isinstance(r, dict):
            continue

        cfg = r.get("expectation_config") or {}
        if not isinstance(cfg, dict):
            cfg = {}

        # ✅ GE often uses cfg["type"]
        etype = (
            cfg.get("expectation_type")
            or cfg.get("type")
            or r.get("expectation_type")
            or r.get("type")
            or "unknown_expectation"
        )

        kwargs = cfg.get("kwargs")
        if not isinstance(kwargs, dict):
            kwargs = r.get("kwargs") if isinstance(r.get("kwargs"), dict) else {}

        details = r.get("result")
        if not isinstance(details, dict):
            details = {}

        norm_results.append({
            "success": bool(r.get("success")),
            "expectation_config": {"expectation_type": etype, "kwargs": kwargs},
            "result": details,
        })

    out = dict(ge_result)
    out["results"] = norm_results
    out.setdefault("statistics", {})
    out["success"] = bool(ge_result.get("success"))
    return out


def _extract_expectation_meta(meta: dict) -> dict:
    """
    Pull expectation_descriptions + column_descriptions from meta/suite wrapper.
    Expected shape:
      expectation_descriptions: {etype: {description, category, doc_url}}
      column_descriptions: {col: "..."}
    """
    meta = meta or {}
    exp_desc = meta.get("expectation_descriptions") or {}
    col_desc = meta.get("column_descriptions") or {}

    if not isinstance(exp_desc, dict):
        exp_desc = {}
    if not isinstance(col_desc, dict):
        col_desc = {}

    return {"expectation_descriptions": exp_desc, "column_descriptions": col_desc}

def _build_validation_html(result_json: dict, meta: dict) -> str:
    from html import escape as esc
    import json

    meta = meta or {}
    em = _extract_expectation_meta(meta)
    exp_meta = em.get("expectation_descriptions") or {}
    col_desc = em.get("column_descriptions") or {}

    suite_name = meta.get("suite_name") or meta.get("expectation_suite_name") or "Validation Suite"

    stats = result_json.get("statistics", {}) or {}
    success = stats.get("successful_expectations", 0)
    total = stats.get("evaluated_expectations", 0)
    success_pct = stats.get("success_percent", 0)
    

    col_rows = []
    tbl_rows = []

    def _exp_doc_url(etype: str, m: dict) -> str:
        url = (m or {}).get("doc_url") or (m or {}).get("url") or ""
        if isinstance(url, str) and url.strip():
            return url.strip()
        return f"https://greatexpectations.io/expectations/{etype}"

    for res in (result_json.get("results") or []):
        cfg = res.get("expectation_config") or {}
        if not isinstance(cfg, dict):
            cfg = {}

        etype = (
            cfg.get("expectation_type")
            or cfg.get("type")
            or res.get("expectation_type")
            or res.get("type")
            or "unknown_expectation"
        )

        kwargs = cfg.get("kwargs") or {}
        if not isinstance(kwargs, dict):
            kwargs = {}

        col = kwargs.get("column")
        ok = bool(res.get("success"))
        status_class = "ok" if ok else "fail"
        details = res.get("result") or {}

        # expectation metadata
        m = exp_meta.get(etype) or {}
        # support a few possible shapes
        desc = m.get("description") or m.get("human") or m.get("text") or ""
        cat = m.get("category") or m.get("group") or ""
        doc_url = _exp_doc_url(etype, m)

        exp_cell = (
            f"<a href='{esc(str(doc_url))}' target='_blank' rel='noreferrer noopener'>"
            f"<code>{esc(str(etype))}</code></a>"
        )
        if desc:
            exp_cell += f"<div style='margin-top:4px;color:#444'>{esc(str(desc))}</div>"
        if cat:
            exp_cell += (
                "<div style='margin-top:6px'>"
                "<span style='display:inline-block;padding:2px 6px;border:1px solid #ddd;"
                "border-radius:10px;font-size:11px;background:#fafafa;color:#555'>"
                f"{esc(str(cat))}</span></div>"
            )

        details_html = esc(json.dumps(details, indent=2, default=str))

        if col is not None:
            cdesc = col_desc.get(col) or ""
            col_cell = f"<code>{esc(str(col))}</code>"
            if cdesc:
                col_cell += f"<div style='margin-top:4px;color:#444'>{esc(str(cdesc))}</div>"

            col_rows.append(
                "<tr>"
                f"<td>{col_cell}</td>"
                f"<td>{exp_cell}</td>"
                f"<td class='{status_class}'>{'✔' if ok else '✘'}</td>"
                f"<td><pre style='white-space:pre-wrap;font-size:0.8rem;margin:0'>{details_html}</pre></td>"
                "</tr>"
            )
        else:
            tbl_rows.append(
                "<tr>"
                f"<td>{exp_cell}</td>"
                f"<td class='{status_class}'>{'✔' if ok else '✘'}</td>"
                f"<td><pre style='white-space:pre-wrap;font-size:0.8rem;margin:0'>{details_html}</pre></td>"
                "</tr>"
            )

    col_rows_html = "".join(col_rows) or "<tr><td colspan='4'><em>No column expectations evaluated.</em></td></tr>"
    tbl_rows_html = "".join(tbl_rows) or "<tr><td colspan='3'><em>No table expectations evaluated.</em></td></tr>"

    return f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Validation Report — {esc(str(suite_name))}</title>
  <style>
    body {{ font-family: system-ui, sans-serif; padding: 1.5rem; }}
    h1 {{ margin-bottom: 0.25rem; }}
    .summary {{ margin-bottom: 1rem; }}
    table {{ border-collapse: collapse; width: 100%; }}
    th, td {{ border: 1px solid #ddd; padding: 0.35rem; font-size: 0.9rem; vertical-align: top; }}
    th {{ background: #f5f5f5; text-align: left; }}
    .ok {{ color: #2e7d32; font-weight: 600; }}
    .fail {{ color: #c62828; font-weight: 600; }}
    code {{ background: #f6f8fa; padding: 2px 4px; border-radius: 4px; }}
    h2 {{ margin-top: 1.5rem; }}
  </style>
</head>
<body>
  <h1>Validation Report</h1>
  <div class="summary">
    <div><strong>Suite:</strong> {esc(str(suite_name))}</div>
    <div><strong>Expectations:</strong> {success}/{total} ({success_pct}%)</div>
  </div>

  <h2>Column Expectation Results</h2>
  <table>
    <thead>
      <tr>
        <th style="width:260px">Column</th>
        <th style="width:380px">Expectation</th>
        <th style="width:60px">Result</th>
        <th>Details</th>
      </tr>
    </thead>
    <tbody>
      {col_rows_html}
    </tbody>
  </table>

  <h2>Table Expectation Results</h2>
  <table>
    <thead>
      <tr>
        <th style="width:440px">Expectation</th>
        <th style="width:60px">OK?</th>
        <th>Details</th>
      </tr>
    </thead>
    <tbody>
      {tbl_rows_html}
    </tbody>
  </table>
</body>
</html>
"""




def _pick_badge_image_uri(category: str) -> str:
    """
    Resolve badge icon per category.
    Configure base via env: DDM_BADGE_ICON_BASE = ipfs://CID
    """
    base = os.getenv("DDM_BADGE_ICON_BASE", "").rstrip("/")
    if not base:
        # fallback generic
        return "ipfs://ddm_badges_generic/badge.png"

    cat = (category or "").lower()
    if cat == "mobility":
        return f"{base}/mobility.png"
    if cat == "cybersecurity":
        return f"{base}/cybersecurity.png"
    return f"{base}/badge.png"


def _build_badge_metadata(
    *,
    category: str,
    level: str,
    dataset_fingerprint: str,
    suite_hash: str,
    file_format: str,
    dataset_uri: str,
    validation_result_uri: str,
    validator_manifest_uri: str,
    network: str,
) -> dict:
    iso_ts = datetime.now(timezone.utc).isoformat()
    image_uri = _pick_badge_image_uri(category)

    name = "DDM Validation Badge"
    description = "Soulbound NFT awarded to the uploader of a dataset that successfully passed validation."

    attributes = [
        {"trait_type": "Category", "value": category},
        {"trait_type": "Level", "value": level},
        {"trait_type": "Dataset Fingerprint", "value": dataset_fingerprint},
        {"trait_type": "Suite Hash", "value": suite_hash},
        {"trait_type": "File Format", "value": file_format},
        {"trait_type": "Validated", "value": "true"},
        {"trait_type": "Network", "value": network},
    ]

    props = {
        "dataset_fingerprint": dataset_fingerprint,
        "suite_hash": suite_hash,
        "file_format": file_format,
        "dataset_uri": dataset_uri,
        "validation_result_uri": validation_result_uri,
        "validator_manifest_uri": validator_manifest_uri,
        "issued_at": iso_ts,
    }

    return {
        "name": name,
        "description": description,
        "image": image_uri,
        "external_url": "https://ddm.extremexp-icom.intracom-telecom.com/validations",
        "animation_url": "", 
        "attributes": attributes,
        "properties": props,
    }


def _get_validation_registry(network: str) -> Optional[DeployedContract]:
    return (
        DeployedContract.query
        .filter_by(network=network, name="ValidationRegistry")
        .order_by(DeployedContract.id.desc())
        .first()
    )

def _as_bytes32(hexstr: str) -> bytes:
    if not hexstr:
        raise ValueError("empty hex string for bytes32")
    return Web3.to_bytes(hexstr=hexstr)


def _mk_contract(w3: Web3, address: str, abi: list):
    return w3.eth.contract(address=Web3.to_checksum_address(address), abi=abi)
# -------------------------------------------------------------------
# Shared helpers (mirroring tasks/suite.py style)
# -------------------------------------------------------------------


def _to_jsonable(obj):
    if isinstance(obj, bytes):
        return "0x" + obj.hex()
    if isinstance(obj, decimal.Decimal):
        return float(obj)
    if hasattr(obj, "item"):  # numpy scalar
        try:
            return obj.item()
        except Exception:
            pass
    if isinstance(obj, (list, tuple)):
        return [_to_jsonable(x) for x in obj]
    if isinstance(obj, dict):
        return {k: _to_jsonable(v) for k, v in obj.items()}
    return obj


def _canonical_json(obj):
    return json.dumps(obj, sort_keys=True, separators=(",", ":"))


def _choose_ipfs_uploader():
    if os.getenv("WEB3STORAGE_TOKEN"):
        return "web3storage"
    if os.getenv("PINATA_JWT"):
        return "pinata"
    raise RuntimeError("No IPFS provider configured (WEB3STORAGE_TOKEN or PINATA_JWT).")


def _upload_json_blob(name: str, obj) -> str:
    obj = _to_jsonable(obj)
    canonical = _canonical_json(obj).encode("utf-8")
    tmp = Path(f"/tmp/{secrets.token_hex(8)}_{name}")
    tmp.write_bytes(canonical)

    uploader = _choose_ipfs_uploader()
    if uploader == "web3storage":
        mapping = _upload_with_web3storage([tmp])  # {filename: ipfs://CID/filename}
        return mapping[tmp.name]
    else:
        mapping = _upload_with_pinata([tmp])       # {filename: ipfs://CID}
        return mapping[tmp.name]


def _upload_file(path: Path) -> str:
    uploader = _choose_ipfs_uploader()
    if uploader == "web3storage":
        mapping = _upload_with_web3storage([path])
    else:
        mapping = _upload_with_pinata([path])
    return mapping[path.name]


def _ipfs_to_http(uri: str) -> str:
    if not uri.startswith("ipfs://"):
        return uri
    gateway = os.getenv("IPFS_GATEWAY", "https://ipfs.io/ipfs")
    # ipfs://CID/path → <gateway>/CID/path
    tail = uri[len("ipfs://"):]
    return gateway.rstrip("/") + "/" + tail.lstrip("/")


@shared_task(
    bind=True,
    name="tasks.validation.build_onchain_validation_artifacts_task",
    ignore_result=False,
)
def build_onchain_validation_artifacts_task(
    self,
    prev_result: dict,
    *,
    network: str,
    dataset_fingerprint: str,
    dataset_uri: str,
    suite_hash: Optional[str],
    uploader: Optional[str],
    project_id: Optional[str],
    file_id: str,
    suite_id: str,
    username: Optional[str] = None, 
) -> dict:
    """
    Step 2 in the chain:
      prev_result = output of run_expectation_suites_task
      - read GE JSON from Zenoh
      - build full_result + HTML
      - upload to IPFS
      - build badge metadata
    """

    fp = str(dataset_fingerprint)

    try:
        if not prev_result or prev_result.get("status") != "completed":
            raise ValueError(f"Unexpected prev_result status: {prev_result}")

        entries = prev_result.get("results") or []
        entry = next((e for e in entries if str(e.get("suite_id")) == str(suite_id)), None)
        if not entry:
            raise ValueError(
                f"No GE result entry for suite_id={suite_id} in prev_result"
            )

        zenoh_path = entry.get("zenoh_path")
        if not zenoh_path:
            raise ValueError("Missing zenoh_path in GE result entry")

        # -----------------------------------------------------------
        # Load full GE result JSON from Zenoh
        # -----------------------------------------------------------
        raw = ZenohFileHandler.get_file(zenoh_path)
        if not raw:
            raise ValueError(f"Could not fetch GE result JSON from Zenoh: {zenoh_path}")

        import json as _json
        ge_result = _json.loads(
            raw.read().decode("utf-8") if hasattr(raw, "read") else raw
        )
        ge_result = _normalize_ge_result(ge_result)


        statistics = ge_result.get("statistics") or {}

        # threshold (safe)
        raw_thr = (os.getenv("VALIDATION_SUCCESS_THRESHOLD") or "50").strip().replace("%", "")
        try:
            threshold = float(raw_thr)
        except Exception:
            threshold = 50.0

        # pct (safe)
        pct = statistics.get("success_percent")
        if pct is None:
            evaluated = statistics.get("evaluated_expectations", 0) or 0
            pct = 100.0 if evaluated == 0 else 0.0

        try:
            pct = float(pct)
        except Exception:
            pct = 0.0

        success = pct >= threshold



        # -----------------------------------------------------------
        # Category & file_format from OnchainDatasetRequest / OnchainDataset
        # -----------------------------------------------------------
        od = (
            OnchainDataset.query
            .filter_by(network=network, fingerprint=fp)
            .one_or_none()
        )

        if od:
            file_format = (od.file_format or "csv").lower()
        else:
            file_format = "csv"

        category = None
        if suite_hash:
            odr = (
                OnchainDatasetRequest.query
                .filter_by(network=network, suite_hash=suite_hash)
                .order_by(OnchainDatasetRequest.created_block.asc())
                .first()
            )
            if odr:
                category = odr.category or category
                if not file_format:
                    file_format = odr.file_format or file_format

        category    = category or "unknown"
        file_format = file_format or "csv"

        suite_name = ge_result.get("expectation_suite_name") or "auto_validation"
        suite = None
        try:
            if suite_id:
                suite = ExpectationSuites.query.get(str(suite_id))
        except Exception as e:
            log.warning(f"Could not load ExpectationSuites: {e}")

        suite_expectations = []
        if suite and hasattr(suite, "expectations"):
            suite_expectations = suite.expectations or []

        derived_exp_meta = extract_expectation_descriptions(suite_expectations)


        meta = {
            "suite_name": suite_name,
            "dataset_fingerprint": fp,
            "suite_hash": suite_hash,
            "file_format": file_format,
            "category": category,
            "network": network,
            "project_id": project_id,
            "file_id": file_id,
            "uploader": uploader,
            "statistics": statistics,
            "column_descriptions": getattr(suite, "column_descriptions", {}) or {},
            "column_names": getattr(suite, "column_names", []) or [],
            "expectation_descriptions": derived_exp_meta,
        }

        full_result = {
            "meta": meta,
            "results": ge_result.get("results", []),
            "statistics": statistics,
            "success": success,
        }

        # -----------------------------------------------------------
        # IPFS uploads (validation JSON + HTML)
        # -----------------------------------------------------------
        validation_result_uri = _upload_json_blob("validation_result.json", full_result)

        html = _build_validation_html(ge_result, meta)
        tmp_html = Path(f"/tmp/{secrets.token_hex(8)}_validation_report.html")
        tmp_html.write_text(html, encoding="utf-8")
        validation_report_uri = _upload_file(tmp_html)

        # optional LLM-based ethical considerations at this stage is overkill;
        # we keep the separate ethical task for that.

        level = "LEVEL1"
        badge_metadata = _build_badge_metadata(
            category=category,
            level=level,
            dataset_fingerprint=fp,
            suite_hash=suite_hash or "",
            file_format=file_format,
            dataset_uri=dataset_uri,
            validation_result_uri=validation_result_uri,
            validator_manifest_uri="",  # can be extended later
            network=network,
        )
        badge_metadata_uri = _upload_json_blob("validation_badge.json", badge_metadata)

        validation_hash = Web3.keccak(text=validation_result_uri).hex()

        return _to_jsonable(
            {
                "status": "ok",
                "dataset_fingerprint": fp,
                "dataset_uri": dataset_uri,
                "suite_hash": suite_hash,
                "file_format": file_format,
                "category": category,
                "validation_result_uri": validation_result_uri,
                "validation_report_uri": validation_report_uri,
                "badge_metadata_uri": badge_metadata_uri,
                "validation_hash": validation_hash,
                "successful": success,
                "project_id": project_id,
                "file_id": file_id,
                "suite_id": suite_id,
                "username": username,
            }
        )

    except Exception as e:
        log.error(
            f"[build_onchain_validation_artifacts_task] error: {e}", exc_info=True
        )
        return {"status": "error", "error": str(e), "dataset_fingerprint": fp}


@shared_task(
    bind=True,
    name="tasks.validation.submit_onchain_validation_task",
    ignore_result=False,
    max_retries=0,
)
def submit_onchain_validation_task(
    self,
    artifacts: dict,
    *,
    network: str,
    dataset_fingerprint: str,
) -> dict:
    log = get_task_logger(__name__)

    fp = str(dataset_fingerprint or artifacts.get("dataset_fingerprint"))
    validation_result_uri = artifacts.get("validation_result_uri")
    validation_report_uri = artifacts.get("validation_report_uri") or ""
    successful = bool(artifacts.get("successful"))

    file_id    = artifacts.get("file_id")
    project_id = artifacts.get("project_id")
    suite_id   = artifacts.get("suite_id")
    category   = artifacts.get("category")
    username   = artifacts.get("username")

    log.info(
        f"[submit_onchain_validation_task] net={network} fp={fp} "
        f"validation_result_uri={validation_result_uri} "
        f"validation_report_uri={validation_report_uri} "
        f"successful={successful}"
    )

    try:
        dc = (
            DeployedContract.query
            .filter_by(network=network, name="ValidationRegistry")
            .order_by(DeployedContract.id.desc())
            .first()
        )
        if not dc or not isinstance(dc.abi, list) or not dc.abi:
            msg = f"No ValidationRegistry deployed for network={network}"
            log.warning(f"[submit_onchain_validation_task] {msg}")
            return {"status": "error", "error": msg, "dataset_fingerprint": fp}

        w3 = get_w3(network)
        contract = w3.eth.contract(
            address=Web3.to_checksum_address(dc.address),
            abi=dc.abi,
        )

        signer_pkey = (
            os.getenv("APP_VALIDATOR_PRIVATE_KEY")
            or os.getenv("VALIDATOR_PRIVATE_KEY")
            or os.getenv("APP_SIGNER_PRIVATE_KEY")
            
        )
        if not signer_pkey:
            msg = "APP_VALIDATOR_PRIVATE_KEY / APP_SIGNER_PRIVATE_KEY / VALIDATOR_PRIVATE_KEY not set"
            log.warning(f"[submit_onchain_validation_task] {msg}")
            return {
                "status": "error",
                "error": msg,
                "dataset_fingerprint": fp,
            }

        acct = Account.from_key(signer_pkey)
        chain_id = w3.eth.chain_id
        nonce = w3.eth.get_transaction_count(acct.address)

        fp_bytes32 = Web3.to_bytes(hexstr=fp)
        validation_hash = artifacts.get("validation_hash") or Web3.keccak(
            text=validation_result_uri
        ).hex()
        vh_bytes32 = Web3.to_bytes(hexstr=validation_hash)

        tx = contract.functions.submitValidation(
            fp_bytes32,
            vh_bytes32,
            validation_result_uri,
            validation_report_uri,
            successful,
        ).build_transaction(
            {
                "from": acct.address,
                "nonce": nonce,
                "chainId": chain_id,
            }
        )

        tx.setdefault("gas", int(os.getenv("VALIDATION_TX_GAS", "500000")))
        if "maxFeePerGas" not in tx:
            tx["maxFeePerGas"] = w3.to_wei("30", "gwei")
        if "maxPriorityFeePerGas" not in tx:
            tx["maxPriorityFeePerGas"] = w3.to_wei("2", "gwei")

        signed = acct.sign_transaction(tx)

        raw_tx = getattr(signed, "rawTransaction", None)
        if raw_tx is None:
            raw_tx = getattr(signed, "raw_transaction", None)
        if raw_tx is None:
            if isinstance(signed, (bytes, bytearray)):
                raw_tx = signed
            else:
                raise TypeError(
                    f"Unexpected signed tx type {type(signed)}; "
                    "no rawTransaction/raw_transaction attribute."
                )

        tx_hash = w3.eth.send_raw_transaction(raw_tx)
        tx_hash_hex = tx_hash.hex()

        log.info(
            f"[submit_onchain_validation_task] submitValidation tx={tx_hash_hex}"
        )

        # ✅ success logging only if we have a valid username
        if username:
            try:
                log_action_with_context(
                    username=username,
                    action_type="submit_onchain_validation",
                    file_id=file_id,
                    metadata={
                        "network": network,
                        "dataset_fingerprint": fp,
                        "project_id": project_id,
                        "suite_id": suite_id,
                        "category": category,
                        "status": "ok",
                        "successful": successful,
                        "validation_result_uri": validation_result_uri,
                        "validation_report_uri": validation_report_uri,
                        "validation_hash": validation_hash,
                        "onchain_tx_hash": tx_hash_hex,
                    },
                )
            except Exception as log_exc:
                db.session.rollback()
                log.warning(
                    f"[submit_onchain_validation_task] failed to log user action: {log_exc}",
                    exc_info=True,
                )

        ingest_tx_task.apply_async(
            kwargs={
                "network": network,
                "address": dc.address,
                "tx_hash": tx_hash_hex,
            },
            countdown=60,
        )

        return {
            "status": "ok",
            "dataset_fingerprint": fp,
            "validation_result_uri": validation_result_uri,
            "validation_report_uri": validation_report_uri,
            "validation_hash": validation_hash,
            "successful": successful,
            "onchain_tx_hash": tx_hash_hex,
        }

    except Exception as e:
        log.error(
            f"[submit_onchain_validation_task] error: {e}", exc_info=True
        )

        # 🔎 log failure only if we have a real username
        if username:
            try:
                log_action_with_context(
                    username=username,
                    action_type="submit_onchain_validation",
                    file_id=file_id,
                    metadata={
                        "network": network,
                        "dataset_fingerprint": fp,
                        "project_id": project_id,
                        "suite_id": suite_id,
                        "category": category,
                        "status": "error",
                        "reason": str(e),
                        "validation_result_uri": validation_result_uri,
                        "validation_report_uri": validation_report_uri,
                    },
                )
            except Exception as log_exc:
                db.session.rollback()
                log.warning(
                    f"[submit_onchain_validation_task] failed to log user action on error: {log_exc}",
                    exc_info=True,
                )

        return {
            "status": "error",
            "error": str(e),
            "dataset_fingerprint": fp,
        }
