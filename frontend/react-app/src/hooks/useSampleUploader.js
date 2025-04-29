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
    formData.append("suite_name", suiteName);

    try {
      setLoadingExpectations(true);

      const response = await EXPECTATIONS_API.uploadSample(formData);
      const { expectation_task_id, description_task_id, dataset_id } = response.data;

      setDatasetId(dataset_id);
      showMessage(toast, 'success', 'File uploaded!');

      const expectationResponse = await handleExpectations(expectation_task_id);
      const expectationResult = expectationResponse?.result || expectationResponse;

      setLoadingExpectations(false);

      // ✅ Handle column-level expectations
      const initialExpectations = {};
      const allColumnData = expectationResult.expectations || {};
      const columnNames = expectationResult.column_names || [];

      for (const column of columnNames) {
        const categories = allColumnData[column];
        if (!categories) continue;

        initialExpectations[column] = {};

        for (const [category, rules] of Object.entries(categories)) {
          for (const rule of rules) {
            initialExpectations[column][rule.expectation_type] = {
              ...(rule.kwargs || {}),
              _enabled: false
            };
          }
        }
      }

      // ✅ Handle table-level expectations
      const initialTableExpectations = {};
      const tableData = expectationResult.table_expectations || {};

      for (const rules of Object.values(tableData)) {
        for (const rule of rules) {
          const args = rule.kwargs || {};
          const hasValues = Object.values(args).some(v => v !== null && v !== "");

          initialTableExpectations[rule.expectation_type] = {
            ...args,
            _enabled: false
          };
        }
      }

      // ✅ State update
      setSelectedExpectations(initialExpectations);
      setTableExpectations(initialTableExpectations);
      setSuiteName(dataset_id || "default_dataset");

      showMessage(toast, 'success', 'Expectations completed!');
      setActiveIndex(prev => prev + 1);

      // ✅ Handle descriptions (optional)
      if (description_task_id) {
        setLoadingDescriptions(true);

        const descriptionResult = await handleDescriptions(description_task_id);

        setSelectedExpectations(prev => {
          const updated = { ...prev };
          descriptionResult.forEach(({ column, description }) => {
            if (updated[column]) {
              updated[column].description = description;
            }
          });
          return updated;
        });

        setLoadingDescriptions(false);
      }

    } catch (err) {
      setLoadingExpectations(false);
      setLoadingDescriptions(false);
      showMessage(toast, 'error', err.message || 'Failed to process file.');
      console.error(err);
    }
  };
};
