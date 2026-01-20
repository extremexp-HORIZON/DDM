# services/ipfs_service.py
import os
import json
import requests
from abc import ABC, abstractmethod

class IpfsClient(ABC):
    @abstractmethod
    def upload_bytes(self, data: bytes, filename: str) -> str:
        """Return an ipfs:// URI"""
        raise NotImplementedError

    def upload_json(self, obj: dict, filename: str) -> str:
        payload = json.dumps(obj, separators=(",", ":")).encode("utf-8")
        return self.upload_bytes(payload, filename)

class Web3StorageClient(IpfsClient):
    def __init__(self, token: str):
        self.token = token
        self.endpoint = "https://api.web3.storage/upload"

    def upload_bytes(self, data: bytes, filename: str) -> str:
        files = {"file": (filename, data, "application/octet-stream")}
        r = requests.post(
            self.endpoint,
            headers={"Authorization": f"Bearer {self.token}"},
            files=files,
            timeout=60,
        )
        r.raise_for_status()
        cid = r.json()["cid"]
        return f"ipfs://{cid}/{filename}"

class PinataClient(IpfsClient):
    def __init__(self, jwt: str):
        self.jwt = jwt
        self.file_url = "https://api.pinata.cloud/pinning/pinFileToIPFS"

    def upload_bytes(self, data: bytes, filename: str) -> str:
        r = requests.post(
            self.file_url,
            headers={"Authorization": f"Bearer {self.jwt}"},
            files={"file": (filename, data, "application/octet-stream")},
            timeout=60,
        )
        r.raise_for_status()
        cid = r.json()["IpfsHash"]
        return f"ipfs://{cid}"

def get_ipfs_client() -> IpfsClient:
    token = os.getenv("WEB3STORAGE_TOKEN")
    if token:
        return Web3StorageClient(token)
    jwt = os.getenv("PINATA_JWT")
    if jwt:
        return PinataClient(jwt)
    raise RuntimeError("No IPFS provider configured (set WEB3STORAGE_TOKEN or PINATA_JWT).")
