import os
import json
from dotenv import load_dotenv
from web3 import Web3
from web3_scripts.web3_factory import get_network_config
from tasks.chain import wait_for_receipt_task  # Celery task

load_dotenv()
DEFAULT_NETWORK = os.getenv("DEFAULT_NETWORK", "sepolia")


def _connect(network):
    cfg = get_network_config(network)
    if not cfg:
        raise ValueError(f"Unsupported network: {network}")
    w3 = Web3(Web3.HTTPProvider(cfg["RPC_URL"]))
    if not w3.is_connected():
        raise RuntimeError(f"Failed to connect to {network} RPC at {cfg['RPC_URL']}")
    deployer = os.getenv(f"{network.upper()}_DEPLOYER_ADDRESS") or cfg["DEPLOYER_ADDRESS"]
    pkey     = os.getenv(f"{network.upper()}_PRIVATE_KEY") or cfg["PRIVATE_KEY"]
    chain_id = cfg["CHAIN_ID"]
    return w3, deployer, pkey, chain_id, cfg


def _load_compiled(path):
    with open(path, "r", encoding="utf-8") as f:
        compiled = json.load(f)
    return compiled["abi"], compiled["bin"]


def _send_tx(w3, deployer, pkey, chain_id, tx, gas_pad=100_000):
    gas = tx.estimate_gas({"from": deployer})
    nonce = w3.eth.get_transaction_count(deployer)
    tx_dict = tx.build_transaction({
        "chainId": chain_id,
        "from": deployer,
        "nonce": nonce,
        "gas": gas + gas_pad,
        # If your RPC/network supports EIP-1559, you can switch to maxFeePerGas / maxPriorityFeePerGas
        "gasPrice": w3.to_wei("20", "gwei"),
    })
    signed = w3.eth.account.sign_transaction(tx_dict, private_key=pkey)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    return tx_hash


def deploy_contract(compiled_contract_path, name, constructor_args=None, network=DEFAULT_NETWORK):
    """Deploy a contract and enqueue the Celery watcher."""
    w3, deployer, pkey, chain_id, cfg = _connect(network)
    abi, bytecode = _load_compiled(compiled_contract_path)

    contract = w3.eth.contract(abi=abi, bytecode=bytecode)
    deploy_tx = contract.constructor(*(constructor_args or []))
    tx_hash = _send_tx(w3, deployer, pkey, chain_id, deploy_tx)

    print(f"⏳ Sent {name}: {tx_hash.hex()}")
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    address = receipt.contractAddress
    print(f"✅ {name} deployed at: {address}")

    confirmations = int(os.getenv("CONFIRMATIONS", "3"))
    wait_for_receipt_task.delay(
        network=network,
        tx_hash_hex=tx_hash.hex(),
        contract_name=name,
        address=address,
        abi=abi,
        confirmations=confirmations
    )
    return address, abi


def call_function(w3, deployer, pkey, chain_id, address, abi, fn_name, *args, label=None):
    """Send a state-changing tx to an already deployed contract function."""
    contract = w3.eth.contract(address=address, abi=abi)
    fn = getattr(contract.functions, fn_name)(*args)
    tx_hash = _send_tx(w3, deployer, pkey, chain_id, fn)
    tag = label or fn_name
    print(f"⏳ Calling {tag}: {tx_hash.hex()}")
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    print(f"✅ {tag} confirmed in block {receipt.blockNumber}")
    return receipt


def deploy_ddm_suite(network=DEFAULT_NETWORK):
    print(f"🚀 Deploying contracts to {network.upper()}...\n")
    w3, deployer, pkey, chain_id, cfg = _connect(network)

    # Addresses / roles from env (with sane fallbacks)
    app_signer = os.getenv("APP_SIGNER_ADDRESS") or deployer         # for Category/FileFormat registries (curator)
    governance_admin = os.getenv("GOVERNANCE_ADMIN") or deployer     # DEFAULT_ADMIN_ROLE for governed contracts
    initial_claim_signer = os.getenv("CLAIM_SIGNER_ADDRESS") or app_signer

    # Optional initial validator metadata (to seed ValidatorsRegistry)
    init_validator_addr = os.getenv("VALIDATOR_ADDRESS") or app_signer
    init_validator_desc = os.getenv("VALIDATOR_DESC", "Default backend validator")
    init_validator_code_uri = os.getenv("VALIDATOR_CODE_URI", "ipfs://validator-manifest")
    # Provide a 0x-prefixed 32-byte hex string for code hash; fallback to 0x00..00
    init_validator_code_hash = os.getenv("VALIDATOR_CODE_HASH", "0x" + "00"*32)

    # ---------- Deploy base contracts ----------
    reward_token_addr, reward_token_abi = deploy_contract(
        "compiled_contracts/RewardToken_RewardToken.json", name="RewardToken", network=network
    )

    dataset_registry_addr, dataset_registry_abi = deploy_contract(
        "compiled_contracts/DatasetRegistry_DatasetRegistry.json", name="DatasetRegistry", network=network
    )

    # ---------- Deploy governance-friendly ValidatorsRegistry ----------
    validators_registry_addr, validators_registry_abi = deploy_contract(
        "compiled_contracts/ValidatorsRegistry_ValidatorsRegistry.json",
        name="ValidatorsRegistry",
        constructor_args=[governance_admin],  # DEFAULT_ADMIN_ROLE holder (EOA or Timelock)
        network=network
    )

    # Seed first validator (optional but handy)
    call_function(
        w3, deployer, pkey, chain_id,
        validators_registry_addr, validators_registry_abi,
        "addValidator",
        init_validator_addr, init_validator_desc, init_validator_code_uri, init_validator_code_hash,
        label="ValidatorsRegistry.addValidator"
    )

    # ---------- Deploy ValidationRegistry (now points to ValidatorsRegistry) ----------
    validation_registry_addr, validation_registry_abi = deploy_contract(
        "compiled_contracts/ValidationRegistry_ValidationRegistry.json",
        name="ValidationRegistry",
        constructor_args=[dataset_registry_addr, validators_registry_addr],
        network=network
    )

    # ---------- Deploy Category & FileFormat registries (curated by app_signer) ----------
    # Initial categories & formats (lowercase)
    categories = ["mobility", "crisis", "safety", "manufacturing", "cybersecurity"]
    formats    = ["csv", "xls", "parquet", "data"]

    category_registry_addr, category_registry_abi = deploy_contract(
        "compiled_contracts/CategoryRegistry_CategoryRegistry.json",
        name="CategoryRegistry",
        constructor_args=[app_signer, categories],
        network=network
    )

    fileformat_registry_addr, fileformat_registry_abi = deploy_contract(
        "compiled_contracts/FileFormatRegistry_FileFormatRegistry.json",
        name="FileFormatRegistry",
        constructor_args=[app_signer, formats],
        network=network
    )

    # ---------- Deploy DatasetRequestRegistry (wires everything together) ----------
    dataset_req_addr, suite_req_abi = deploy_contract(
        "compiled_contracts/DatasetRequestRegistry_DatasetRequestRegistry.json",
        name="DatasetRequestRegistry",
        constructor_args=[
            reward_token_addr,
            dataset_registry_addr,
            validation_registry_addr,
            category_registry_addr,
            fileformat_registry_addr,
            governance_admin,   # <-- admin (gets DEFAULT_ADMIN_ROLE)
            app_signer          # <-- initialSigner (granted SIGNER_ROLE)
        ],
        network=network
    )


    # ---------- Deploy RewardClaimer (EIP-712 + AccessControl SIGNER_ROLE) ----------
    reward_claimer_addr, reward_claimer_abi = deploy_contract(
        "compiled_contracts/RewardClaimer_RewardClaimer.json",
        name="RewardClaimer",
        constructor_args=[
            reward_token_addr,
            validation_registry_addr,
            dataset_registry_addr,
            initial_claim_signer,   # grants SIGNER_ROLE to this address
            governance_admin        # DEFAULT_ADMIN_ROLE (ideally your Timelock)
        ],
        network=network
    )

    print("\n🎉 Deployment complete:")
    print(f"RewardToken:           {reward_token_addr}")
    print(f"DatasetRegistry:       {dataset_registry_addr}")
    print(f"ValidatorsRegistry:    {validators_registry_addr}")
    print(f"ValidationRegistry:    {validation_registry_addr}")
    print(f"CategoryRegistry:      {category_registry_addr}")
    print(f"FileFormatRegistry:    {fileformat_registry_addr}")
    print(f"DatasetRequestRegistry:  {dataset_req_addr}")
    print(f"RewardClaimer:         {reward_claimer_addr}")

    return {
        "RewardToken":           reward_token_addr,
        "DatasetRegistry":       dataset_registry_addr,
        "ValidatorsRegistry":    validators_registry_addr,
        "ValidationRegistry":    validation_registry_addr,
        "CategoryRegistry":      category_registry_addr,
        "FileFormatRegistry":    fileformat_registry_addr,
        "DatasetRequestRegistry":  dataset_req_addr,
        "RewardClaimer":         reward_claimer_addr,
    }


if __name__ == "__main__":
    deploy_ddm_suite()
