from __future__ import annotations

import os
from typing import Optional, Dict
from celery import shared_task
from celery.utils.log import get_task_logger
from eth_account import Account
from web3 import Web3

from models.user import UserAction
from app import db
from utils.user_file_logger import log_action_with_context
from web3_scripts.web3_factory import get_w3  

def _norm_addr(addr: str) -> str:
    # store & compare as lowercase checksum-normalized string
    return Web3.to_checksum_address(addr).lower()


@shared_task(
    bind=True,
    name="tasks.tips.send_profile_tip_task",
    ignore_result=False,
    max_retries=0,
)
def send_profile_tip_task(
    self,
    *,
    network: str,
    username: str,
    to_address: str,
    tip_eth: Optional[float] = None,
) -> Dict:
    """
    Send a one-time tip to a wallet.
    Uses UserAction logs as the 'already tipped?' source of truth.
    """
    log = get_task_logger(__name__)

    if not to_address:
        return {"status": "error", "error": "Missing to_address"}

    w3 = get_w3(network)

    signer_pkey = os.getenv("APP_SIGNER_PRIVATE_KEY")
    if not signer_pkey:
        return {"status": "error", "error": "APP_SIGNER_PRIVATE_KEY not set"}

    acct = Account.from_key(signer_pkey)
    from_address = acct.address

    to_norm = _norm_addr(to_address)
    from_norm = _norm_addr(from_address)

    # ---------------------------
    # 1) IDP / once-only check
    # ---------------------------
    already = (
        UserAction.query
        .filter(
            UserAction.action_type == "profile_tip",
            UserAction.log_metadata["network"].as_string() == network,
            UserAction.log_metadata["to_address"].as_string().ilike(to_norm),
            UserAction.log_metadata["status"].as_string() == "sent",
        )
        .order_by(UserAction.timestamp.desc())
        .first()
    )
    if already:
        return {
            "status": "skip",
            "reason": "Wallet already tipped",
            "network": network,
            "to_address": to_norm,
            "existing_action": already.to_json(),
        }

    # ---------------------------
    # 2) Build & send tx
    # ---------------------------
    tip_eth = tip_eth if tip_eth is not None else float(os.getenv("PROFILE_TIP_ETH", "0.05"))
    value_wei = w3.to_wei(tip_eth, "ether")

    try:
        chain_id = w3.eth.chain_id
        nonce = w3.eth.get_transaction_count(from_address)

        tx = {
            "from": from_address,
            "to": Web3.to_checksum_address(to_address),
            "value": int(value_wei),
            "nonce": nonce,
            "chainId": chain_id,
            "type": 2,
            "maxFeePerGas": w3.to_wei(os.getenv("TIP_MAX_FEE_GWEI", "30"), "gwei"),
            "maxPriorityFeePerGas": w3.to_wei(os.getenv("TIP_PRIORITY_FEE_GWEI", "2"), "gwei"),
        }

        try:
            tx["gas"] = int(w3.eth.estimate_gas(tx))
        except Exception:
            tx["gas"] = 21000

        signed = acct.sign_transaction(tx)
        raw_tx = getattr(signed, "rawTransaction", None) or getattr(signed, "raw_transaction", None)
        tx_hash = w3.eth.send_raw_transaction(raw_tx)
        tx_hash_hex = tx_hash.hex()

        # ---------------------------
        # 3) Log success (the ledger)
        # ---------------------------
        try:
            log_action_with_context(
                username=username,
                action_type="profile_tip",
                file_id=None,
                metadata={
                    "network": network,
                    "from_address": from_norm,
                    "to_address": to_norm,
                    "amount_wei": str(value_wei),
                    "tx_hash": tx_hash_hex,
                    "status": "sent",
                },
            )
        except Exception as log_exc:
            db.session.rollback()
            log.warning(f"Failed to log profile_tip action: {log_exc}", exc_info=True)

        return {
            "status": "ok",
            "network": network,
            "from_address": from_norm,
            "to_address": to_norm,
            "amount_wei": str(value_wei),
            "tx_hash": tx_hash_hex,
        }

    except Exception as e:
        # Log failure too (optional, helps debug)
        try:
            log_action_with_context(
                username=username,
                action_type="profile_tip",
                file_id=None,
                metadata={
                    "network": network,
                    "from_address": from_norm,
                    "to_address": to_norm,
                    "amount_wei": str(value_wei),
                    "status": "failed",
                    "reason": str(e),
                },
            )
        except Exception:
            db.session.rollback()

        return {"status": "error", "error": str(e), "network": network, "to_address": to_norm}
