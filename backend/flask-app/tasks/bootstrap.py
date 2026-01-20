# tasks/bootstrap.py
import os
from celery import chain
from celery.signals import worker_ready
from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError

from tasks.compile import compile_contracts_task
from tasks.deploy import deploy_ddm_suite_task
from tasks.ipfs import upload_ipfs_assets_task

RUN_FLAG        = os.getenv("RUN_COMPILE_DEPLOY_ON_STARTUP", "0").lower() in ("1","true","yes")
DEFAULT_NETWORK = os.getenv("DEFAULT_NETWORK", "sepolia")
ALWAYS_REDEPLOY = os.getenv("ALWAYS_REDEPLOY", "0").lower() in ("1","true","yes")

# Exactly the contracts your deploy task manages
REQUIRED_CONTRACTS = {
    "CategoryRegistry",
    "FileFormatRegistry",
    "ValidatorsRegistry",
    "RewardToken",
    "RewardClaimer",
    "DatasetRegistry",
    "DatasetRequestRegistry",
    "ValidationRegistry"
}

def _existing_names(flask_app, network: str) -> set[str]:
    """Return the set of contract names deployed for this network (or empty if table not ready)."""
    from extensions.db import db
    with flask_app.app_context():
        try:
            rows = db.session.execute(
                text("SELECT DISTINCT name FROM deployed_contracts WHERE network = :n"),
                {"n": network},
            ).fetchall()
            return {r[0] for r in rows}
        except ProgrammingError:
            db.session.rollback()
            return set()

@worker_ready.connect
def kick_off(sender=None, **kwargs):
    if not RUN_FLAG or sender is None:
        return

    flask_app = getattr(sender.app, "flask_app", None)
    if flask_app is None:
        return

    existing = _existing_names(flask_app, DEFAULT_NETWORK)
    missing  = REQUIRED_CONTRACTS - existing

    if not missing and not ALWAYS_REDEPLOY:
        sender.app.log.get_default_logger().info(
            f"Bootstrap: all contracts already deployed for '{DEFAULT_NETWORK}', skipping."
        )
        return

    if missing:
        sender.app.log.get_default_logger().info(
            f"Bootstrap: missing contracts for '{DEFAULT_NETWORK}': {sorted(missing)} → compiling & deploying…"
        )
    else:
        sender.app.log.get_default_logger().info(
            f"Bootstrap: ALWAYS_REDEPLOY=1 → compiling & redeploying all."
        )

    chain(
        compile_contracts_task.s(),              # compiles to ./compiled_contracts by default
        upload_ipfs_assets_task.si(),            # immutable → uses default IPFS_ASSETS_DIR
        deploy_ddm_suite_task.s(network=DEFAULT_NETWORK),
    ).apply_async()

