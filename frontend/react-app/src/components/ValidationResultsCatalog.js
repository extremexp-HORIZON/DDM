// src/components/ValidationResultsCatalog.js
import React from "react";
import { Dialog } from "primereact/dialog";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";

const ValidationResultsCatalog = ({
  visible,
  onHide,
  results,
  datasetName,
}) => {
  const openInViewer = (result) => {
    const newTab = window.open("/validationviewer", "_blank");
    const sendMessage = () => {
      newTab.postMessage(result, window.location.origin);
    };

    // Post message safely after tab is ready
    if (newTab) {
      newTab.onload = sendMessage;
    } else {
      setTimeout(sendMessage, 1000); // fallback if newTab not ready immediately
    }
  };

  return (
    <Dialog
      header={`Validation Results for ${datasetName}`}
      visible={visible}
      onHide={onHide}
      style={{ width: '60vw' }}
      modal
    >
      <DataTable value={results} responsiveLayout="scroll" size="small">
        <Column 
          field="run_time" 
          header="Run Time" 
          body={(row) => new Date(row.run_time).toLocaleString()} 
        />
        <Column 
          field="suite_name" 
          header="Suite Name" 
        />
        <Column 
          header="Actions" 
          body={(row) => (
            <Button
              icon="pi pi-eye"
              className="p-button-sm p-button-info"
              tooltip="View Details"
              tooltipOptions={{ position: "top" }}
              onClick={() => openInViewer(row)}
            />
          )} 
        />
      </DataTable>
    </Dialog>
  );
};

export default ValidationResultsCatalog;
