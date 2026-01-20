// components/ConfirmDialog.jsx
import React from "react";
import {
  ConfirmDialog as PrimeConfirmDialog,
  confirmDialog,
} from "primereact/confirmdialog";
import "../styles/components/dialog.css";

const showConfirm = ({
  message,
  header = "Confirm",
  icon = "pi pi-exclamation-triangle",
  accept,
  reject,
  isDarkMode = false,

  // ✅ NEW
  loading = false,
  acceptLabel,
  rejectLabel,
}) => {
  confirmDialog({
    message,
    header,
    icon,
    accept,
    reject,

    // ✅ NEW: disable buttons while loading
    acceptDisabled: loading,
    rejectDisabled: loading,
    closable: !loading,
    closeOnEscape: !loading,

    // ✅ NEW: show spinner + label while loading
    acceptLabel: acceptLabel ?? (loading ? "Please wait..." : "Confirm"),
    rejectLabel: rejectLabel ?? "Cancel",
    acceptIcon: loading ? "pi pi-spin pi-spinner" : "pi pi-check",

    acceptClassName: "p-button-danger",
    className: isDarkMode ? "dark-confirm" : "",
  });
};

const ConfirmDialog = () => {
  return <PrimeConfirmDialog />;
};

export { ConfirmDialog, showConfirm };
