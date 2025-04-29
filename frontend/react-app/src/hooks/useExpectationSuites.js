import { useState, useCallback, useEffect } from "react";
import { EXPECTATIONS_API } from "../api/expectations";
import { showMessage } from "../utils/messages";

export const useExpectationSuites = (filters, toast) => {
  const [suites, setSuites] = useState([]);
  const [lazyParams, setLazyParams] = useState({
    first: 0,
    rows: 10,
    sortOrder: -1,
    sortField: "created",
    filters: {},
  });

  const [loading, setLoading] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);

  const loadSuites = useCallback(async () => {
    setLoading(true);
    const { first, rows, sortField, sortOrder } = lazyParams;

    const formatFilters = (v) =>
      !v || v.length === 0 ? undefined : Array.isArray(v) ? v.join(",") : v;

    const params = {
      page: Math.floor(first / rows) + 1,
      perPage: rows,
      sort: `${sortField},${sortOrder === 1 ? "asc" : "desc"}`,
      suite_name: formatFilters(filters.suite_name),
      file_types: formatFilters(filters.file_types),
      category: formatFilters(filters.category),
      use_case: formatFilters(filters.use_case),
      user_id: formatFilters(filters.user_id),
      created_from: filters.created_from?.toISOString(),
      created_to: filters.created_to?.toISOString(),
    };

    try {
      const res = await EXPECTATIONS_API.getAllSuites(params);
      setSuites(res.data.data || []);
      setTotalRecords(res.data.filtered_total || res.data.total || 0);
    } catch (err) {
      showMessage(toast, "error", err.message || "Failed to fetch expectation suites.");
    } finally {
      setLoading(false);
    }
  }, [lazyParams, filters, toast]);

  useEffect(() => {
    loadSuites();
  }, [loadSuites]);

  return {
    suites,
    setSuites,
    lazyParams,
    setLazyParams,
    loading,
    totalRecords,
    reload: loadSuites,
  };
};
