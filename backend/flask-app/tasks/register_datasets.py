# tasks/register_datasets.py
import os
from pathlib import Path
from typing import Dict, Any, Optional

from celery import shared_task
from celery.utils.log import get_task_logger

from extensions.db import db
from models.file import File
from utils.zenoh_file_handler import download_file_from_zenoh 
from tasks.ipfs import _upload_with_web3storage, _upload_with_pinata

log = get_task_logger(__name__)


def _choose_ipfs_uploader() -> str:
    if os.getenv("WEB3STORAGE_TOKEN"):
        return "web3storage"
    if os.getenv("PINATA_JWT"):
        return "pinata"
    raise RuntimeError("No IPFS provider configured (WEB3STORAGE_TOKEN or PINATA_JWT).")



def _download_to_temp_from_uri(uri: str, filename_hint: str) -> Path:
    """
    Download file from Zenoh / HTTP / object store into /tmp and
    return the local Path.

    👉 You MUST implement this to match your storage backend.

    Example pseudo-code:

        if uri.startswith("zenoh://"):
            data = fetch_from_zenoh(uri)
        else:
            import requests
            resp = requests.get(uri)
            resp.raise_for_status()
            data = resp.content

        dst.write_bytes(data)
    """
    tmp_dir = Path("/tmp/catalog_ipfs")
    tmp_dir.mkdir(parents=True, exist_ok=True)

    safe_name = filename_hint or "catalog_file"
    dst = tmp_dir / safe_name

    # TODO: REPLACE THIS WITH REAL IMPLEMENTATION
    raise NotImplementedError("Implement _download_to_temp_from_uri for your storage backend")

    # return dst

@shared_task(
    bind=True,
    ignore_result=False,
    name="tasks.datasets.prepare_report_ipfs_uri_task",
)
def prepare_report_ipfs_uri_task(
    self,
    *,
    network: str,
    catalog_id: str,
) -> Dict[str, Any]:
    """
    Given a catalog file (File.id = catalog_id), locate its HTML profile report
    in Zenoh, upload that HTML to IPFS, and return the IPFS URI.
    The report is stored under:
      projects/{project_id}/files/{file_id}/{file_id}_profile_report.html
    """
    log.info(f"[prepare_report_ipfs_uri_task] net={network} catalog_id={catalog_id}")

    try:
        # 1️⃣ Load the File row
        file_row: Optional[File] = File.query.get(catalog_id)
        if not file_row:
            raise RuntimeError(f"File catalog entry {catalog_id!r} not found")

        project_id = getattr(file_row, "project_id", None)
        file_id = getattr(file_row, "id", None)

        if not project_id or not file_id:
            raise RuntimeError(
                f"File row missing project_id or id (project_id={project_id}, id={file_id})"
            )

        # 2️⃣ Build the Zenoh path where the report is stored
        #    Example filename: 33404699-..._profile_report.html
        report_zenoh_path = (
            f"projects/{project_id}/files/{file_id}/{file_id}_profile_report.html"
        )

        log.info(
            "[prepare_report_ipfs_uri_task] Downloading report from Zenoh path: %s",
            report_zenoh_path,
        )

        # 3️⃣ Download from Zenoh to /tmp
        tmp_dir = Path("/tmp/catalog_ipfs_reports")
        tmp_dir.mkdir(parents=True, exist_ok=True)

        local_report_path = tmp_dir / f"{file_id}_profile_report.html"

        # This helper will raise FileNotFoundError if not present
        download_file_from_zenoh(report_zenoh_path, str(local_report_path))

        if not local_report_path.exists():
            raise RuntimeError(
                f"Report not found after Zenoh download: {local_report_path}"
            )

        log.info(
            "[prepare_report_ipfs_uri_task] Report downloaded to %s",
            local_report_path,
        )

        # 4️⃣ Upload the HTML report to IPFS via your existing helpers
        uploader = _choose_ipfs_uploader()

        if uploader == "web3storage":
            mapping = _upload_with_web3storage([local_report_path])
            report_ipfs_uri = mapping[local_report_path.name]  # ipfs://CID/filename
        else:
            mapping = _upload_with_pinata([local_report_path])
            report_ipfs_uri = mapping[local_report_path.name]  # ipfs://CID

        log.info(
            "[prepare_report_ipfs_uri_task] Uploaded report %s → %s",
            local_report_path,
            report_ipfs_uri,
        )

        # 5️⃣ Return minimal payload for frontend
        return {
            "catalog_id": str(catalog_id),
            "network": network,
            "report_uri": report_ipfs_uri,  # <-- frontend uses this
            "file_format": "html",
        }

    except Exception as exc:
        log.exception(
            "[prepare_report_ipfs_uri_task] Error for catalog_id=%s: %s",
            catalog_id,
            exc,
        )
        db.session.rollback()
        return {"status": "error", "message": str(exc)}

    finally:
        db.session.remove()
