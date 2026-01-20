import os
import json
import requests
from dotenv import load_dotenv
from web3 import Web3

load_dotenv()

# ---------------------------
# Ethereum & IPFS Setup
# ---------------------------
eth_rpc_url = os.getenv("SEPOLIA_RPC_URL")
w3 = Web3(Web3.HTTPProvider(eth_rpc_url))
assert w3.is_connected(), "❌ Failed to connect to Sepolia network"

deployer_address = os.getenv("SEPOLIA_DEPLOYER_ADDRESS")
private_key = os.getenv("SEPOLIA_PRIVATE_KEY")

# Contract setup
reward_token_address = os.getenv("REWARD_TOKEN_ADDRESS")
with open("compiled_contracts/RewardToken_RewardToken.json") as file:
    reward_token_data = json.load(file)
reward_token_abi = reward_token_data["abi"]
reward_token_contract = w3.eth.contract(address=reward_token_address, abi=reward_token_abi)

# ---------------------------
# IPFS via Infura
# ---------------------------
infura_id = os.getenv("INFURA_PROJECT_ID")
infura_secret = os.getenv("INFURA_PROJECT_SECRET")
ipfs_url = "https://ipfs.infura.io:5001/api/v0/add"
ipfs_auth = (infura_id, infura_secret)


def upload_metadata_to_ipfs(metadata):
    """Uploads metadata JSON to Infura IPFS and returns the ipfs:// URI."""
    files = {'file': json.dumps(metadata)}
    response = requests.post(ipfs_url, files=files, auth=ipfs_auth)

    if response.status_code == 200:
        ipfs_hash = response.json()["Hash"]
        return f"ipfs://{ipfs_hash}"
    else:
        raise Exception(f"IPFS upload failed: {response.content}")


def mint_token(to_address, token_uri, category):
    """Mints a reward token on Sepolia."""
    nonce = w3.eth.get_transaction_count(deployer_address)

    tx = reward_token_contract.functions.mint(to_address, token_uri, category).build_transaction({
        "chainId": 11155111,  # Sepolia Chain ID
        "from": deployer_address,
        "gas": 300000,
        "gasPrice": w3.to_wei("20", "gwei"),
        "nonce": nonce,
    })

    signed_tx = w3.eth.account.sign_transaction(tx, private_key)
    tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)

    return receipt


if __name__ == "__main__":
    # IPFS metadata (replace image URL as needed)
    metadata = {
        "name": "Bronze Reward",
        "description": "Bronze tier reward for contributions.",
        "image": "https://example.com/images/bronze.png"
    }

    print("📦 Uploading metadata to IPFS (Infura)...")
    ipfs_uri = upload_metadata_to_ipfs(metadata)
    print(f"✅ Uploaded to IPFS: {ipfs_uri}")

    # Replace with recipient's Sepolia address
    recipient_address = "0xRecipientAddressHere"
    category = "uploader"  # or "evaluator"

    print("🎯 Minting token on Sepolia...")
    receipt = mint_token(recipient_address, ipfs_uri, category)
    print(f"✅ Minted! Tx Hash: {receipt.transactionHash.hex()}")
