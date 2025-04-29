import { EXPECTATIONS_API } from "../api/expectations";
import { toGEFormat } from "../utils/geFormatter";

export const ExpectationSaver = ({
  toast,
  showMessage,
  useCase,
  selectedExpectations,
  tableExpectations,
  selectedCategory,
  customCategory,
  selectedFileTypes,
  datasetId
}) => {
  return async () => {
    try {
      const suiteName = useCase.name;

      // Column descriptions
      const columnDescriptions = Object.fromEntries(
        Object.entries(selectedExpectations)
          .filter(([_, val]) => val.description)
          .map(([col, val]) => [col, val.description])
      );

      // Table expectation descriptions
      const tableExpectationDescriptions = Object.fromEntries(
        Object.entries(tableExpectations)
          .filter(([_, config]) => config._enabled && config.description)
          .map(([type, config]) => [type, config.description])
      );

      const columnNames = Object.keys(selectedExpectations);

      const filteredColumnExpectations = Object.entries(selectedExpectations).reduce((acc, [col, rules]) => {
        const enabledRules = Object.entries(rules).filter(([_, val]) => val._enabled);
        if (enabledRules.length > 0) {
          acc[col] = Object.fromEntries(enabledRules);
        }
        return acc;
      }, {});

      const filteredTableExpectations = Object.entries(tableExpectations).reduce((acc, [rule, config]) => {
        if (config._enabled) {
          acc[rule] = { ...config };
        }
        return acc;
      }, {});

      const geFormatted = toGEFormat(
        suiteName,
        filteredColumnExpectations,
        filteredTableExpectations,
        columnDescriptions,
        tableExpectationDescriptions
      );

      const payload = {
        suite_name: suiteName,
        datasource_name: "default",
        file_types: selectedFileTypes,
        expectations: geFormatted,
        category: selectedCategory === "other" ? customCategory : selectedCategory,
        description: useCase.description,
        use_case: suiteName,
        dataset_id: datasetId,
        column_descriptions: columnDescriptions, 
        column_names: columnNames,              
      };

      const response = await EXPECTATIONS_API.save(payload);
      showMessage(toast, "success", "Expectations saved successfully!");
      return { success: true, suite_id: response.data.suite_id };
    } catch (error) {
      showMessage(toast, "error", "Failed to save expectations");
      console.error(error);
      return { success: false };
    }
  };
};
