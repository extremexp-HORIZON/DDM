
import eventlet
eventlet.monkey_patch()
# tasks/ipfs.py
import os
import json
from pathlib import Path
from celery import shared_task
from typing import Optional, Dict, List 
from services.ipfs_service import get_ipfs_client

ASSETS_DIR = os.getenv("IPFS_ASSETS_DIR", "ipfs_assets")


def _upload_with_web3storage(files: List[Path]) -> Dict[str, str]:
    """
    Uploads all files in one CAR to web3.storage; returns {relative_path: ipfs://CID/relative_path}
    Implementation uses raw HTTP; you can replace with official SDK if you have it.
    """
    import requests, io, tarfile, time
    token = os.getenv("WEB3STORAGE_TOKEN")
    if not token:
        raise RuntimeError("WEB3STORAGE_TOKEN missing")

    # We'll tar the files (web3.storage accepts multipart/form-data too; keeping it simple here)
    tar_bytes = io.BytesIO()
    with tarfile.open(mode="w", fileobj=tar_bytes) as tar:
        for f in files:
            tar.add(f, arcname=f.name)
    tar_bytes.seek(0)

    # NOTE: web3.storage supports multipart uploads, car files, etc.
    # Here we use a simple multipart; replace as desired.
    headers = {"Authorization": f"Bearer {token}"}
    files_mp = [("file", ("bundle.tar", tar_bytes, "application/x-tar"))]
    r = requests.post("https://api.web3.storage/upload", headers=headers, files=files_mp, timeout=60)
    r.raise_for_status()
    cid = r.json()["cid"]

    # Map paths → ipfs://CID/<filename>
    return {f.name: f"ipfs://{cid}/{f.name}" for f in files}

def _upload_with_pinata(files: List[Path]) -> Dict[str, str]:
    """
    Upload files individually to Pinata; returns {relative_path: ipfs://CID}
    """
    import requests
    jwt = os.getenv("PINATA_JWT")
    if not jwt:
        raise RuntimeError("PINATA_JWT missing")

    headers = {"Authorization": f"Bearer {jwt}"}
    out = {}
    for f in files:
        with open(f, "rb") as fp:
            res = requests.post(
                "https://api.pinata.cloud/pinning/pinFileToIPFS",
                headers=headers,
                files={"file": (f.name, fp)},
                timeout=60
            )
        res.raise_for_status()
        cid = res.json()["IpfsHash"]
        out[f.name] = f"ipfs://{cid}"
    return out

@shared_task(bind=True, ignore_result=False, name="tasks.ipfs.upload_ipfs_assets_task")
def upload_ipfs_assets_task(self, assets_dir: Optional[str] = None) -> Dict[str, str]:
    """
    Upload all files in ASSETS_DIR to IPFS.
    Returns a dict { "<filename>": "ipfs://..." }.
    """
    assets_dir = assets_dir or ASSETS_DIR
    root = Path(assets_dir).resolve()
    if not root.exists():
        # Nothing to upload → return empty map
        return {}

    files = [p for p in root.iterdir() if p.is_file()]
    if not files:
        return {}

    if os.getenv("WEB3STORAGE_TOKEN"):
        mapping = _upload_with_web3storage(files)
    elif os.getenv("PINATA_JWT"):
        mapping = _upload_with_pinata(files)
    else:
        raise RuntimeError("No IPFS provider configured (set WEB3STORAGE_TOKEN or PINATA_JWT).")

    # You can persist this mapping to disk if handy:
    (root / "_uploaded.json").write_text(json.dumps(mapping, indent=2), encoding="utf-8")
    return mapping

