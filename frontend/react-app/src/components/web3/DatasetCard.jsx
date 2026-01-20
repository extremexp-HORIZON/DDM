// src/components/web3/DatasetCard.jsx
import React from "react";
import { Button } from "primereact/button";

function shortAddr(a) {
  return a ? `${a.slice(0, 8)}…${a.slice(-6)}` : "";
}

const openUri = (uri) => {
  if (!uri) return;
  window.open(uri, "_blank", "noopener,noreferrer");
};

const datasetStatusPill = (row) => {
  const minValidations = 3;
  const vCount = row.validations || 0;

  if (row.claimed) {
    return (
      <span className="validator-status-pill validator-status-claimed">
        Claimed
      </span>
    );
  }

  if (vCount < minValidations) {
    return (
      <span className="validator-status-pill validator-status-pending">
        Pending ({vCount}/{minValidations})
      </span>
    );
  }

  if (row.lastStatus === "valid") {
    return (
      <span className="validator-status-pill validator-status-active">
        Valid
      </span>
    );
  }

  if (row.lastStatus === "invalid") {
    return (
      <span className="validator-status-pill validator-status-inactive">
        Failed
      </span>
    );
  }

  return (
    <span className="validator-status-pill validator-status-inactive">
      Unknown
    </span>
  );
};



export default function DatasetCard({
  dataset,
  className,
  formatRegisteredAt,
  onSubmitValidation,
  onClaimReward, 
}) {
  const d = dataset;
  const validations = d.validationsArr || [];
  

  return (
    <div className={className}>
      <div className="flex justify-between items-center mb-1">
        <div className="text-xs text-muted">Dataset</div>
        <div className="dataset-badge-container">{datasetStatusPill(d)}</div>
      </div>

      <div className="text-xs mb-1">
        {/* Fingerprint row */}
        <div className="mb-1 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-muted">fp: </span>
            <span title={d.fingerprint} className="text-ellipsis">
              {shortAddr(d.fingerprint)}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              className="p-button-text p-button-sm tag-icon-btn tag-icon-copy"
              icon="pi pi-copy"
              disabled={!d.fingerprint}
              onClick={() => navigator.clipboard.writeText(d.fingerprint)}
              tooltip="Copy fingerprint"
              tooltipOptions={{ position: "top" }}
            />

          </div>
        </div>

        <div className="mb-1 flex items-center justify-between">
          <span className="text-muted">Uploader: </span>
          <span title={d.uploader}>{shortAddr(d.uploader)}</span>
        </div>

        <div className="mb-1 flex items-center justify-between">
          <span className="text-muted">Format:</span>
          <span>{d.fileFormat || "-"}</span>
        </div>

        <div className="mb-1 flex items-center justify-between">
          <span className="text-muted">Timestamp:</span>
          <span>{formatRegisteredAt(d.registeredAt)}</span>
        </div>

        <div className="mb-1 flex items-center justify-between">
          <span className="text-muted">Validations:</span>
          <span>{d.validations || 0}</span>
        </div>
      </div>

      {/* ✅ Inline validations list (compact) */}
      <div className="mt-2">
        <div className="text-xs text-muted mb-1">Validation Reports / Results</div>

        {validations.length === 0 ? (
          <div className="text-xs text-muted">None</div>
        ) : (
          <div className="suite-dv-scroll">
            <div className="flex flex-column gap-1">
              {validations.slice(0, 20).map((v, i) => {
                const ok = v.successful === true;
                return (
                  <div
                    key={i}
                    className={`suite-val-chip ${ok ? "ok" : "bad"}`}
                    style={{ justifyContent: "space-between" }}
                    title={v.validator}
                  >
                    <span className="suite-val-chip-text">
                      {shortAddr(v.validator || "")}
                    </span>
                    <span className="suite-val-chip-mark">{ok ? "✓" : "✕"}</span>

                    <div className="flex items-center gap-1">
                      <Button
                        className="p-button-text p-button-sm suite-val-chip-btn"
                        icon="pi pi-file"
                        disabled={!v.resultURI}
                        onClick={() => openUri(v.resultURI)}
                        tooltip={v.resultURI ? "Open result URI" : "No result URI"}
                        tooltipOptions={{ position: "top" }}
                      />
                      <Button
                        className="p-button-text p-button-sm suite-val-chip-btn"
                        icon="pi pi-external-link"
                        disabled={!v.reportURI}
                        onClick={() => openUri(v.reportURI)}
                        tooltip={v.reportURI ? "Open report URI" : "No report URI"}
                        tooltipOptions={{ position: "top" }}
                      />
                    </div>
                  </div>
                );
              })}

              {validations.length > 20 && (
                <div className="text-xs text-muted">+{validations.length - 20} more…</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 mt-2">

        <Button
          className="p-button-text p-button-sm tag-icon-btn btn-blue"
          icon="pi pi-database"
          disabled={!d.uri}
          onClick={() => openUri(d.uri)}
          tooltip="Open dataset URI"
          tooltipOptions={{ position: "top" }}
        />

        <Button
          className="p-button-text p-button-sm tag-icon-btn btn-purple"
          icon="pi pi-book"
          disabled={!d.reportURI}
          onClick={() => openUri(d.reportURI)}
          tooltip={d.reportURI ? "Open dataset report" : "No report URI"}
          tooltipOptions={{ position: "top" }}
        />

        <Button
          className="p-button-text p-button-sm btn-green"
          icon="pi pi-check-circle"
          onClick={onSubmitValidation}
          tooltip="Submit validation"
          tooltipOptions={{ position: "top" }}
        />
        <Button
          className="p-button-text p-button-sm btn-orange"
          icon="pi pi-gift"
          onClick={() => onClaimReward?.(d.requestId, d.fingerprint)}
          tooltip={d.requestId ? `Claim reward for request #${d.requestId}` : "No open request found for this suiteHash"}
          tooltipOptions={{ position: "top" }}
          disabled={!d.requestId}
        />



      </div>
    </div>
  );
}
