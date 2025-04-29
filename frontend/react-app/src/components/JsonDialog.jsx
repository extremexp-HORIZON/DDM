// src/components/JsonDialog.js
import React from "react";
import { Dialog } from "primereact/dialog";
import { Button } from "primereact/button";

const JsonDialog = ({ visible, onHide, title, jsonData }) => {
  const handleDownload = () => {
    const jsonBlob = new Blob([JSON.stringify(jsonData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(jsonBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(title || "data").replace(/\s+/g, "_").toLowerCase()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const footerContent = (
    <div className="flex justify-content-end gap-2">
      <Button
        label="Download JSON"
        icon="pi pi-download"
        className="p-button-success"
        onClick={handleDownload}
      />
      <Button
        label="Close"
        icon="pi pi-times"
        className="p-button-secondary"
        onClick={onHide}
      />
    </div>
  );

  return (
    <Dialog
      header={title || "JSON Viewer"}
      visible={visible}
      onHide={onHide}
      style={{ width: '60vw', maxHeight: '80vh' }}
      modal
      footer={footerContent}
    >
      {jsonData ? (
        <div
          style={{
            overflowY: "auto",
            maxHeight: "60vh",
            padding: "1rem",
            borderRadius: "5px",
            fontFamily: "monospace",
            fontSize: "0.9rem",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {JSON.stringify(jsonData, null, 2)}
        </div>
      ) : (
        <p>No data available.</p>
      )}
    </Dialog>
  );
};

export default JsonDialog;
