// src/hooks/useContractEvents.js
import { useState, useCallback, useEffect, useRef } from "react";
import { BLOCKCHAIN_API } from "../api/blockchain";
import { showMessage } from "../utils/messages";

export const useContractEvents = (contractRow, toast) => {
  const [events, setEvents] = useState([]);
  const [lazyParams, setLazyParams] = useState({
    first: 0,
    rows: 50,
    sortField: "block_number",
    sortOrder: -1,
  });
  const [loading, setLoading] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);
  const abortRef = useRef(null);

  const address = contractRow?.address?.toLowerCase?.();
  const network = contractRow?.network;

  const load = useCallback(async () => {
    if (!address) return;

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    const { first, rows, sortField, sortOrder } = lazyParams;

    const params = {
      page: Math.floor(first / rows) + 1,
      perPage: rows,
      sort: `${sortField},${sortOrder === 1 ? "asc" : "desc"}`,
      network,
    };

    try {
      const res = await BLOCKCHAIN_API.getContractEvents(address, params, {
        signal: controller.signal,
      });
      setEvents(res.data.data || []);
      setTotalRecords(res.data.filtered_total ?? res.data.total ?? 0);
    } catch (err) {
      if (err.name === "CanceledError" || err.name === "AbortError") return;
      const msg = err?.response?.data?.message || err?.message || "Failed to fetch events.";
      showMessage(toast, "error", "Load events failed", msg);
    } finally {
      setLoading(false);
    }
  }, [address, network, lazyParams, toast]);

  const queryKey = JSON.stringify({ lp: lazyParams, address, network });

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
  }, [queryKey, load]);

  // if contract changes, reset pagination only
  useEffect(() => {
    setLazyParams((p) => ({ ...p, first: 0 }));
  }, [address]);

  return {
    events,
    loading,
    totalRecords,
    lazyParams,
    setLazyParams,
    reload: load,
  };
};
