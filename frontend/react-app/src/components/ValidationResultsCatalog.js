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
  const openInViewer = (row) => {
    window.open(`/validation_results_viewer/${row.suite_id}/${row.dataset_id}`, '_blank');
  };
  

  return (
    <Dialog
      header={`Validation Results for file: ${datasetName}`}
      visible={visible}
      onHide={onHide}
      style={{ width: '60vw' }}
      modal
    >
      <DataTable value={results} size="small">
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
