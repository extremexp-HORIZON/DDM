# utils/suites.py
from typing import Any, Dict, List
from html import escape as esc

def _clean(val):
    # prune None/"" but keep 0/False
    if val is None:
        return None
    if isinstance(val, str) and val.strip() == "":
        return None
    return val

def _sanitize_kwargs(obj: Dict[str, Any]) -> Dict[str, Any]:
    out = {}
    for k, v in (obj or {}).items():
        if k == "_enabled":
            continue
        key = "type" if k == "type_" else k  # UI -> metadata
        if isinstance(v, dict):
            sv = _sanitize_kwargs(v)
            if sv:
                out[key] = sv
        elif isinstance(v, list):
            sv = [ _clean(x) for x in v ]
            sv = [ x for x in sv if x is not None ]
            if len(sv):
                out[key] = sv
        else:
            sv = _clean(v)
            if sv is not None:
                out[key] = sv
    return out

def build_flat_suite_from_selected(suite_object: Dict[str, Any]) -> Dict[str, Any]:
    """
    Produce the compact (flat) suite:
    {
      suite_name, datasource_name, file_types, expectations: [{expectation_type, kwargs}], ...
    }
    """
    exp_flat: List[Dict[str, Any]] = []

    sel = (suite_object or {}).get("selectedExpectations") or {}
    for col, defs in sel.items():
        for exp_type, cfg in (defs or {}).items():
            if exp_type in ("description", "undefined"):
                continue
            if not isinstance(cfg, dict) or not cfg.get("_enabled"):
                continue
            kwargs = {"column": col}
            kwargs.update(_sanitize_kwargs(cfg))
            exp_flat.append({"expectation_type": exp_type, "kwargs": kwargs})

    table_defs = (suite_object or {}).get("tableExpectations") or {}
    for exp_type, cfg in table_defs.items():
        if not isinstance(cfg, dict) or not cfg.get("_enabled"):
            continue
        kwargs = _sanitize_kwargs(cfg)
        exp_flat.append({"expectation_type": exp_type, "kwargs": kwargs})

    return {
        "id":               suite_object.get("id"),
        "suite_name":       suite_object.get("name") or suite_object.get("suite_name") or "suite",
        "datasource_name":  suite_object.get("datasource_name") or "default",
        "file_types":       suite_object.get("fileFormats") or suite_object.get("file_types") or [],
        "expectations":     exp_flat,
        "category":         suite_object.get("category"),
        "description":      suite_object.get("description"),
        "user_id":          suite_object.get("user_id"),
        "column_descriptions": suite_object.get("column_descriptions"),
        "column_names":        suite_object.get("column_names"),
        "created":            suite_object.get("created"),
        "expectation_descriptions": suite_object.get("expectation_descriptions")
    }



def build_docs_html(flat: Dict[str, Any]) -> str:
    """
    Renders docs for a suite with THREE distinct sections:
      1) Columns (name + description)
      2) Column Expectations (target a specific column)
      3) Table Expectations (apply to the whole table)
    """
    suite_name   = (flat.get("suite_name") or "Suite").strip() or "Suite"
    description  = (flat.get("description") or "").strip()
    suite_uri  = flat.get("suiteURI") or ""
    docs_uri   = flat.get("docsURI") or ""
    cert_uri   = flat.get("certificateURI") or ""

    uris_html = ""
    if any([suite_uri, docs_uri, cert_uri]):
        def _row(label, val):
            return f"<tr><td style='width:180px;color:#666'>{esc(label)}</td><td><code>{esc(str(val))}</code></td></tr>" if val else ""
        uris_html = (
            "<section><h2>Artifacts</h2>"
            "<table><tbody>"
            f"{_row('Suite URI', suite_uri)}"
            f"{_row('Docs URI', docs_uri)}"
            f"{_row('Metadata URI', cert_uri)}"
            "</tbody></table></section>"
        )


    # --- Columns inputs (robust normalization)
    columns      = flat.get("column_names") or []
    if not isinstance(columns, list):
        columns = []
    columns = [str(c) for c in columns]

    col_descs    = flat.get("column_descriptions") or {}
    if isinstance(col_descs, dict):
        col_descs = {str(k): (v or "") for k, v in col_descs.items()}
    else:
        col_descs = {}

    # Fallback: build columns from description keys if column_names missing
    if not columns and col_descs:
        columns = sorted(col_descs.keys())

    # --- Expectations inputs (robust normalization)
    expectations = flat.get("expectations") or []
    # Support both list and {"expectations":[...]} shape
    if isinstance(expectations, dict):
        expectations = expectations.get("expectations") or []
    if not isinstance(expectations, list):
        expectations = []
    # Keep only dict items with expected keys
    expectations = [
        e for e in expectations
        if isinstance(e, dict) and "expectation_type" in e and isinstance(e.get("kwargs"), dict)
    ]

    exp_meta = flat.get("expectation_descriptions") or {}
    if not isinstance(exp_meta, dict):
        exp_meta = {}

    # -------------------- Columns table --------------------
    col_rows: List[str] = []
    for col in columns:
        desc = col_descs.get(col, "")
        desc_html = esc(desc) if desc else "<em>No description</em>"
        col_rows.append(
            "<tr>"
            f"<td><code>{esc(col)}</code></td>"
            f"<td>{desc_html}</td>"
            "</tr>"
        )
    cols_html = "".join(col_rows) if col_rows else "<tr><td colspan='2'><em>No columns provided.</em></td></tr>"

    # Helper: params renderer (kwargs minus 'column')
    def render_params(kw: Dict[str, Any]) -> str:
        items = [(k, kw[k]) for k in sorted(kw.keys()) if k != "column"]
        if not items:
            return "<em>—</em>"
        return ", ".join(f"{esc(str(k))}={esc(str(v))}" for k, v in items)
    

    # Split column vs table expectations
    col_exps: List[Dict[str, Any]] = []
    tbl_exps: List[Dict[str, Any]] = []
    for e in expectations:
        kw = e.get("kwargs") or {}
        if "column" in kw:
            col_exps.append(e)
        else:
            tbl_exps.append(e)

    # helper: compute a docs URL for an expectation
    def expectation_doc_url(exp_type: str, meta: Dict[str, Any]) -> str:
        # 1) honor explicit doc_url provided by metadata (if any)
        m = meta or {}
        url = m.get("doc_url") or m.get("url") or ""
        if isinstance(url, str) and url.strip():
            return url.strip()
        # 2) fall back to the standard GE expectations site using the expectation type
        # (works for both column- and table-level expectations)
        safe = (exp_type or "").strip()
        if safe:
            return f"https://greatexpectations.io/expectations/{safe}"
        return ""
    

    # -------------------- Column Expectations --------------------
    col_exp_rows: List[str] = []
    for e in col_exps:
        et = e.get("expectation_type", "")
        kw = e.get("kwargs") or {}
        col = str(kw.get("column", ""))

        meta  = exp_meta.get(et) or {}
        human = meta.get("description") or ""
        cat   = meta.get("category") or ""
        doc_u = expectation_doc_url(et, meta)
        human_html = f"<div style='margin-top:4px;color:#444'>{esc(human)}</div>" if human else ""
        cat_badge  = (
            "<div style='margin-top:6px'>"
            "<span style='display:inline-block;padding:2px 6px;border:1px solid #ddd;"
            "border-radius:10px;font-size:11px;background:#fafafa;color:#555'>"
            f"{esc(cat)}</span></div>"
        ) if cat else ""
        # clickable expectation name (keeps code look)
        if doc_u:
            exp_name_html = f"<a href='{esc(doc_u)}' target='_blank' rel='noreferrer noopener'><code>{esc(et)}</code></a>"
        else:
            exp_name_html = f"<code>{esc(et)}</code>"
        col_exp_rows.append(
            "<tr>"
            f"<td><code>{esc(col)}</code></td>"
            f"<td>{exp_name_html}{human_html}{cat_badge}</td>"
            f"<td>{render_params(kw)}</td>"
            "</tr>"
        )
    col_exps_html = "".join(col_exp_rows) if col_exp_rows else "<tr><td colspan='3'><em>No column expectations.</em></td></tr>"

    # -------------------- Table Expectations --------------------
    tbl_exp_rows: List[str] = []
    for e in tbl_exps:
        et = e.get("expectation_type", "")
        kw = e.get("kwargs") or {}

        meta  = exp_meta.get(et) or {}
        human = meta.get("description") or ""
        cat   = meta.get("category") or ""
        doc_u = expectation_doc_url(et, meta)
        
        human_html = f"<div style='margin-top:4px;color:#444'>{esc(human)}</div>" if human else ""
        cat_badge  = (
            "<div style='margin-top:6px'>"
            "<span style='display:inline-block;padding:2px 6px;border:1px solid #ddd;"
            "border-radius:10px;font-size:11px;background:#fafafa;color:#555'>"
            f"{esc(cat)}</span></div>"
        ) if cat else ""
        if doc_u:
            exp_name_html = f"<a href='{esc(doc_u)}' target='_blank' rel='noreferrer noopener'><code>{esc(et)}</code></a>"
        else:
            exp_name_html = f"<code>{esc(et)}</code>"
        tbl_exp_rows.append(
            "<tr>"
            f"<td>{exp_name_html}{human_html}{cat_badge}</td>"
            f"<td>{render_params(kw)}</td>"
            "</tr>"
        )
    tbl_exps_html = "".join(tbl_exp_rows) if tbl_exp_rows else "<tr><td colspan='2'><em>No table expectations.</em></td></tr>"

    # -------------------- Header line --------------------
    cat  = (flat.get("category") or "").strip()
    fts  = flat.get("file_types") or flat.get("fileFormats") or []
    header_bits = []
    if cat:
        header_bits.append(f"Category: <strong>{esc(cat)}</strong>")
    if isinstance(fts, list) and fts:
        header_bits.append(f"File types: <strong>{esc(', '.join(map(str, fts)))}</strong>")
    header_line = f"<p>{' &nbsp;|&nbsp; '.join(header_bits)}</p>" if header_bits else ""

    desc_html = esc(description) if description else "<em>No description provided.</em>"

    # -------------------- Final HTML --------------------
    return (
        "<!doctype html>"
        "<html><head><meta charset='utf-8'/>"
        f"<title>{esc(suite_name)} — Validation Suite</title>"
        "<meta name='viewport' content='width=device-width,initial-scale=1'/>"
        "<style>"
        "body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;padding:24px;color:#111}"
        "h1,h2{margin:0 0 12px}section{margin:20px 0}"
        "table{width:100%;border-collapse:collapse;font-size:14px}"
        "th,td{padding:8px 10px;border-bottom:1px solid #eee;vertical-align:top}"
        "code{background:#f6f8fa;padding:2px 4px;border-radius:4px}"
        ".count{font-size:12px;color:#666;margin-left:6px}"
        "</style></head><body>"
        f"<h1>{esc(suite_name)}</h1>"
        f"{header_line}"

        "<section><h2>Description</h2>"
        f"<p>{desc_html}</p></section>"
        f"{uris_html}"

        "<section>"
        f"<h2>Columns <span class='count'>({len(columns)})</span></h2>"
        "<table><thead><tr><th style='width:240px'>Name</th><th>Description</th></tr></thead>"
        "<tbody>"
        f"{cols_html}"
        "</tbody></table></section>"

        "<section>"
        f"<h2>Column Expectations <span class='count'>({len(col_exps)})</span></h2>"
        "<table><thead><tr><th style='width:220px'>Column</th><th style='width:460px'>Expectation</th><th>Params</th></tr></thead>"
        "<tbody>"
        f"{col_exps_html}"
        "</tbody></table></section>"

        "<section>"
        f"<h2>Table Expectations <span class='count'>({len(tbl_exps)})</span></h2>"
        "<table><thead><tr><th style='width:520px'>Expectation</th><th>Params</th></tr></thead>"
        "<tbody>"
        f"{tbl_exps_html}"
        "</tbody></table></section>"

        "</body></html>"
    )
