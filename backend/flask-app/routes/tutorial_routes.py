from flask_restx import Namespace, Resource
from flask import request
from sqlalchemy import or_, func
from typing import Any
from models.file import File
from models.user import UserAction, User,PreferredQuery, UserNotification
from models.expectations import ExpectationSuites
from models.expectations import ValidationResults
from utils.advanced_filtering import filter_files
from typing import Any, Optional, List, Dict
from auth.auth import get_current_username
from models.blockchain import OnchainDataset, OnchainDatasetRequest, ContractEvent, ContractTx, DeployedContract
from web3 import Web3
import json

tutorials_ns = Namespace(
    "tutorials",
    path="/tutorials",
    description="Tutorial Progress Checks",
)


REQUIRED_STEP1_FILES = {
    "Titanic-Dataset.csv",
    "titanic.parquet",
    "titanic_large.csv",
}


# -------------------------
# Helpers
# -------------------------

def step_result(status: str, payload: Optional[Any] = None) -> Dict[str, Any]:
    return {"status": status, "payload": payload}


def resolve_project_candidates(username: str, mode: str) -> list[str]:
    mode = (mode or "").lower()
    if mode == "ui":
        return [username]                 #  UI: project_id = username
    return [f"tutorial-{username}"]       #  SDK: project_id = tutorial-username



def get_user_or_404(username: str) -> User:
    u = User.query.filter(User.username == username).first()
    if not u:
        raise ValueError(f"Unknown username: {username}")
    return u


def safe_count(result: Any) -> int:
    """
    Your query runner can return:
    - list
    - {"data":[...]}
    - {"count": 123, "data":[...]}
    """
    if result is None:
        return 0
    if isinstance(result, list):
        return len(result)
    if isinstance(result, dict):
        if isinstance(result.get("count"), int):
            return result["count"]
        data = result.get("data")
        if isinstance(data, list):
            return len(data)
    return 0


def file_by_name(file_owner: str, projects: list[str], filename: str) -> Optional[File]:
    return (
        File.query
        .filter(
            File.user_id == file_owner,          # ✅ username
            File.project_id.in_(projects),
            File.recdeleted.is_(False),
            File.filename == filename,
        )
        .order_by(File.created.desc())
        .first()
    )

# -------------------------
# Step checks
# -------------------------

def check_step_1(file_owner: str, projects: list[str]) -> dict:
    files = (
        File.query
        .filter(
            File.user_id == file_owner,          # ✅ username
            File.project_id.in_(projects),
            File.recdeleted.is_(False),
            File.filename.in_(list(REQUIRED_STEP1_FILES)),
        )
        .all()
    )

    found = {f.filename: f.id for f in files}
    missing = sorted(list(REQUIRED_STEP1_FILES - set(found.keys())))

    if missing:
        return step_result("pending", {"found": found, "missing": missing, "projects": projects})

    return step_result("success", {"found": found, "projects": projects})



def check_step_2(file_owner: str, username: str, projects: list[str]) -> dict:
    f = file_by_name(file_owner, projects, "titanic.parquet")
    if not f:
        return step_result("pending", {"reason": "titanic.parquet not found"})

    md = f.uploader_metadata or {}
    ok = False

    if md.get("username") == username:
        ok = True

    tags = md.get("tags")
    if isinstance(tags, dict) and tags.get("username") == username:
        ok = True

    if isinstance(tags, list):
        for t in tags:
            if isinstance(t, dict) and t.get("tag") == "username" and t.get("value") == username:
                ok = True
                break

    if not ok:
        return step_result("pending", {"file_id": f.id, "uploader_metadata": md})

    return step_result("success", {"file_id": f.id})



def check_step_3(file_owner: str, projects: list[str]) -> dict:
    """
    Step 3: user downloaded system metadata
    Backend check: file_metadata exists for all required files
    """
    rows = (
        File.query
        .filter(
            File.user_id == file_owner,
            File.project_id.in_(projects),
            File.recdeleted.is_(False),
            File.filename.in_(list(REQUIRED_STEP1_FILES)),
        )
        .all()
    )

    ok = []
    missing = []
    for f in rows:
        if f.file_metadata:
            ok.append({"filename": f.filename, "file_id": f.id})
        else:
            missing.append({"filename": f.filename, "file_id": f.id})

    if rows and not missing:
        return step_result("success", {"files_with_metadata": ok})

    return step_result("pending", {"files_with_metadata": ok, "missing_metadata": missing})


def check_step_4(username: str, projects: list[str]) -> dict:
    act = (
        UserAction.query
        .filter(
            UserAction.username == username,
            UserAction.action_type == "view_report",
            UserAction.log_metadata["project_id"].as_string().in_(projects),
        )
        .order_by(UserAction.timestamp.desc())
        .first()
    )

    if not act:
        return step_result("pending", {"projects": projects})

    return step_result("success", {"action": act.to_json()})



def check_step_5(user_sub: str) -> dict:
    """
    Step 5: NO logging for "run query"
    Derived: if at least 1 PreferredQuery exists
    """
    q = (
        PreferredQuery.query
        .filter(PreferredQuery.user_sub == user_sub)
        .order_by(PreferredQuery.created_at.desc())
        .first()
    )

    if not q:
        return step_result("pending", None)

    return step_result("success", {"preferred_query_id": q.id})


def check_step_6(user_sub: str) -> dict:
    q = (
        PreferredQuery.query
        .filter(PreferredQuery.user_sub == user_sub)
        .order_by(PreferredQuery.created_at.desc())
        .first()
    )
    if not q:
        return step_result("pending", {"reason": "No preferred query saved"})

    query_json = q.query_json or {}

    try:
        query = filter_files(query_json)   # must return a SQLAlchemy Query
        count = query.count()
    except Exception as e:
        return step_result("failure", {
            "reason": "Failed to run preferred query",
            "error": str(e),
            "preferred_query": q.to_json(),
        })

    if count != 1:
        return step_result("pending", {
            "reason": "Query did not return exactly 1 file",
            "result_count": count,
            "preferred_query": q.to_json(),
        })

    return step_result("success", {
        "result_count": count,
        "preferred_query": q.to_json(),
    })


def check_step_7(user_id: str, projects: list[str]) -> dict:
    """
    ExpectationSuites doesn't have project_id, so detect it via sample_file_path
    """
    clauses = []
    for p in projects:
        clauses.append(ExpectationSuites.sample_file_path.ilike(f"%projects/{p}/%"))

    suite = (
        ExpectationSuites.query
        .filter(ExpectationSuites.user_id == user_id)
        .filter(or_(*clauses))
        .order_by(ExpectationSuites.created.desc())
        .first()
    )

    if not suite:
        return step_result("pending", {"projects": projects})

    return step_result("success", {"suite": suite.to_json()})


def _to_float(x: Any) -> Optional[float]:
    if x is None:
        return None
    if isinstance(x, (int, float)):
        return float(x)
    if isinstance(x, str):
        s = x.strip().replace("%", "")
        if not s:
            return None
        try:
            return float(s)
        except ValueError:
            return None
    return None

def _pick_percent(stats: Dict[str, Any]) -> Optional[float]:
    # direct percent keys
    for k in ("success_percent", "successPercent", "success_percentage", "successPercentage"):
        v = _to_float(stats.get(k))
        if v is not None:
            return v

    # ratio keys
    for k in ("success_ratio", "successRatio", "success_fraction", "successFraction"):
        v = _to_float(stats.get(k))
        if v is not None:
            return v * 100.0

    # derive from counts
    ok = _to_float(stats.get("successful_expectations") or stats.get("successfulExpectations"))
    total = _to_float(stats.get("evaluated_expectations") or stats.get("evaluatedExpectations")
                      or stats.get("total_expectations") or stats.get("totalExpectations"))
    if ok is not None and total not in (None, 0):
        return (ok / total) * 100.0

    return None

def _extract_stats_from_validation(v: "ValidationResults") -> Dict[str, Any]:
    """
    Your DB object stores the useful stats inside detailed_results.
    detailed_results looks like:
      {"statistics": {...}, "results":[...], "meta": {...}}
    """
    dr = getattr(v, "detailed_results", None) or {}
    if isinstance(dr, dict):
        stats = dr.get("statistics")
        if isinstance(stats, dict):
            return stats
    return {}

def validation_is_success(v: "ValidationResults", *, threshold: float = 70.0) -> bool:
    stats = _extract_stats_from_validation(v)
    pct = _pick_percent(stats)
    return pct is not None and pct >= threshold


def check_step_8(user_id: str, suite_id: Optional[str]) -> Dict[str, Any]:

    if not suite_id:
        return step_result("pending", {"reason": "Suite missing (Step 7 not completed)"})

    v = (
        ValidationResults.query
        .filter(
            ValidationResults.user_id == user_id,
            ValidationResults.suite_id == suite_id,
        )
        .order_by(ValidationResults.run_time.desc())
        .first()
    )

    if not v:
        return step_result("pending", {"reason": "No validations found", "suite_id": suite_id})

    stats = _extract_stats_from_validation(v)
    pct = _pick_percent(stats)
    ok = pct is not None and pct >= 70.0

    return step_result(
        "success" if ok else "pending",
        {
            "validation_id": v.id,
            "suite_id": suite_id,
            "dataset_name": v.dataset_name,
            "run_time": v.run_time.isoformat() if v.run_time else None,
            "success_percent": pct,
        },
    )



def check_step_9(username: str, projects: list[str], file_owner: str) -> dict:
    f = file_by_name(file_owner, projects, "Titanic-Dataset.csv")
    if not f:
        return step_result(
            "pending",
            {
                "reason": "Titanic-Dataset.csv not found (Step-1 not completed or wrong project/mode)",
                "projects": projects,
                "file_owner": file_owner,
                "expected_filename": "Titanic-Dataset.csv",
            },
        )

    file_id = f.id

    act = (
        UserAction.query
        .filter(
            UserAction.username == username,
            UserAction.action_type.in_(["download", "download_file", "download_zip"]),
            UserAction.log_metadata["project_id"].as_string().in_(projects),
            or_(
                UserAction.log_metadata["request_url"].as_string().like(f"%/ddm/file/{file_id}%"),
                UserAction.log_metadata["filename"].as_string() == f"{file_id}.csv",
            ),
        )
        .order_by(UserAction.timestamp.desc())
        .first()
    )

    if not act:
        return step_result(
            "pending",
            {"reason": "No matching download found", "file_id": file_id, "projects": projects},
        )

    return step_result("success", {"action": act.to_json()})



def check_web3_1_profile_wallet(username: str) -> dict:
    u = User.query.filter(User.username == username).first()
    if not u:
        return step_result("pending", {"reason": "User not found"})

    # adjust field name depending on your schema:
    wallet = getattr(u, "public_key", None) or getattr(u, "wallet_address", None)
    if not wallet:
        return step_result("pending", {"reason": "No wallet/public key saved in profile"})

    return step_result("success", {"wallet": wallet})

def check_web3_2_dataset_request(username: str, suite_id: Optional[str], network: str = "sepolia") -> dict:
    if not suite_id:
        return step_result("pending", {"reason": "Suite missing (need Step-7)"})

    row = (
        OnchainDatasetRequest.query
        .filter(
            OnchainDatasetRequest.network == network,
            OnchainDatasetRequest.expectation_suite_id == suite_id,
            OnchainDatasetRequest.user_id == username,     
        )
        .order_by(OnchainDatasetRequest.created_at.desc())
        .first()
    )


    if not row:
        return step_result("pending", {"reason": "No on-chain dataset request found yet", "suite_id": suite_id})

    return step_result("success", {"dataset_request": row.to_json()})

def check_web3_3_dataset_registered(
    wallet: str,
    *,
    file_owner: str,
    projects: list[str],
    suite_hash: Optional[str],
    network: str = "sepolia",
) -> dict:
    # 1) Find the exact file that should have been registered on-chain
    f = file_by_name(file_owner, projects, "titanic_large.csv")
    if not f:
        return step_result("pending", {"reason": "titanic_large.csv not found in project", "projects": projects})

    expected_prefix = f"projects/{f.project_id}/files/{f.id}/"

    # 2) Query OnchainDataset for THIS file + THIS wallet (+ optional suite_hash)
    q = (
        OnchainDataset.query
        .filter(
            OnchainDataset.network == network,
            func.lower(OnchainDataset.uploader) == wallet.lower(),
            OnchainDataset.uri.ilike(f"%{expected_prefix}%"),
        )
    )

    if suite_hash:
        q = q.filter(func.lower(OnchainDataset.suite_hash) == suite_hash.lower())

    row = q.order_by(OnchainDataset.registered_block.desc().nullslast()).first()

    if not row:
        return step_result(
            "pending",
            {
                "reason": "No matching on-chain dataset registration found for the tutorial large file",
                "wallet": wallet,
                "file_id": f.id,
                "project_id": f.project_id,
                "expected_uri_prefix": expected_prefix,
                "suite_hash_filter": suite_hash,
            },
        )

    return step_result(
        "success",
        {
            "dataset": row.to_json(),
            "matched_on": {
                "file_id": f.id,
                "project_id": f.project_id,
                "expected_uri_prefix": expected_prefix,
                "suite_hash_filter": suite_hash,
            },
        },
    )

def check_web3_4_validations(dataset_fingerprint: Optional[str], min_validations: int = 1, network: str = "sepolia") -> dict:
    if not dataset_fingerprint:
        return step_result("pending", {"reason": "Missing dataset fingerprint (need web3-3)"})

    row = OnchainDataset.query.filter(OnchainDataset.fingerprint == dataset_fingerprint,OnchainDataset.network == network,).first()
    if not row:
        return step_result("pending", {"reason": "Dataset not found in onchain_datasets table", "fingerprint": dataset_fingerprint})

    if (row.validations_count or 0) < min_validations:
        return step_result("pending", {"reason": "Not enough validations yet", "have": row.validations_count, "need": min_validations})

    return step_result("success", {"fingerprint": dataset_fingerprint, "validations_count": row.validations_count})



def _decode_claim_input(w3: Web3, abi: list, to_addr: str, calldata: bytes):
    """
    Returns (fn_name, args_dict) or (None, None) if not decodable.
    """
    try:
        contract = w3.eth.contract(address=Web3.to_checksum_address(to_addr), abi=abi)
        fn, args = contract.decode_function_input(calldata)
        return fn.fn_name, args
    except Exception:
        return None, None

def check_web3_5_reward_claimed(user_sub: str, fingerprint: Optional[str]) -> dict:
    if not fingerprint:
        return step_result("pending", {"reason": "Missing dataset fingerprint (need step-13)"})

    n = (
        UserNotification.query
        .filter(
            UserNotification.user_sub == user_sub,
            UserNotification.kind == "reward_claimed",
        )
        .order_by(UserNotification.created_at.desc())
        .first()
    )
    if not n:
        return step_result("pending", {"reason": "No reward_claimed notification found"})

    payload = n.payload or {}

    # If payload is stored as a JSON string in DB
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except Exception:
            payload = {}

    dataset_fp = None
    if isinstance(payload, dict):
        dataset_fp = payload.get("datasetFingerprint") or payload.get("fingerprint")

    if not dataset_fp:
        return step_result("pending", {
            "reason": "reward_claimed payload missing dataset_fingerprint",
            "payload": payload,
        })

    if str(dataset_fp).lower() != str(fingerprint).lower():
        return step_result("pending", {
            "reason": "reward_claimed fingerprint does not match latest registered dataset",
            "expected": fingerprint,
            "got": dataset_fp,
        })

    return step_result("success", {"notification": n.to_json()})


def check_web3_6_notifications(user_sub: str, *, only_unread: bool = True, limit: int = 50) -> dict:
    q = UserNotification.query.filter(UserNotification.user_sub == user_sub)

    if only_unread:
        q = q.filter(UserNotification.is_read.is_(False))

    rows = q.order_by(UserNotification.created_at.desc()).limit(limit).all()

    if not rows:
        return step_result("pending", {"reason": "No notifications found", "only_unread": only_unread})

    return step_result("success", {
        "count": len(rows),
        "latest": rows[0].to_json(),
    })




@tutorials_ns.route("/progress")
class TutorialsProgress(Resource):
    @tutorials_ns.doc(security="oauth2")
    def get(self):
        username = (request.args.get("username") or "").strip()
        mode = (request.args.get("mode") or "sdk").strip().lower()

        if not username:
            return {"error": "username is required"}, 400
        if mode not in ("sdk", "ui"):
            return {"error": "mode must be sdk or ui"}, 400

        # ✅ resolve user first
        try:
            user = get_user_or_404(username)
        except ValueError as e:
            return {"error": str(e)}, 404

        # ✅ identities
        user_sub = getattr(user, "sub", None)
        file_owner = username          # ✅ File.user_id stores username in  DB

        if not user_sub:
            return {"error": "Could not resolve user_sub for user"}, 500

        projects = resolve_project_candidates(username, mode)

        steps: dict[str, dict] = {}

        # ✅ File checks MUST use file_owner (username)
        steps["step-1"] = check_step_1(file_owner, projects)
        steps["step-2"] = check_step_2(file_owner, username, projects)
        steps["step-3"] = check_step_3(file_owner, projects)

        # ✅ UserAction uses username (already correct)
        steps["step-4"] = check_step_4(username, projects)

        # ✅ PreferredQuery uses sub
        steps["step-5"] = check_step_5(user_sub)
        steps["step-6"] = check_step_6(user_sub)

        # ✅ Step 7/8: 
        s7 = check_step_7(file_owner, projects)
        steps["step-7"] = s7

        suite_id = None
        if s7["status"] == "success":
            suite_id = (s7.get("payload") or {}).get("suite", {}).get("id")

        steps["step-8"] = check_step_8(file_owner, suite_id)

        steps["step-9"] = check_step_9(username, projects, file_owner)
        # ✅ If step-9 is done, step-10 is automatically done too
        if steps["step-9"]["status"] == "success":
            steps["step-10"] = step_result(
                "success",
                {"reason": "Auto-pass: step-10 is considered complete once step-9 is complete"}
            )
        else:
            steps["step-10"] = step_result("pending", {"reason": "Not completed"})
        # -------------------
        # Web3 tutorial steps
        # -------------------

        steps["step-11"] = check_web3_1_profile_wallet(username)
        wallet = (steps["step-11"].get("payload") or {}).get("wallet")

        steps["step-12"] = check_web3_2_dataset_request(username, suite_id, network="sepolia")
        dataset_request = (steps["step-12"].get("payload") or {}).get("dataset_request") or {}
        suite_hash = dataset_request.get("suite_hash")
        steps["step-12"] = check_web3_2_dataset_request(username, suite_id, network="sepolia")
        dataset_request = (steps["step-12"].get("payload") or {}).get("dataset_request") or {}
        suite_hash = dataset_request.get("suite_hash")

        expected_category = dataset_request.get("category")  # e.g. "crisis"

        expected_level_hex = None


        steps["step-13"] = (
            check_web3_3_dataset_registered(
                wallet,
                file_owner=file_owner,
                projects=projects,
                suite_hash=suite_hash,
                network="sepolia",
            )
            if wallet else step_result("pending", {"reason": "Missing wallet"})
        )

        dataset_fingerprint = None
        if steps["step-13"]["status"] == "success":
            dataset_fingerprint = (steps["step-13"].get("payload") or {}).get("dataset", {}).get("fingerprint")

        steps["step-14"] = check_web3_4_validations(dataset_fingerprint, min_validations=3,network="sepolia")

        steps["step-15"] = check_web3_5_reward_claimed(user_sub, fingerprint=dataset_fingerprint)


        steps["step-16"] = check_web3_6_notifications(user_sub)

        return {
            "username": username,
            "mode": mode,
            "project_ids": projects,
            "steps": steps,
        }, 200
