import React, { useEffect, useMemo, useState } from "react";
import { Dialog } from "primereact/dialog";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { InputNumber } from "primereact/inputnumber";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar"; // ⬅️ add
import { BLOCKCHAIN_API } from "../api/blockchain";
import "../styles/components/tx_dialog.css";


function short(s, head = 10, tail = 8) {
  if (!s) return "";
  const full = s.startsWith("0x") ? s : "0x" + s;
  return `${full.slice(0, head + (full.startsWith("0x") ? 0 : 2))}…${full.slice(-tail)}`;
}

function tsToLocal(tsSec) {
  if (!tsSec && tsSec !== 0) return "";
  const d = new Date(Number(tsSec) * 1000);
  // Localized string for quick reading; ISO in title
  return {
    text: d.toLocaleString(), // uses user locale/timezone
    iso: d.toISOString(),
  };
}

export default function ContractTxsDialog({ visible, onHide, contract }) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // filters
  const [blockFrom, setBlockFrom] = useState(null);
  const [blockTo, setBlockTo] = useState(null);
  const [status, setStatus] = useState(null); // 1 | 0 | null
  const [timeFrom, setTimeFrom] = useState(null); // Date | null
  const [timeTo, setTimeTo] = useState(null);     // Date | null

  // table state
  const [lazyParams, setLazyParams] = useState({
    first: 0,
    rows: 25,
    sortField: "block_number",
    sortOrder: -1, // desc
  });

  const address = contract?.address;
  const network = contract?.network;

  const params = useMemo(() => {
    const p = {
      network: network ? [network] : undefined,
      page: Math.floor(lazyParams.first / lazyParams.rows) + 1,
      perPage: lazyParams.rows,
      sort:
        (lazyParams.sortField || "block_number") +
        "," +
        (lazyParams.sortOrder === -1 ? "desc" : "asc"),
    };
    if (blockFrom) p.block_from = blockFrom;
    if (blockTo) p.block_to = blockTo;
    if (status === 0 || status === 1) p.status = status;

    // ⬇️ timestamp filtering (UNIX seconds)
    if (timeFrom instanceof Date) p.ts_from = Math.floor(timeFrom.getTime() / 1000);
    if (timeTo instanceof Date)   p.ts_to   = Math.floor(timeTo.getTime() / 1000);

    return p;
  }, [network, lazyParams, blockFrom, blockTo, status, timeFrom, timeTo]);

  useEffect(() => {
    if (!visible || !address) return;
    (async () => {
      setLoading(true);
      try {
        const { data } = await BLOCKCHAIN_API.getContractTxs(address, params);
        setRows(data?.data || []);
        setTotal(data?.filtered_total || 0);
      } finally {
        setLoading(false);
      }
    })();
  }, [visible, address, params]);

  const onPage = (e) => setLazyParams((p) => ({ ...p, first: e.first, rows: e.rows }));
  const onSort = (e) =>
    setLazyParams((p) => ({
      ...p,
      sortField: e.sortField || p.sortField,
      sortOrder: e.sortOrder ?? p.sortOrder,
    }));

  // reset when contract changes
  useEffect(() => {
    setLazyParams((p) => ({ ...p, first: 0 }));
    setBlockFrom(null);
    setBlockTo(null);
    setStatus(null);
    setTimeFrom(null);
    setTimeTo(null);
  }, [address]);

  const header = (
    <div className="tx-filters">
        <div className="txf-item">
        <InputNumber
            value={blockFrom}
            placeholder="Block From"
            onValueChange={(e) => setBlockFrom(e.value ?? null)}
        />
        </div>

        <div className="txf-item">
        <InputNumber
            value={blockTo}
            placeholder="Block To"
            onValueChange={(e) => setBlockTo(e.value ?? null)}
        />
        </div>

        <div className="txf-item">
        <Calendar
            value={timeFrom}
            onChange={(e) => setTimeFrom(e.value ?? null)}
            showTime
            hourFormat="24"
            placeholder="Time From"
            showIcon
        />
        </div>

        <div className="txf-item">
        <Calendar
            value={timeTo}
            onChange={(e) => setTimeTo(e.value ?? null)}
            showTime
            hourFormat="24"
            placeholder="Time To"
            showIcon
        />
        </div>

        <div style={{ flex: "0 0 auto" }}>
        <Button
            label="Clear"
            className="p-button-text p-button-sm"
            onClick={() => {
            setBlockFrom(null);
            setBlockTo(null);
            setStatus(null);
            setTimeFrom(null);
            setTimeTo(null);
            }}
        />
        </div>
    </div>
    );


  // tx hash cell (always 0x prefixed)
  const txBody = (r) => {
    const full = r?.tx_hash ? (r.tx_hash.startsWith("0x") ? r.tx_hash : "0x" + r.tx_hash) : "";
    if (!full) return "";
    const href =
      network === "mainnet"
        ? `https://etherscan.io/tx/${full}`
        : `https://${network}.etherscan.io/tx/${full}`;
    return (
      <a href={href} target="_blank" rel="noreferrer" title={full}>
        {short(full)}
      </a>
    );
  };

  const timeBody = (r) => {
    const { text, iso } = tsToLocal(r.block_timestamp) || {};
    return <span title={iso}>{text}</span>;
  };

  return (
    <Dialog
      header={contract ? `${contract.name} Transactions (${contract.network})` : "Transactions"}
      visible={visible}
      onHide={onHide}
      style={{ width: "90rem", maxWidth: "95vw" }}
      modal
    >
      <DataTable
        value={rows}
        loading={loading}
        paginator
        lazy
        rows={lazyParams.rows}
        first={lazyParams.first}
        totalRecords={total}
        sortField={lazyParams.sortField}
        sortOrder={lazyParams.sortOrder}
        onPage={onPage}
        onSort={onSort}
        rowsPerPageOptions={[10, 25, 50, 100]}
        header={header}
        dataKey="id"
        scrollable
      >
        <Column field="block_number" header="Block" sortable style={{ width: 120 }} />
        <Column field="tx_index" header="#" sortable style={{ width: 80 }} />
        <Column field="tx_hash" header="Tx Hash" sortable body={txBody} />
        <Column field="status" header="OK" sortable style={{ width: 80 }} body={(r) => (r.status === 1 ? "✓" : "✗")} />
        <Column field="value_wei" header="Value (wei)" sortable style={{ width: 200 }} />
        <Column field="gas_used" header="Gas Used" sortable style={{ width: 160 }} />
        <Column field="effective_gas_price" header="Gas Price" sortable style={{ width: 160 }} />
        <Column field="nonce" header="Nonce" sortable style={{ width: 100 }} />
        {/* ⬇️ human-readable time */}
        <Column field="block_timestamp" header="Time" sortable style={{ width: 220 }} body={timeBody} />
      </DataTable>
    </Dialog>
  );
}
