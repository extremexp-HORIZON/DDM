# tasks/validation.py
import os
import io
import json
import secrets
from pathlib import Path
from datetime import datetime, timezone
import traceback
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
from typing import Optional, Dict, Any, Optional, Union
from urllib.parse import urlparse
from utils.file_df_loader import load_dataframe   
from utils.zenoh_file_handler import ZenohFileHandler
from utils.file_df_loader import load_dataframe  
from html import escape as esc


log = get_task_logger(__name__)

def _mk_contract(w3: Web3, address: str, abi: list):
    return w3.eth.contract(address=Web3.to_checksum_address(address), abi=abi)
# -------------------------------------------------------------------
# Shared helpers (mirroring tasks/suite.py style)
# -------------------------------------------------------------------

def _to_jsonable(obj):
    if isinstance(obj, bytes):
        return "0x" + obj.hex()
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


def _fetch_dataset_to_df(dataset_uri: str, file_format: str) -> pd.DataFrame:
    """
    dataset_uri can be:
      - ipfs://CID/...                        → fetch via IPFS gateway
      - http(s)://...                         → fetch via HTTP
      - projects/<project_id>/files/.../...   → fetch via Zenoh + load_dataframe
    """
    if not dataset_uri:
        raise ValueError("dataset_uri is required")

    fmt = (file_format or "").lower()

    # -----------------------------------------------------------
    # 1) IPFS → HTTP gateway
    # -----------------------------------------------------------
    if dataset_uri.startswith("ipfs://"):
        url = _ipfs_to_http(dataset_uri)
        resp = requests.get(url)
        resp.raise_for_status()
        buf = io.BytesIO(resp.content)

        if fmt in ("csv", ""):
            return pd.read_csv(buf)
        if fmt in ("parquet", "pq"):
            return pd.read_parquet(buf)
        if fmt in ("json", "ndjson"):
            return pd.read_json(buf, lines=(fmt == "ndjson"))

        # fallback: try CSV
        return pd.read_csv(buf)

    # -----------------------------------------------------------
    # 2) Full HTTP(S) URL
    # -----------------------------------------------------------
    if dataset_uri.startswith("http://") or dataset_uri.startswith("https://"):
        resp = requests.get(dataset_uri)
        resp.raise_for_status()
        buf = io.BytesIO(resp.content)

        if fmt in ("csv", ""):
            return pd.read_csv(buf)
        if fmt in ("parquet", "pq"):
            return pd.read_parquet(buf)
        if fmt in ("json", "ndjson"):
            return pd.read_json(buf, lines=(fmt == "ndjson"))

        return pd.read_csv(buf)

    # -----------------------------------------------------------
    # 3) Storage-style path (Zenoh): "projects/.../files/.../file.ext"
    #    – mirror your run_expectation_suites_task approach
    # -----------------------------------------------------------
    # Treat any non-ipfs, non-http URI as a Zenoh key / storage path.
    raw = ZenohFileHandler.get_file(dataset_uri)
    if not raw:
        raise ValueError(f"Could not fetch dataset from Zenoh for path: {dataset_uri}")

    # Write to a temp file so load_dataframe can do its magic
    tmp_name = f"{secrets.token_hex(8)}_{Path(dataset_uri).name}"
    tmp_path = Path("/tmp") / tmp_name
    tmp_path.write_bytes(raw.read() if hasattr(raw, "read") else raw)

    try:
        df_or_error = load_dataframe(str(tmp_path))
        if not isinstance(df_or_error, pd.DataFrame):
            raise TypeError(f"load_dataframe did not return DataFrame for {dataset_uri}: {df_or_error}")
        return df_or_error
    finally:
        # optional: clean up temp file
        try:
            tmp_path.unlink(missing_ok=True)
        except Exception:
            pass


def _build_ethical_considerations(
    df,
    meta,
    username: Optional[str],
    file_id: Optional[str],
):

    try:
        # You can shrink DF if you want – here we just use column names
        column_names = list(df.columns)

        prompt_parts = [
            "You are an expert in data ethics and responsible AI.",
            "You get basic metadata about a tabular dataset and the list of columns.",
            "Your job: highlight potential ethical risks, privacy concerns, and fairness issues.",
            "",
            "Return STRICT JSON with the following shape:",
            "{",
            '  "overall_risk": "low|medium|high",',
            '  "key_issues": [ "short sentence", ... ],',
            '  "recommendations": [ "short actionable recommendation", ... ]',
            "}",
            "",
            "Dataset metadata (JSON):",
            json.dumps(meta, indent=2),
            "",
            "Columns:",
        ]

        for col in column_names:
            prompt_parts.append(f"- {col}")

        prompt = "\n".join(prompt_parts)

        raw = llm.invoke(prompt)   # same as your descriptions task

        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            return {"error": "LLM did not return valid JSON for ethical considerations"}

        # optional audit log
        log_action_with_context(
            username=username,
            action_type="build_ethical_considerations",
            file_id=file_id,
            metadata={
                "meta": meta,
                "column_count": len(column_names),
                "result_keys": list(parsed.keys()),
            },
        )

        return parsed

    except Exception as e:
        traceback.print_exc()
        return {"error": str(e)}



def _build_validation_html(result_json: dict, meta: dict, suite_wrapper: dict = None) -> str:
    """
    HTML report that separates:
      - Column expectations (per-column results)
      - Table expectations (whole-dataset checks)
    and shows column names, expectation descriptions, and GE result details.
    """
    suite_name = meta.get("suite_name") or meta.get("expectation_suite_name") or "Validation Suite"
    stats      = result_json.get("statistics", {}) or {}
    success    = stats.get("successful_expectations", 0)
    total      = stats.get("evaluated_expectations", 0)
    success_pct = stats.get("success_percent", 0)

    # Pull optional metadata we might have stored in suite_wrapper
    exp_meta = {}
    if suite_wrapper and isinstance(suite_wrapper, dict):
        exp_meta = suite_wrapper.get("expectation_descriptions") or {}
        if not isinstance(exp_meta, dict):
            exp_meta = {}

    results = result_json.get("results", []) or []

    # Split column vs table expectations
    col_results = []
    tbl_results = []

    for res in results:
        if not isinstance(res, dict):
            continue
        cfg = res.get("expectation_config") or {}
        etype = cfg.get("expectation_type") or ""
        kwargs = cfg.get("kwargs") or {}
        col = kwargs.get("column")
        success_flag = res.get("success")
        details = res.get("result") or {}

        row = {
            "expectation_type": etype,
            "column": col,
            "success": success_flag,
            "kwargs": kwargs,
            "details": details,
        }

        if col is not None:
            col_results.append(row)
        else:
            tbl_results.append(row)

    def render_params(kw: dict) -> str:
        items = [(k, kw[k]) for k in sorted(kw.keys()) if k != "column"]
        if not items:
            return "<em>—</em>"
        return ", ".join(f"{esc(str(k))}={esc(str(v))}" for k, v in items)

    def render_details(d: dict) -> str:
        if not d:
            return "<em>no details</em>"
        # show selected keys more compactly
        keys_order = [
            "element_count",
            "missing_count",
            "unexpected_count",
            "unexpected_percent",
            "observed_value",
        ]
        lines = []
        for k in keys_order:
            if k in d:
                lines.append(f"{k}: {d[k]}")
        # dump anything else at the end
        remaining = {k: v for k, v in d.items() if k not in keys_order}
        if remaining:
            lines.append(json.dumps(remaining, indent=2))
        return "<br/>".join(esc(str(x)) for x in lines)

    def render_exp_name(etype: str) -> str:
        if not etype:
            return "<code>unknown_expectation</code>"
        meta_for = exp_meta.get(etype) or {}
        human = meta_for.get("description") or ""
        cat   = meta_for.get("category") or ""
        # GE docs fallback
        doc_url = meta_for.get("doc_url") or meta_for.get("url") or ""
        if not doc_url and etype:
            doc_url = f"https://greatexpectations.io/expectations/{etype}"

        name_html = (
            f"<a href='{esc(doc_url)}' target='_blank' rel='noreferrer noopener'>"
            f"<code>{esc(etype)}</code></a>"
            if doc_url else f"<code>{esc(etype)}</code>"
        )

        extra = ""
        if human:
            extra += f"<div style='margin-top:4px;color:#444'>{esc(human)}</div>"
        if cat:
            extra += (
                "<div style='margin-top:6px'>"
                "<span style='display:inline-block;padding:2px 6px;border:1px solid #ddd;"
                "border-radius:10px;font-size:11px;background:#fafafa;color:#555'>"
                f"{esc(cat)}</span></div>"
            )
        return name_html + extra

    # Build rows
    col_rows_html = []
    for r in col_results:
        col = r["column"] if r["column"] is not None else "(unknown)"
        status_class = "ok" if r["success"] else "fail"
        status_label = "✔" if r["success"] else "✘"
        col_rows_html.append(
            "<tr>"
            f"<td><code>{esc(str(col))}</code></td>"
            f"<td>{render_exp_name(r['expectation_type'])}</td>"
            f"<td class='{status_class}'>{status_label}</td>"
            f"<td>{render_params(r['kwargs'])}</td>"
            f"<td><div style='font-size:0.8rem'>{render_details(r['details'])}</div></td>"
            "</tr>"
        )

    tbl_rows_html = []
    for r in tbl_results:
        status_class = "ok" if r["success"] else "fail"
        status_label = "✔" if r["success"] else "✘"
        tbl_rows_html.append(
            "<tr>"
            f"<td>{render_exp_name(r['expectation_type'])}</td>"
            f"<td class='{status_class}'>{status_label}</td>"
            f"<td>{render_params(r['kwargs'])}</td>"
            f"<td><div style='font-size:0.8rem'>{render_details(r['details'])}</div></td>"
            "</tr>"
        )

    col_rows_html = "".join(col_rows_html) or "<tr><td colspan='5'><em>No column expectations were evaluated.</em></td></tr>"
    tbl_rows_html = "".join(tbl_rows_html) or "<tr><td colspan='4'><em>No table expectations were evaluated.</em></td></tr>"

    html = f"""<!doctype html>
        <html>
        <head>
        <meta charset="utf-8"/>
        <title>Validation Report — {esc(str(suite_name))}</title>
        <style>
            body {{ font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 1.5rem; color:#111; }}
            h1 {{ margin-bottom: 0.25rem; }}
            .summary {{ margin-bottom: 1rem; }}
            table {{ border-collapse: collapse; width: 100%; font-size: 0.9rem; }}
            th, td {{ border: 1px solid #ddd; padding: 0.35rem 0.5rem; vertical-align: top; }}
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
                <th style="width:160px">Column</th>
                <th style="width:260px">Expectation</th>
                <th style="width:60px">OK?</th>
                <th style="width:180px">Params</th>
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
                <th style="width:320px">Expectation</th>
                <th style="width:60px">OK?</th>
                <th style="width:180px">Params</th>
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
    return html


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
        "external_url": "https://ddm.extremexp-icom.intracom-telecom.com/rewards",
        "animation_url": "",  # you can point this to HTML report if you like
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


# -------------------------------------------------------------------
# Main task – runs when DatasetRegistered is ingested
# -------------------------------------------------------------------

@shared_task(
    bind=True,
    name="tasks.validation.validate_registered_dataset_onchain_task",
    ignore_result=False,
    max_retries=0,
)
def validate_registered_dataset_onchain_task(
    self,
    *,
    network: str,
    dataset_fingerprint: str,
    dataset_uri: str,
    suite_hash: Optional[str] = None,
    uploader: Optional[str] = None,
    
) -> dict:
    """
    Triggered from tx_helper._handle_event when a DatasetRegistered event is stored.

    Steps:
      1) Resolve OnchainDataset + related suite info.
      2) Fetch dataset from IPFS/HTTP.
      3) Load expectation suite (if available) and run GE.
      4) Upload validation result JSON + HTML to IPFS.
      5) Build badge metadata JSON and upload to IPFS.
      6) (Optional) Submit ValidationRegistry.submitValidation on-chain
         using backend signer, then enqueue ingest_tx_task to record tx+events.
    """

    fp = str(dataset_fingerprint)
    log.info(
        f"[validate_registered_dataset] net={network} fp={fp} "
        f"uri={dataset_uri} suiteHash={suite_hash} uploader={uploader}"
    )

    try:
        # ---------------------------------------------------------------
        # 1) Resolve dataset + suite metadata from DB
        # ---------------------------------------------------------------
        od = OnchainDataset.query.filter_by(
            network=network,
            fingerprint=fp,
        ).one_or_none()

        if od:
            suite_hash = suite_hash or od.suite_hash
            dataset_uri = dataset_uri or od.uri
            uploader = uploader or od.uploader
            file_format = od.file_format or "csv"
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
                # prefer file_format from request if missing
                if not file_format:
                    file_format = odr.file_format or file_format

        category = category or "unknown"
        file_format = file_format or "csv"

        # ---------------------------------------------------------------
        # 2) Fetch dataset into DataFrame
        # ---------------------------------------------------------------
        df = _fetch_dataset_to_df(dataset_uri, file_format)

               # ---------------------------------------------------------------
        # 3) Load expectation suite and (maybe) run GE
        # ---------------------------------------------------------------
        suite_wrapper = None

        if suite_hash:
            es = (
                ExpectationSuites.query
                .filter(ExpectationSuites.suite_hash == suite_hash)
                .order_by(ExpectationSuites.created.desc())
                .first()
            )
            if es:
                raw = getattr(es, "suite_object", None) or getattr(es, "payload", None)
                if isinstance(raw, dict):
                    suite_wrapper = raw
                elif isinstance(raw, str):
                    try:
                        suite_wrapper = json.loads(raw)
                    except Exception:
                        log.warning(
                            "Could not json-load suite wrapper from ExpectationSuites"
                        )

        if not suite_wrapper:
            log.warning(
                f"No local suite wrapper found for suite_hash={suite_hash}, using empty suite"
            )
            suite_wrapper = {"suite_name": "auto_validation", "expectations": []}

        suite_name    = suite_wrapper.get("suite_name") or "auto_validation"
        expectations  = suite_wrapper.get("expectations") or []

        # base meta we’ll always have
        meta = {
            "suite_name": suite_name,
            "dataset_fingerprint": fp,
            "suite_hash": suite_hash,
            "file_format": file_format,
            "category": category,
            "network": network,
        }

        if not expectations:
            # ✅ no GE run at all
            log.info(
                f"[validate_registered_dataset] suite '{suite_name}' "
                f"has no expectations; skipping GE run"
            )
            results_json = {
                "statistics": {
                    "successful_expectations": 0,
                    "evaluated_expectations": 0,
                    "success_percent": 100.0,
                },
                "results": [],
                "success": True,
            }
        else:
            # sanity check – df must be a DataFrame
            if not isinstance(df, pd.DataFrame):
                raise TypeError(
                    f"Internal error: df is not a DataFrame but {type(df)}"
                )

            ge_results_json, ge_meta = run_expectation_suite(df, suite_wrapper)
            meta.update(ge_meta or {})
            results_json = ge_results_json

        full_result = {
            "meta": meta,
            "results": results_json.get("results", []),
            "statistics": results_json.get("statistics", {}),
            "success": results_json.get("success"),
        }

        # ---------------------------------------------------------------
        # 4) Upload validation result JSON + HTML to IPFS
        # ---------------------------------------------------------------
        validation_result_uri = _upload_json_blob("validation_result.json", full_result)

        html = _build_validation_html(results_json, meta, suite_wrapper)
        tmp_html = Path(f"/tmp/{secrets.token_hex(8)}_validation_report.html")
        tmp_html.write_text(html, encoding="utf-8")
        validation_report_uri = _upload_file(tmp_html)

        # animation_url: you may choose to use this HTML report
        validator_manifest_uri = ""  
        ethical = _build_ethical_considerations(
            df=df,
            meta=meta,
            username=None,       # or pass from task args if you have username
            file_id=None,        # or map from OnchainDataset to local file_id
        )

        # ---------------------------------------------------------------
        # 5) Build badge metadata + upload (soulbound reward)
        # ---------------------------------------------------------------
        # For now, single level "LEVEL1"; you can derive level from suite complexity later
        level = "LEVEL1"

        badge_metadata = _build_badge_metadata(
            category=category,
            level=level,
            dataset_fingerprint=fp,
            suite_hash=suite_hash or "",
            file_format=file_format,
            dataset_uri=dataset_uri,
            validation_result_uri=validation_result_uri,
            validator_manifest_uri=validator_manifest_uri,
            network=network,
        )

        badge_metadata_uri = _upload_json_blob("validation_badge.json", badge_metadata)

        # ---------------------------------------------------------------
        # 6) Optionally submit ValidationRegistry.submitValidation tx
        # ---------------------------------------------------------------
        validation_hash = Web3.keccak(text=validation_result_uri).hex()
        successful = bool(full_result.get("success"))

        tx_hash_hex = None
        signer_pkey = os.getenv("APP_VALIDATOR_PRIVATE_KEY") or os.getenv("APP_SIGNER_PRIVATE_KEY")
        if signer_pkey:
            dc = _get_validation_registry(network)
            if not dc or not isinstance(dc.abi, list) or not dc.abi:
                log.warning(f"No ValidationRegistry deployed for network={network}, skipping on-chain submitValidation")
            else:
                w3 = get_w3(network)
                contract = _mk_contract(w3, dc.address, dc.abi)

                acct = Account.from_key(signer_pkey)
                chain_id = w3.eth.chain_id
                nonce = w3.eth.get_transaction_count(acct.address)

                fp_bytes32 = _as_bytes32(fp)
                vh_bytes32 = _as_bytes32(validation_hash)

                tx = contract.functions.submitValidation(
                    fp_bytes32,
                    vh_bytes32,
                    validation_result_uri,  # JSON result IPFS URI
                    successful,
                ).build_transaction({
                    "from": acct.address,
                    "nonce": nonce,
                    "chainId": chain_id,
                })

                # simple gas strategy, can be improved
                tx.setdefault("gas", int(os.getenv("VALIDATION_TX_GAS", "500000")))
                if "maxFeePerGas" not in tx:
                    tx["maxFeePerGas"] = w3.to_wei("30", "gwei")
                if "maxPriorityFeePerGas" not in tx:
                    tx["maxPriorityFeePerGas"] = w3.to_wei("2", "gwei")

                signed = acct.sign_transaction(tx)
                tx_hash = w3.eth.send_raw_transaction(signed.rawTransaction)
                tx_hash_hex = tx_hash.hex()

                log.info(f"[validate_registered_dataset] submitValidation tx={tx_hash_hex}")

                # enqueue ingest so existing pipeline records tx + events
                ingest_tx_task.apply_async(kwargs={
                    "network": network,
                    "address": dc.address,
                    "tx_hash": tx_hash_hex,
                })
        else:
            log.info(
                "[validate_registered_dataset] APP_VALIDATOR_PRIVATE_KEY not set; "
                "skipping on-chain submitValidation"
            )

        return _to_jsonable({
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
            "successful": successful,
            "onchain_tx_hash": tx_hash_hex,
            "ethical_considerations": ethical,
        })

    except Exception as e:
        log.error(f"[validate_registered_dataset] error: {e}", exc_info=True)
        return {"status": "error", "error": str(e)}




def _normalize_validation_json(payload: Union[dict, list, str]) -> Union[dict, list]:
    """
    Accept dict/list or a JSON string. Return a parsed dict/list.
    Raise ValueError on invalid JSON.
    """
    if isinstance(payload, (dict, list)):
        return payload
    if isinstance(payload, str):
        s = payload.strip()
        # allow empty string? probably not
        if not s:
            raise ValueError("validation_json is empty")
        return json.loads(s)
    raise ValueError(f"validation_json must be object/array or JSON string, got {type(payload)}")


def _write_json_file(tmp_dir: Path, filename: str, obj: Union[dict, list]) -> Path:
    tmp_dir.mkdir(parents=True, exist_ok=True)
    path = tmp_dir / filename
    # stable output (useful for debugging + reproducibility)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2, sort_keys=True), encoding="utf-8")
    return path


def _write_html_report(tmp_dir: Path, filename: str, obj: Union[dict, list]) -> Path:
    """
    Minimal HTML report. Replace later with a richer renderer if you want.
    """
    tmp_dir.mkdir(parents=True, exist_ok=True)
    path = tmp_dir / filename

    pretty = json.dumps(obj, ensure_ascii=False, indent=2, sort_keys=True)
    html = f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Validation Report</title>
  <style>
    body {{ font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; margin: 24px; }}
    h1 {{ margin: 0 0 12px; }}
    .meta {{ color: #555; font-size: 12px; margin-bottom: 16px; }}
    pre {{ background: #f6f8fa; padding: 16px; border-radius: 10px; overflow-x: auto; }}
  </style>
</head>
<body>
  <h1>Validation Report</h1>
  <div class="meta">Auto-generated from validation JSON.</div>
  <pre>{pretty}</pre>
</body>
</html>
"""
    path.write_text(html, encoding="utf-8")
    return path


def _upload_files_to_ipfs(paths: list[Path]) -> Dict[str, str]:
    uploader = _choose_ipfs_uploader()
    if uploader == "web3storage":
        return _upload_with_web3storage(paths)  # expected: {filename: ipfs://CID/filename}
    return _upload_with_pinata(paths)          # expected: {filename: ipfs://CID or ipfs://CID/filename}

@shared_task(
    bind=True,
    ignore_result=False,
    name="tasks.validate_datasets.prepare_validation_task",
)
def prepare_validation_task(
    self,
    *,
    network: str,
    dataset_fingerprint: str,
    uploader: Optional[str] = None,
    include_report: bool = True,
    validation_json: Union[dict, list, str],
) -> Dict[str, Any]:
    log.info(
        "[prepare_validation_task] net=%s fp=%s include_report=%s uploader=%s",
        network, dataset_fingerprint, include_report, uploader
    )

    try:
        # Basic fp validation
        if not (
            isinstance(dataset_fingerprint, str)
            and dataset_fingerprint.startswith("0x")
            and len(dataset_fingerprint) == 66
        ):
            raise ValueError("dataset_fingerprint must be bytes32 hex string (0x + 64 hex chars)")

        if uploader:
            try:
                uploader = Web3.to_checksum_address(uploader)
            except Exception:
                raise ValueError("invalid uploader address")

        # 1) Normalize JSON (accept dict/list or JSON string)
        obj = _normalize_validation_json(validation_json)

        # 2) Write to temp
        tmp_dir = Path("/tmp/validation_ipfs")
        tmp_dir.mkdir(parents=True, exist_ok=True)

        fp_short = dataset_fingerprint[2:10]
        json_name = f"validation_{fp_short}.json"
        html_name = f"validation_{fp_short}.html"

        json_path = _write_json_file(tmp_dir, json_name, obj)

        # 3) Upload JSON to IPFS
        mapping = _upload_files_to_ipfs([json_path])
        result_uri = mapping.get(json_path.name)
        if not result_uri:
            raise RuntimeError("IPFS upload returned no result_uri for JSON")

        # 4) Optionally generate + upload HTML
        report_uri = None
        if include_report:
            html_path = _write_html_report(tmp_dir, html_name, obj)
            mapping2 = _upload_files_to_ipfs([html_path])
            report_uri = mapping2.get(html_path.name)
            if not report_uri:
                raise RuntimeError("IPFS upload returned no report_uri for HTML")

        # 5) Hash for on-chain convenience
        validation_hash = Web3.to_hex(Web3.keccak(text=result_uri))



        return {
            "network": network,
            "dataset_fingerprint": dataset_fingerprint,
            "uploader": uploader,
            "result_uri": result_uri,
            "report_uri": report_uri,
            "validation_hash": validation_hash,
            "file_format": "html" if include_report else None,
        }

    except Exception as exc:
        log.exception("[prepare_validation_task] Error: %s", exc)
        return {"status": "error", "message": str(exc)}