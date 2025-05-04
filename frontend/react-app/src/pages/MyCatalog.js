import React, { useState } from "react";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext"; 
import CatalogRowExpansion from "../components/CatalogRowExpansion";
import CatalogFilters from "../components/CatalogFilters";
import { catalogColumns } from "../constants/catalogColumns";
import { useAllFileTypes } from "../hooks/useAllFileTypes";
import { useFileActions } from "../hooks/useFileActions";
import { useMyCatalogData } from "../hooks/useMyCatalogData";
import { useCatalogCellEditor } from "../hooks/useCatalogCellEditor";

import "primereact/resources/themes/lara-light-blue/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";
import "primeflex/primeflex.css";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button"; 
import { Dialog } from "primereact/dialog";

const MyCatalog = () => {
  const { isDarkMode } = useTheme(); 


  const [showAllDialogVisible, setShowAllDialogVisible] = useState(false);
  const [showAllDialogContent, setShowAllDialogContent] = useState('');

  const toast = useToast();

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
    handleDownloadMultiple
  } = useFileActions(reload);
  
   
  return (
    <div className={`dataset-container ${isDarkMode ? "dark-mode" : "light-mode"}`}>
      <h2>Catalog</h2>
      
      {/* Filters Panel */}
      <CatalogFilters 
        filters={filters} 
        setFilters={setFilters} 
        fileTypes={fileTypes}

      />
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
          </div>
        )}

    </div>
  );
};

export default MyCatalog;
