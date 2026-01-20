import React, { useEffect, useState } from "react";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { InputSwitch } from "primereact/inputswitch";
import { Button } from "primereact/button";
import { RadioButton } from "primereact/radiobutton";

import { openIpfsUri } from "../../utils/web3DashboardUtils"; // ✅ same helper you use elsewhere

const DEFAULT_JSON_TEMPLATE = `{
  "score": 0
}`;

const ensure0x = (hex) => {
  const v = (hex || "").trim();
  if (!v) return "";
  return v.startsWith("0x") ? v : `0x${v}`;
};

export default function ValidationDialog({
  visible,
  datasetFingerprint,
  onChangeDatasetFingerprint,

  resultURI,
  onChangeResultURI,

  reportURI,
  onChangeReportURI,

  validationHash,
  onChangeValidationHash,
  successful,
  onChangeSuccessful,

  onPrepareResultFromJson, // async (jsonText) => { resultUri, reportUri?, validationHash? }
  preparing = false,

  onHide,
  onSave,

  submitting = false,
}) {
  const [mode, setMode] = useState("manual"); // "manual" | "json"
  const [jsonText, setJsonText] = useState(DEFAULT_JSON_TEMPLATE);

  useEffect(() => {
    if (visible) {
      setMode("manual");
      setJsonText(DEFAULT_JSON_TEMPLATE); // ✅ prefilled, editable
    }
  }, [visible]);

  const handlePrepare = async () => {
    if (!onPrepareResultFromJson) return;
    const txt = (jsonText || "").trim();
    if (!txt) return;

    const prepared = await onPrepareResultFromJson(txt);

    if (prepared?.resultUri) onChangeResultURI?.(prepared.resultUri);
    if (prepared?.reportUri) onChangeReportURI?.(prepared.reportUri);

    if (prepared?.validationHash) {
      onChangeValidationHash?.(ensure0x(prepared.validationHash));
    }

    setMode("manual");
  };

  const disableSubmit =
    submitting ||
    preparing ||
    !(datasetFingerprint || "").trim() ||
    !(resultURI || "").trim();

  const disablePrepare = preparing || !(jsonText || "").trim();

  const disabled = submitting || preparing;

  return (
    <Dialog
      header="Submit Validation"
      visible={visible}
      onHide={disabled ? undefined : onHide}
      style={{ width: "32rem", maxWidth: "90vw" }}
      modal
    >
      {/* mode selector */}
      <div className="flex flex-column gap-2 mb-3 text-sm">
        <div className="flex align-items-center gap-2">
          <RadioButton
            inputId="val-manual"
            value="manual"
            onChange={(e) => setMode(e.value)}
            checked={mode === "manual"}
          />
          <label htmlFor="val-manual">
            I already have a Result URI (IPFS / HTTPS)
          </label>
        </div>

        <div className="flex align-items-center gap-2">
          <RadioButton
            inputId="val-json"
            value="json"
            onChange={(e) => setMode(e.value)}
            checked={mode === "json"}
          />
          <label htmlFor="val-json">
            Paste validation JSON (backend uploads & returns IPFS URI)
          </label>
        </div>
      </div>

      <div className="flex flex-column gap-3 mt-2">
        {/* fingerprint */}
        <div className="flex flex-column gap-1">
          <label className="text-sm">Dataset fingerprint (bytes32)</label>
          <InputText
            value={datasetFingerprint}
            onChange={(e) => onChangeDatasetFingerprint(e.target.value)}
            placeholder="0x..."
            disabled={disabled}
            className="w-full"
          />
        </div>

        {/* JSON MODE */}
        {mode === "json" && (
          <div className="flex flex-column gap-1">
            <label className="text-sm">Validation JSON</label>
            <InputTextarea
              autoResize
              rows={8}
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              placeholder="Paste JSON here"
              disabled={disabled}
              className="w-full"
            />
            <small className="text-xs text-muted">
              After prepare, Result URI (and optional Report URI/hash) will be filled automatically.
            </small>

            <div className="flex justify-end mt-2">
              <Button
                label={preparing ? "Preparing…" : "Prepare Result URI"}
                icon={preparing ? "pi pi-spin pi-spinner" : "pi pi-cloud-upload"}
                className="p-button-outlined"
                onClick={handlePrepare}
                disabled={disablePrepare}
              />
            </div>
          </div>
        )}

        {/* MANUAL MODE */}
        {mode === "manual" && (
          <>
            {/* Result URI with inline buttons */}


            <div className="flex flex-column gap-1">
              <label className="text-sm">Result URI</label>

              <div className="flex align-items-center gap-1">
                <div className="flex-1">
                  <InputTextarea
                    autoResize
                    rows={3}
                    value={resultURI}
                    onChange={(e) => onChangeResultURI(e.target.value)}
                    placeholder="ipfs://… or https://…"
                    disabled={disabled}
                    className="w-full"
                  />
                </div>

                <Button
                  className="p-button-text p-button-sm tag-icon-btn tag-icon-copy"
                  icon="pi pi-copy"
                  tooltip="Copy result URI"
                  tooltipOptions={{ position: "top" }}
                  disabled={disabled || !(resultURI || "").trim()}
                  onClick={() =>
                    navigator.clipboard.writeText((resultURI || "").trim())
                  }
                />

                <Button
                  className="p-button-text p-button-sm tag-icon-btn tag-icon-navigate"
                  icon="pi pi-external-link"
                  tooltip="Open in IPFS gateway"
                  tooltipOptions={{ position: "top" }}
                  disabled={disabled || !(resultURI || "").trim()}
                  onClick={() => openIpfsUri((resultURI || "").trim())}
                />
              </div>
            </div>


            {/* Report URI with inline buttons */}
            <div className="flex flex-column gap-1">
              <label className="text-sm">Report URI (optional HTML)</label>

              <div className="flex align-items-center gap-1">
                <div className="flex-1">
                  <InputTextarea
                    autoResize
                    rows={2}
                    value={reportURI}
                    onChange={(e) => onChangeReportURI(e.target.value)}
                    placeholder='ipfs://… (or leave empty "")'
                    disabled={disabled}
                    className="w-full"
                  />
                </div>

                <div className="flex align-items-center gap-1">
                  <Button
                    className="p-button-text p-button-sm tag-icon-btn tag-icon-copy"
                    icon="pi pi-copy"
                    tooltip="Copy report URI"
                    tooltipOptions={{ position: "top" }}
                    disabled={disabled || !(reportURI || "").trim()}
                    onClick={() => navigator.clipboard.writeText((reportURI || "").trim())}
                  />
                  <Button
                    className="p-button-text p-button-sm tag-icon-btn tag-icon-navigate"
                    icon="pi pi-external-link"
                    tooltip="Open in IPFS gateway"
                    tooltipOptions={{ position: "top" }}
                    disabled={disabled || !(reportURI || "").trim()}
                    onClick={() => openIpfsUri((reportURI || "").trim())}
                  />
                </div>
              </div>
            </div>

            {/* Hash with inline copy */}
            <div className="flex flex-column gap-1">
              <label className="text-sm">
                Validation hash (optional, default keccak256(resultURI))
              </label>

              <div className="flex align-items-center gap-1">
                <div className="flex-1">
                  <InputText
                    value={validationHash}
                    onChange={(e) => onChangeValidationHash(e.target.value)}
                    placeholder="0x... (leave empty to auto-hash)"
                    disabled={disabled}
                    className="w-full"
                  />
                </div>

                <Button
                  className="p-button-text p-button-sm tag-icon-btn tag-icon-copy"
                  icon="pi pi-copy"
                  tooltip="Copy hash"
                  tooltipOptions={{ position: "top" }}
                  disabled={disabled || !(validationHash || "").trim()}
                  onClick={() =>
                    navigator.clipboard.writeText(ensure0x((validationHash || "").trim()))
                  }
                />
              </div>
            </div>
          </>
        )}

        <div className="flex items-center gap-2">
          <InputSwitch
            checked={successful}
            onChange={(e) => onChangeSuccessful(e.value)}
            disabled={disabled}
          />
          <span className="text-sm">
            {successful ? "Mark as successful" : "Mark as failed"}
          </span>
        </div>
      </div>

      {/* footer */}
      <div className="flex justify-end gap-2 mt-4">
        <Button
          label="Cancel"
          className="p-button-text"
          onClick={onHide}
          disabled={disabled}
        />
        <Button
          label={submitting ? "Submitting…" : "Submit"}
          icon={submitting ? "pi pi-spin pi-spinner" : "pi pi-check"}
          onClick={onSave}
          disabled={disableSubmit}
        />
      </div>
    </Dialog>
  );
}