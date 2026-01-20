// src/hooks/useContractsRegistry.js
import { useEffect, useState } from "react";
import { BLOCKCHAIN_API } from "../api/blockchain";

export function useContractsRegistry(selectedNetwork) {
  const [byName, setByName] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const res = await BLOCKCHAIN_API.getRegistry();
        const rows = res.data?.data || [];
        const filtered = selectedNetwork
          ? rows.filter(r => r.network?.toLowerCase() === selectedNetwork.toLowerCase())
          : rows;
        const map = {};
        for (const r of filtered) map[r.name] = { address: r.address, abi: r.abi, network: r.network };
        if (mounted) setByName(map);
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [selectedNetwork]);

  return { byName, loading };
}
