import React, { useState, useRef } from "react";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import { useExpectationSuites } from "../hooks/useExpectationSuites";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Tooltip } from "primereact/tooltip";
import ExpectationSuiteFilters from "../components/ExpectationSuiteFilters";
import { formatDate } from '../utils/dateFormatter';
import { useSupportedFileTypes } from '../hooks/useSupportedFileTypes';
import { itemTemplate } from '../utils/categoryOptions';
import { Button } from "primereact/button"; 
import { getFileIconFromExt } from "../utils/icons";
import ExpecationSuiteViewerDialog from "../components/ExpectationSuiteViewerDialog";

const fileTypesWithIconsTemplate = (rowData) => {
  if (!rowData.file_types?.length) return null;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
      {rowData.file_types.map((ext, idx) => {
        const icon = getFileIconFromExt(ext);
        const id = `ft-icon-${rowData.id}-${idx}`; // unique id for tooltip target

        return (
          <div
            key={id}
            id={id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "2rem",
              height: "2rem",
              borderRadius: "4px",
              cursor: "default",
            }}
          >
            {icon}
            <Tooltip target={`#${id}`} content={ext} position="top" />
          </div>
        );
      })}
    </div>
  );
};


const ExpectationSuites = () => {
  const { isDarkMode } = useTheme();
  const toast = useToast();
  const tooltipRef = useRef(null);

  const [filters, setFilters] = useState({
    suite_name: [],
    file_types: [],
    category: [],
    use_case: [],
    user_id: [],
    created_from: null,
    created_to: null,
  });

  const [selectedFileTypes, setSelectedFileTypes] = useState([]);
  const [viewDialogVisible, setViewDialogVisible] = useState(false);
  const [selectedSuite, setSelectedSuite] = useState(null);
  const { 
    fileTypes, 
    loading: fileTypesLoading, 
    error: fileTypesError 
  } = useSupportedFileTypes();

  const {
    suites,
    lazyParams,
    setLazyParams,
    loading,
    totalRecords,
  } = useExpectationSuites(filters, toast);


  const tableClass = isDarkMode
    ? "p-datatable p-datatable-dark"
    : "p-datatable p-datatable-light";

  const onPage = (event) => {
    setLazyParams((prev) => ({ ...prev, first: event.first, rows: event.rows }));
  };

  const onSort = (event) => {
    setLazyParams((prev) => ({
      ...prev,
      sortField: event.sortField || prev.sortField,
      sortOrder: event.sortOrder || prev.sortOrder,
    }));
  };

  const handleView = (rowData) => {
    setSelectedSuite(rowData);
    setViewDialogVisible(true);
  };

  const handleDownload = (id) => {
    const result = suites.find((r) => r.id === id);
    if (!result) return;
  
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
  
    const a = document.createElement("a");
    a.href = url;
    a.download = `${result.dataset_name || "expectation_suite"}_${id}.json`;
    a.click();
  
    URL.revokeObjectURL(url);
  };
  
  
 

  return (
    <div className={`dataset-container ${isDarkMode ? "dark-mode" : "light-mode"}`}>
      <h2>Expectation Suites</h2>
      <Tooltip ref={tooltipRef} />
      
      <ExpectationSuiteFilters 
        filters={filters} 
        setFilters={setFilters} 
        selectedFileTypes={selectedFileTypes}
        setSelectedFileTypes={setSelectedFileTypes}
        itemTemplate={itemTemplate}
        fileTypes={fileTypes}
        fileTypesLoading={fileTypesLoading}
        fileTypesError={fileTypesError}
        isDarkMode={isDarkMode}
        />

      <DataTable
        value={suites}
        loading={loading}
        paginator
        lazy
        rows={lazyParams.rows}
        first={lazyParams.first}
        className={tableClass}
        scrollable
        totalRecords={totalRecords}
        sortField={lazyParams.sortField}
        sortOrder={lazyParams.sortOrder}
        onPage={onPage}
        onSort={onSort}
        rowsPerPageOptions={[10, 25, 50]}
        paginatorTemplate="RowsPerPageDropdown FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink"
        currentPageReportTemplate="{first} to {last} of {totalRecords}"
        >
        <Column field="suite_name" header="Suite Name" sortable />

        <Column
          field="category"
          header="Category"
          sortable
          body={(rowData) => itemTemplate({ value: rowData.category })}
        />
        <Column 
          field="file_types" 
          header="File Types" 
          body={fileTypesWithIconsTemplate} 
          sortable 
        />
        <Column 
          field="user_id" 
          header="User ID" 
          sortable 
        />
        <Column 
          field="created" 
          header="Created" 
          body={(rowData) => formatDate(rowData.created)} 
          sortable 
        />
        <Column
          header="Actions"
          body={(rowData) => (
            <div className="flex gap-2">
              <Button
                icon="pi pi-eye"
                className="p-button-sm p-button-info p-button-text"
                onClick={() => handleView(rowData)}
                tooltip="View details"
                tooltipOptions={{ position: "top" }}
              />
              <Button
                icon="pi pi-download"
                className="p-button-sm p-button-success p-button-text"
                onClick={() => handleDownload(rowData.id)}
                tooltip="Download file"
                tooltipOptions={{ position: "top" }}
              />
            </div>
          )}
          frozen
          alignFrozen="right"
          style={{ width: "9.5rem" }}
        />

      </DataTable>
      <ExpecationSuiteViewerDialog
        visible={viewDialogVisible}
        onHide={() => setViewDialogVisible(false)}
        suite={selectedSuite}
        isDarkMode={isDarkMode}
      />
    </div>
  );
};

export default ExpectationSuites;
