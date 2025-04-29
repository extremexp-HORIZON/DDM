// components/ConfirmDialog.jsx
import React from "react";
import { ConfirmDialog as PrimeConfirmDialog, confirmDialog } from "primereact/confirmdialog";
import "../styles/components/dialog.css"

const showConfirm = ({ message, header = "Confirm", icon = "pi pi-exclamation-triangle", accept, reject, isDarkMode = false }) => {
  confirmDialog({
    message,
    header,
    icon,
    accept,
    reject,
    acceptClassName: "p-button-danger",
    className: isDarkMode ? "dark-confirm" : "",
  });
};

const ConfirmDialog = () => {
  return <PrimeConfirmDialog />;
};

export { ConfirmDialog, showConfirm };
