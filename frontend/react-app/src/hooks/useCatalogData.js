import { useState, useCallback, useEffect } from "react";
import { CATALOG_API } from "../api/catalog";
import { showMessage } from "../utils/messages";

export const useCatalogData = (filters, toast) => {
  const [datasets, setDatasets] = useState([]);
  const [lazyParams, setLazyParams] = useState({
    first: 0,
    rows: 10,
    sortOrder: -1,
    sortField: "created",
    filters: {},
  });

  const [loading, setLoading] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);
  const [filteredRecords, setFilteredRecords] = useState(0);

  const loadLazyData = useCallback(async () => {
    setLoading(true);
    const { first, rows, sortField, sortOrder } = lazyParams;

    const formatFilters = (v) => (!v || v.length === 0 ? undefined : Array.isArray(v) ? v.join(",") : v);
    
    const normalizeFileTypes = (fileTypes) => {
      if (!fileTypes || fileTypes.length === 0) return undefined;
      return fileTypes.map(ft => ft.replace(/^\./, '').toLowerCase()).join(",");
    };


    const params = {
      page: Math.floor(first / rows) + 1,
      perPage: rows,
      sort: `${sortField},${sortOrder === 1 ? "asc" : "desc"}`,
      filename: formatFilters(filters.filename),
      user_id: formatFilters(filters.user_id),
      use_case: formatFilters(filters.use_case),
      file_type: normalizeFileTypes(filters.file_types),
      project_id: formatFilters(filters.project_id),
      parent_files: formatFilters(filters.parent_files),
      size_from: filters.size_from ? parseInt(filters.size_from, 10) : undefined,
      size_to: filters.size_to ? parseInt(filters.size_to, 10) : undefined,
      created_from: filters.fromDate?.toISOString(),
      created_to: filters.toDate?.toISOString(),
    };

    try {
      const data = await CATALOG_API.fetchCatalog(params);
      setDatasets(data.data);
      setTotalRecords(data.total);
      setFilteredRecords(data.filtered_total || data.total);
    } catch (err) {
      showMessage(toast, "error", err.message || "Failed to fetch datasets.");
    } finally {
      setLoading(false);
    }
  }, [lazyParams, filters, toast]);

  useEffect(() => {
    loadLazyData();
  }, [loadLazyData]);

  return {
    datasets,
    setDatasets,
    lazyParams,
    setLazyParams,
    loading,
    totalRecords,
    filteredRecords,
    reload: loadLazyData,
  };
};
