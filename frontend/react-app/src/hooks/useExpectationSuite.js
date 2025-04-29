import { useState } from 'react';
import { EXPECTATIONS_API } from '../api/expectations';

export const useExpectationSuite = () => {
  const [suite, setSuite] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchSuite = async (suiteId) => {
    setLoading(true);
    setError(null);
    try {
      const res = await EXPECTATIONS_API.getSuiteById(suiteId);
      setSuite(res.data);
    } catch (err) {
      setError(err.message || "Failed to fetch suite");
    } finally {
      setLoading(false);
    }
  };

  return { suite, fetchSuite, loading, error };
};
