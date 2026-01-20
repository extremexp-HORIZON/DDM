// src/hooks/useContracts.js
import { useState, useCallback, useEffect, useRef } from "react";
import { BLOCKCHAIN_API } from "../api/blockchain";
import { showMessage } from "../utils/messages";

export const useContracts = (filters, toast) => {
  const [contracts, setContracts] = useState([]);
  const [lazyParams, setLazyParams] = useState({
    first: 0,
    rows: 25,
    sortOrder: -1,
    sortField: "id",
  });
  const [loading, setLoading] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);
  const abortRef = useRef(null);

  const fmt = (v) =>
    !v || v.length === 0 ? undefined : Array.isArray(v) ? v.join(",") : v;

  const loadContracts = useCallback(async () => {
    // cancel previous in-flight
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    const { first, rows, sortField, sortOrder } = lazyParams;

    const params = {
      page: Math.floor(first / rows) + 1,
      perPage: rows,
      sort: `${sortField},${sortOrder === 1 ? "asc" : "desc"}`,
      network: fmt(filters.network),
      name: fmt(filters.name),
      status: fmt(filters.status),
      address: fmt(filters.address),
      withEventsCount: 1,
    };

    try {
      const res = await BLOCKCHAIN_API.getContracts(params, {
        signal: controller.signal,        // <— AbortController now works
      });
      const body = res.data || {};
      const total =
        body.filtered_total ??
        body.total ??
        Number(res.headers?.["x-total-count"]) ??
        0;

      setContracts(body.data || []);
      setTotalRecords(total);
    } catch (err) {
      if (err.name === "CanceledError" || err.name === "AbortError") return;
      showMessage(toast, "error", "Load contracts failed", err.message);
    } finally {
      setLoading(false);
    }
  }, [lazyParams, filters, toast]);

  // One effect to fetch when table params (or filters) change.
  // We derive a stable key so StrictMode won’t double-fetch different queries.
  const queryKey = JSON.stringify({
    lp: lazyParams,
    f: {
      network: fmt(filters.network),
      name: fmt(filters.name),
      status: fmt(filters.status),
      address: fmt(filters.address),
    },
  });

  useEffect(() => {
    loadContracts();
    return () => abortRef.current?.abort();
  }, [queryKey, loadContracts]);

  // When filters change, reset page ONLY (don’t fetch here).
  useEffect(() => {
    setLazyParams((prev) => ({ ...prev, first: 0 }));
  }, [JSON.stringify(filters)]);

  return {
    contracts,
    setContracts,
    lazyParams,
    setLazyParams,
    loading,
    totalRecords,
    reload: loadContracts,
  };
};
