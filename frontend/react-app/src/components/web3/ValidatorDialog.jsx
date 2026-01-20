// components/web3/ValidatorDialog.jsx
import React from "react";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Button } from "primereact/button";

export default function ValidatorDialog({
  visible,
  mode, // "add" | "update"
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
}) {
  return (
    <Dialog
      header={mode === "add" ? "Add validator" : "Update validator"}
      visible={visible}
      onHide={onHide}
      style={{ width: "32rem" }}
      modal
    >
      <div className="p-fluid grid">
        <div className="field col-12">
          <label>Validator address</label>
          <InputText
            value={address}
            onChange={(e) => onChangeAddress(e.target.value)}
            placeholder="0x..."
          />
        </div>
        <div className="field col-12">
          <label>Description</label>
          <InputTextarea
            rows={3}
            value={description}
            onChange={(e) => onChangeDescription(e.target.value)}
          />
        </div>
        <div className="field col-12">
          <label>Code URI</label>
          <InputText
            value={codeURI}
            onChange={(e) => onChangeCodeURI(e.target.value)}
            placeholder="ipfs://..."
          />
        </div>
        <div className="field col-12">
          <label>Code hash (bytes32 hex)</label>
          <InputText
            value={codeHash}
            onChange={(e) => onChangeCodeHash(e.target.value)}
            placeholder="0x..."
          />
        </div>
        <div className="field col-12">
          <label className="flex align-items-center gap-2">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => onChangeActive(e.target.checked)}
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
        />
        <Button
          label={mode === "add" ? "Add" : "Save"}
          icon="pi pi-check"
          onClick={onSave}
          disabled={!address}
        />
      </div>
    </Dialog>
  );
}
