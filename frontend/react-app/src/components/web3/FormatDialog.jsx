import React from "react";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import { Button } from "primereact/button";

export default function FormatDialog({
  visible,
  value,
  onChange,
  onHide,
  onSave,
  submitting = false,
}) {
  return (
    <Dialog
      header="Manage file format"
      visible={visible}
      onHide={!submitting ? onHide : undefined}
      style={{ width: "25rem" }}
      modal
      closable={!submitting}
    >
      <div className="p-fluid">
        <div className="field">
          <label>Format</label>
          <InputText
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="e.g. csv"
            disabled={submitting}
          />
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
          label={submitting ? "Saving..." : "Save"}
          icon={submitting ? "pi pi-spin pi-spinner" : "pi pi-check"}
          onClick={onSave}
          disabled={!value || submitting}
        />
      </div>
    </Dialog>
  );
}
