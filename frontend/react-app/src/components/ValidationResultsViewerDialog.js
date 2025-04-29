import React from "react";
import { Dialog } from "primereact/dialog";
import ValidationResultsViewer from "./ValidationResultsViewer";

const ValidationResultsViewerDialog = ({ visible, onHide, result, isDarkMode }) => {
  return (
    <Dialog
      header={`Validation Result: ${result?.dataset_name || 'N/A'}`}
      visible={visible}
      onHide={onHide}
      style={{ width: "80vw" }}
      className={isDarkMode ? "dark-mode" : ""}
      modal
      closable
      draggable={false}
      resizable={false}
    >
      {result ? (
        <ValidationResultsViewer result={result} />
      ) : (
        <div>No result data available.</div>
      )}
    </Dialog>
  );
};

export default ValidationResultsViewerDialog;
