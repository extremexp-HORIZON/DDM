// components/web3/ConfirmDialog.jsx
import React from "react";
import { Dialog } from "primereact/dialog";
import { Button } from "primereact/button";

export default function ConfirmDialog({
  visible,
  message,
  onCancel,
  onConfirm,
  confirmLoading,
}) {
  return (
    <Dialog
      header="Confirm action"
      visible={visible}
      disabled={confirmLoading}
      onHide={onCancel}
      style={{ width: "22rem" }}
      modal
    >
      <div className="text-sm mb-4">{message}</div>

      <div className="flex justify-end gap-2 mt-3">
        <Button
          label="Cancel"
          className="p-button-text"
          onClick={onCancel}
          disabled={confirmLoading}
        />
        <Button
          label="Yes"
          icon="pi pi-check"
          className="p-button-danger"
          onClick={onConfirm}
          disabled={confirmLoading}
        />
      </div>
    </Dialog>
  );
}
