from datetime import datetime
from sqlalchemy import and_, or_, not_, cast
from sqlalchemy.types import Float, String, DateTime
from extensions import db
from models.file import File


def resolve_nested_jsonb_field(base, dotted: str):
    """
    Supports dotted paths AND numeric array indexes:
      "shape.0" -> base["shape"][0]
    """
    col = base
    for part in dotted.split("."):
        if part.isdigit():
            col = col[int(part)]
        else:
            col = col[part]
    return col


def _get_field_expression(field: str):
    if field.startswith("file_metadata."):
        return resolve_nested_jsonb_field(File.file_metadata, field.removeprefix("file_metadata.")), True
    if field.startswith("uploader_metadata."):
        return resolve_nested_jsonb_field(File.uploader_metadata, field.removeprefix("uploader_metadata.")), True
    if field.startswith("nft_metadata."):
        return resolve_nested_jsonb_field(File.nft_metadata, field.removeprefix("nft_metadata.")), True
    if field.startswith("use_case."):
        return resolve_nested_jsonb_field(File.use_case, field.removeprefix("use_case.")), True
    if field.startswith("parent_files."):
        return resolve_nested_jsonb_field(File.parent_files, field.removeprefix("parent_files.")), True
    return getattr(File, field, None), False


def _parse_iso_datetime(value):
    if value is None:
        return None
    s = str(value).strip()
    if not s:
        return None
    try:
        # Accept "YYYY-MM-DD"
        if len(s) == 10:
            return datetime.fromisoformat(s)
        # Accept ISO with timezone / Z
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None


def _parse_rule_group(group):
    rules = group.get("rules", [])
    combinator = group.get("combinator", "and").lower()
    is_not = group.get("not", False)

    expressions = []

    i = 0
    while i < len(rules):
        rule = rules[i]

        if isinstance(rule, str) and rule.lower() in {"and", "or"}:
            i += 1
            continue

        elif isinstance(rule, dict) and "rules" in rule:
            expr = _parse_rule_group(rule)
            if expr is not None:
                expressions.append(expr)

        elif isinstance(rule, dict):
            field = rule.get("field")
            operator = rule.get("operator")
            value = rule.get("value")

            if not field or not operator:
                i += 1
                continue

            # ------------------------------------------------------------
            # VIRTUAL FIELDS (handle before _get_field_expression)
            # ------------------------------------------------------------
            if field == "__rows__":
                # file_metadata.shape[0]
                expr = resolve_nested_jsonb_field(File.file_metadata, "shape.0")
                try:
                    val = float(value)
                    num_expr = cast(expr.astext, Float)
                    op_map = {
                        ">": num_expr > val,
                        ">=": num_expr >= val,
                        "<": num_expr < val,
                        "<=": num_expr <= val,
                        "=": num_expr == val,
                        "!=": num_expr != val,
                    }
                    if operator in op_map:
                        expressions.append(op_map[operator])
                except Exception:
                    pass
                i += 1
                continue

            if field == "__has_column__":
                # file_metadata.columns contains [column_name]
                expr = resolve_nested_jsonb_field(File.file_metadata, "columns")
                colname = str(value or "").strip()
                if colname:
                    if operator == "hasColumn":
                        expressions.append(expr.contains([colname]))
                    elif operator == "notHasColumn":
                        expressions.append(not_(expr.contains([colname])))
                i += 1
                continue

            if field == "__stat__":
                # value must be dict: { column, metric, value }
                if isinstance(value, dict):
                    colname = str(value.get("column") or "").strip()
                    metric = str(value.get("metric") or "").strip()
                    metric_value = value.get("value")

                    if colname and metric:
                        path = f"summary_statistics.{colname}.{metric}"
                        expr = resolve_nested_jsonb_field(File.file_metadata, path)

                        # try numeric compare
                        try:
                            num = float(metric_value)
                            num_expr = cast(expr.astext, Float)
                            op_map = {
                                ">": num_expr > num,
                                ">=": num_expr >= num,
                                "<": num_expr < num,
                                "<=": num_expr <= num,
                                "=": num_expr == num,
                                "!=": num_expr != num,
                            }
                            if operator in op_map:
                                expressions.append(op_map[operator])
                        except Exception:
                            # fallback to text compare
                            text_expr = expr.astext
                            if operator == "=":
                                expressions.append(text_expr == str(metric_value))
                            elif operator == "!=":
                                expressions.append(text_expr != str(metric_value))
                            elif operator == "contains":
                                expressions.append(text_expr.ilike(f"%{metric_value}%"))
                i += 1
                continue


            expr, is_json = _get_field_expression(field)
            if expr is None:
                i += 1
                continue

            # created is DateTime: compare as DateTime, not strings
            if (not is_json) and hasattr(expr, "type") and isinstance(expr.type, DateTime):
                if operator in {">", ">=", "<", "<=", "=", "!="}:
                    dt = _parse_iso_datetime(value)
                    if dt is not None:
                        op_map = {
                            ">": expr > dt,
                            ">=": expr >= dt,
                            "<": expr < dt,
                            "<=": expr <= dt,
                            "=": expr == dt,
                            "!=": expr != dt,
                        }
                        expressions.append(op_map[operator])
                i += 1
                continue

            text_expr = expr.astext if is_json else cast(expr, String)

            if operator == "=":
                expressions.append(text_expr == str(value))
            elif operator == "!=":
                expressions.append(text_expr != str(value))
            elif operator == "contains":
                expressions.append(text_expr.ilike(f"%{value}%"))
            elif operator == "startsWith":
                expressions.append(text_expr.ilike(f"{value}%"))
            elif operator == "endsWith":
                expressions.append(text_expr.ilike(f"%{value}"))
            elif operator in {">", ">=", "<", "<="}:
                try:
                    val = float(value)
                    num_expr = cast(expr.astext, Float) if is_json else cast(expr, Float)
                    op_map = {
                        ">": num_expr > val,
                        ">=": num_expr >= val,
                        "<": num_expr < val,
                        "<=": num_expr <= val,
                    }
                    expressions.append(op_map[operator])
                except Exception:
                    pass
            elif operator == "in" and isinstance(value, list):
                expressions.append(text_expr.in_(map(str, value)))

        i += 1

    if not expressions:
        return None

    comb = or_ if combinator == "or" else and_
    return not_(comb(*expressions)) if is_not else comb(*expressions)


def filter_files(query_payload):
    try:
        where_clause = _parse_rule_group(query_payload or {})
        query = File.query.filter(File.recdeleted.is_(False))
        if where_clause is not None:
            query = query.filter(where_clause)
        return query
    except Exception as e:
        raise ValueError(f"Failed to build query: {str(e)}")
