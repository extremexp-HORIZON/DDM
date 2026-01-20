# tasks/ethical_assessment.py
import os
import json
import secrets
import traceback
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional
import pandas as pd
from web3 import Web3
from eth_account import Account

from celery import shared_task
from celery.utils.log import get_task_logger

from extensions.db import db
from extensions.llm import llm
from web3_scripts.web3_factory import get_w3

from models.ethics import DatasetEthicalAssessment
from models.blockchain import DeployedContract, OnchainDataset

from utils.zenoh_file_handler import ZenohFileHandler
from utils.file_df_loader import load_dataframe

from tasks.ipfs import _upload_with_web3storage, _upload_with_pinata
from tasks.chain import ingest_tx_task


from utils.user_file_logger import log_action_with_context

log = get_task_logger(__name__)


# -------------------------------------------------------------------
# Shared helpers (JSON + IPFS) – local copy to avoid circular imports
# -------------------------------------------------------------------

def _canonical_json(obj) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"))


def _choose_ipfs_uploader() -> str:
    if os.getenv("WEB3STORAGE_TOKEN"):
        return "web3storage"
    if os.getenv("PINATA_JWT"):
        return "pinata"
    raise RuntimeError(
        "No IPFS provider configured (WEB3STORAGE_TOKEN or PINATA_JWT)."
    )


def _upload_json_blob(name: str, obj) -> str:
    """
    Upload a canonical JSON blob to IPFS and return an ipfs:// URI.
    """
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
    """
    Upload a file as-is to IPFS and return an ipfs:// URI.
    """
    uploader = _choose_ipfs_uploader()
    if uploader == "web3storage":
        mapping = _upload_with_web3storage([path])
    else:
        mapping = _upload_with_pinata([path])
    return mapping[path.name]


# -------------------------------------------------------------------
# DF loading – mirror run_expectation_suites_task style
# -------------------------------------------------------------------

def _load_df_from_zenoh_via_file_record(dataset_uri: str) -> pd.DataFrame:
    """
    Mirror the style of run_expectation_suites_task:

      - dataset_uri is expected to look like:
        projects/<project_id>/files/<file_id>/filename.ext

      - derive file_id, then use get_file_record(file_id)
      - read the file from Zenoh using file_record.path
      - write it under /uploads/<path>
      - call load_dataframe(local_path)
    """
    if not dataset_uri or not dataset_uri.startswith("projects/"):
        raise ValueError(f"Unsupported dataset_uri for ethical assessment: {dataset_uri}")

    parts = dataset_uri.split("/")
    # ["projects", project_id, "files", file_id, "filename.ext"]
    if len(parts) < 5 or parts[0] != "projects" or parts[2] != "files":
        raise ValueError(f"Unexpected dataset_uri format: {dataset_uri}")

    project_id = parts[1]
    file_id = parts[3]

    # local import to avoid circular import issues
    from utils.file_handler import get_file_record

    file_record = get_file_record(file_id)
    if not file_record:
        raise ValueError(f"Invalid file_id derived from uri: {file_id}")

    path = file_record.path
    local_path = os.path.join("/uploads", path)
    os.makedirs(os.path.dirname(local_path), exist_ok=True)

    # Read raw bytes from Zenoh
    raw_data = ZenohFileHandler.get_file(file_record.path)
    if not raw_data:
        raise ValueError(f"File not found in Zenoh: {file_record.path}")

    # Write to local file
    with open(local_path, "wb") as f:
        f.write(raw_data.read() if hasattr(raw_data, "read") else raw_data)

    try:
        df_or_error = load_dataframe(local_path)
        if not isinstance(df_or_error, pd.DataFrame):
            raise TypeError(f"load_dataframe failed: {df_or_error}")
        return df_or_error
    finally:
        # optional cleanup
        try:
            if os.path.exists(local_path):
                os.remove(local_path)
        except Exception:
            traceback.print_exc()


# -------------------------------------------------------------------
# LLM prompt – same JSON discipline as build_column_descriptions_task
# -------------------------------------------------------------------

def _call_llm_ethical_model(df: pd.DataFrame, meta: dict) -> dict:
    """
    LLM call in JSON:
    - explicit JSON schema in the prompt
    - llm.invoke(...)
    - json.loads(...) with safe fallback
    """

    sample = df.head(2).to_dict(orient="records")
    column_names = list(df.columns)

    prompt_parts = [
        "You are an expert in data ethics and responsible AI.",
        "You receive: (1) basic metadata about a tabular anonymized dataset, "
        "(2) the list of column names, and (3) a small sample of rows.",
        "",
        "Your job:",
        "- Identify potential ethical risks, privacy issues, and fairness concerns.",
        "- Consider re-identification risk, sensitive attributes, bias, misuse, and consent.",
        "",
        "Return ONLY valid JSON. Do not include any explanation outside JSON.",
        "The JSON MUST have exactly this structure:",
        "",
        "{",
        '  "score": 0.0,                     // float between 0 and 1, higher = more ethical/safe',
        '  "label": "low|medium|high|unknown",',
        '  "summary": "Short 1-3 sentence summary of main issues.",',
        '  "details": {',
        '    "risks": [ "short bullet", ... ],',
        '    "privacy": [ "short bullet", ... ],',
        '    "fairness": [ "short bullet", ... ],',
        '    "recommendations": [ "short, actionable recommendation", ... ]',
        "  }",
        "}",
        "",
        "Dataset metadata (JSON):",
        json.dumps(meta, indent=2),
        "",
        "Column names:",
    ]

    for col in column_names:
        prompt_parts.append(f"- {col}")

    prompt_parts.append("")
    prompt_parts.append("Sample rows (JSON, array of objects):")
    prompt_parts.append(json.dumps(sample, indent=2) if sample else "[]")

    ethical_prompt = "\n".join(prompt_parts)

    result = llm.invoke(ethical_prompt)

    try:
        parsed = json.loads(result)
    except json.JSONDecodeError:
        return {
            "score": 0.0,
            "label": "unknown",
            "summary": "LLM did not return valid JSON; see raw field for debugging.",
            "details": {
                "risks": [],
                "privacy": [],
                "fairness": [],
                "recommendations": [],
            },
            "raw": result,
        }

    return parsed


# -------------------------------------------------------------------
# Simple HTML report for the ethical assessment
# -------------------------------------------------------------------

def _build_ethical_html(result_json: dict, meta: dict) -> str:
    score   = float(result_json.get("score", 0.0))
    label   = result_json.get("label", "unknown")
    summary = result_json.get("summary", "")
    details = result_json.get("details") or {}

    risks           = details.get("risks", [])
    privacy_issues  = details.get("privacy", [])
    fairness_issues = details.get("fairness", [])
    recommendations = details.get("recommendations", [])

    dataset_fp = meta.get("dataset_fingerprint", "")
    suite_hash = meta.get("suite_hash", "")
    network    = meta.get("network", "")
    file_fmt   = meta.get("file_format", "")

    html = f"""<!doctype html>
        <html>
        <head>
        <meta charset="utf-8"/>
        <title>Ethical Assessment Report</title>
        <style>
            body {{ font-family: system-ui, sans-serif; padding: 1.5rem; max-width: 900px; margin: 0 auto; }}
            h1, h2, h3 {{ margin-bottom: 0.4rem; }}
            .meta, .summary, .section {{ margin-bottom: 1rem; }}
            .badge {{
            display: inline-block;
            padding: 0.2rem 0.6rem;
            border-radius: 999px;
            font-size: 0.8rem;
            font-weight: 600;
            }}
            .badge-low {{ background:#e8f5e9; color:#2e7d32; }}
            .badge-medium {{ background:#fff8e1; color:#f9a825; }}
            .badge-high {{ background:#ffebee; color:#c62828; }}
            .badge-unknown {{ background:#eceff1; color:#455a64; }}
            ul {{ padding-left: 1.2rem; }}
            li {{ margin-bottom: 0.15rem; }}
            code {{ font-size: 0.8rem; background:#f5f5f5; padding:0.1rem 0.3rem; border-radius:4px; }}
        </style>
        </head>
        <body>
        <h1>Ethical Assessment</h1>
        <div class="meta">
            <div><strong>Network:</strong> {network}</div>
            <div><strong>Dataset fingerprint:</strong> <code>{dataset_fp}</code></div>
            <div><strong>Suite hash:</strong> <code>{suite_hash}</code></div>
            <div><strong>File format:</strong> {file_fmt}</div>
        </div>
    """
    
    label_lower = str(label).lower()
    badge_class = {
        "low": "badge-low",
        "medium": "badge-medium",
        "high": "badge-high",
    }.get(label_lower, "badge-unknown")

    label_text = str(label).upper() if label else "UNKNOWN"

    html += f"""
        <div class="summary">
            <h2>Overall Assessment</h2>
            <p>
            <span class="badge {badge_class}">{label_text}</span>
            &nbsp; <strong>Score:</strong> {score:.2f}
            </p>
            <p>{summary}</p>
        </div>
    """


    def _render_section(title: str, items):
        if not items:
            return ""
        li_html = "\n".join(f"<li>{x}</li>" for x in items)
        return f"""
            <div class="section">
                <h3>{title}</h3>
                <ul>
                {li_html}
                </ul>
            </div>
        """

    html += _render_section("Key Risks", risks)
    html += _render_section("Privacy Considerations", privacy_issues)
    html += _render_section("Fairness & Bias Concerns", fairness_issues)
    html += _render_section("Recommendations", recommendations)

    html += """
        </body>
        </html>
    """
    return html


# -------------------------------------------------------------------
# Main task
# -------------------------------------------------------------------

@shared_task(
    bind=True,
    name="tasks.ethical_assessment.run_ethical_assessment_task",
    ignore_result=False,
    max_retries=3,
)
def run_ethical_assessment_task(
    self,
    *,
    network: str,
    dataset_fingerprint: str,
    dataset_uri: str,
    suite_hash: Optional[str] = None,
    uploader: Optional[str] = None,
    trigger_tx_hash: Optional[str] = None,
    trigger_event_id: Optional[str] = None,
) -> dict:
    """
    Background ethical assessment:

      1) Load OnchainDataset (for file_format etc.)
      2) Fetch dataset from Zenoh using the same pattern as run_expectation_suites_task
      3) Call LLM-based ethical model
      4) Upload JSON + HTML to IPFS and compute a keccak hash (“signature”)
      5) Store everything in DatasetEthicalAssessment.details["artifacts"]["ethical"]
    """

    fp = str(dataset_fingerprint)
    log.info(
        f"[ethical_assessment] net={network} fp={fp} uri={dataset_uri} "
        f"suiteHash={suite_hash} uploader={uploader} tx={trigger_tx_hash}"
    )

    try:
        # 1) Get dataset meta from OnchainDataset
        od = OnchainDataset.query.filter_by(
            network=network,
            fingerprint=fp,
        ).one_or_none()

        if od:
            dataset_uri = dataset_uri or od.uri
            suite_hash  = suite_hash or od.suite_hash
            uploader    = uploader or od.uploader
            file_format = od.file_format or "csv"
        else:
            file_format = "csv"

        if not dataset_uri:
            raise ValueError("No dataset_uri available for ethical assessment")

        # 2) Load dataset as DataFrame (Zenoh + load_dataframe pattern)
        df = _load_df_from_zenoh_via_file_record(dataset_uri)

        meta = {
            "network": network,
            "dataset_fingerprint": fp,
            "suite_hash": suite_hash,
            "file_format": file_format,
            "uploader": uploader,
        }

        # 3) LLM-based ethical model
        raw_result = _call_llm_ethical_model(df, meta)

        score   = float(raw_result.get("score", 0.0))
        label   = raw_result.get("label") or "unknown"
        summary = raw_result.get("summary") or ""
        details = raw_result.get("details") or raw_result

         # Decide "success" for on-chain ethics submission
        label_lower = str(label).lower()
        if "high" in label_lower:
            ethical_success = False           # high risk -> not successful
        elif "low" in label_lower:
            ethical_success = True            # low risk -> successful
        elif "medium" in label_lower:
            ethical_success = True           # medium risk -> successful
        else:
            ethical_success = score >= 0.5    # fallback to score threshold

               # 4) Build artifacts: JSON + HTML → IPFS + hash (this is your “signing”)
        artifacts = {}
        try:
            full_ethics = {
                "meta": meta,
                "result": raw_result,
            }

            ethics_result_uri = _upload_json_blob(
                "ethical_assessment.json", full_ethics
            )

            html = _build_ethical_html(raw_result, meta)
            tmp_html = Path(f"/tmp/{secrets.token_hex(8)}_ethical_report.html")
            tmp_html.write_text(html, encoding="utf-8")
            ethics_report_uri = _upload_file(tmp_html)

            ethics_hash = Web3.keccak(text=ethics_result_uri).hex()

            artifacts = {
                "result_uri": ethics_result_uri,
                "report_uri": ethics_report_uri,
                "hash": ethics_hash,
                "successful": ethical_success,
            }

        except Exception as ipfs_exc:
            log.error(
                f"[ethical_assessment] IPFS upload failed: {ipfs_exc}", exc_info=True
            )
            artifacts = {
                "result_uri": None,
                "report_uri": None,
                "hash": None,
                "successful": ethical_success,
                "error": str(ipfs_exc),
            }

        # 5) Persist in DB (1 row per dataset/network; update if exists)
        row = (
            DatasetEthicalAssessment.query
            .filter_by(network=network, dataset_fingerprint=fp)
            .one_or_none()
        )
        now = datetime.now(timezone.utc)

        if not row:
            row = DatasetEthicalAssessment(
                network=network,
                dataset_fingerprint=fp,
            )
            db.session.add(row)

        # Attach artifacts into details without requiring schema changes
        if not isinstance(details, dict):
            details = {"raw": details}

        details.setdefault("artifacts", {})
        details["artifacts"]["ethical"] = artifacts

        row.score            = score
        row.label            = label
        row.summary          = summary
        row.details          = details
        row.assessed_at      = now
        row.suite_hash       = suite_hash or row.suite_hash
        row.uploader         = uploader or row.uploader
        row.trigger_tx_hash  = trigger_tx_hash or row.trigger_tx_hash
        row.trigger_event_id = trigger_event_id or row.trigger_event_id

        db.session.commit()

        return {
            "status": "ok",
            "network": network,
            "dataset_fingerprint": fp,
            "score": score,
            "label": label,
            "summary": summary,
            "artifacts": artifacts,
        }

    except Exception as e:
        log.error(f"[ethical_assessment] error: {e}", exc_info=True)
        try:
            db.session.rollback()
        except Exception:
            pass
        return {"status": "error", "error": str(e), "dataset_fingerprint": fp}


@shared_task(
    bind=True,
    name="tasks.ethical_assessment.submit_onchain_ethical_validation_task",
    ignore_result=False,
    max_retries=0,
)
def submit_onchain_ethical_validation_task(
    self,
    ethical_result: dict,
    *,
    network: str,
    dataset_fingerprint: str,
    username: Optional[str] = None,
    project_id: Optional[str] = None,
    file_id: Optional[str] = None,
    suite_id: Optional[str] = None,
    category: Optional[str] = None,
) -> dict:
    """
    Step 5 in the chain:
      - takes output of run_ethical_assessment_task
      - uses artifacts.result_uri / report_uri / hash / successful
      - submits as an on-chain validation from an "ethics validator"
    """

    log = get_task_logger(__name__)

    fp = str(dataset_fingerprint or ethical_result.get("dataset_fingerprint"))
    score   = float(ethical_result.get("score", 0.0))
    label   = ethical_result.get("label") or "unknown"

    artifacts = (ethical_result or {}).get("artifacts") or {}
    ethics_result_uri = artifacts.get("result_uri")
    ethics_report_uri = artifacts.get("report_uri") or ""
    ethics_hash       = artifacts.get("hash")
    successful        = artifacts.get("successful")

    # fallback: recompute success if missing
    if successful is None:
        label_lower = str(label).lower()
        if "high" in label_lower:
            successful = False
        elif "low" in label_lower:
            successful = True
        elif "medium" in label_lower:
            successful = False
        else:
            successful = score >= 0.5

    log.info(
        f"[submit_onchain_ethical_validation_task] net={network} fp={fp} "
        f"result_uri={ethics_result_uri} report_uri={ethics_report_uri} "
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
            log.warning(f"[submit_onchain_ethical_validation_task] {msg}")
            return {"status": "error", "error": msg, "dataset_fingerprint": fp}

        if not ethics_result_uri:
            msg = "No ethics result URI in artifacts"
            log.warning(f"[submit_onchain_ethical_validation_task] {msg}")
            return {"status": "error", "error": msg, "dataset_fingerprint": fp}

        w3 = get_w3(network)
        contract = w3.eth.contract(
            address=Web3.to_checksum_address(dc.address),
            abi=dc.abi,
        )

        # Prefer a dedicated key for ethics, otherwise fall back
        signer_pkey = (
            os.getenv("APP_ETHICS_VALIDATOR_PRIVATE_KEY")
            or os.getenv("APP_VALIDATOR_PRIVATE_KEY")
            or os.getenv("APP_SIGNER_PRIVATE_KEY")
        )
        if not signer_pkey:
            msg = (
                "APP_ETHICS_VALIDATOR_PRIVATE_KEY / "
                "APP_VALIDATOR_PRIVATE_KEY / APP_SIGNER_PRIVATE_KEY not set"
            )
            log.warning(f"[submit_onchain_ethical_validation_task] {msg}")
            return {
                "status": "error",
                "error": msg,
                "dataset_fingerprint": fp,
            }

        acct = Account.from_key(signer_pkey)
        chain_id = w3.eth.chain_id
        nonce = w3.eth.get_transaction_count(acct.address)

        fp_bytes32 = Web3.to_bytes(hexstr=fp)
        validation_hash = ethics_hash or Web3.keccak(
            text=ethics_result_uri
        ).hex()
        vh_bytes32 = Web3.to_bytes(hexstr=validation_hash)

        tx = contract.functions.submitValidation(
            fp_bytes32,
            vh_bytes32,
            ethics_result_uri,
            ethics_report_uri,
            bool(successful),
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
            f"[submit_onchain_ethical_validation_task] submitValidation tx={tx_hash_hex}"
        )

        if username:
            try:
                log_action_with_context(
                    username=username,
                    action_type="submit_onchain_ethical_validation",
                    file_id=file_id,
                    metadata={
                        "network": network,
                        "dataset_fingerprint": fp,
                        "project_id": project_id,
                        "suite_id": suite_id,
                        "category": category,
                        "status": "ok",
                        "successful": bool(successful),
                        "ethics_result_uri": ethics_result_uri,
                        "ethics_report_uri": ethics_report_uri,
                        "validation_hash": validation_hash,
                        "onchain_tx_hash": tx_hash_hex,
                    },
                )
            except Exception as log_exc:
                db.session.rollback()
                log.warning(
                    f"[submit_onchain_ethical_validation_task] failed to log user action: {log_exc}",
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
            "ethics_result_uri": ethics_result_uri,
            "ethics_report_uri": ethics_report_uri,
            "validation_hash": validation_hash,
            "successful": bool(successful),
            "onchain_tx_hash": tx_hash_hex,
        }

    except Exception as e:
        log.error(
            f"[submit_onchain_ethical_validation_task] error: {e}",
            exc_info=True,
        )

        if username:
            try:
                log_action_with_context(
                    username=username,
                    action_type="submit_onchain_ethical_validation",
                    file_id=file_id,
                    metadata={
                        "network": network,
                        "dataset_fingerprint": fp,
                        "project_id": project_id,
                        "suite_id": suite_id,
                        "category": category,
                        "status": "error",
                        "reason": str(e),
                        "ethics_result_uri": ethics_result_uri,
                        "ethics_report_uri": ethics_report_uri,
                    },
                )
            except Exception:
                db.session.rollback()

        return {
            "status": "error",
            "error": str(e),
            "dataset_fingerprint": fp,
        }
