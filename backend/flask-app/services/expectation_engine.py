from utils.expectation_helpers import categorize_expectations
from utils.type_detection import dtype_map, guess_regex
import great_expectations as ge
from great_expectations.core.expectation_suite import ExpectationSuite

import logging
from great_expectations.core import ExpectationSuite
from great_expectations.expectations.expectation_configuration import ExpectationConfiguration

logger = logging.getLogger(__name__)

def run_expectation_suite(df, suite_wrapper):
    context = ge.get_context()
    assert type(context).__name__ == "EphemeralDataContext"

    logger.info("🔍 Received suite_wrapper:")
    logger.info(suite_wrapper)

    if not isinstance(suite_wrapper, dict):
        raise ValueError("suite_wrapper must be a dict")

    suite_name = suite_wrapper.get("expectation_suite_name", "default_suite")
    meta = suite_wrapper.get("meta", {})
    expectation_list = suite_wrapper.get("expectations", [])

    suite = ExpectationSuite(expectation_suite_name=suite_name, meta=meta)

    logger.info(f"🔁 Adding {len(expectation_list)} expectations to the suite...")
    for exp in expectation_list:
        try:
            if not isinstance(exp, dict):
                logger.warning(f"⚠️ Skipping non-dict expectation: {exp}")
                continue

            if "expectation_type" not in exp or "kwargs" not in exp:
                logger.warning(f"⚠️ Invalid expectation format: {exp}")
                continue

            kwargs = exp["kwargs"].copy()
            expectation_type = exp["expectation_type"]
            column = kwargs.get("column")

            # 🔍 Auto-fill types
            if column and column in df.columns:
                pandas_type = str(df[column].dtype)
                type_map = {
                    "object": "str",
                    "int64": "int",
                    "float64": "float",
                    "bool": "bool",
                    "datetime64[ns]": "datetime"
                }
                inferred_type = type_map.get(pandas_type, "str")

                if "type_" not in kwargs and "type" in expectation_type:
                    kwargs["type_"] = inferred_type
                    logger.info(f"🧠 Inferred type_='{inferred_type}' for {column}")

                if "type_list" in expectation_type and "type_list" not in kwargs:
                    kwargs["type_list"] = [inferred_type]
                    logger.info(f"🧠 Inferred type_list={kwargs['type_list']} for {column}")

            # ✅ Clean kwargs
            sanitized_kwargs = {
                k if k != "type" else "type_": v
                for k, v in kwargs.items()
                if v not in (None, "", [], {})
            }

            config = ExpectationConfiguration(
                expectation_type=expectation_type,
                kwargs=sanitized_kwargs,
                meta=exp.get("meta", {})
            )

            suite.add_expectation(config)
            logger.info(f"➕ Added: {expectation_type} with args: {sanitized_kwargs}")

        except Exception as e:
            logger.warning(f"❌ Failed to add expectation: {exp}")
            logger.exception(e)

    validator = ge.from_pandas(df, expectation_suite=suite)

    logger.info("✅ Running validation")
    results = validator.validate()

    logger.info("✅ Validation complete")
    return results.to_json_dict()





def run_table_expectations(ge_df, df, total_rows, categorized_expectations):
    table_expectations = []

    for category, rules in categorized_expectations.get("table", {}).items():
        for rule in rules:
            expectation = rule["name"]
            method = getattr(ge_df, expectation, None)
            if not callable(method):
                continue
            try:
                args = {}

                if "table_row_count_to_be_between" in expectation:
                    args["min_value"] = 0
                    args["max_value"] = total_rows
                if "table_row_count_to_equal" in expectation:
                    args["value"] = total_rows
                if "table_column_count_to_be_between" in expectation:
                    args["min_value"] = 0
                    args["max_value"] = len(df.columns)
                if "table_column_count_to_equal" in expectation:
                    args["value"] = len(df.columns)

                result = method(**args)
                table_expectations.append({
                    "name": expectation,
                    "success": result["success"],
                    "args": args
                })

            except Exception as e:
                print(f"⚠️ Skipping {expectation} for table: {e}")

    return table_expectations



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



def build_expectation_config (df):
    expectations = []
    column_names = df.columns.tolist()

    # Prompt construction for descriptions
  
    for col in df.columns:
        checks = {}

        pandas_type = str(df[col].dtype)
        is_numeric = pandas_type in ["int64", "float64"]

        if pandas_type == "object":
            ge_type = "str"
        elif "datetime64" in pandas_type:
            ge_type = "datetime"
        else:
            ge_type = dtype_map.get(pandas_type, "string")

        try:
            lengths = df[col].astype(str).str.len()
            avg_length = int(lengths.mean()) if not lengths.empty else None
        except Exception:
            avg_length = None

        regex_guess = guess_regex(df[col])
        categorized = categorize_expectations()
        for category, rules in categorized.items():
            if category == "table":
                continue
            for rule in rules:
                expectation = rule["name"]
                args = {}

                if "be_of_type" in expectation:
                    args["type"] = ge_type
                    args["column"] = col
                

                if "be_in_type_list" in expectation:
                    args["type_list"] = [ge_type]


                if "expect_column_to_exist" in expectation:
                    args["column_index"] = df.columns.get_loc(col)
                    args["column"] = col

                if "regex_list" in expectation:
                    args["regex_list"] = [regex_guess]
                elif "regex" in expectation:
                    args["regex"] = regex_guess


                if "set" in expectation :
                    args["value_set"] = []

                if "within_record" in expectation or "compound_columns" in expectation:
                    args["column_list"] = column_names

                if "quantile_values_to_be_between" in expectation:
                    args["quantile_ranges"] = {
                        "quantiles": [0.05, 0.95],
                        "value_ranges": [["", ""], ["", ""]]
                    }

                checks[expectation] = {"args": args}

        expectations.append({
            "column": col,
            "checks": checks
        })



    return expectations, build_table_expectation_args(df), column_names, categorized
 