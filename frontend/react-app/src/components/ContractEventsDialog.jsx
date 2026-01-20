// src/components/ContractEventsDialog.jsx
import React, { useMemo } from "react";
import { Dialog } from "primereact/dialog";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { useToast } from "../context/ToastContext";
import { useContractEvents } from "../hooks/useContractEvents";

function shortTx(h) {
  if (!h) return "";
  const full = h.startsWith("0x") ? h : "0x" + h;
  return `${full.slice(0, 12)}…${full.slice(-8)}`;
}

// --- helpers (add/replace) ---
const IPFS_RE = /^ipfs:\/\/([^/]+)(?:\/(.*))?$/i;

// helper to turn ipfs:// into a public HTTP gateway (if you aren't already doing so)
const ipfsToHttp = (u) =>
  typeof u === "string" && u.startsWith("ipfs://")
    ? `https://ipfs.io/ipfs/${u.replace("ipfs://", "")}`
    : u;

function IpfsActions({ uri, TAG_H = 34, onCopied }) {
  const http = ipfsToHttp(uri);

  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(uri);
      onCopied?.();
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = uri;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      onCopied?.();
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        size="small"
        icon="pi pi-external-link"
        className="p-button-text p-button-rounded"
        tooltip={`Open ${uri} in new tab`}
        tooltipOptions={{ position: "top" }}
        onClick={() => http && window.open(http, "_blank", "noopener,noreferrer")}
        disabled={!http}
        aria-label="Open IPFS URI in new tab"
        style={{ height: TAG_H, width: TAG_H }}
      />
      <Button
        size="small"
        icon="pi pi-copy"
        className="p-button-text p-button-rounded"
        tooltip={`Copy ${uri}`}
        tooltipOptions={{ position: "top" }}
        onClick={doCopy}
        aria-label="Copy IPFS URI"
        style={{ height: TAG_H, width: TAG_H }}
      />
    </div>
  );
}

const collectIpfsFields = (obj, path = []) => {
  const out = [];
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj)) {
      const p = [...path, k];
      if (typeof v === "string" && IPFS_RE.test(v)) out.push({ path: p, key: k, value: v });
      else if (v && typeof v === "object") out.push(...collectIpfsFields(v, p));
    }
  } else if (Array.isArray(obj)) {
    obj.forEach((v, i) => {
      const p = [...path, i];
      if (typeof v === "string" && IPFS_RE.test(v)) out.push({ path: p, key: String(i), value: v });
      else if (v && typeof v === "object") out.push(...collectIpfsFields(v, p));
    });
  }
  return out;
};

const pathLabel = (path) =>
  path.map((p) => (typeof p === "number" ? `[${p}]` : String(p))).join(".");

const ipfsKindFromPath = (pathArr) => {
  const last = String(pathArr[pathArr.length - 1] || "").toLowerCase();
  if (last.includes("docsuri")) return "docs";
  if (last.includes("suiteuri")) return "suite";
  if (last.includes("certificateuri")) return "cert";
  return "other";
};

const Explorer = {
  // extend as needed
  sepolia: (tx) => `https://sepolia.etherscan.io/tx/${tx}`,
  mainnet: (tx) => `https://etherscan.io/tx/${tx}`,
  holesky: (tx) => `https://holesky.etherscan.io/tx/${tx}`,
};
const txUrl = (network, hash) =>
  (Explorer[network] || Explorer.mainnet)(hash);

// --- compact & aligned row for one IPFS field (replace existing IpfsRow) ---
function IpfsRow({ label, uri, gatewayBase = "https://ipfs.io/ipfs/" }) {
  const http = ipfsToHttp(uri, gatewayBase);

  // fixed geometry so every row aligns perfectly
  const TAG_W = 120;
  const TAG_H = 28;

  // robust dark-mode detection (once on mount)
  const isDark = useMemo(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }, []);

  // solid colors that pop in both modes
  const COLOR = useMemo(() => {
    const paletteLight = {
      docs: { bg: "#FACC15", fg: "#111" }, // yellow
      suite: { bg: "#22C55E", fg: "#fff" }, // green
      cert: { bg: "#3B82F6", fg: "#fff" }, // blue
      other: { bg: "#9CA3AF", fg: "#111" }, // gray
    };
    const paletteDark = {
      docs: { bg: "#B45309", fg: "#fff" }, // warm amber
      suite: { bg: "#16A34A", fg: "#fff" },
      cert: { bg: "#2563EB", fg: "#fff" },
      other: { bg: "#6B7280", fg: "#fff" },
    };
    return isDark ? paletteDark : paletteLight;
  }, [isDark]);

  const kind = ipfsKindFromPath(label.split("."));
  const { bg, fg } = COLOR[kind] || COLOR.other;

  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(uri);
    } catch {}
  };
  const toast = useToast();

  return (
    <div
      className="ipfs-row"
      style={{
        display: "grid",
        gridTemplateColumns: `${TAG_W}px 1fr auto`,
        alignItems: "center",
        gap: 8,
        minHeight: TAG_H,
        marginBottom: 6,
      }}
    >
      {/* fixed-size badge */}
      <span
        title={label}
        style={{
          width: TAG_W,
          height: TAG_H,
          borderRadius: 999,
          background: bg,
          color: fg,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: 0.2,
          textTransform: "none",
          userSelect: "none",
          boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.08)",
        }}
      >
        {label}
      </span>

      {/* URI bubble */}
      <div
        className="p-inputgroup"
        style={{ maxWidth: 560, height: TAG_H, alignItems: "stretch" }}
      >
        <IpfsActions uri={uri} TAG_H={32} onCopied={() => toast.current?.show({
          severity: "info",
          summary: "Copied",
          detail: "IPFS URI copied to clipboard",
          life: 2000
        })} />

      </div>
    </div>
  );
}



export default function ContractEventsDialog({ visible, onHide, contract }) {
  const {
    events,
    loading,
    totalRecords,
    lazyParams,
    setLazyParams,
  } = useContractEvents(contract, /* toast */ null);

  const onPage = (e) => setLazyParams((p) => ({ ...p, first: e.first, rows: e.rows }));
  const onSort = (e) =>
    setLazyParams((p) => ({
      ...p,
      sortField: e.sortField || p.sortField,
      sortOrder: e.sortOrder || p.sortOrder,
    }));

  // render tx hash as link

  const txBody = (r) => {
    if (!r?.tx_hash) return "";

    const full = r.tx_hash.startsWith("0x") ? r.tx_hash : "0x" + r.tx_hash;
    const short = shortTx(full);  // shortTx already trims but now always has 0x
    const href = txUrl(contract?.network || "mainnet", full);

    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        title={full}
      >
        {short}
      </a>
    );
  };


      // --- Args column body />) ---
  const argsBody = (r) => {
    const ipfsFields = collectIpfsFields(r.args || {});
    if (ipfsFields.length === 0) {
      return (
        <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
          {JSON.stringify(r.args, null, 2)}
        </pre>
      );
    }
    return (
      <div>
        {ipfsFields.map((f, i) => (
          <IpfsRow key={i} label={pathLabel(f.path)} uri={f.value} />
        ))}
        <details style={{ marginTop: 6 }}>
          <summary style={{ cursor: "pointer" }}>Show raw args</summary>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
            {JSON.stringify(r.args, null, 2)}
          </pre>
        </details>
      </div>
    );
  };



  return (
    <Dialog
      header={contract ? `${contract.name} Events (${contract.network})` : "Events"}
      visible={visible}
      style={{ width: "80vw", maxWidth: 1200 }}
      modal
      onHide={onHide}
    >
      <DataTable
        value={events || []}
        loading={loading}
        paginator
        lazy
        rows={lazyParams.rows}
        first={lazyParams.first}
        totalRecords={totalRecords}
        sortField={lazyParams.sortField}
        sortOrder={lazyParams.sortOrder}
        onPage={onPage}
        onSort={onSort}
        rowsPerPageOptions={[10, 25, 50]}
        dataKey="id"
        scrollable
      >
        <Column field="block_number" header="Block" sortable style={{ width: 120 }} />
        <Column field="log_index" header="Idx" sortable style={{ width: 80 }} />
        <Column
          header="Event"
          sortable
          sortField="name"               // keep sorting by the "name" field
          style={{ width: 280 }}
          body={(row) => {
            const ev = row?.name ?? "";
            const cn = row?.contract_name ? ` (${row.contract_name})` : "";
            return (
              <span title={`${ev}${cn}`}>
                {ev}
                <span className="text-500">{cn}</span>
              </span>
            );
          }}
        />

        <Column
          field="tx_hash"
          header="Tx"
          sortable
          body={txBody}
          style={{ width: 240 }}
        />
        <Column header="Args" body={argsBody} />
      </DataTable>
    </Dialog>
  );
}
