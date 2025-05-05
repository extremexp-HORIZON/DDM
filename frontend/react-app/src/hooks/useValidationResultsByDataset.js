// src/hooks/useValidationResultsByDataset.js
import { useState } from "react";
import { VALIDATIONS_API } from "../api/validations";
import { showMessage } from "../utils/messages";

export const useValidationResultsByDataset = (toast) => {
  const [validationResults, setValidationResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchValidationResults = async (datasetId) => {
    setLoading(true);
    try {
      const res = await VALIDATIONS_API.getAllResults({ dataset_id: datasetId });
      const results = Array.isArray(res.data?.data) ? res.data.data : [];
      setValidationResults(results);
      return results;  // optional if you want to do something extra immediately
    } catch (error) {
      console.error(error);
      showMessage(toast, "error", "Failed to fetch validation results.");
      throw error;  // rethrow if caller needs to know
    } finally {
      setLoading(false);
    }
  };

  return { validationResults, fetchValidationResults, loading };
};
