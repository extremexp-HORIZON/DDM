import { useEffect, useState } from 'react';
import { VALIDATIONS_API } from '../api/validations';
import { showMessage } from '../utils/messages';

export const useValidationResult = (suiteId, datasetId, toast) => {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await VALIDATIONS_API.getAllResults({
          dataset_id: [datasetId],
          suite_id: suiteId,
        });
        const data = res.data?.data;
        if (data && data.length > 0) {
          setResult(data[0]);  // use first matching result
        } else {
          showMessage(toast, 'warn', 'No results found for this suite and dataset.');
        }
      } catch (error) {
        console.error(error);
        showMessage(toast, 'error', 'Failed to fetch validation results.');
      } finally {
        setLoading(false);
      }
    };

    if (suiteId && datasetId) {
      fetchData();
    }
  }, [suiteId, datasetId, toast]);

  return { result, loading };
};
