# routes/blockchain_routes.py
from flask import request
from flask_restx import Namespace, Resource, fields, reqparse
from sqlalchemy import func, and_, or_
from web3 import Web3
from extensions.db import db
from models.blockchain import DeployedContract, ContractEvent, ContractTx
from tasks.register_suites import create_suite_artifacts_task 
from tasks.chain import ingest_tx_task
from tasks.register_datasets import prepare_report_ipfs_uri_task
from tasks.validate_registered_datasets import prepare_validation_task
from tasks.rewards import prepare_dataset_reward_claim_task

blockchain_ns = Namespace(
    name="blockchain",
    description="Deployed contracts & on-chain events",
    path=None
)

ingest_model = blockchain_ns.model("IngestTx", {
    "network": fields.String(required=True),
    "address": fields.String(required=True, description="Contract address (0x...)"),
    "tx_hash": fields.String(required=True, description="Transaction hash (0x...)"),
})


# ---------- Swagger models ----------
ContractModel = blockchain_ns.model("DeployedContract", {
    "id":                 fields.Integer,
    "network":            fields.String,
    "name":               fields.String,
    "address":            fields.String,
    "tx_hash":            fields.String,
    "start_block":        fields.Integer,
    "last_scanned_block": fields.Integer,
    "confirmations":      fields.Integer,
    "status":             fields.String,
    "events_count":       fields.Integer(description="Count of events for this contract"),
    "abi":                fields.Raw(description="ABI (optional)", required=False),
})

EventModel = blockchain_ns.model("ContractEvent", {
    "id":           fields.Integer,
    "network":      fields.String,
    "address":      fields.String,
    "name":         fields.String,
    "tx_hash":      fields.String,
    "block_number": fields.Integer,
    "log_index":    fields.Integer,
    "args":         fields.Raw,
    "contract_name": fields.String,
})

PagedContracts = blockchain_ns.model("PagedContracts", {
    "data":           fields.List(fields.Nested(ContractModel)),
    "total":          fields.Integer,
    "filtered_total": fields.Integer,
    "page":           fields.Integer,
    "perPage":        fields.Integer,
})

PagedEvents = blockchain_ns.model("PagedEvents", {
    "data":           fields.List(fields.Nested(EventModel)),
    "total":          fields.Integer,
    "filtered_total": fields.Integer,
    "page":           fields.Integer,
    "perPage":        fields.Integer,
})

PrepareSuiteBody = blockchain_ns.model("PrepareSuiteBody", {
    "network":         fields.String(required=False, default="sepolia"),
    "requester":       fields.String(required=True, description="0x wallet address"),
    "suite":           fields.Raw(required=True, description="Full expectations JSON"),
    "category":        fields.String(required=True, description="Category key"),
    "fileFormat":      fields.String(required=True, description="File format key (csv/xls/parquet/data)"),
    "deadline":        fields.Integer(required=True, description="Unix timestamp"),
    "totalExpected":   fields.Integer(required=True, description="Split count"),
    "docs_html":       fields.String(required=False, description="Optional HTML (small)"),
    "certificate_json":fields.Raw(required=False, description="Optional ERC721 metadata JSON"),
    "expectation_suite_id": fields.String(required=True, description="Optional local ExpectationSuite ID to link" ),
})

PrepareDatasetFromCatalogBody = blockchain_ns.model("PrepareDatasetFromCatalogBody", {
    "network":    fields.String(required=False, default="sepolia"),
    "catalog_id": fields.String(required=True, description="ID of catalog dataset (File.id)"),
})


# --- Dataset catalog & Zenoh models ---

DatasetCatalogItem = blockchain_ns.model("DatasetCatalogItem", {
    "id":          fields.String(description="Catalog item id"),
    "name":        fields.String(description="Human-friendly name"),
    "description": fields.String(required=False),
    "uri":         fields.String(description="Source URI (e.g. s3://, file://, etc.)"),
    "fileFormat":  fields.String(description="File format key (csv/xls/parquet/...)"),
})

DatasetCatalogList = blockchain_ns.model("DatasetCatalogList", {
    "data":  fields.List(fields.Nested(DatasetCatalogItem)),
    "count": fields.Integer,
})

PrepareDatasetFromCatalogBody = blockchain_ns.model("PrepareDatasetFromCatalogBody", {
    "network":    fields.String(required=False, default="sepolia"),
    "catalog_id": fields.String(required=True, description="ID of catalog dataset"),
})

PreparedDatasetModel = blockchain_ns.model("PreparedDataset", {
    "uri":        fields.String(description="Prepared dataset URI (e.g. ipfs://...)"),
    "suiteHash":  fields.String(description="bytes32 suite hash"),
    "fileFormat": fields.String(description="File format key"),
})

ZenohMappingBody = blockchain_ns.model("ZenohMappingBody", {
    "network":     fields.String(required=False, default="sepolia"),
    "zenoh_uri":   fields.String(required=True, description="zenoh:// URI"),
    "dataset_uri": fields.String(required=True, description="Dataset URI (ipfs:// or https://)"),
    "suite_hash":  fields.String(required=False, description="Optional bytes32 suite hash"),
})

PrepareValidationBody = blockchain_ns.model("PrepareValidationBody", {
    "network": fields.String(required=False, description="Chain/network name", example="sepolia"),
    "dataset_fingerprint": fields.String(required=True, description="bytes32 dataset fingerprint", example="0x" + "0"*64),
    "uploader": fields.String(required=False, description="Ethereum address of uploader/validator", example="0x0000000000000000000000000000000000000000"),
    "validation_json": fields.Raw(required=True, description="Validation JSON (object or JSON string)"),
    "include_report": fields.Boolean(required=False, description="Generate HTML report too", default=True),
})

TaskRefModel = blockchain_ns.model("TaskRef", {
    "task_id": fields.String,
})

# --- Swagger models for transactions ---
TxModel = blockchain_ns.model("ContractTx", {
    "id":                 fields.Integer,
    "network":            fields.String,
    "tx_hash":            fields.String,
    "block_number":       fields.Integer,
    "tx_index":           fields.Integer,
    "from":               fields.String(attribute="frm"),
    "to":                 fields.String,
    "value_wei":          fields.String,
    "status":             fields.Integer,
    "gas_used":           fields.String,
    "effective_gas_price":fields.String,
    "nonce":              fields.Integer,
    "contract_address":   fields.String,
    "block_timestamp":    fields.Integer,
    "extra":              fields.Raw,
    "contract_name":      fields.String(description="Resolved name when 'to' matches a known contract"),
})

PagedTxs = blockchain_ns.model("PagedTxs", {
    "data":           fields.List(fields.Nested(TxModel)),
    "total":          fields.Integer,
    "filtered_total": fields.Integer,
    "page":           fields.Integer,
    "perPage":        fields.Integer,
})


PrepareRewardBody = blockchain_ns.model("PrepareRewardBody", {
    "network": fields.String(required=False, default="sepolia"),
    "dataset_fingerprint": fields.String(required=True, description="bytes32 0x..."),
    "uploader": fields.String(required=True, description="0x uploader wallet (msg.sender)"),
    "category": fields.String(required=True, description="e.g. dataset"),
    "dataset_uri": fields.String(required=False),
    "suite_hash": fields.String(required=False, description="bytes32 suite hash 0x..."),
    "report_uri": fields.String(required=False, description="Optional ipfs:// report URI"),
})




# ---------- Parsers ----------
contracts_parser = reqparse.RequestParser()
contracts_parser.add_argument("network", action="split")
contracts_parser.add_argument("name", action="split")
contracts_parser.add_argument("address", action="split")
contracts_parser.add_argument("status", action="split")
contracts_parser.add_argument("withEventsCount", type=int, default=1)
contracts_parser.add_argument("includeAbi", type=int, default=0)
contracts_parser.add_argument("sort", default="id,desc")
contracts_parser.add_argument("page", type=int, default=1)
contracts_parser.add_argument("perPage", type=int, default=25)

# --- Parser for transactions ---
txs_parser = reqparse.RequestParser()
txs_parser.add_argument("network", action="split")
txs_parser.add_argument("tx_hash", action="split")
txs_parser.add_argument("address", action="split")   # filters rows where to OR contract_address matches any
txs_parser.add_argument("from", action="split")
txs_parser.add_argument("to", action="split")
txs_parser.add_argument("ts_from", type=int, required=False, help="Unix seconds, inclusive")
txs_parser.add_argument("ts_to", type=int, required=False, help="Unix seconds, inclusive")
txs_parser.add_argument("status", type=int)          # 1 or 0
txs_parser.add_argument("block_from", type=int)
txs_parser.add_argument("block_to", type=int)
txs_parser.add_argument("sort", default="block_number,desc")
txs_parser.add_argument("page", type=int, default=1)
txs_parser.add_argument("perPage", type=int, default=50)

SORTABLE_TX_COLS = {
    "id", "block_number", "tx_index", "nonce", "status", "value_wei",
    "gas_used", "effective_gas_price", "block_timestamp"
}

events_parser = reqparse.RequestParser()
events_parser.add_argument("network", action="split")
events_parser.add_argument("address", action="split")
events_parser.add_argument("name", action="split")
events_parser.add_argument("tx_hash", action="split")
events_parser.add_argument("block_from", type=int)
events_parser.add_argument("block_to", type=int)
events_parser.add_argument("search")
events_parser.add_argument("sort", default="block_number,desc")
events_parser.add_argument("page", type=int, default=1)
events_parser.add_argument("perPage", type=int, default=50)

# ---------- Helpers ----------
SORTABLE_CONTRACT_COLS = {
    "id", "name", "network", "status",
    "last_scanned_block", "start_block", "address", "events_count"
}
SORTABLE_EVENT_COLS = {"id", "name", "block_number", "log_index"}

def _parse_sort(sort_value: str, default_field: str, default_dir: str = "desc"):
    try:
        f, d = (sort_value or "").split(",", 1)
        f = f.strip() or default_field
        d = d.strip().lower()
        if d not in ("asc", "desc"):
            d = default_dir
    except Exception:
        f, d = default_field, default_dir
    return f, d

def _fmt_multi(v):
    if not v:
        return None
    return [s.strip() for s in v if s and s.strip()]

# ---------- Routes ----------
@blockchain_ns.route("/contracts")
@blockchain_ns.doc(security="oauth2",
                   description="Retrieve a paginated list of deployed contracts with optional filters and sorting.",
                   responses={200: "Contracts retrieved", 400: "Bad request", 500: "Server error"})
class ContractList(Resource):
    @blockchain_ns.expect(contracts_parser)
    @blockchain_ns.marshal_with(PagedContracts)
    def get(self):
        args = contracts_parser.parse_args()
        include_abi      = bool(args["includeAbi"])
        with_events_cnt  = bool(args["withEventsCount"])
        page             = max(args["page"], 1)
        per_page         = max(min(args["perPage"], 200), 1)
        sort_field, sort_dir = _parse_sort(args["sort"], "id", "desc")

        q_base = db.session.query(DeployedContract)

        nets = _fmt_multi(args["network"])
        if nets:
            q_base = q_base.filter(DeployedContract.network.in_(nets))

        stats = _fmt_multi(args["status"])
        if stats:
            q_base = q_base.filter(DeployedContract.status.in_(stats))

        addrs = _fmt_multi(args["address"])
        if addrs:
            addrs_lc = [a.lower() for a in addrs]
            q_base = q_base.filter(func.lower(DeployedContract.address).in_(addrs_lc))

        names = _fmt_multi(args["name"])
        if names:
            ors = [DeployedContract.name.ilike(f"%{n}%") for n in names]
            q_base = q_base.filter(or_(*ors)) if len(ors) > 1 else q_base.filter(ors[0])

        total = q_base.count()
        filtered_total = total  # keep parity with your catalog style

        if with_events_cnt and sort_field == "events_count":
            events_count_expr = func.coalesce(func.count(ContractEvent.id), 0).label("events_count")
            q = (
                q_base
                .outerjoin(
                    ContractEvent,
                    and_(ContractEvent.address == DeployedContract.address,
                         ContractEvent.network == DeployedContract.network)
                )
                .add_columns(events_count_expr)
                .group_by(DeployedContract.id)
            )
            order_col = events_count_expr
            q = q.order_by(order_col.desc() if sort_dir == "desc" else order_col.asc())
            rows = q.offset((page - 1) * per_page).limit(per_page).all()
            data = [c.to_json(include_abi=include_abi, events_count=int(evc)) for (c, evc) in rows]
        else:
            if sort_field not in SORTABLE_CONTRACT_COLS:
                sort_field = "id"
            order_col = getattr(DeployedContract, sort_field, DeployedContract.id)
            q_page = q_base.order_by(order_col.desc() if sort_dir == "desc" else order_col.asc())
            rows = q_page.offset((page - 1) * per_page).limit(per_page).all()

            cnt_map = {}
            if with_events_cnt and rows:
                subq = (
                    db.session.query(
                        DeployedContract.address.label("addr"),
                        DeployedContract.network.label("net"),
                    )
                    .filter(DeployedContract.id.in_([r.id for r in rows]))
                    .subquery()
                )
                counts = (
                    db.session.query(
                        ContractEvent.address,
                        ContractEvent.network,
                        func.count(ContractEvent.id).label("c"),
                    )
                    .join(subq, and_(
                        ContractEvent.address == subq.c.addr,
                        ContractEvent.network == subq.c.net,
                    ))
                    .group_by(ContractEvent.address, ContractEvent.network)
                    .all()
                )
                cnt_map = {(a, n): int(c) for (a, n, c) in counts}

            data = [
                r.to_json(include_abi=include_abi, events_count=cnt_map.get((r.address, r.network), 0))
                for r in rows
            ]

        return {
            "data": data,
            "total": int(total or 0),
            "filtered_total": int(filtered_total or 0),
            "page": page,
            "perPage": per_page,
        }, 200


@blockchain_ns.route("/contracts/<string:address>/events")
@blockchain_ns.param("address", "Contract address (0x...)")
@blockchain_ns.doc(security="oauth2",
                   description="Retrieve events for a single contract with optional filters and sorting.",
                   responses={200: "Events retrieved", 400: "Bad request", 500: "Server error"})
class ContractEvents(Resource):
    @blockchain_ns.expect(events_parser)
    @blockchain_ns.marshal_with(PagedEvents)
    def get(self, address):
        address_lc = address.lower()
        args = events_parser.parse_args()

        q = db.session.query(
            ContractEvent,
            DeployedContract.name.label("contract_name"),
        ).outerjoin(
            DeployedContract,
            and_(
                DeployedContract.address == ContractEvent.address,
                DeployedContract.network == ContractEvent.network,
            )
        ).filter(func.lower(ContractEvent.address) == address_lc)

        nets = _fmt_multi(args["network"])
        if nets:
            q = q.filter(ContractEvent.network.in_(nets))

        names = _fmt_multi(args["name"])
        if names:
            q = q.filter(ContractEvent.name.in_(names))

        txs = _fmt_multi(args["tx_hash"])
        if txs:
            q = q.filter(ContractEvent.tx_hash.in_(txs))

        if args["block_from"]:
            q = q.filter(ContractEvent.block_number >= args["block_from"])
        if args["block_to"]:
            q = q.filter(ContractEvent.block_number <= args["block_to"])

        filtered_total = q.count()

        sort_field, sort_dir = _parse_sort(args["sort"], "block_number", "desc")
        if sort_field not in SORTABLE_EVENT_COLS:
            sort_field = "block_number"
        order_col = getattr(ContractEvent, sort_field, ContractEvent.block_number)
        q = q.order_by(order_col.desc() if sort_dir == "desc" else order_col.asc())

        page     = max(args["page"], 1)
        per_page = max(min(args["perPage"], 200), 1)
        rows     = q.offset((page - 1) * per_page).limit(per_page).all()

        data = []
        for ev_row, cname in rows:
            item = ev_row.to_json()
            item["contract_name"] = cname
            data.append(item)

        total = db.session.query(ContractEvent).filter(func.lower(ContractEvent.address) == address_lc).count()
        return {
            "data": data,
            "total": int(total or 0),
            "filtered_total": int(filtered_total or 0),
            "page": page,
            "perPage": per_page,
        }, 200


@blockchain_ns.route("/events")
@blockchain_ns.doc(security="oauth2",
                   description="Retrieve all events with optional filters, search, and sorting.",
                   responses={200: "Events retrieved", 400: "Bad request", 500: "Server error"})
class AllEvents(Resource):
    @blockchain_ns.expect(events_parser)
    @blockchain_ns.marshal_with(PagedEvents)
    def get(self):
        args = events_parser.parse_args()

        q = db.session.query(
            ContractEvent,
            DeployedContract.name.label("contract_name"),
        ).outerjoin(
            DeployedContract,
            and_(
                DeployedContract.address == ContractEvent.address,
                DeployedContract.network == ContractEvent.network,
            )
        )

        nets = _fmt_multi(args["network"])
        if nets:
            q = q.filter(ContractEvent.network.in_(nets))

        addrs = _fmt_multi(args["address"])
        if addrs:
            addrs_lc = [a.lower() for a in addrs]
            q = q.filter(func.lower(ContractEvent.address).in_(addrs_lc))

        names = _fmt_multi(args["name"])
        if names:
            q = q.filter(ContractEvent.name.in_(names))

        txs = _fmt_multi(args["tx_hash"])
        if txs:
            q = q.filter(ContractEvent.tx_hash.in_(txs))

        if args["block_from"]:
            q = q.filter(ContractEvent.block_number >= args["block_from"])
        if args["block_to"]:
            q = q.filter(ContractEvent.block_number <= args["block_to"])

        if args["search"]:
            s = f"%{args['search']}%"
            q = q.filter(
                or_(
                    DeployedContract.name.ilike(s),
                    ContractEvent.address.ilike(s),
                )
            )

        filtered_total = q.count()

        sort_field, sort_dir = _parse_sort(args["sort"], "block_number", "desc")
        if sort_field not in SORTABLE_EVENT_COLS:
            sort_field = "block_number"
        order_col = getattr(ContractEvent, sort_field, ContractEvent.block_number)
        q = q.order_by(order_col.desc() if sort_dir == "desc" else order_col.asc())

        page     = max(args["page"], 1)
        per_page = max(min(args["perPage"], 200), 1)
        rows     = q.offset((page - 1) * per_page).limit(per_page).all()

        data = []
        for ev_row, cname in rows:
            item = ev_row.to_json()
            item["contract_name"] = cname
            data.append(item)

        total = db.session.query(func.count(ContractEvent.id)).scalar()
        return {
            "data": data,
            "total": int(total or 0),
            "filtered_total": int(filtered_total or 0),
            "page": page,
            "perPage": per_page,
        }, 200




@blockchain_ns.route("/contracts/<string:address>")
@blockchain_ns.param("address", "Contract address (0x...)")
@blockchain_ns.doc(security="oauth2",
                   description="Get a single deployed contract. Optional ABI and events_count.",
                   responses={200: "OK", 404: "Not found"})
class ContractByAddress(Resource):
    @blockchain_ns.doc(params={"includeAbi": "0|1", "withEventsCount": "0|1"})
    @blockchain_ns.marshal_with(ContractModel)
    def get(self, address):
        include_abi = request.args.get("includeAbi", "0") in ("1", "true", "yes")
        with_cnt    = request.args.get("withEventsCount", "0") in ("1", "true", "yes")

        row = (DeployedContract.query
               .filter(func.lower(DeployedContract.address) == address.lower())
               .first_or_404("Contract not found"))

        payload = row.to_json(include_abi=include_abi)
        if with_cnt:
            payload["events_count"] = db.session.query(func.count(ContractEvent.id)).filter(
                func.lower(ContractEvent.address) == address.lower(),
                ContractEvent.network == row.network
            ).scalar() or 0
        return payload, 200


@blockchain_ns.route("/contracts/registry")
@blockchain_ns.doc(security="oauth2",
                   description="Return latest contract per (network, name).",
                   responses={200: "OK"})
class ContractsRegistry(Resource):
    def get(self):
        rows = (DeployedContract.query
                .order_by(DeployedContract.name.asc(), DeployedContract.id.desc())
                .all())
        seen = set()
        out = []
        for r in rows:
            k = (r.network, r.name)
            if k in seen:
                continue
            seen.add(k)
            out.append({
                "name": r.name,
                "network": r.network,
                "address": r.address,
                "abi": r.abi,
            })
        return {"data": out, "count": len(out)}, 200


@blockchain_ns.route("/suites/prepare")
@blockchain_ns.doc(security="oauth2",
                   description="Ask backend to upload suite artifacts to IPFS and compute canonical suiteHash. Returns a Celery task id.",
                   responses={202: "Accepted", 400: "Bad request"})
class PrepareSuite(Resource):
    @blockchain_ns.expect(PrepareSuiteBody, validate=True)
    @blockchain_ns.marshal_with(TaskRefModel, code=202)
    def post(self):
        data = request.get_json(force=True)
        network        = data.get("network", "sepolia")
        requester      = data.get("requester")
        suite          = data.get("suite")
        category       = data.get("category")
        file_format    = data.get("fileFormat")
        deadline       = int(data.get("deadline", 0))
        total_expected = int(data.get("totalExpected", 0))
        docs_html      = data.get("docs_html")
        certificate    = data.get("certificate_json")
        suite_id       = data.get("expectation_suite_id")

        if not (isinstance(suite, dict) and requester and category and file_format and deadline and total_expected):
            blockchain_ns.abort(400, "missing required fields")

        try:
            requester = Web3.to_checksum_address(requester)
        except Exception:
            blockchain_ns.abort(400, "invalid requester address")

        task = create_suite_artifacts_task.apply_async(kwargs=dict(
            network=network,
            requester=requester,
            suite_object=suite,
            category=category,
            fileFormat=file_format,
            deadline=deadline,
            totalExpected=total_expected,
            docs_html=docs_html,
            certificate_json=certificate,
            expires_in_sec=900,
            expectation_suite_id = suite_id
        ))
        return {"task_id": task.id}, 202


@blockchain_ns.route("/ingest-tx")
@blockchain_ns.doc(security="oauth2",
                   description="Ingest a specific transaction for a contract address on a given network. Returns a Celery task id.",
                   responses={202: "Accepted", 400: "Bad request"})
class IngestTx(Resource):
    @blockchain_ns.expect(ingest_model)
    def post(self):
        data = request.get_json(force=True)
        network = data.get("network")
        address = data.get("address")
        tx_hash = data.get("tx_hash")
        if not (network and address and tx_hash):
            return {"error": "network, address, tx_hash required"}, 400

        # enqueue as celery job
        async_res = ingest_tx_task.apply_async(kwargs={
            "network": network,
            "address": address,
            "tx_hash": tx_hash,
        })
        return {"task_id": async_res.id}, 202
    


# ---------- All transactions ----------
@blockchain_ns.route("/txs")
@blockchain_ns.doc(security="oauth2",
                   description="Retrieve all recorded transactions with filters and sorting.")
class AllTxs(Resource):
    @blockchain_ns.expect(txs_parser)
    @blockchain_ns.marshal_with(PagedTxs)
    def get(self):
        args = txs_parser.parse_args()

        q = db.session.query(
            ContractTx,
            DeployedContract.name.label("contract_name"),
        ).outerjoin(
            DeployedContract,
            and_(
                DeployedContract.network == ContractTx.network,
                DeployedContract.address == ContractTx.to,   # best-effort name via 'to'
            )
        )

        nets = _fmt_multi(args["network"])
        if nets:
            q = q.filter(ContractTx.network.in_(nets))

        txs = _fmt_multi(args["tx_hash"])
        if txs:
            q = q.filter(ContractTx.tx_hash.in_(txs))

        addrs = _fmt_multi(args["address"])
        if addrs:
            addrs_lc = [a.lower() for a in addrs]
            q = q.filter(
                or_(
                    func.lower(ContractTx.to).in_(addrs_lc),
                    func.lower(ContractTx.contract_address).in_(addrs_lc),
                )
            )

        froms = _fmt_multi(args["from"])
        if froms:
            q = q.filter(func.lower(ContractTx.frm).in_([a.lower() for a in froms]))

        tos = _fmt_multi(args["to"])
        if tos:
            q = q.filter(func.lower(ContractTx.to).in_([a.lower() for a in tos]))

        if args["status"] in (0, 1):
            q = q.filter(ContractTx.status == int(args["status"]))

        if args["block_from"]:
            q = q.filter(ContractTx.block_number >= args["block_from"])
        if args["block_to"]:
            q = q.filter(ContractTx.block_number <= args["block_to"])
        if args["ts_from"]:
            q = q.filter(ContractTx.block_timestamp >= args["ts_from"])
        if args["ts_to"]:
            q = q.filter(ContractTx.block_timestamp <= args["ts_to"])

        filtered_total = q.count()

        sort_field, sort_dir = _parse_sort(args["sort"], "block_number", "desc")
        if sort_field not in SORTABLE_TX_COLS:
            sort_field = "block_number"
        order_col = getattr(ContractTx, sort_field, ContractTx.block_number)
        q = q.order_by(order_col.desc() if sort_dir == "desc" else order_col.asc())

        page     = max(args["page"], 1)
        per_page = max(min(args["perPage"], 200), 1)
        rows     = q.offset((page - 1) * per_page).limit(per_page).all()

        data = []
        for tx_row, cname in rows:
            item = tx_row.to_json()
            item["contract_name"] = cname
            data.append(item)

        total = db.session.query(func.count(ContractTx.id)).scalar()
        return {
            "data": data,
            "total": int(total or 0),
            "filtered_total": int(filtered_total or 0),
            "page": page,
            "perPage": per_page,
        }, 200


# ---------- Transactions for a specific contract ----------
@blockchain_ns.route("/contracts/<string:address>/txs")
@blockchain_ns.param("address", "Contract address (0x...)")
@blockchain_ns.doc(security="oauth2",
                   description="Transactions interacting with this contract (to == address) or creating it (contract_address == address).")
class ContractTxs(Resource):
    @blockchain_ns.expect(txs_parser)
    @blockchain_ns.marshal_with(PagedTxs)
    def get(self, address):
        address_lc = address.lower()
        args = txs_parser.parse_args()

        q = db.session.query(
            ContractTx,
            DeployedContract.name.label("contract_name"),
        ).outerjoin(
            DeployedContract,
            and_(
                DeployedContract.network == ContractTx.network,
                DeployedContract.address == ContractTx.to,
            )
        ).filter(
            or_(
                func.lower(ContractTx.to) == address_lc,
                func.lower(ContractTx.contract_address) == address_lc,
            )
        )

        nets = _fmt_multi(args["network"])
        if nets:
            q = q.filter(ContractTx.network.in_(nets))

        if args["status"] in (0, 1):
            q = q.filter(ContractTx.status == int(args["status"]))

        if args["block_from"]:
            q = q.filter(ContractTx.block_number >= args["block_from"])
        if args["block_to"]:
            q = q.filter(ContractTx.block_number <= args["block_to"])
        if args["ts_from"]:
            q = q.filter(ContractTx.block_timestamp >= args["ts_from"])
        if args["ts_to"]:
            q = q.filter(ContractTx.block_timestamp <= args["ts_to"])

        filtered_total = q.count()

        sort_field, sort_dir = _parse_sort(args["sort"], "block_number", "desc")
        if sort_field not in SORTABLE_TX_COLS:
            sort_field = "block_number"
        order_col = getattr(ContractTx, sort_field, ContractTx.block_number)
        q = q.order_by(order_col.desc() if sort_dir == "desc" else order_col.asc())

        page     = max(args["page"], 1)
        per_page = max(min(args["perPage"], 200), 1)
        rows     = q.offset((page - 1) * per_page).limit(per_page).all()

        data = []
        for tx_row, cname in rows:
            item = tx_row.to_json()
            item["contract_name"] = cname
            data.append(item)

        total = db.session.query(ContractTx).filter(
            or_(
                func.lower(ContractTx.to) == address_lc,
                func.lower(ContractTx.contract_address) == address_lc,
            )
        ).count()

        return {
            "data": data,
            "total": int(total or 0),
            "filtered_total": int(filtered_total or 0),
            "page": page,
            "perPage": per_page,
        }, 200


# ---------- Single tx by hash ----------
@blockchain_ns.route("/txs/<string:tx_hash>")
@blockchain_ns.param("tx_hash", "0x transaction hash")
@blockchain_ns.doc(security="oauth2", description="Get a single recorded transaction by hash.")
class TxByHash(Resource):
    @blockchain_ns.marshal_with(TxModel)
    def get(self, tx_hash):
        row = ContractTx.query.filter_by(tx_hash=tx_hash).first_or_404("Transaction not found")
        # try naming via 'to'
        cname = None
        if row.to:
            dc = (DeployedContract.query
                  .filter_by(network=row.network, address=row.to)
                  .first())
            cname = dc.name if dc else None
        payload = row.to_json()
        payload["contract_name"] = cname
        return payload, 200


@blockchain_ns.route("/register_datasets/prepare_report")
@blockchain_ns.doc(security="oauth2",
                   description="Prepare an IPFS URI for an existing HTML profile report stored in zenoh for a catalog file. Returns a Celery task id.",     
                   responses={202: "Accepted", 400: "Bad request"})
class PrepareReportIPFSURIResource(Resource):
    def post(self):
        """
        Trigger creation of an IPFS URI for an existing HTML profile report
        stored in zenoh for a catalog file.
        Frontend will poll /ddm/tasks/status/<task_id> for the result.
        """
        payload = request.get_json(force=True) or {}

        network = payload.get("network")
        catalog_id = payload.get("catalog_id")
        include_report = payload.get("include_report", True)

        if not catalog_id:
            return {"error": "Missing catalog_id"}, 400

        if not include_report:
            # Contract with frontend: this endpoint only makes sense
            # when include_report === true
            return {"error": "include_report is False; nothing to do"}, 400

        task = prepare_report_ipfs_uri_task.apply_async(
            kwargs={
                "network": network or "sepolia",
                "catalog_id": catalog_id,
            }
        )

        return {"task_id": task.id}, 202

@blockchain_ns.route("/rewards/prepare")
@blockchain_ns.doc(security="oauth2",
                   description="Prepare a dataset reward claim. Returns a Celery task id.",
                   responses={202: "Accepted", 400: "Bad request"})
class PrepareReward(Resource):
    @blockchain_ns.expect(PrepareRewardBody, validate=True)
    @blockchain_ns.marshal_with(TaskRefModel, code=202)
    def post(self):
        data = request.get_json(force=True) or {}

        network = data.get("network", "sepolia")
        dataset_fingerprint = data.get("dataset_fingerprint")
        uploader = data.get("uploader")
        category = data.get("category")
        dataset_uri = data.get("dataset_uri")
        suite_hash = data.get("suite_hash")
        report_uri = data.get("report_uri")


        if not (dataset_fingerprint and uploader and category ):
            return {"error": "dataset_fingerprint, uploader, category required"}, 400

        try:
            uploader = Web3.to_checksum_address(uploader)
        except Exception:
            return {"error": "invalid uploader address"}, 400

        task = prepare_dataset_reward_claim_task.apply_async(kwargs={
            "network": network,
            "dataset_fingerprint": dataset_fingerprint,
            "category": category,
            "uploader": uploader,
            "dataset_uri": dataset_uri,
            "suite_hash": suite_hash,
            "report_uri": report_uri,
        })
        return {"task_id": task.id}, 202


@blockchain_ns.route("/validations/prepare")
@blockchain_ns.doc(
    security="oauth2",
    description="Prepare validation artifacts: upload JSON to IPFS, optionally generate HTML report, return Celery task id.",
    responses={202: "Accepted", 400: "Bad request"}
)
class PrepareValidation(Resource):
    @blockchain_ns.expect(PrepareValidationBody, validate=True)
    @blockchain_ns.marshal_with(TaskRefModel, code=202)
    def post(self):
        data = request.get_json(force=True) or {}

        network = data.get("network", "sepolia")
        dataset_fingerprint = data.get("dataset_fingerprint")
        uploader = data.get("uploader")  # optional
        include_report = bool(data.get("include_report", True))
        validation_json = data.get("validation_json")

        if not dataset_fingerprint:
            return {"error": "dataset_fingerprint required"}, 400

        if validation_json is None:
            return {"error": "validation_json required"}, 400

        # optional uploader checksum validation
        if uploader:
            try:
                uploader = Web3.to_checksum_address(uploader)
            except Exception:
                return {"error": "invalid uploader address"}, 400

        # NOTE: accept either JSON object or JSON string
        # Celery task can normalize/parse it safely.
        task = prepare_validation_task.apply_async(kwargs={
            "network": network,
            "dataset_fingerprint": dataset_fingerprint,
            "uploader": uploader,
            "include_report": include_report,
            "validation_json": validation_json,
        })

        return {"task_id": task.id}, 202