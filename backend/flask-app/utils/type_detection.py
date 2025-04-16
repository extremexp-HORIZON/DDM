# ✅ Mapping Pandas dtypes to Great Expectations types
dtype_map = {
    "int64": "int",
    "float64": "float",
    "bool": "bool",
    "str": "string",
    "datetime64": "datetime"
}

# ✅ UUID detection 
def is_uuid_column(series):
    sample_values = series.dropna().astype(str).head(10).tolist()
    match_count = sum(1 for val in sample_values if "-" in val and len(val) == 36)
    return match_count / len(sample_values) > 0.8 if sample_values else False

# ✅ Timestamp detection 
def is_timestamp_column(series):
    sample_values = series.dropna().astype(str).head(10).tolist()
    match_count = sum(1 for val in sample_values if "T" in val and ":" in val)
    return match_count / len(sample_values) > 0.8 if sample_values else False

# ✅ E-mail detection 
def is_email_column(series):
    return series.astype(str).str.contains(r"@.*\.", regex=True).mean() > 0.8

# ✅ Phone detection 
def is_phone_column(series):
    return series.astype(str).str.contains(r"\d{3}[-.\s]?\d{3}[-.\s]?\d{4}", regex=True).mean() > 0.6


def guess_regex(series):
    if is_email_column(series):
        return r"^[\w\.-]+@[\w\.-]+\.\w+$"
    if is_uuid_column(series):
        return r"^[a-f0-9\-]{36}$"
    if is_phone_column(series):
        return r"^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$"
    if is_timestamp_column(series):
        return r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}"
    return ".*"
