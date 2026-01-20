# blockchain/web3_factory.py
import os
from web3 import Web3

def get_network_config(network: str):
    return {
        "ganache": {
            "RPC_URL": os.getenv("GANACHE_RPC_URL", "http://127.0.0.1:7545"),
            "WS_URL":  os.getenv("GANACHE_WS_URL"),  # optional
            "CHAIN_ID": int(os.getenv("GANACHE_CHAIN_ID", 5777)),
        },
        "sepolia": {
            "RPC_URL": os.getenv("SEPOLIA_RPC_URL"),
            "WS_URL":  os.getenv("SEPOLIA_WS_URL"),  # wss://… if you have it
            "CHAIN_ID": int(os.getenv("SEPOLIA_CHAIN_ID", 11155111)),
        },
    }.get(network)

def get_w3(network: str) -> Web3:
    cfg = get_network_config(network)
    if not cfg:
        raise ValueError(f"Unknown network {network}")
    if cfg.get("WS_URL"):
        w3 = Web3(Web3.WebsocketProvider(cfg["WS_URL"]))
    else:
        w3 = Web3(Web3.HTTPProvider(cfg["RPC_URL"]))
    if not w3.is_connected():
        raise RuntimeError(f"Web3 cannot connect to {cfg.get('WS_URL') or cfg['RPC_URL']}")
    return w3
