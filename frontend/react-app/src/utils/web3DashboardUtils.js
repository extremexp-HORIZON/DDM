// utils/web3DashboardUtils.js
import Web3 from "web3";

export const web3Instance = new Web3();

export function shortAddr(a) {
  return a ? `${a.slice(0, 8)}…${a.slice(-6)}` : "";
}

export function weiToEth(weiStr) {
  if (!weiStr) return 0;
  const n = Number(weiStr);
  if (!Number.isFinite(n)) return 0;
  return n / 1e18;
}

export function shortHex(v, left = 6, right = 4) {
  if (typeof v !== "string") return String(v);
  if (!v.startsWith("0x") || v.length <= left + right + 3) return v;
  return `${v.slice(0, left)}…${v.slice(-right)}`;
}

export function getExplorerAddressUrl(network, address) {
  if (!address) return null;
  switch (network) {
    case "eth":
    case "mainnet":
      return `https://etherscan.io/address/${address}`;
    case "sepolia":
      return `https://sepolia.etherscan.io/address/${address}`;
    case "polygon":
      return `https://polygonscan.com/address/${address}`;
    default:
      return null; // ganache or unknown
  }
}

export function openInExplorer(address, network) {
  const url = getExplorerAddressUrl(network, address);
  if (!url) return;
  window.open(url, "_blank", "noreferrer");
}

export function openIpfsUri(uri) {
  if (!uri || !uri.startsWith("ipfs://")) return;
  const cid = uri.replace("ipfs://", "");
  const url = `https://ipfs.io/ipfs/${cid}`;
  window.open(url, "_blank", "noreferrer");
}

export const mkContract = (row) => {
  if (!web3Instance || !row?.abi || !row?.address) return null;
  return new web3Instance.eth.Contract(row.abi, row.address);
};

export function formatArgValue(val) {
  if (val == null) return "-";

  if (typeof val === "string") {
    if (val.startsWith("0x") && val.length > 16) {
      return shortHex(val);
    }
    if (val.startsWith("ipfs://") && val.length > 28) {
      return val.slice(0, 28) + "…";
    }
    return val;
  }

  if (Array.isArray(val)) {
    if (val.length === 0) return "[]";
    if (val.length <= 3) return `[${val.map(formatArgValue).join(", ")}]`;
    return `[${val.length} items]`;
  }

  if (typeof val === "object") {
    try {
      const s = JSON.stringify(val);
      return s.length > 60 ? s.slice(0, 60) + "…" : s;
    } catch {
      return String(val);
    }
  }

  return String(val);
}

export const countEventsByName = (events) => {
  const map = {};
  for (const ev of events || []) {
    if (!ev?.name) continue;
    map[ev.name] = (map[ev.name] || 0) + 1;
  }
  return map;
};


const truncate = (text, max = 80) =>
  !text ? "" : text.length <= max ? text : text.slice(0, max) + "…";

const formatDateShort = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString();
};

export const catalogItemTemplate = (option) => {
  if (!option) return null;
  const uploaded = formatDateShort(option.uploadedAt);
  return (
    <div className="flex flex-column gap-1">
      {/* first line: filename + use-case badges */}
      <div className="flex justify-content-between align-items-center">
        <span className="font-medium">{option.label}</span>
        <div className="flex flex-wrap gap-1">
          {option.useCases &&
            option.useCases.map((uc) => (
              <span
                key={uc}
                className="p-tag p-tag-rounded p-tag-info text-xs"
              >
                {uc}
              </span>
            ))}
        </div>
      </div>

      {/* second line: project + uploaded */}
      <div className="flex justify-content-between text-xs text-muted">
        <span>
          {option.projectId && (
            <>
              Project: <strong>{option.projectId}</strong>
            </>
          )}
        </span>
        <span> {option.uploaded && `Project: ${option.uploaded} `}
        {uploaded && ` • Uploaded: ${uploaded}`}</span>
      </div>

      {/* third line: description truncated */}
      {option.description && (
        <div className="text-xs text-muted">
          {truncate(option.description, 90)}
        </div>
      )}
    </div>
  );
};

export const catalogValueTemplate = (option, props) => {
  // how the selected value appears in the closed dropdown
  if (!option) {
    return <span>{props.placeholder}</span>;
  }
  const uploaded = formatDateShort(option.uploadedAt);
  return (
    <div className="flex flex-column">
      <span className="font-medium">{option.label}</span>
      <span className="text-xs text-muted">
        {option.projectId && `Project: ${option.projectId} `}
        {uploaded && `• ${uploaded}`}
      </span>
    </div>
  );
};
