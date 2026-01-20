import React from "react";
import { Dialog } from "primereact/dialog";
import { Button } from "primereact/button";
import "../styles/components/NotificationDetailsDialog.css";

const NotificationDetailsDialog = ({
  visible,
  notification,
  onHide,
  onMarkAsRead,
  isDarkMode,
  renderLabel,
  className,
  contentClassName,

  // optional: lets you control explorer behavior from parent
  openInExplorer, // (value, type, network) => void
}) => {
  if (!notification) return null;

  const net = notification.network;

  const copyToClipboard = async (text) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(String(text));
    } catch (e) {
      console.error("Clipboard copy failed", e);
    }
  };

  const iconBtnBase = "p-button-text p-button-sm tag-icon-btn";
  const markBtnClass = "p-button-text p-button-sm notif-mark-btn";

  const ActionIconButtons = ({ value, onNavigate, copyTooltip, navTooltip }) => {
    const canNavigate = typeof onNavigate === "function";

    return (
      <span className="notif-icon-actions flex align-items-center gap-1">
        <Button
          className={`${iconBtnBase} tag-icon-copy`}
          icon="pi pi-copy"
          onClick={() => copyToClipboard(value)}
          tooltip={copyTooltip}
          tooltipOptions={{ position: "top" }}
          disabled={!value}
          type="button"
        />
        <Button
          className={`${iconBtnBase} tag-icon-navigate`}
          icon="pi pi-external-link"
          onClick={canNavigate ? onNavigate : undefined}
          tooltip={navTooltip}
          tooltipOptions={{ position: "top" }}
          disabled={!canNavigate}
          type="button"
        />
      </span>
    );
  };

  // ---- payload helpers ------------------------------------------------------

  const isAddress = (v) => typeof v === "string" && /^0x[0-9a-fA-F]{40}$/.test(v);
  const isTx = (v) => typeof v === "string" && /^0x[0-9a-fA-F]{64}$/.test(v);
  const isUrl = (v) => typeof v === "string" && /^https?:\/\/\S+$/i.test(v);
  const isIpfs = (v) => typeof v === "string" && v.startsWith("ipfs://");
  const isHttpUrl = (v) => {
    try {
        const u = new URL(v);
        return u.protocol === "http:" || u.protocol === "https:";
    } catch {
        return false;
    }
    };

  const ipfsToHttp = (ipfsUri) =>
    ipfsUri.replace(/^ipfs:\/\//, "https://ipfs.io/ipfs/");


  const detectNavigate = (value) => {
    if (!openInExplorer || !value) return null;

    if (isAddress(value)) return () => openInExplorer(value, "address", net);
    if (isTx(value)) return () => openInExplorer(value, "tx", net);
    if (isUrl(value)) return () => window.open(value, "_blank", "noopener,noreferrer");

    // if it's hex but unknown, don't enable navigate
    return null;
  };
  
  const renderPayloadValue = (value) => {
    if (value == null) return <span className="text-muted">null</span>;

    if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
    ) {
        const strVal = String(value);


        const isIpfsLink = isIpfs(strVal);
        const isHttpLink = isHttpUrl(strVal);

        const showActions = isIpfsLink || isHttpLink;

        const onNavigate =
        isIpfsLink
            ? () => window.open(ipfsToHttp(strVal), "_blank", "noopener")
            : isHttpLink
            ? () => window.open(strVal, "_blank", "noopener")
            : detectNavigate(strVal); // explorer for addr / tx

        return (
        <div className="notif-kv-value flex justify-content-between align-items-center gap-2">
            <span className="notif-kv-text" style={{ overflowWrap: "anywhere" }}>
            {strVal}
            </span>

            {showActions && (
            <ActionIconButtons
                value={strVal}
                copyTooltip="Copy value"
                navTooltip={
                isIpfsLink || isHttpLink
                    ? "Open link"
                    : "Open in explorer"
                }
                onNavigate={onNavigate}
            />
            )}
        </div>
        );
    }

    // object / array
    return (
        <pre className={`notif-payload-pre ${isDarkMode ? "is-dark" : ""}`}>
        {JSON.stringify(value, null, 2)}
        </pre>
    );
    };


  const renderPayload = (payload) => {
    const obj = payload ?? {};
    if (typeof obj !== "object" || Array.isArray(obj)) {
      return renderPayloadValue(obj);
    }

    const entries = Object.entries(obj);

    if (!entries.length) {
      return <div className="text-xs text-muted">No payload.</div>;
    }

    return (
      <div className="notif-payload-kv">
        {entries.map(([k, v]) => (
          <div key={k} className="notif-kv-row">
            <div className="notif-kv-key">
              <b>{k}:</b>
            </div>
            <div className="notif-kv-val">{renderPayloadValue(v)}</div>
          </div>
        ))}
      </div>
    );
  };

  // ---- render ---------------------------------------------------------------
  return (
    <Dialog
      header="Notification details"
      visible={visible}
      style={{ width: "50vw", maxWidth: "720px" }}
      onHide={onHide}
      className={className}
      contentClassName={contentClassName} 
    >
      <div className="flex flex-column gap-3">
        {/* Header */}
        <div>
          <div className="font-semibold">{renderLabel(notification)}</div>
          <div className="text-xs text-muted">
            {notification.created_at ? new Date(notification.created_at).toLocaleString() : ""}
          </div>
        </div>

        {/* Metadata */}
        <div className="text-xs flex flex-column gap-2">
          <div>
            <b>Kind:</b> {notification.kind}
          </div>

          {notification.network && (
            <div>
              <b>Network:</b> {notification.network}
            </div>
          )}

          {notification.contract_address && (
            <div className="flex justify-content-between align-items-center gap-2">
              <span style={{ overflowWrap: "anywhere" }}>
                <b>Contract:</b> {notification.contract_address}
              </span>

              <ActionIconButtons
                value={notification.contract_address}
                copyTooltip="Copy address"
                navTooltip="Open in explorer"
                onNavigate={
                  openInExplorer
                    ? () => openInExplorer(notification.contract_address, "address", net)
                    : null
                }
              />
            </div>
          )}

          {notification.tx_hash && (
            <div className="flex justify-content-between align-items-center gap-2">
              <span style={{ overflowWrap: "anywhere" }}>
                <b>Tx:</b> {notification.tx_hash}
              </span>

              <ActionIconButtons
                value={notification.tx_hash}
                copyTooltip="Copy transaction hash"
                navTooltip="Open tx in explorer"
                onNavigate={openInExplorer ? () => openInExplorer(notification.tx_hash, "tx", net) : null}
              />
            </div>
          )}

          {notification.suite_id != null && (
            <div>
              <b>Suite ID:</b> {notification.suite_id}
            </div>
          )}

          {notification.dataset_fingerprint && (
            <div className="flex justify-content-between align-items-center gap-2">
              <span style={{ overflowWrap: "anywhere" }}>
                <b>Fingerprint:</b> {notification.dataset_fingerprint}
              </span>

              <Button
                className={`${iconBtnBase} tag-icon-copy`}
                icon="pi pi-copy"
                onClick={() => copyToClipboard(notification.dataset_fingerprint)}
                tooltip="Copy fingerprint"
                tooltipOptions={{ position: "top" }}
                type="button"
              />
            </div>
          )}
        </div>

        {/* Payload */}
        <div>
          <div className="font-semibold text-sm mb-2">Payload</div>
          {renderPayload(notification.payload)}
        </div>

        {/* Actions */}
        <div className="flex justify-content-end gap-2">
          {!notification.is_read && (
            <Button
              className={markBtnClass}
              icon="pi pi-eye"
              onClick={onMarkAsRead}
              tooltip="Mark as read"
              tooltipOptions={{ position: "top" }}
              type="button"
            />
          )}
        </div>
      </div>
    </Dialog>
  );
};

export default NotificationDetailsDialog;
