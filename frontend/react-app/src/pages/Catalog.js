// src/pages/Catalog.js
import React, { useState,  useRef } from 'react';
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import CatalogFilters from "../components/CatalogFilters";
import JsonDialog from "../components/JsonDialog"; 
import ValidationResultsCatalog from "../components/ValidationResultsCatalog";
import { catalogColumns } from "../constants/catalogColumns";
import { useCatalogData } from "../hooks/useCatalogData";
import { useAllFileTypes } from "../hooks/useAllFileTypes";
import { useCatalogCellEditor } from "../hooks/useCatalogCellEditor";
import { useFileActions } from "../hooks/useFileActions";
import { useFileMetadata } from "../hooks/useFileMetadata";
import { useUploaderMetadata } from "../hooks/useUploaderMetadata";
import { useValidationResultsByDataset } from "../hooks/useValidationResultsByDataset";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Tooltip } from 'primereact/tooltip'; 
import { Dialog } from "primereact/dialog";
import { showMessage } from '../utils/messages';
import { VALIDATIONS_API } from "../api/validations";
import ValidateAgainstSuitesDialog from "../components/ValidateAgainstSuitesDialog";

import "primereact/resources/themes/lara-light-blue/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";
import "primeflex/primeflex.css";



const Catalog = () => {
  const { isDarkMode } = useTheme();
  const toast = useToast();
  const tooltipRef = useRef(null);
  const [jsonDialogVisible, setJsonDialogVisible] = useState(false);
  const [jsonDialogTitle, setJsonDialogTitle] = useState("");
  const [jsonDialogData, setJsonDialogData] = useState(null);

  const { 
    validationResults, 
    fetchValidationResults
  } = useValidationResultsByDataset(toast);

  const [validationDialogVisible, setValidationDialogVisible] = useState(false);
  const [currentDatasetName, setCurrentDatasetName] = useState(""); // Optional, nice for header

  const [validateDialogVisible, setValidateDialogVisible] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState(null);

  const [showAllDialogVisible, setShowAllDialogVisible] = useState(false);
  const [showAllDialogContent, setShowAllDialogContent] = useState('');


  const handleValidateAgainstSuites = async (fileId, suiteIds) => {
    try {
      const payload = {
        file_id: fileId,
        suite_ids: suiteIds
      };
      await VALIDATIONS_API.validateFileAgainstSuites(payload);
      showMessage(toast, "success", "Validation started.");
    } catch (error) {
      console.error(error);
      showMessage(toast, "error", error.message || "Failed to start validation.");
    }
  };
  


  const { 
    fileTypes,
  } = useAllFileTypes();


  const [filters, setFilters] = useState({
    filename: "",
    use_case: "",
    file_type: "",
    user_id: "",
    parent_files: [],
    project_id: [],
    size_from: "",
    size_to: "",
    fromDate: null,
    toDate: null,
  });

  const {
    datasets,
    setDatasets,
    lazyParams,
    setLazyParams,
    loading,
    totalRecords,
    filteredRecords,
    reload,
  } = useCatalogData(filters, toast);

  const { 
    handleDownload, 
    handleDelete, 
    handleDownloadMultiple
  } = useFileActions(reload);


  const { onCellEditComplete } = useCatalogCellEditor(toast, datasets, setDatasets);

  const [selectedRows, setSelectedRows] = useState(null);

  const onPage = (event) => {
    setLazyParams((prev) => ({
      ...prev,
      first: event.first,
      rows: event.rows,
    }));
  };

  const onSort = (event) => {
    setLazyParams((prev) => ({
      ...prev,
      sortField: event.sortField || prev.sortField,
      sortOrder: event.sortOrder || prev.sortOrder,
    }));
  };

  const onFilter = (event) => {
    setLazyParams((prevParams) => ({
      ...prevParams,
      filters: event.filters,
      first: 0,
    }));
    setFilters(event.filters);
    reload();
  };


  const openJsonDialog = (title, data) => {
    setJsonDialogTitle(title);
    setJsonDialogData(data);
    setJsonDialogVisible(true);
  };

  const { 
    fetchFileMetadata, 
  } = useFileMetadata();

  const { fetchUploaderMetadata } = useUploaderMetadata();
  

  const tableClass = isDarkMode ? "p-datatable p-datatable-dark" : "p-datatable p-datatable-light";

  return (
    <div className={`dataset-container ${isDarkMode ? "dark-mode" : "light-mode"}`}>
      <h2>Catalog</h2>
      <Tooltip ref={tooltipRef}/>
      <CatalogFilters 
        filters={filters} 
        setFilters={setFilters} 
        fileTypes={fileTypes}
      />
      <ConfirmDialog />
      <DataTable
        loading={loading}
        value={datasets}
        lazy
        editMode="cell"
        paginator
        rows={lazyParams.rows}
        first={lazyParams.first}
        className={tableClass}
        selection={selectedRows}
        onSelectionChange={(e) => setSelectedRows(e.value)}
        dataKey="id"
        scrollable
        totalRecords={filteredRecords || totalRecords}
        sortField={lazyParams.sortField}
        sortOrder={lazyParams.sortOrder}
        filters={lazyParams.filters}
        rowsPerPageOptions={[10, 25, 50]}
        onPage={onPage}
        onSort={onSort}
        onFilter={onFilter}
        paginatorTemplate="RowsPerPageDropdown FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink"
        currentPageReportTemplate="{first} to {last} of {totalRecords}"
      >


        {/* Dynamically generated editable columns */}
        {catalogColumns(onCellEditComplete).map((col, index) => (
          <Column key={index} {...col} />
        ))}

        {/* Fixed "Actions" column */}
        <Column
          header="Actions"
          body={(rowData) => (
            <div className="flex gap-2">
              <Button 
                icon="pi pi-eye" 
                className="p-button-sm p-button-info p-button-text" 
                onClick={async () => {
                  try {
                    const uploaderMetadata = await fetchUploaderMetadata(rowData.id);
                    openJsonDialog('Uploader Metadata', uploaderMetadata);
                  } catch (error) {
                    console.error(error);
                    showMessage(toast, "error", "Failed to fetch uploader metadata.");
                  }
                }}
                tooltip="Uploader Metadata" 
                tooltipOptions={{ position: "top" }}
              />
              <Button 
                icon="pi pi-file" 
                className="p-button-sm p-button-help p-button-text" 
                onClick={async () => {
                  try {
                    const metadata = await fetchFileMetadata(rowData.id);
                    console.log(metadata);
                    openJsonDialog('File Metadata', metadata);
                  } catch (error) {
                    console.error(error);
                    showMessage(toast, "error", "Failed to fetch file metadata.");
                  }
                }}
                tooltip="File Metadata" 
                tooltipOptions={{ position: "top" }}
              />
              <Button
                icon="pi pi-external-link"
                className="p-button-sm p-button-secondary p-button-text"
                tooltip="View Report"
                tooltipOptions={{ position: "top" }}
                onClick={() => {
                  window.open(`/report_viewer/${rowData.id}`, '_blank');
                }}
              />
              <Button
                icon="pi pi-play"
                className="p-button-sm p-button-success p-button-text"
                onClick={() => {
                  setSelectedFileId(rowData.id);
                  setValidateDialogVisible(true);
                }}
                tooltip="Validate against suite IDs"
                tooltipOptions={{ position: "top" }}
              />

              <Button 
                icon="pi pi-list" 
                className="p-button-sm p-button-warning p-button-text" 
                onClick={async () => {
                  try {
                    await fetchValidationResults([rowData.id]);
                    setCurrentDatasetName(rowData.filename || "Unknown Dataset");
                    setValidationDialogVisible(true);
                  } catch (error) {
                    console.error(error);
                    // Error already handled inside the hook
                  }
                }}
                tooltip="Validation Results" 
                tooltipOptions={{ position: "top" }}
              />

              <Button 
                icon="pi pi-download" 
                className="p-button-sm p-button-text"  
                onClick={() => handleDownload(rowData.id)} 
                tooltip="Download file" 
                tooltipOptions={{ position: "top" }}
              />
              <Button 
                icon="pi pi-trash" 
                className="p-button-sm p-button-danger p-button-text" 
                onClick={() => handleDelete(rowData.id)} 
                tooltip="Delete file" 
                tooltipOptions={{ position: "top" }}
              />

            </div>
          )}
          frozen
          alignFrozen="right"
          style={{ width: "14rem" }}  // ➡ Wider to fit more buttons
        />

      </DataTable>

      <ValidateAgainstSuitesDialog
        visible={validateDialogVisible}
        onHide={() => setValidateDialogVisible(false)}
        onSubmit={handleValidateAgainstSuites}
        fileId={selectedFileId}
      />


      <ValidationResultsCatalog
        visible={validationDialogVisible}
        onHide={() => setValidationDialogVisible(false)}
        results={validationResults}
        datasetName={currentDatasetName}
      />    

      <JsonDialog
        visible={jsonDialogVisible}
        onHide={() => setJsonDialogVisible(false)}
        title={jsonDialogTitle}
        jsonData={jsonDialogData}
      />

      <Dialog
        header={`Validation Results for ${currentDatasetName}`}
        visible={validationDialogVisible}
        onHide={() => setValidationDialogVisible(false)}
        style={{ width: '60vw' }}
        modal
      >
        <DataTable value={validationResults} >
          <Column field="run_time" header="Run Time" body={(row) => new Date(row.run_time).toLocaleString()} />
          <Column field="suite_name" header="Suite Name" />
          <Column header="Actions" body={(row) => (
            <Button
              icon="pi pi-eye"
              className="p-button-sm p-button-info"
              tooltip="View Details"
              tooltipOptions={{ position: "top" }}
              onClick={() => {
                window.open(`/validation_results_viewer/${row.suite_id}/${row.dataset_id}`, '_blank');
              }}
            />
          )} />
        </DataTable>
      </Dialog>


      <Dialog
        header="Selected File Details"
        visible={showAllDialogVisible}
        onHide={() => setShowAllDialogVisible(false)}
        style={{ width: '50vw' }}
        modal
      >
        <pre style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
          {showAllDialogContent}
        </pre>
      </Dialog>



      {selectedRows?.length > 0 && (
      <div
        style={{
          marginTop: "1.5rem",
          display: "flex",
          gap: "1rem",
          flexWrap: "wrap",
          justifyContent: "flex-end",
        }}
      >
        <Button
          label={`Download ${selectedRows.length} File${selectedRows.length > 1 ? "s" : ""}`}
          icon="pi pi-download"
          className="p-button-success"
          onClick={() => {
            if (selectedRows.length === 1) {
              handleDownload(selectedRows[0].id);
            } else {
              handleDownloadMultiple(selectedRows.map((row) => row.id));
            }
          }}
        />

        <Button
          label={`Show ${selectedRows.length} File${selectedRows.length > 1 ? "s" : ""}`}
          icon="pi pi-info-circle"
          className="p-button-info"
          onClick={() => {
            const info = selectedRows
              .map((row) => `ID: ${row.id}\nPath: ${row.zenoh_file_path || row.path || "Unknown"}`)
              .join("\n\n");
            setShowAllDialogContent(info);
            setShowAllDialogVisible(true);
          }}
        />

      </div>
    )}



    </div>
  );
};

export default Catalog;
