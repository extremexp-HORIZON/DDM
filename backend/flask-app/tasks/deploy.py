# tasks/deploy.py
import os, json
from celery import shared_task
from web3 import Web3
from dotenv import load_dotenv
from web3_scripts.web3_factory import get_network_config
from tasks.chain import wait_for_receipt_task
from typing import Optional, Any, Dict
import time
from utils.tx_helper import _record_tx
from tasks.chain import wait_for_receipt_task
load_dotenv()
DEFAULT_NETWORK = os.getenv("DEFAULT_NETWORK", "sepolia")

def _load_chain_cfg(network: str) -> dict:
    base = get_network_config(network) or {}
    rpc_url  = os.getenv(f"{network.upper()}_RPC_URL")    or base.get("RPC_URL")
    chain_id = os.getenv(f"{network.upper()}_CHAIN_ID")   or base.get("CHAIN_ID")
    pkey     = os.getenv(f"{network.upper()}_PRIVATE_KEY") or base.get("PRIVATE_KEY")
    deployer = os.getenv(f"{network.upper()}_DEPLOYER_ADDRESS") or base.get("DEPLOYER_ADDRESS")
    if not rpc_url: raise RuntimeError(f"[{network}] RPC_URL missing")
    if chain_id is None: raise RuntimeError(f"[{network}] CHAIN_ID missing")
    if not pkey: raise RuntimeError(f"[{network}] PRIVATE_KEY missing")
    if not deployer: deployer = Web3().eth.account.from_key(pkey).address
    return {"RPC_URL": rpc_url, "CHAIN_ID": int(chain_id), "PRIVATE_KEY": pkey, "DEPLOYER_ADDRESS": deployer}

def _gas_fields(w3: Web3):
    try:
        latest = w3.eth.get_block("latest")
        if "baseFeePerGas" in latest and latest["baseFeePerGas"] is not None:
            max_priority = w3.to_wei(os.getenv("MAX_PRIORITY_GWEI", "2"), "gwei")
            base = latest["baseFeePerGas"]
            max_fee = base * 2 + max_priority
            return {"maxFeePerGas": max_fee, "maxPriorityFeePerGas": max_priority}
    except Exception:
        pass
    return {"gasPrice": w3.to_wei(os.getenv("GAS_PRICE_GWEI", "20"), "gwei")}

def _deploy_one(artifact_path: str, name: str, constructor_args, network: str):
    cfg = _load_chain_cfg(network)
    w3 = Web3(Web3.HTTPProvider(cfg["RPC_URL"]))
    if not w3.is_connected():
        raise RuntimeError(f"Failed to connect to {network} RPC at {cfg['RPC_URL']}")
    with open(artifact_path, "r", encoding="utf-8") as f:
        compiled = json.load(f)
    abi = compiled["abi"]; bytecode = compiled["bin"]
    contract = w3.eth.contract(abi=abi, bytecode=bytecode)
    txb = contract.constructor(*(constructor_args or []))
    gas = txb.estimate_gas({"from": cfg["DEPLOYER_ADDRESS"]})
    nonce = w3.eth.get_transaction_count(cfg["DEPLOYER_ADDRESS"])
    tx = txb.build_transaction({
        "chainId": cfg["CHAIN_ID"], "from": cfg["DEPLOYER_ADDRESS"], "nonce": nonce,
        "gas": gas + 100_000, **_gas_fields(w3),
    })
    signed = w3.eth.account.sign_transaction(tx, private_key=cfg["PRIVATE_KEY"])
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    print(f"⏳ Sent {name}: {tx_hash.hex()}")

    rcpt = w3.eth.wait_for_transaction_receipt(tx_hash)
    address = rcpt.contractAddress
    print(f"✅ {name} deployed at: {address}")
    _record_tx(w3, network, tx_hash.hex(), receipt=rcpt)
    time.sleep(float(os.getenv("SLEEP_BETWEEN_TX", "5")))
    wait_for_receipt_task.delay(
        network=network, tx_hash_hex=tx_hash.hex(), contract_name=name, address=address, abi=abi,
        confirmations=int(os.getenv("CONFIRMATIONS", "3")),
    )
    return address, abi, w3


def _call(
    w3: Web3,
    cfg: dict,
    address: str,
    abi,
    fn: str,
    *args,
    label=None,
    network: str = DEFAULT_NETWORK,
):
    from tasks.chain import ingest_tx_task
    c = w3.eth.contract(address=address, abi=abi)
    txb = getattr(c.functions, fn)(*args)
    gas = txb.estimate_gas({"from": cfg["DEPLOYER_ADDRESS"]})
    nonce = w3.eth.get_transaction_count(cfg["DEPLOYER_ADDRESS"])
    tx = txb.build_transaction({
        "chainId": cfg["CHAIN_ID"],
        "from": cfg["DEPLOYER_ADDRESS"],
        "nonce": nonce,
        "gas": gas + 50_000,
        **_gas_fields(w3),
    })
    signed = w3.eth.account.sign_transaction(tx, private_key=cfg["PRIVATE_KEY"])
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    tx_hex = tx_hash.hex()

    tag = label or fn
    print(f"⏳ Calling {tag}: {tx_hex}")
    time.sleep(float(os.getenv("SLEEP_BETWEEN_TX", "5")))
    rcpt = w3.eth.wait_for_transaction_receipt(tx_hash)
    print(f"✅ {tag} confirmed in block {rcpt.blockNumber}")

    # 1) record tx in ContractTx
    _record_tx(w3, network, tx_hex, receipt=rcpt)

    # 2) decode events for this contract+tx and store in ContractEvent
    ingest_tx_task.delay(network=network, address=address, tx_hash=tx_hex)

    return rcpt



def _bytes32_or_keccak(raw_hex: Optional[str], desc: str, uri: str) -> bytes:
    """
    - If raw_hex is a proper 0x + 64-hex, return bytes32
    - Else derive bytes32 as keccak(desc|uri)
    """
    if raw_hex and raw_hex.startswith("0x") and len(raw_hex) == 66:
        return Web3.to_bytes(hexstr=raw_hex)
    return Web3.keccak(text=f"{desc}|{uri}")

@shared_task(bind=True, ignore_result=False, name="tasks.deploy.deploy_ddm_suite_task")
def deploy_ddm_suite_task(self, prev_result: Any = None, network: str = DEFAULT_NETWORK):
    """
    Chained usage:
      compile_contracts_task() -> upload_ipfs_assets_task() -> deploy_ddm_suite_task()

    prev_result will be the IPFS map dict from upload_ipfs_assets_task.
    We read the compiled artifacts path from COMPILED_DIR (env), so we don't
    depend on compile task's return shape here.
    """
    # 1) Resolve ipfs_map from prev_result (dict or None)
    ipfs_map: Dict[str, str] = prev_result if isinstance(prev_result, dict) else {}

    # 2) Resolve compiled_dir from env (what compile task wrote to)
    compiled_dir = os.path.abspath(os.getenv("COMPILED_DIR", "compiled_contracts"))

    def p(fname: str):
        path = os.path.join(compiled_dir, fname)
        if not os.path.exists(path):
            raise FileNotFoundError(
                f"Missing artifact: {path}. Ensure compile task ran and COMPILED_DIR is correct."
            )
        return path

    cfg = _load_chain_cfg(network)

    # Resolve manifest / metadata from uploaded assets (with env fallbacks)
    validator_manifest = ipfs_map.get("validator-manifest.json") or \
                        os.getenv("VALIDATOR_CODE_URI", "ipfs://validator-manifest")
    ethical_validator_manifest = ipfs_map.get("ethical-validator-manifest.json") or \
                        os.getenv("ETHICS_VALIDATOR_CODE_URI") 
    human_validator_manifest = ipfs_map.get("human-validator-manifest.json") or \
                        os.getenv("HUMAN_VALIDATOR_CODE_URI") 
    time.sleep(float(os.getenv("SLEEP_BETWEEN_TX", "5")))

    reward_metadata   = ipfs_map.get("reward-metadata.json") or os.getenv("REWARD_METADATA_URI")

    # Roles / signers
    app_signer       = os.getenv("APP_SIGNER_ADDRESS") or cfg["DEPLOYER_ADDRESS"]
    governance_admin = os.getenv("GOVERNANCE_ADMIN") or cfg["DEPLOYER_ADDRESS"]
    initial_signer   = os.getenv("CLAIM_SIGNER_ADDRESS") or app_signer

    # Initial validator metadata
    init_validator_addr = os.getenv("VALIDATOR_ADDRESS") or app_signer
    init_validator_desc = os.getenv("VALIDATOR_DESC", "Default backend validator")
    raw_code_hash       = os.getenv("VALIDATOR_CODE_HASH")  # optional hex 0x + 64
    init_validator_code_hash = _bytes32_or_keccak(raw_code_hash, init_validator_desc, validator_manifest)

    # ---------- Deploy base ----------
    reward_token_addr, reward_token_abi, w3 = _deploy_one(
        p("RewardToken_RewardToken.json"), "RewardToken", None, network
    )

    dataset_registry_addr, dataset_registry_abi, _ = _deploy_one(
        p("DatasetRegistry_DatasetRegistry.json"), "DatasetRegistry", None, network
    )
    
    # ---------- ValidatorsRegistry ----------
    validators_registry_addr, validators_registry_abi, w3 = _deploy_one(
        p("ValidatorsRegistry_ValidatorsRegistry.json"),
        "ValidatorsRegistry",
        [governance_admin],
        network
    )
    time.sleep(float(os.getenv("SLEEP_BETWEEN_TX", "5")))
    _call(
        w3, cfg, validators_registry_addr, validators_registry_abi,
        "addValidator",
        init_validator_addr, init_validator_desc, validator_manifest, init_validator_code_hash,
        label="ValidatorsRegistry.addValidator",
        network=network,   # <--- important
    )

    # 2) optional ethical validator
    ethical_validator_addr_raw = os.getenv("APP_ETHICS_VALIDATOR_ADDRESS")
    if ethical_validator_addr_raw and ethical_validator_manifest:
        ethical_validator_addr = Web3.to_checksum_address(ethical_validator_addr_raw)

        ethical_validator_desc = os.getenv(
            "ETHICAL_VALIDATOR_DESC",
            "Ethical assessment validator",
        )
        raw_ethics_code_hash = os.getenv("ETHICAL_VALIDATOR_CODE_HASH")
        ethical_validator_code_hash = _bytes32_or_keccak(
            raw_ethics_code_hash,
            ethical_validator_desc,
            ethical_validator_manifest,
        )

        time.sleep(float(os.getenv("SLEEP_BETWEEN_TX", "7")))


        _call(
            w3, cfg, validators_registry_addr, validators_registry_abi,
            "addValidator",
            ethical_validator_addr,
            ethical_validator_desc,
            ethical_validator_manifest,
            ethical_validator_code_hash,
            label="ValidatorsRegistry.addValidator:ethical",
            network=network,
        )

    # 3) optional human validator
    human_validator_addr_raw = os.getenv("HUMAN_VALIDATOR_ADDRESS")
    if human_validator_addr_raw and human_validator_manifest:
        human_validator_addr = Web3.to_checksum_address(human_validator_addr_raw)

        human_validator_desc = os.getenv(
            "HUMAN_VALIDATOR_DESC",
            "Human review validator",
        )
        raw_human_code_hash = os.getenv("HUMAN_VALIDATOR_CODE_HASH")
        human_validator_code_hash = _bytes32_or_keccak(
            raw_human_code_hash,
            human_validator_desc,
            human_validator_manifest,
        )

        time.sleep(float(os.getenv("SLEEP_BETWEEN_TX", "7")))

        _call(
            w3, cfg, validators_registry_addr, validators_registry_abi,
            "addValidator",
            human_validator_addr,
            human_validator_desc,
            human_validator_manifest,
            human_validator_code_hash,
            label="ValidatorsRegistry.addValidator:human",
            network=network,
        )



    # ---------- ValidationRegistry ----------
    validation_registry_addr, validation_registry_abi, _ = _deploy_one(
        p("ValidationRegistry_ValidationRegistry.json"),
        "ValidationRegistry",
        [dataset_registry_addr, validators_registry_addr],
        network
    )


    # ---------- Category & FileFormat registries ----------
    categories = ["mobility", "crisis", "safety", "manufacturing", "cybersecurity"]
    formats    = ["csv", "xls", "parquet", "data"]

    category_registry_addr, category_registry_abi, _ = _deploy_one(
        p("CategoryRegistry_CategoryRegistry.json"),
        "CategoryRegistry",
        [app_signer, categories],
        network
    )

    fileformat_registry_addr, fileformat_registry_abi, _ = _deploy_one(
        p("FileFormatRegistry_FileFormatRegistry.json"),
        "FileFormatRegistry",
        [app_signer, formats],
        network
    )

    # ---------- DatasetRequestRegistry ----------
    dataset_req_addr, suite_req_abi, _ = _deploy_one(
        p("DatasetRequestRegistry_DatasetRequestRegistry.json"),
        "DatasetRequestRegistry",
        [reward_token_addr, dataset_registry_addr, validation_registry_addr, category_registry_addr, fileformat_registry_addr, governance_admin, app_signer],
        network
    )
    # Extra safety: (re)grant SIGNER_ROLE to app_signer explicitly
    SIGNER_ROLE = Web3.keccak(text="SIGNER_ROLE")
    _call(
        w3, cfg, dataset_req_addr, suite_req_abi,
        "grantRole",
        SIGNER_ROLE,
        Web3.to_checksum_address(app_signer),
        label="DatasetRequestRegistry.grantRole(SIGNER_ROLE, app_signer)"
    )


    # ---------- RewardClaimer ----------
    reward_claimer_addr, reward_claimer_abi, _ = _deploy_one(
        p("RewardClaimer_RewardClaimer.json"),
        "RewardClaimer",
        [reward_token_addr, validation_registry_addr, dataset_registry_addr, initial_signer, governance_admin],
        network
    )
    

    RELAYER_ROLE = Web3.keccak(text="RELAYER_ROLE")
    _call(
        w3, cfg, reward_claimer_addr, reward_claimer_abi,
        "grantRole",
        RELAYER_ROLE,
        Web3.to_checksum_address(dataset_req_addr),
        label="RewardClaimer.grantRole(RELAYER_ROLE, DatasetRequestRegistry)",
        network=network,
    )

    _call(
        w3, cfg, dataset_req_addr, suite_req_abi,
        "setRewardClaimer",
        Web3.to_checksum_address(reward_claimer_addr),
        label="DatasetRequestRegistry.setRewardClaimer(RewardClaimer)",
        network=network,
    )



    # Set RewardClaimer in DatasetRegistry (DatasetRegistry is Ownable; owner must be deployer/timelock)
    _call(
        w3, cfg, dataset_registry_addr, dataset_registry_abi,
        "setRewardClaimer",
        Web3.to_checksum_address(reward_claimer_addr),
        label="DatasetRegistry.setRewardClaimer(RewardClaimer)",
        network=network,
    )
    

    if reward_metadata:
        print(f"ℹ️ Reward metadata available at: {reward_metadata}")

    return {
        "RewardToken":          reward_token_addr,
        "DatasetRegistry":      dataset_registry_addr,
        "ValidatorsRegistry":   validators_registry_addr,
        "ValidationRegistry":   validation_registry_addr,
        "CategoryRegistry":     category_registry_addr,
        "FileFormatRegistry":   fileformat_registry_addr,
        "DatasetRequestRegistry": dataset_req_addr,
        "RewardClaimer":        reward_claimer_addr,
        "validator_manifest":   validator_manifest,
        "ethical_validator_manifest": ethical_validator_manifest,
        "human_validator_manifest":   human_validator_manifest,
        "reward_metadata":      reward_metadata,
    }