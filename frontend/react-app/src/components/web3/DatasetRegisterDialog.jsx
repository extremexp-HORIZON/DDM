// src/components/web3/DatasetRegisterDialog.jsx
import React, { useState, useEffect } from "react";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import { Button } from "primereact/button";
import { RadioButton } from "primereact/radiobutton";
import { Checkbox } from "primereact/checkbox";
import {
  catalogItemTemplate,
  catalogValueTemplate,
} from "../../utils/web3DashboardUtils";

// src/components/web3/DatasetRegisterDialog.jsx
export default function DatasetRegisterDialog({
  visible,
  uri,
  onChangeUri,
  suiteHash,
  onChangeSuiteHash,
  fileFormat,
  onChangeFileFormat,
  fileFormatOptions = [],

  includeReport,
  onChangeIncludeReport,
  reportUri,
  onChangeReportUri,      // ✅ ADD THIS

  lockSuiteFields = false,
  catalogOptions = [],
  selectedCatalogId,
  onChangeSelectedCatalogId,
  onPrepareReport,

  saving = false,
  onHide,
  onSave,
}) {
  const [mode, setMode] = useState("manual");
  const [preparing, setPreparing] = useState(false);

  const suiteLocked = lockSuiteFields && !!suiteHash;

  const handlePrepareFromCatalog = async () => {
    if (!onPrepareReport || !selectedCatalogId) return;
    try {
      setPreparing(true);
      const prepared = await onPrepareReport(selectedCatalogId, {
        includeReport: !!includeReport,
      });

      // 🔹 Make 100% sure we push the reportUri into the field
      if (prepared?.reportUri && onChangeReportUri) {
        onChangeReportUri(prepared.reportUri);
      }

      // If user hadn’t checked it before, ensure it’s on
      if (!includeReport) {
        onChangeIncludeReport?.(true);
      }
    } finally {
      setPreparing(false);
    }
  };

  const requireReportUri = mode === "catalog" && !!includeReport;

  const prepareDisabled =
    preparing ||
    !selectedCatalogId ||
    !onPrepareReport ||
    !!reportUri; 

  const showPrepareButton =
    mode === "catalog" && includeReport && !reportUri;

  const disableRegister =
    saving ||
    preparing ||
    !uri ||
    !suiteHash ||
    !fileFormat ||
    (requireReportUri && !reportUri);

  return (
    <Dialog
      header="Register Dataset"
      visible={visible}
      onHide={saving || preparing ? undefined : onHide}
      style={{ width: "32rem", maxWidth: "90vw" }}
      modal
    >
      {/* description */}
      <div className="text-xs text-muted mb-3">
        Register a dataset for this request. You can:
        <ul className="ml-3 mt-1 list-disc">
          <li>Use an existing IPFS/HTTPS dataset URI, or</li>
          <li>Select a file from your catalog and let the backend upload it.</li>
        </ul>
      </div>

      {/* mode selector */}
      <div className="flex flex-column gap-2 mb-3 text-sm">
        <div className="flex align-items-center gap-2">
          <RadioButton
            inputId="ds-manual"
            value="manual"
            onChange={(e) => setMode(e.value)}
            checked={mode === "manual"}
          />
          <label htmlFor="ds-manual">
            I already have a dataset URI (IPFS / HTTPS)
          </label>
        </div>

        <div className="flex align-items-center gap-2">
          <RadioButton
            inputId="ds-catalog"
            value="catalog"
            onChange={(e) => setMode(e.value)}
            checked={mode === "catalog"}
          />
          <label htmlFor="ds-catalog">
            Select from my catalog (backend uploads from Zenoh to IPFS)
          </label>
        </div>
      </div>

      {/* MANUAL */}
      {mode === "manual" && (
        <div className="flex flex-column gap-3 mt-1">
          <div className="flex flex-column gap-1">
            <label className="text-sm">
              Dataset URI <span className="text-red-500">*</span>
            </label>
            <InputText
              value={uri}
              onChange={(e) => onChangeUri?.(e.target.value)}
              placeholder="ipfs://... or https://..."
            />
          </div>

          <div className="flex flex-column gap-1">
            <label className="text-sm">
              Suite hash (bytes32) <span className="text-red-500">*</span>
            </label>
            <InputText
              value={suiteHash}
              onChange={(e) =>
                !suiteLocked && onChangeSuiteHash?.(e.target.value)
              }
              placeholder="0x..."
              readOnly={suiteLocked}
            />
          </div>

          <div className="flex flex-column gap-1">
            <label className="text-sm">
              File format <span className="text-red-500">*</span>
            </label>
            <Dropdown
              value={fileFormat}
              options={fileFormatOptions}
              optionLabel="label"
              optionValue="value"
              placeholder="Select format"
              onChange={(e) => !suiteLocked && onChangeFileFormat?.(e.value)}
              showClear={false}
              disabled={suiteLocked}
            />
          </div>
        </div>
      )}

      {/* CATALOG */}
      {mode === "catalog" && (
        <div className="flex flex-column gap-3 mt-1">
          <div className="flex flex-column gap-1">
            <label className="text-sm">Select from catalog</label>
            <Dropdown
              value={selectedCatalogId}
              options={catalogOptions}
              optionLabel="label"
              optionValue="value"
              placeholder="Choose catalog dataset"
              onChange={(e) => {
                const id = e.value;
                onChangeSelectedCatalogId?.(id);

                const selected = catalogOptions.find((opt) => opt.value === id);
                if (selected) {
                  const ext = (selected.fileFormat || "csv").toLowerCase();
                  const finalFilename = `${selected.value}.${ext}`;
                  const datasetUri = `projects/${selected.projectId}/files/${selected.value}/${finalFilename}`;

                  onChangeUri?.(datasetUri);

                  if (onChangeFileFormat) {
                    let fmt = selected.fileFormat;
                    if (!fmt && finalFilename.includes(".")) {
                      const parts = finalFilename.split(".");
                      fmt = parts[parts.length - 1].toLowerCase();
                    }
                    if (fmt) {
                      onChangeFileFormat(fmt);
                    }
                  }
                }
              }}
              filter
              showClear
              itemTemplate={catalogItemTemplate}
              valueTemplate={catalogValueTemplate}
              appendTo="self"
            />

            <small className="text-xs text-muted">
              After selecting, you can optionally generate a report IPFS URI.
            </small>
          </div>

          <div className="flex align-items-center gap-2">
            <Checkbox
              inputId="include-report"
              checked={!!includeReport}
              onChange={(e) => onChangeIncludeReport?.(e.checked)}
            />
            <label htmlFor="include-report" className="text-sm">
              Include a data-quality report for this file.
            </label>
          </div>

          {/* Dataset fields */}
          <div className="flex flex-column gap-1">
            <label className="text-sm">
              Dataset URI (auto-filled) <span className="text-red-500">*</span>
            </label>
            <InputText
              value={uri}
              onChange={(e) => onChangeUri?.(e.target.value)}
              placeholder="Will be filled from catalog selection"
            />
          </div>

          <div className="flex flex-column gap-1">
            <label className="text-sm">
              Suite hash (bytes32) <span className="text-red-500">*</span>
            </label>
            <InputText
              value={suiteHash}
              onChange={(e) =>
                !suiteLocked && onChangeSuiteHash?.(e.target.value)
              }
              placeholder="0x..."
              readOnly={suiteLocked}
            />
          </div>

          <div className="flex flex-column gap-1">
            <label className="text-sm">
              File format <span className="text-red-500">*</span>
            </label>
            <Dropdown
              value={fileFormat}
              options={fileFormatOptions}
              optionLabel="label"
              optionValue="value"
              placeholder="Select format"
              onChange={(e) =>
                !suiteLocked && onChangeFileFormat?.(e.value)
              }
              showClear={false}
              disabled={suiteLocked}
            />
          </div>

          {/* Report IPFS URI display */}
          {mode === "catalog" && includeReport && (
          <div className="flex flex-column gap-1">
            <label className="text-sm">
              Report IPFS URI
              {requireReportUri && !reportUri && (
                <span className="text-xs text-red-500">
                  &nbsp;– required before registering
                </span>
              )}
            </label>
            <InputText
              value={reportUri || ""} // 🔥 comes from parent state
              readOnly
              placeholder="Click 'Get Report IPFS URI' to generate"
            />
          </div>
        )}

        </div>
      )}

      {/* footer – your style */}
      <div className="flex justify-end gap-2 mt-4">
        <Button
          label="Cancel"
          className="p-button-text"
          onClick={onHide}
          disabled={saving || preparing}
        />

        {showPrepareButton && (
          <Button
            label={preparing ? "Preparing…" : "Get Report IPFS URI"}
            icon={preparing ? "pi pi-spin pi-spinner" : "pi pi-cloud-upload"}
            className="p-button-outlined"
            onClick={handlePrepareFromCatalog}
            disabled={prepareDisabled}
          />
        )}

        <Button
          label={saving ? "Registering…" : "Register"}
          icon={saving ? "pi pi-spin pi-spinner" : "pi pi-check"}
          onClick={onSave}
          disabled={disableRegister}
        />
      </div>
    </Dialog>
  );
}
