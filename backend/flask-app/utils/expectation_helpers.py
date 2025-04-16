from great_expectations.expectations.registry import (
    list_registered_expectation_implementations,
    get_expectation_impl
)

ALL_EXPECTATIONS = list_registered_expectation_implementations()


def categorize_expectations():
    categorized = {"table": {"volume": [], "schema": []}}
    for category, expectations in CATEGORIZED_EXPECTATIONS.items():
        categorized[category] = []
    
    expectation_details = get_expectation_details()
    
    for exp_info in expectation_details:
        exp_name = exp_info["name"]
        for category, expectations in CATEGORIZED_EXPECTATIONS.items():
            if exp_name in expectations:
                categorized[category].append(exp_info)
        for category, expectations in TABLE_EXPECTATIONS.items():
            if exp_name in expectations:
                categorized["table"][category].append(exp_info)
    
    return categorized

def build_expectation_args(df, ge_df, col, categorized_expectations):
    result_dict = {}
    for category, rules in categorized_expectations.items():
        if category == "table":
            continue

        for rule in rules:
            expectation = rule["name"]
            method = getattr(ge_df, expectation, None)
            if not method:
                continue

            try:
                args = {"column": col}
                # Example: you can implement similar conditional logic from your original script
                result = method(**args)
                result_dict[expectation] = {
                    "success": result["success"],
                    "args": args
                }
            except Exception as e:
                print(f"⚠️ Skipping {expectation} for column {col}: {e}")

    return result_dict



def get_expectation_details():
    exclude_arguments = {"profiler_config", "meta", "row_condition", "condition_parser", "include_config", "catch_exceptions", "result_format", "auto","ignore_row_if"}
    expectation_details = []
    
    for exp in ALL_EXPECTATIONS:
        try:
            exp_class = get_expectation_impl(exp)
            description = exp_class.__doc__.strip().split("\n")[0] if exp_class.__doc__ else "No description available"
            default_args = getattr(exp_class, "default_kwarg_values", {})
            
            filtered_arguments = [
                {"name": key, "expected_value": default_args[key]}
                for key in default_args.keys()
                if key not in exclude_arguments
            ]

            expectation_info = {
                "name": exp,
                "description": description,
                "arguments": filtered_arguments
            }
            expectation_details.append(expectation_info)
        except Exception as e:
            expectation_details.append({"name": exp, "error": str(e)})
    
    return expectation_details



CATEGORIZED_EXPECTATIONS = {
    "uniqueness": [
        "expect_column_values_to_be_unique",
        "expect_column_distinct_values_to_be_in_set", 
        "expect_column_distinct_values_to_contain_set",
        "expect_column_distinct_values_to_equal_set", 
        "expect_column_proportion_of_unique_values_to_be_between",
        "expect_column_unique_value_count_to_be_between", 
        "expect_compound_columns_to_be_unique",
        "expect_select_column_values_to_be_unique_within_record"
    ],
    "completeness": [
        "expect_column_values_to_not_be_null", 
        "expect_column_values_to_be_null"
    ],
    "numeric": [
        "expect_column_values_to_be_between", 
        "expect_column_max_to_be_between",
        "expect_column_min_to_be_between",
        "expect_column_mean_to_be_between", 
        "expect_column_median_to_be_between",
        "expect_column_stdev_to_be_between",
        "expect_column_sum_to_be_between",
        "expect_column_kl_divergence_to_be_less_than", 
        "expect_column_quantile_values_to_be_between", 
        "expect_column_value_z_scores_to_be_less_than",
        
    ],
    "schema": [
        "expect_column_to_exist", 
        "expect_column_values_to_be_of_type",
        "expect_column_values_to_be_in_type_list",
    ],
    "validity": [
        "expect_column_values_to_match_regex",
        "expect_column_values_to_not_match_regex",
        "expect_column_values_to_match_regex_list",
        "expect_column_values_to_not_match_regex_list"
        "expect_column_values_to_be_in_set",
        "expect_column_values_to_not_be_in_set", 
        "expect_column_most_common_value_to_be_in_set",
        "expect_column_value_lengths_to_be_between", 
        "expect_column_value_lengths_to_equal", 
    ]
}

# Categorized expectations for tables
TABLE_EXPECTATIONS = {
    "volume": [
        "expect_table_row_count_to_be_between", 
        "expect_table_row_count_to_equal",
    ],
    "schema": [
        "expect_table_column_count_to_be_between", 
        "expect_table_column_count_to_equal"
    ]
}

