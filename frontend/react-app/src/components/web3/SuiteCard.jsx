// src/components/web3/SuiteCard.jsx
import React, { useRef } from "react";
import { Tag } from "primereact/tag";
import { Button } from "primereact/button";
import { ProgressBar } from "primereact/progressbar";
import { OverlayPanel } from "primereact/overlaypanel";

function shortAddr(a) {
  return a ? `${a.slice(0, 8)}…${a.slice(-6)}` : "";
}

const statusTag = (row) => {
  const now = Date.now();
  const deadlineMs = (row.deadline || 0) * 1000;
  const expired = !row.isClosed && row.deadline && deadlineMs < now;

  const complete =
    !row.isClosed &&
    !expired &&
    row.totalExpected &&
    row.totalClaims >= row.totalExpected;

  let key = "open";
  let label = "Open";

  if (row.isClosed) {
    key = "closed";
    label = "Closed";
  } else if (expired) {
    key = "expired";
    label = "Expired";
  } else if (complete) {
    key = "complete";
    label = "Complete";
  }

  return <Tag value={label} className={`status-badge status-${key} text-xs`} />;
};

const formatDeadline = (row) =>
  row.deadline ? new Date(row.deadline * 1000).toLocaleString() : "-";

const suiteProgress = (row) => {
  if (!row.totalExpected) return 0;
  return Math.min(100, Math.round((row.totalClaims / row.totalExpected) * 100));
};

const openUri = (uri) => {
  if (!uri) return;
  window.open(uri, "_blank", "noopener,noreferrer");
};

export default function SuiteCard({
  suite,
  className,
  onClaim,
  onCancel,
  onRegisterDataset,
}) {
  const row = suite;
  const opRef = useRef(null);

  const now = Date.now();
  const expired = !row.isClosed && row.deadline && row.deadline * 1000 < now;
  const complete =
    !row.isClosed &&
    !expired &&
    row.totalExpected &&
    row.totalClaims >= row.totalExpected;

  const claimDisabled =
    row.isClosed ||
    expired ||
    !row.totalExpected ||
    row.totalClaims >= row.totalExpected ||
    row.remainingEth <= 0;

  const registerDisabled = row.isClosed || expired || complete; // ✅ disable like claim
  const cancelDisabled = row.isClosed;

  const datasetsInfo = row.datasetsInfo || [];

  return (
    <div className={className}>
      <div className="suite-status-pill">{statusTag(row)}</div>

      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">Dataset Request</span>
          <span className="font-semibold text-sm">#{row.id}</span>
        </div>
      </div>

      <div className="text-xs mb-1">
        <div className="mb-1">
          <span className="text-muted">Requester: </span>
          <span title={row.requester}>{shortAddr(row.requester)}</span>
        </div>
        <div className="mb-1">
          <span className="text-muted">Category: </span>
          <span>{row.category || "-"}</span>
        </div>
        <div className="mb-1">
          <span className="text-muted">Format: </span>
          <span>{row.fileFormat || "-"}</span>
        </div>
        <div className="mb-1">
          <span className="text-muted">Deadline: </span>
          <span>{formatDeadline(row)}</span>
        </div>
      </div>

      <div className="mb-1 text-xs">
        <div className="flex justify-between mb-1">
          <span className="text-muted">Bounty: </span>
          <span>{(row.bountyEth || 0).toFixed(4)} ETH</span>
        </div>
        <div className="flex justify-between mb-1">
          <span className="text-muted">Claimed: </span>
          <span>{(row.claimedEth || 0).toFixed(4)} ETH</span>
        </div>
        <div className="flex justify-between mb-1">
          <span className="text-muted">Remaining: </span>
          <span>{(row.remainingEth || 0).toFixed(4)} ETH</span>
        </div>

        <div className="mt-1">
          <ProgressBar value={suiteProgress(row)} showValue={false} style={{ height: "0.35rem" }} />
          <div className="flex justify-between mt-1">
            <span className="text-muted">Claims</span>
            <span>
              {row.totalClaims}/{row.totalExpected || "-"}
            </span>
          </div>
        </div>
      </div>

      <div className="action-row mt-2 text-xs">
        <Button
          icon="pi pi-external-link"
          className="p-button-rounded p-button-text p-button-sm icon-btn btn-blue"
          disabled={!row.suiteURI}
          onClick={() => openUri(row.suiteURI)}
          tooltip="Open suite URI"
          tooltipOptions={{ position: "top" }}
        />
        <Button
          icon="pi pi-book"
          className="p-button-rounded p-button-text p-button-sm icon-btn btn-purple"
          disabled={!row.docsURI}
          onClick={() => openUri(row.docsURI)}
          tooltip="Open docs URI"
          tooltipOptions={{ position: "top" }}
        />
        <Button
          icon="pi pi-id-card"
          className="p-button-rounded p-button-text p-button-sm icon-btn btn-teal"
          disabled={!row.certificateURI}
          onClick={() => openUri(row.certificateURI)}
          tooltip="Open certificate URI"
          tooltipOptions={{ position: "top" }}
        />

        {/* ✅ Minimal popover button */}
        <Button
          icon="pi pi-list"
          className="p-button-rounded p-button-text p-button-sm icon-btn"
          tooltip="Datasets & validations"
          tooltipOptions={{ position: "top" }}
          onClick={(e) => opRef.current?.toggle(e)}
        />
        <OverlayPanel ref={opRef} style={{ width: "26rem" }}>
          <div className="text-xs" style={{ maxHeight: "20rem", overflow: "hidden" }}>
            <div className="flex justify-between mb-2">
              <span className="text-muted">Datasets:</span>
              <span>{row.datasetsCount || datasetsInfo.length || 0}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-muted">Validations:</span>
              <span>{row.validationsCount || 0}</span>
            </div>
            

            {datasetsInfo.length === 0 ? (
              <div className="text-muted">No datasets registered yet.</div>
            ) : (
              <div className="suite-dv-scroll">
                {datasetsInfo.slice(0, 10).map((d, idx) => (
                  <div key={d.fingerprint || idx} className="suite-dv-item">
                    {/* compact row */}
                    <div className="suite-dv-row">                     
                      <span className="suite-dv-uploader" title={d.uploader}>
                        <span className="suite-dv-k">User:</span> {shortAddr(d.uploader || "")}
                      </span>
                      <span className="suite-dv-fp" title={d.fingerprint}>
                        <span className="suite-dv-k">Fingerprint:</span> {shortAddr(d.fingerprint || "")}
                      </span>
                      {d.claimed && (
                        <span className="text-2xs text-muted">
                          claimed: {d.claimedAmountEth?.toFixed?.(4) || d.claimedAmountEth} ETH
                        </span>
                      )}
                      {!!d.fingerprint && (
                        <Button
                          className="p-button-text p-button-sm suite-dv-mini-btn"
                          icon="pi pi-copy"
                          tooltip="Copy fingerprint"
                          tooltipOptions={{ position: "top" }}
                          onClick={() => navigator.clipboard.writeText(d.fingerprint)}
                        />
                      )}

                      {/* report icon next to fp (no label) */}
                      <Button
                        className="p-button-text p-button-sm suite-dv-mini-btn"
                        icon="pi pi-file"
                        disabled={!d.reportURI}
                        onClick={() => openUri(d.reportURI)}
                        tooltip={d.reportURI ? "Open dataset report" : "No report URI"}
                        tooltipOptions={{ position: "top" }}
                      />



                    </div>

                    {/* validations chips */}
                    <div className="suite-dv-validations">
                      {(d.validations || []).length ? (
                        <>
                          {(d.validations || []).slice(0, 8).map((v, i) => {
                            const ok = v.successful === true || v.successful === "true";
                            return (
                              <span
                                key={i}
                                className={`suite-val-chip ${ok ? "ok" : "bad"}`}
                                title={v.validator}
                              >
                                <span className="suite-val-chip-text">
                                  {shortAddr(v.validator || "")}
                                </span>
                                <span className="suite-val-chip-mark">{ok ? "✓" : "✕"}</span>

                                <Button
                                  className="p-button-text p-button-sm suite-val-chip-btn"
                                  icon="pi pi-external-link"
                                  disabled={!v.reportURI}
                                  onClick={() => openUri(v.reportURI)}
                                  tooltip={v.reportURI ? "Open validation report" : "No report URI"}
                                  tooltipOptions={{ position: "top" }}
                                />
                              </span>
                            );
                          })}

                          {(d.validations || []).length > 8 && (
                            <span className="text-muted">+{d.validations.length - 8} more…</span>
                          )}
                        </>
                      ) : (
                        <span className="text-muted">None</span>
                      )}
                    </div>
                  </div>
                ))}

                {datasetsInfo.length > 10 && (
                  <div className="text-muted">+{datasetsInfo.length - 10} more…</div>
                )}
              </div>
            )}
          </div>
        </OverlayPanel>


        {onRegisterDataset && (
          <Button
            icon="pi pi-database"
            className="p-button-rounded p-button-text p-button-sm icon-btn btn-orange"
            disabled={registerDisabled}
            tooltip={
              registerDisabled
                ? "Request is complete/closed/expired"
                : "Register dataset for this suite"
            }
            tooltipOptions={{ position: "top" }}
            onClick={onRegisterDataset}
          />
        )}

        {onClaim && (
          <Button
            icon="pi pi-gift"
            className="p-button-rounded p-button-text p-button-sm icon-btn btn-green"
            disabled={claimDisabled}
            tooltip="Claim reward"
            tooltipOptions={{ position: "top" }}
            onClick={onClaim}
          />
        )}

        {onCancel && (
          <Button
            icon="pi pi-ban"
            className="p-button-rounded p-button-text p-button-sm icon-btn btn-red"
            disabled={cancelDisabled}
            tooltip="Cancel request & refund"
            tooltipOptions={{ position: "top" }}
            onClick={onCancel}
          />
        )}
      </div>
    </div>
  );
}
