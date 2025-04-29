from utils.expectation_helpers import categorize_expectation, get_expectation_impl,list_registered_expectation_implementations, extract_default_kwargs, extract_domain_kwargs, extract_success_keys
import great_expectations as ge
import pandas as pd
import logging

_metadata_cache = None
logger = logging.getLogger(__name__)


def run_expectation_suite(df, suite_wrapper):
    context = ge.get_context()
    suite_name = suite_wrapper.get("suite_name", "default_suite")
    logger.info(f"Running expectation suite: {suite_name}")
    logger.info(f"Wrapper: {suite_wrapper}")

    # 🔥 Correct way: expectations is directly a list
    expectations = suite_wrapper.get("expectations", [])
    meta = {
        "column_descriptions": suite_wrapper.get("column_descriptions"),
        "column_names": suite_wrapper.get("column_names"),
        
    }

    datasource_name = "xxp-ddm"
    asset_name = "my_dataframe_asset"
    batch_definition_name = "batch_def"

    try:
        datasource = context.data_sources.get(datasource_name)
    except Exception:
        datasource = context.data_sources.add_pandas(name=datasource_name)

    try:
        asset = datasource.get_asset(asset_name)
    except Exception:
        asset = datasource.add_dataframe_asset(name=asset_name)

    try:
        batch_def = asset.get_batch_definition(batch_definition_name)
    except Exception:
        batch_def = asset.add_batch_definition_whole_dataframe(batch_definition_name)

    batch = batch_def.get_batch(batch_parameters={"dataframe": df})

    suite = ge.core.ExpectationSuite(name=suite_name, meta=meta)
    validator = context.get_validator(batch=batch, expectation_suite=suite)

    for exp in expectations:
        try:
            expectation_type = exp["expectation_type"]
            kwargs = exp["kwargs"]
            expectation_method = getattr(validator, expectation_type)
            expectation_method(**kwargs)
        except Exception as e:
            logger.warning(f"⚠️ Failed to add expectation: {exp} | {e}")

    validator.expectation_suite.meta = meta
    results = validator.validate()

    return results.to_json_dict(), meta




def build_table_expectation_args(df):
    total_rows = len(df)
    total_columns = len(df.columns)

    table_expectations = {
        "volume": [],
        "schema": []
    }

    # Row count equal
    table_expectations["volume"].append({
        "name": "expect_table_row_count_to_equal",
        "description": "Expect the number of rows to equal a value.",
        "arguments": [
            {"name": "value", "expected_value": total_rows}
        ],
        "args": {"value": total_rows}
    })

    # Row count between
    table_expectations["volume"].append({
        "name": "expect_table_row_count_to_be_between",
        "description": "Expect the number of rows to be between two values.",
        "arguments": [
            {"name": "min_value", "expected_value": "" },
            {"name": "max_value", "expected_value": total_rows}
        ],
        "args": {
            "min_value": 0,
            "max_value": total_rows
        }
    })

    # Column count equal
    table_expectations["schema"].append({
        "name": "expect_table_column_count_to_equal",
        "description": "Expect the number of columns to equal a value.",
        "arguments": [
            {"name": "value", "expected_value": ""}
        ],
        "args": {"value": ""}
    })

    # Column count between
    table_expectations["schema"].append({
        "name": "expect_table_column_count_to_be_between",
        "description": "Expect the number of columns to be between two values.",
        "arguments": [
            {"name": "min_value", "expected_value": 0 },
            {"name": "max_value", "expected_value": total_columns}
        ],
        "args": {
            "min_value": 0,
            "max_value": total_columns
        }
    })

    return table_expectations



def build_metadata():
    global _metadata_cache
    if _metadata_cache is not None:
        return _metadata_cache

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

    _metadata_cache = categorized
    return _metadata_cache


def extract_expectation_descriptions(expectations, metadata):
    """Extracts a mapping of expectation type to human-readable descriptions and categories."""
    if not expectations:
        return {}

    description_map = {}

    def find_description_and_category(expectation_type):
        for scope in ("column", "table"):
            for category, exp_list in metadata.get(scope, {}).items():
                for exp in exp_list:
                    if exp["name"] == expectation_type:
                        return {
                            "description": exp.get("description", "No description available."),
                            "category": category
                        }
        return {
            "description": "No description available.",
            "category": "uncategorized"
        }

    for exp in expectations:
        exp_type = exp.get("expectation_type")
        if exp_type and exp_type not in description_map:
            description_map[exp_type] = find_description_and_category(exp_type)

    return description_map



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
                description = exp.get("description", "")
                config = {
                    "expectation_type": expectation_type,
                    "description": description,
                    "kwargs": {}
                }

                for arg in exp.get("arguments", []):
                    name = arg["name"]
                    is_required = arg["required"]

                    if name == "column":
                        config["kwargs"][name] = col
                    elif name == "column_index":
                        config["kwargs"][name] = df.columns.get_loc(col)
                    elif name == "column_list":
                        config["kwargs"][name] = [col]
                    elif name == "type_":
                        config["kwargs"][name] = ge_dtype
                    elif name == "type_list":
                        config["kwargs"][name] = [ge_dtype]
                    elif name == "json_schema":
                        config["kwargs"][name] = {
                            "type": ge_dtype
                        }
                    elif name == "strict_min":
                        config["kwargs"][name] = False  
                    elif name == "strict_max":
                        config["kwargs"][name] = False  
                    elif name == "mostly":
                        config["kwargs"][name] = 0.95  
                    elif name == "column_A":
                        config["kwargs"][name] = col
                    elif name == "column_B":
                        config["kwargs"][name] = df.columns[0] if df.columns[0] != col else df.columns[1]
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
            description = exp.get("description", "")
            config = {
                "expectation_type": expectation_type,
                "description": description,
                "kwargs": {}
            }

            for arg in exp.get("arguments", []):
                name = arg["name"]
                is_required = arg["required"]

                if name == "column_list":
                    config["kwargs"][name] = list(df.columns)
                elif name == "column_set":
                    config["kwargs"][name] = list(df.columns)
                elif not is_required:
                    config["kwargs"][name] = arg.get("default")
                elif name == "strict_min":
                    config["kwargs"][name] = False  
                elif name == "strict_max":
                    config["kwargs"][name] = False 
                elif name == "exact_match":
                    config["kwargs"][name] = False 
                else:
                    config["kwargs"][name] =  arg.get("default")


            table_expectations[category_name].append(config)

    return per_column_result, table_expectations, column_names


