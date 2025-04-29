import { useState, useCallback, useEffect } from "react";
import { VALIDATIONS_API } from "../api/validations";
import { showMessage } from "../utils/messages";

export const useValidationResults = (filters, toast) => {
    const [results, setResults] = useState([]);
    const [lazyParams, setLazyParams] = useState({
        first: 0,
        rows: 10,
        sortOrder: -1,
        sortField: "run_time",
        filters: {},
    });

    const [loading, setLoading] = useState(false);
    const [totalRecords, setTotalRecords] = useState(0);

    // Reset pagination to first page on filters change
    useEffect(() => {
        setLazyParams((prev) => ({ ...prev, first: 0 }));
    }, [filters]);

    const loadResults = useCallback(async () => {
    
        setLoading(true);
        const { first, rows, sortField, sortOrder } = lazyParams;

        const formatFilters = (v) =>
            !v || v.length === 0 ? undefined : Array.isArray(v) ? v.join(",") : v;

        const params = {
            page: Math.floor(first / rows) + 1,
            perPage: rows,
            sort: `${sortField},${sortOrder === 1 ? "asc" : "desc"}`,
            dataset_name: formatFilters(filters?.dataset_name || []),
            dataset_id: filters?.dataset_id,
            user_id: formatFilters(filters?.user_id || []),
            suite_id: formatFilters(filters?.suite_id || []),
            run_time_from: filters?.run_time_from?.toISOString(),
            run_time_to: filters?.run_time_to?.toISOString(),
        };

        try {
            const res = await VALIDATIONS_API.getAllResults(params);
            console.log("Fetched results:", res.data?.data);
            const fetched = Array.isArray(res.data) ? res.data : res.data?.data || [];
            setResults(fetched);

            setTotalRecords(res.data?.filtered_total || res.data?.total || fetched.length || 0);
        } catch (err) {
            showMessage(toast, "error", err.message || "Failed to fetch expectation results.");
        } finally {
            setLoading(false);
        }
    }, [lazyParams, filters, toast]);

    useEffect(() => {
        loadResults();
    }, [lazyParams, loadResults]); // REMOVE `filters` from deps
      
  

  return {
    results,
    setResults,
    lazyParams,
    setLazyParams,
    loading,
    totalRecords,
    reload: loadResults,
  };
};
