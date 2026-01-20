// src/components/SuiteRequestPreparePanel.jsx
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";

function ipfsToHttp(uri) {
  if (!uri) return "";
  if (uri.startsWith("ipfs://")) {
    const path = uri.slice("ipfs://".length);
    return `https://ipfs.io/ipfs/${path}`;
  }
  return uri;
}

function UriRow({ label, value }) {
  const open = () => { const url = ipfsToHttp(value); if (url) window.open(url, "_blank", "noopener"); };
  const copy = () => { try { navigator.clipboard.writeText(value || ""); } catch {} };
  return (
    <div className="field col-12">
      <label>{label}</label>
      <div className="flex gap-2">
        <InputText value={value || ""} disabled className="flex-1" />
        <Button icon="pi pi-copy" className="p-button-text p-button-sm" onClick={copy} tooltip="Copy" />
        <Button icon="pi pi-external-link" className="p-button-text p-button-sm" onClick={open} tooltip="Open in new tab" />
      </div>
    </div>
  );
}

export default function SuiteRequestPreparePanel({ preparing, prepared, onClickPrepare }) {
  if (!prepared) {
    return (
      <div className="p-2 mb-2 border-1 border-round">
        <Button
          label={preparing ? "Preparing…" : "Prepare via backend (upload to IPFS)"}
          icon={preparing ? "pi pi-spin pi-spinner" : "pi pi-upload"}
          className="p-button-secondary w-full py-2"
          disabled={preparing}
          onClick={onClickPrepare}
        />
      </div>
    );
  }

  return (
    <div className="p-2 mb-2 border-1 border-round">
      <div className="p-fluid grid">
        <UriRow label="Suite URI" value={prepared.suiteURI} />
        <UriRow label="Docs URI" value={prepared.docsURI} />
        <UriRow label="Metadata URI" value={prepared.certificateURI} />
      </div>
    </div>
  );
}
