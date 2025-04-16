import { EXPECTATIONS_API } from "../api/expectations";

export const useSampleUploader = ({
  toast,
  showMessage,
  handleExpectations,
  handleDescriptions,
  setSelectedExpectations,
  setTableExpectations,
  setSuiteName,
  setLoadingExpectations,
  setLoadingDescriptions,
  setActiveIndex,
  setDatasetId,
  suiteName 
}) => {
  return async (event) => {
    const file = event.files[0];
    if (!file) {
      showMessage(toast, 'error', 'No file uploaded!');
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("suite_name", suiteName)

    try {
      setLoadingExpectations(true);
      const response = await EXPECTATIONS_API.uploadSample(formData);
      const { expectation_task_id, description_task_id, dataset_id } = response.data;
      setDatasetId(dataset_id);
      showMessage(toast, 'success', 'File uploaded!');
      const expectationResult = await handleExpectations(expectation_task_id);
      setLoadingExpectations(false);

      // Column-level expectations
      const initialExpectations = {};
      if (Array.isArray(expectationResult.expectations)) {
        expectationResult.expectations.forEach(exp => {
          const column = exp.column;
          if (!initialExpectations[column]) initialExpectations[column] = {};
          Object.entries(exp.checks || {}).forEach(([checkName, checkDetails]) => {
            initialExpectations[column][checkName] = {
              ...(checkDetails.args || {}),
              _enabled: false
            };
          });
        });
      }

      // Table-level expectations
      const initialTableExpectations = {};
      const tableRules = expectationResult.categorized?.table || {};
      const tableValues = Object.values(expectationResult.table_expectations || {}).flat();

      for (const rules of Object.values(tableRules)) {

        for (const rule of rules) {
          const defaultArgs = (rule.arguments || []).reduce((acc, arg) => {
            acc[arg.name] = arg.expected_value ?? "";
            return acc;
          }, {});

          const matchedRule = tableValues.find(exp => exp.name === rule.name);
          const providedArgs = matchedRule?.args || {};

          initialTableExpectations[rule.name] = {
            ...defaultArgs,
            ...providedArgs,
            _enabled: false
          };
        }
      }

      // Final state updates
      setSelectedExpectations(initialExpectations);
      setTableExpectations(initialTableExpectations);
      setSuiteName(dataset_id || "default_dataset");

      showMessage(toast, 'success', 'Expectations completed!');
      setActiveIndex(prev => prev + 1);

      // Descriptions
      setLoadingDescriptions(true);
      const descriptionResult = await handleDescriptions(description_task_id);
      setSelectedExpectations(prev => {
        const updated = { ...prev };
        descriptionResult.forEach(({ column, description }) => {
          if (updated[column]) updated[column].description = description;
        });
        return updated;
      });
      setLoadingDescriptions(false);

    } catch (err) {
      setLoadingExpectations(false);
      setLoadingDescriptions(false);
      showMessage(toast, 'error', err.message || 'Failed to process file.');
      console.error(err);
    }
  };
};
