import React, { useState,useRef, useEffect } from "react";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { Tooltip } from "primereact/tooltip";
import { formatDate } from "../utils/dateFormatter";
import ValidationResultsViewerDialog from "../components/ValidationResultsViewerDialog";
import ValidationResultsFilters from "../components/ValidationResultsFilters";
import { useValidationResults } from "../hooks/useValidationResults";
import { useToast } from "../context/ToastContext";
import { useTheme } from "../context/ThemeContext";

const ValidationResults = () => {
    const [selectedResult, setSelectedResult] = useState(null);
    const [viewDialogVisible, setViewDialogVisible] = useState(false);
    const { isDarkMode } = useTheme();
    const toast = useToast();
    const tooltipRef = useRef(null);

    const handleView = (result) => {
        setSelectedResult(result);
        setViewDialogVisible(true);
    };

    const handleDownload = (id) => {
        const result = results.find((r) => r.id === id);
        if (!result) return;
      
        const blob = new Blob([JSON.stringify(result, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
      
        const a = document.createElement("a");
        a.href = url;
        a.download = `${result.dataset_name || "expectation_result"}_${id}.json`;
        a.click();
      
        URL.revokeObjectURL(url);
      };
      
      

    const [filters, setFilters] = useState({
        dataset_name: [],
        suite_id: [],
        user_id: [],
        run_time_from: null,
        run_time_to: null,
      });


    
    const {
        results,
        lazyParams,
        setLazyParams,
        loading,
        totalRecords,
        reload
    } = useValidationResults(filters, toast);
  
      
    useEffect(() => {
        setLazyParams((prev) => ({ ...prev, first: 0 }));
    }, [filters, setLazyParams]);
        
    


  return (
    <div className={`dataset-container ${isDarkMode ? "dark-mode" : "light-mode"}`}>
      <h2>Validation Results</h2>
      <Tooltip ref={tooltipRef} />
      

      <ValidationResultsFilters
        filters={filters}
        setFilters={setFilters}
        isDarkMode={isDarkMode}
        />

      <DataTable
        value={results}
        rowKey={(rowData) => rowData.id}
        lazy
        paginator
        loading={loading}
        totalRecords={totalRecords}
        rows={lazyParams.rows}
        first={lazyParams.first}
        sortField={lazyParams.sortField}
        sortOrder={lazyParams.sortOrder}
        onPage={(e) => setLazyParams(prev => ({ ...prev, first: e.first, rows: e.rows }))}
        onSort={(e) => setLazyParams(prev => ({ ...prev, sortField: e.sortField, sortOrder: e.sortOrder }))}
        rowsPerPageOptions={[10, 25, 50]}
        paginatorTemplate="RowsPerPageDropdown FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink"
        currentPageReportTemplate="{first} to {last} of {totalRecords}"
        >

        <Column field="dataset_name" header="Dataset Name" sortable />
        <Column
          field="run_time"
          header="Run Time"
          sortable
          body={(rowData) => formatDate(rowData.run_time)}
        />
        <Column field="user_id" header="User ID" sortable />
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

      <ValidationResultsViewerDialog
        visible={viewDialogVisible}
        onHide={() => setViewDialogVisible(false)}
        result={selectedResult}
        isDarkMode={isDarkMode}
      />
    </div>
  );
};

export default ValidationResults;
