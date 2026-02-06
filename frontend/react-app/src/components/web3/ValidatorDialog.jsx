import React from "react";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Button } from "primereact/button";

export default function ValidatorDialog({
  visible,
  mode,
  address,
  description,
  codeURI,
  codeHash,
  active,
  onChangeAddress,
  onChangeDescription,
  onChangeCodeURI,
  onChangeCodeHash,
  onChangeActive,
  onHide,
  onSave,
  submitting = false,
}) {
  const primaryLabel = mode === "add" ? "Add" : "Save";

  return (
    <Dialog
      header={mode === "add" ? "Add validator" : "Update validator"}
      visible={visible}
      onHide={!submitting ? onHide : undefined}
      style={{ width: "32rem" }}
      modal
      closable={!submitting}
    >
      <div className="p-fluid grid">
        <div className="field col-12">
          <label>Validator address</label>
          <InputText
            value={address}
            onChange={(e) => onChangeAddress(e.target.value)}
            placeholder="0x..."
            disabled={submitting}
          />
        </div>

        <div className="field col-12">
          <label>Description</label>
          <InputTextarea
            rows={3}
            value={description}
            onChange={(e) => onChangeDescription(e.target.value)}
            disabled={submitting}
          />
        </div>

        <div className="field col-12">
          <label>Code URI</label>
          <InputText
            value={codeURI}
            onChange={(e) => onChangeCodeURI(e.target.value)}
            placeholder="ipfs://..."
            disabled={submitting}
          />
        </div>

        <div className="field col-12">
          <label>Code hash (bytes32 hex)</label>
          <InputText
            value={codeHash}
            onChange={(e) => onChangeCodeHash(e.target.value)}
            placeholder="0x..."
            disabled={submitting}
          />
        </div>

        <div className="field col-12">
          <label className="flex align-items-center gap-2">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => onChangeActive(e.target.checked)}
              disabled={submitting}
            />
            Active
          </label>
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-3">
        <Button
          label="Close"
          className="p-button-text"
          onClick={onHide}
          disabled={submitting}
        />
        <Button
          label={submitting ? `${primaryLabel}...` : primaryLabel}
          icon={submitting ? "pi pi-spin pi-spinner" : "pi pi-check"}
          onClick={onSave}
          disabled={!address || submitting}
        />
      </div>
    </Dialog>
  );
}
