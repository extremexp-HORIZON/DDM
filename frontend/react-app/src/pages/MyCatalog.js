import React, { useState } from "react";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext"; 
import CatalogRowExpansion from "../components/CatalogRowExpansion";
import CatalogFilters from "../components/CatalogFilters";
import { ConfirmDialog } from "../components/ConfirmDialog";

import { catalogColumns } from "../constants/catalogColumns";
import { useAllFileTypes } from "../hooks/useAllFileTypes";
import { useFileActions } from "../hooks/useFileActions";
import { useMyCatalogData } from "../hooks/useMyCatalogData";
import { useCatalogCellEditor } from "../hooks/useCatalogCellEditor";
import { useValidations } from "../hooks/useValidations";

import "primereact/resources/themes/lara-light-blue/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";
import "primeflex/primeflex.css";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button"; 
import { Dialog } from "primereact/dialog";

import { useFileMetadata } from "../hooks/useFileMetadata";
import { useUploaderMetadata } from "../hooks/useUploaderMetadata";
import { useValidationResultsByDataset } from "../hooks/useValidationResultsByDataset";
import JsonDialog from "../components/JsonDialog";
import ValidateAgainstSuitesDialog from "../components/ValidateAgainstSuitesDialog";
import ValidationResultsCatalog from "../components/ValidationResultsCatalog";
import { showMessage } from '../utils/messages';


const MyCatalog = () => {
  const { isDarkMode } = useTheme(); 
  const toast = useToast();

  const [jsonDialogVisible, setJsonDialogVisible] = useState(false);
  const [jsonDialogTitle, setJsonDialogTitle] = useState("");
  const [jsonDialogData, setJsonDialogData] = useState(null);
  const openJsonDialog = (title, data) => {
    setJsonDialogTitle(title);
    setJsonDialogData(data);
    setJsonDialogVisible(true);
  };

  const { fetchFileMetadata } = useFileMetadata();
  const { fetchUploaderMetadata } = useUploaderMetadata();

  const {
    validationResults,
    fetchValidationResults
  } = useValidationResultsByDataset(toast);

  const [validationDialogVisible, setValidationDialogVisible] = useState(false);
  const [currentDatasetName, setCurrentDatasetName] = useState("");

  const [validateDialogVisible, setValidateDialogVisible] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState(null);

  const { validateFileAgainstSuites } = useValidations();
  
  const [showAllDialogVisible, setShowAllDialogVisible] = useState(false);
  const [showAllDialogContent, setShowAllDialogContent] = useState('');


  const { 
    fileTypes
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
  } = useMyCatalogData(filters, toast);
  
  const { onCellEditComplete } = useCatalogCellEditor(toast, datasets, setDatasets);

  const [expandedRows, setExpandedRows] = useState({}); 
  const [selectedRows, setSelectedRows] = useState(null); 
  const [activeTabIndex, setActiveTabIndex] = useState(0); 

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
      first: 0, // Reset to first page when filtering
    }));
    setFilters(event.filters); // Ensure filters update state
    reload(); // Trigger data fetching immediately
  };
  

  const expandAll = () => {
    const allExpandedRows = {};
    datasets.forEach((dataset) => {
      allExpandedRows[dataset.id] = true; // Expand all rows by setting their ID to true
    });
    setExpandedRows(allExpandedRows);
  };

  // Function to collapse all rows
  const collapseAll = () => {
    setExpandedRows({}); 
  };

  const rowExpansionTemplate = (data) => (
    <CatalogRowExpansion
      data={data}
      activeTabIndex={activeTabIndex}
      setActiveTabIndex={setActiveTabIndex}
    />
  );
  
  const tableClass = isDarkMode ? "p-datatable p-datatable-dark" : "p-datatable p-datatable-light";

  const expanderHeaderTemplate = () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      {Object.keys(expandedRows).length === datasets.length ? (
        <Button
          icon="pi pi-chevron-down"
          onClick={collapseAll}
          className="p-button-sm p-button-text"
          title="Collapse All"
        />
      ) : (
        <Button
          icon="pi pi-chevron-right"
          onClick={expandAll}
          className="p-button-sm p-button-text"
          title="Expand All"
        />
      )}
    </div>
  );

  const { 
    handleDownload, 
    handleDelete, 
    handleDownloadMultiple,
    handleDeleteMultiple
  } = useFileActions(reload);
  
   
  return (
    <div className={`dataset-container ${isDarkMode ? "dark-mode" : "light-mode"}`}>
      <h2>My Catalog</h2>
      
      {/* Filters Panel */}
      <CatalogFilters 
        filters={filters} 
        setFilters={setFilters} 
        fileTypes={fileTypes}

      />
      <JsonDialog
        visible={jsonDialogVisible}
        onHide={() => setJsonDialogVisible(false)}
        title={jsonDialogTitle}
        jsonData={jsonDialogData}
      />
      <ValidateAgainstSuitesDialog
        visible={validateDialogVisible}
        onHide={() => setValidateDialogVisible(false)}
        onSubmit={(suiteIds) => validateFileAgainstSuites(selectedFileId, suiteIds)}
        fileId={selectedFileId}
      />

      <ValidationResultsCatalog
        visible={validationDialogVisible}
        onHide={() => setValidationDialogVisible(false)}
        results={validationResults}
        datasetName={currentDatasetName}
      />    

      <ConfirmDialog />

      {/* DataTable */}
      <DataTable
        loading={loading}
        value={datasets}
        lazy
        editMode="cell"
        paginator
        rows={lazyParams.rows}
        first={lazyParams.first} 
        className={tableClass}
        expandedRows={expandedRows}
        onRowToggle={(e) => {
          const newExpandedRows = e.data; // Now this contains an object
          setExpandedRows(newExpandedRows);
        }}
        rowExpansionTemplate={rowExpansionTemplate}
        selection={selectedRows}
        onSelectionChange={(e) => setSelectedRows(e.value)}
        dataKey="id"
        scrollable
        totalRecords={filteredRecords || totalRecords}
        sortField={lazyParams.sortField}
        sortOrder={lazyParams.sortOrder}
        filters={lazyParams.filters}
        rowsPerPageOptions={[10, 25, 50]}  
        paginatorTemplate="RowsPerPageDropdown FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink"
        currentPageReportTemplate="{first} to {last} of {totalRecords}"
        onPage={onPage}
        onSort={onSort}
        onFilter={onFilter}
      >
      {/* Selection + Expander still need to be declared separately */}

      <Column expander header={expanderHeaderTemplate} style={{ width: "1em" }} />

      {/* Dynamically generate the rest */}
      {catalogColumns(onCellEditComplete).map((col, index) => (
        <Column key={index} {...col} />
      ))}

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
                  await fetchValidationResults(rowData.id);
                  setCurrentDatasetName(rowData.id || "Unknown Dataset");
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
              onClick={() => handleDownload(rowData.id,rowData.filename)} 
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
            <Button
              label={`Delete ${selectedRows.length} File${selectedRows.length > 1 ? "s" : ""}`}
              icon="pi pi-trash"
              className="p-button-danger"
              onClick={() => {
                handleDeleteMultiple(
                  selectedRows.map(row => row.id),
                  () => setSelectedRows(null)  // Clear selection after successful delete
                );
              }}
            />
          </div>
        )}

    </div>
  );
};

export default MyCatalog;
