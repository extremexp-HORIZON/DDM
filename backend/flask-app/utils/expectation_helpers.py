import json
import re
import inspect
import pandas as pd

from great_expectations.expectations.registry import (
    list_registered_expectation_implementations,
    get_expectation_impl,
)

CATEGORIES = {
    "column": {
        "schema": [
            "to_exist", 
            "to_be_of_type", 
            "to_be_in_type_list",
            "match_json_schema"
            ],
        "volume": [
            "value_count", 
            "unique_value_count",
            "proportion_of_unique"
            ],
        "uniqueness": [
            "to_be_unique", 
            "to_be_distinct",
            "compound_columns_to_be_unique",
            "select_column_values_to_be_unique"
            ],
        "validity": [
            "to_be_in_set", 
            "to_not_be_in_set",
            "to_match", 
            "not_match",
            "to_be_parseable", 
            "match_regex",
            "match_like_pattern",
            "json_parseable",
            "dateutil_parseable",
            "distinct_values_to_be_in_set",
            "distinct_values_to_contain_set",
            "distinct_values_to_equal_set"
            ],
        "completeness": [
            "to_be_null", 
            "to_not_be_null"
            ],
        "numeric": [
            "to_be_between", 
            "to_be_less_than", 
            "to_be_greater_than",
            "value_lengths_to_equal",
            "value_lengths_to_be_between",
            "values_to_be_increasing",
            "values_to_be_decreasing",
            "quantile_values",
            "value_z_scores",
            "column_sum",
            "max_to_be_between",
            "min_to_be_between",
            "mean_to_be_between",
            "median_to_be_between",
            "stdev_to_be_between",
            "kl_divergence"
            ],
    },
    "table": {
        "schema": [
            "table_columns_to_match",
            "table_column_count",
        ],
        "volume": [
            "table_row_count"
        ],
    }
}


def get_expectation_scope(name):
    return "table" if name.startswith("expect_table_") else "column"

def collect_all_expectations():
    expectations = []

    for name in list_registered_expectation_implementations():
        try:
            exp_class = get_expectation_impl(name)
            doc = (exp_class.__doc__ or "No description").strip().split("\n")[0]

            default_kwargs = extract_default_kwargs(exp_class)
            domain_keys = extract_domain_kwargs(exp_class)
            success_keys = extract_success_keys(exp_class)
            all_keys = sorted(set(list(domain_keys) + list(success_keys) + list(default_kwargs.keys())))

            args = []
            for key in all_keys:
                args.append({
                    "name": key,
                    "required": key not in default_kwargs,
                    "default": default_kwargs.get(key, None)
                })

            expectations.append({
                "name": name,
                "description": doc,
                "scope": get_expectation_scope(name),
                "arguments": args
            })

        except Exception as e:
            expectations.append({
                "name": name,
                "description": "Could not load",
                "scope": "uncategorized",
                "arguments": [],
                "error": str(e)
            })

    return expectations


def categorize_expectation(name, doc):
    name = name.lower()
    doc = doc.lower()

    # 1. Table-level expectations should always start with "expect_table_"
    if name.startswith("expect_table_"):
        for subcat, keywords in CATEGORIES["table"].items():
            for kw in keywords:
                if kw in name or kw in doc:
                    return "table", subcat
        return "table", "other"

    # 2. Column-level expectations (default scope)
    for subcat, keywords in CATEGORIES["column"].items():
        for kw in keywords:
            if kw in name or kw in doc:
                return "column", subcat

    return "uncategorized", "other"



def extract_domain_kwargs(exp_class):
    try:
        method = getattr(exp_class, "_get_domain_kwargs", None)
        if not method:
            return []
        source = inspect.getsource(method)

        # Handle both string and tuple keys
        matches = re.findall(r"configuration\.kwargs\.get\((?:'|\")?([a-zA-Z0-9_]+)(?:'|\")?", source)
        
        # 🚫 Remove "key" if present
        matches = [m for m in matches if m != "key"]

        return list(sorted(set(matches)))
    except Exception:
        return []




def extract_success_keys(exp_class):
    return getattr(exp_class, "success_keys", [])


def extract_default_kwargs(exp_class):
    return getattr(exp_class, "default_kwarg_values", {}) or {}


def build_metadata():
    categorized = {
        "column": {},
        "table": {},
        "uncategorized": {}
    }

    for name in list_registered_expectation_implementations():
        try:
            exp_class = get_expectation_impl(name)
            doc = (exp_class.__doc__ or "").strip().split("\n")[0]

            default_kwargs = extract_default_kwargs(exp_class)
            domain_keys = extract_domain_kwargs(exp_class)
            success_keys = extract_success_keys(exp_class)
            all_keys = set(list(domain_keys) + list(success_keys) + list(default_kwargs.keys()))

            args = []
            for key in sorted(all_keys):
                args.append({
                    "name": key,
                    "required": key not in default_kwargs,
                    "default": default_kwargs.get(key, None)
                })

            scope, subcat = categorize_expectation(name, doc)
            if subcat not in categorized[scope]:
                categorized[scope][subcat] = []

            categorized[scope][subcat].append({
                "name": name,
                "description": doc,
                "arguments": args
            })

        except Exception as e:
            categorized["uncategorized"].setdefault("errors", []).append({
                "name": name,
                "description": "Could not load",
                "arguments": [],
                "error": str(e)
            })

    return categorized


def build_expectations_grouped(categorized_metadata, df: pd.DataFrame):
    per_column_result = {}
    table_expectations = {}
    column_names = df.columns.tolist()
    for col in df.columns:
        dtype = str(df[col].dtype)
        ge_dtype = "int"  # default

        if "int" in dtype:
            ge_dtype = "int"
        elif "float" in dtype:
            ge_dtype = "float"
        elif "bool" in dtype:
            ge_dtype = "boolean"
        elif "datetime" in dtype:
            ge_dtype = "datetime"
        else:
            ge_dtype = "string"

        per_column_result[col] = {}

        for category_name, expectations in categorized_metadata.get("column", {}).items():
            per_column_result[col][category_name] = []

            for exp in expectations:
                expectation_type = exp["name"]
                config = {
                    "expectation_type": expectation_type,
                    "kwargs": {}
                }

                for arg in exp.get("arguments", []):
                    name = arg["name"]
                    is_required = arg["required"]

                    if name == "column":
                        config["kwargs"][name] = col
                    elif name == "column_list":
                        config["kwargs"][name] = [col]
                    elif name == "type":
                        config["kwargs"][name] = ge_dtype
                    elif name == "value_set":
                        config["kwargs"][name] = ["dummy1", "dummy2"]
                    elif name == "value_pairs_set":
                        config["kwargs"][name] = [["valA", "valB"]]
                    elif name == "column_A":
                        config["kwargs"][name] = col
                    elif name == "column_B":
                        config["kwargs"][name] = df.columns[0] if df.columns[0] != col else df.columns[1]
                    elif name == "min_value":
                        config["kwargs"][name] = 0
                    elif name == "max_value":
                        config["kwargs"][name] = 100
                    elif name == "quantile_ranges":
                        config["kwargs"][name] = {
                            "quantiles": [0.25, 0.5, 0.75],
                            "value_ranges": [[0, 50], [30, 70], [60, 100]]
                        }
                    elif not is_required:
                        config["kwargs"][name] = arg.get("default")
                    else:
                        config["kwargs"][name] =  arg.get("default")

                per_column_result[col][category_name].append(config)

    # Process table-level expectations just once
    for category_name, expectations in categorized_metadata.get("table", {}).items():
        table_expectations[category_name] = []

        for exp in expectations:
            expectation_type = exp["name"]
            config = {
                "expectation_type": expectation_type,
                "kwargs": {}
            }

            for arg in exp.get("arguments", []):
                name = arg["name"]
                is_required = arg["required"]

                if name == "column_list":
                    config["kwargs"][name] = list(df.columns)
                elif name == "type":
                    config["kwargs"][name] = "table"
                elif not is_required:
                    config["kwargs"][name] = arg.get("default")
                else:
                    config["kwargs"][name] = f"<{name}_value>"

            table_expectations[category_name].append(config)

    return per_column_result, table_expectations, column_names






if __name__ == "__main__":


    data = build_metadata()
    with open("categorized_expectations.json", "w") as f:
        json.dump(data, f, indent=2)
    print("✅ Saved: categorized_expectations.json")
    with open("categorized_expectations.json") as f:
        categorized = json.load(f)
    categorized = build_metadata()


    all = collect_all_expectations()
    with open("all_expectations.json", "w") as f:
        json.dump(data, f, indent=2)

    columns = ["age", "salary", "department"]
    # Simulate a DataFrame to infer types
    dummy_df = pd.DataFrame({
        "age": [1, 2, 3],
        "salary": [1000.0, 2000.5, 3000.2],
        "department": ["HR", "IT", "Sales"]
    })




    column_expectations, table_expectations, column_names = build_expectations_grouped(categorized, dummy_df)
    # Get fully categorized expectations per column based on actual dtypes

    with open("per_column_expectations_filled.json", "w") as f:
        json.dump(column_expectations, f, indent=2)

    with open("table_expectations_filled.json", "w") as f:
        json.dump(table_expectations, f, indent=2)

    print("✅ Saved column + table expectations.")


