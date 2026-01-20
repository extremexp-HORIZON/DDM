
import eventlet
eventlet.monkey_patch()
import os
import json
from dotenv import load_dotenv
from celery import shared_task
from pathlib import Path
from solcx import (
    compile_files,
    compile_standard,
    install_solc,
    get_installed_solc_versions,
    import_installed_solc,
    set_solc_version,
)

import shutil
from solcx.exceptions import SolcError

load_dotenv()

SOLC_VERSION = os.getenv("SOLC_VERSION", "0.8.20")
USE_VIA_IR = os.getenv("USE_VIA_IR", "0") in ("1", "true", "TRUE")


def _ensure_solc():
    # 1) If solcx already knows this version, just select it
    installed = {str(v) for v in get_installed_solc_versions()}
    if SOLC_VERSION in installed:
        set_solc_version(SOLC_VERSION)
        return

    # 2) Otherwise import from the shipped binary path (or PATH)
    solc_path = os.getenv("SOLC_BINARY", "/usr/local/bin/solc")
    if not os.path.exists(solc_path):
        solc_path = shutil.which("solc")

    if not solc_path:
        raise RuntimeError("solc not found (expected /usr/local/bin/solc or in PATH)")

    # ✅ IMPORTANT: pass the version so solcx registers it as solc-vX.Y.Z
    import_installed_solc(solc_path, SOLC_VERSION)
    set_solc_version(SOLC_VERSION)

def _compile_with_files(contract_paths, out_dir, base_path, remappings=None):
    """
    compile_files path (no viaIR). Optimizer ON. Keeps local node_modules remapping.
    """
    _ensure_solc()

    args = dict(
        output_values=["abi", "bin"],
        base_path=str(base_path),
        optimize=True,
        optimize_runs=200,
    )
    if remappings:
        args["import_remappings"] = remappings

    try:
        compiled = compile_files([str(p) for p in contract_paths], **args)
    except SolcError as e:
        print("❌ solc failed (compile_files):")
        if getattr(e, "stderr", None):
            print(e.stderr)
        else:
            print(repr(e))
        raise

    out_dir.mkdir(parents=True, exist_ok=True)
    for full_name, data in compiled.items():
        # e.g. '/app/smart_contracts/RewardToken.sol:RewardToken'
        file_name, contract_name = full_name.split(":")
        file_base = Path(file_name).stem
        out_path = out_dir / f"{file_base}_{contract_name}.json"
        with out_path.open("w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

    return str(out_dir)


def _compile_with_standard(contract_paths, out_dir, base_path, remappings=None):
    """
    Standard JSON input with viaIR:true (optimizer ON). Keeps local node_modules remapping.
    Produces the same {abi, bin} shape per <File>_<Contract>.json for your deployer.
    """
    _ensure_solc()

    sources = {}
    base = Path(base_path).resolve()
    for p in contract_paths:
        p = Path(p).resolve()
        rel = p.relative_to(base).as_posix()
        sources[rel] = {"content": p.read_text(encoding="utf-8")}

    settings = {
        # Good defaults; you can add "evmVersion" if you need a specific target
        "optimizer": {"enabled": True, "runs": 200},
        "viaIR": True,
        # Emit minimal outputs your deployer needs
        "outputSelection": {"*": {"*": ["abi", "evm.bytecode.object"]}},
        # Optional: make bytecode deterministic across builds
        # "metadata": {"bytecodeHash": "none"},
    }
    if remappings:
        settings["remappings"] = remappings

    input_json = {"language": "Solidity", "sources": sources, "settings": settings}

    try:
        out = compile_standard(input_json, allow_paths=str(base))
    except SolcError as e:
        print("❌ solc failed (compile_standard viaIR):")
        if getattr(e, "stderr", None):
            print(e.stderr)
        else:
            print(repr(e))
        raise

    out_dir.mkdir(parents=True, exist_ok=True)
    for file_rel, contracts in out.get("contracts", {}).items():
        for cname, data in contracts.items():
            file_base = Path(file_rel).stem
            out_path = out_dir / f"{file_base}_{cname}.json"
            abi = data.get("abi", [])
            binobj = data.get("evm", {}).get("bytecode", {}).get("object", "")
            with out_path.open("w", encoding="utf-8") as f:
                json.dump({"abi": abi, "bin": binobj}, f, indent=2)

    return str(out_dir)


@shared_task(bind=True, ignore_result=False)
def compile_contracts_task(self, out_dir=None):
    """
    Returns the absolute compiled artifacts directory path (string).
    - USE_VIA_IR=1 → compile via IR (standard JSON)
    - Otherwise → compile_files
    Keeps local node_modules remapping to @openzeppelin.
    """
    repo_root = Path(__file__).resolve().parents[1]  # project root
    contracts_dir = repo_root / "smart_contracts"
    out_dir = Path(out_dir or (repo_root / "compiled_contracts"))

    contracts = [
        contracts_dir / "CategoryRegistry.sol",
        contracts_dir / "FileFormatRegistry.sol",
        contracts_dir / "IValidatorsRegistry.sol",
        contracts_dir / "ValidatorsRegistry.sol",
        contracts_dir / "ValidationRegistry.sol",
        contracts_dir / "DatasetRequestRegistry.sol",
        contracts_dir / "RewardToken.sol",
        contracts_dir / "DatasetRegistry.sol",
        contracts_dir / "RewardClaimer.sol",
    ]

    # Remap to *local* node_modules (as requested)
    oz_path = (repo_root / "node_modules" / "@openzeppelin")
    remappings = [f"@openzeppelin={oz_path.as_posix()}"] if oz_path.exists() else None

    if USE_VIA_IR:
        return _compile_with_standard(contracts, out_dir, base_path=repo_root, remappings=remappings)
    else:
        return _compile_with_files(contracts, out_dir, base_path=repo_root, remappings=remappings)
