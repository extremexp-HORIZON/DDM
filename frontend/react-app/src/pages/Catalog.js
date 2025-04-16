// src/pages/Catalog.js
import React, { useState,  useRef } from 'react';
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import CatalogFilters from "../components/CatalogFilters";
import { catalogColumns } from "../constants/catalogColumns";
import { useCatalogData } from "../hooks/useCatalogData";
import { useCatalogCellEditor } from "../hooks/useCatalogCellEditor";
import { useFileActions } from "../hooks/useFileActions";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Tooltip } from 'primereact/tooltip'; 
import "primereact/resources/themes/lara-light-blue/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";
import "primeflex/primeflex.css";

const Catalog = () => {
  const { isDarkMode } = useTheme();
  const toast = useToast();
  const tooltipRef = useRef(null);
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
    handleDelete 
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




  const tableClass = isDarkMode ? "p-datatable p-datatable-dark" : "p-datatable p-datatable-light";

  return (
    <div className={`dataset-container ${isDarkMode ? "dark-mode" : "light-mode"}`}>
      <h2>Catalog</h2>
      <Tooltip ref={tooltipRef}/>
      <CatalogFilters filters={filters} setFilters={setFilters} />
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
              <Button icon="pi pi-download" className="p-button-sm p-button-text"  onClick={() => handleDownload(rowData.id)} tooltip="Download file" tooltipOptions={{ position: "top" }}/>
              <Button icon="pi pi-trash" className="p-button-sm p-button-danger p-button-text" onClick={() => handleDelete(rowData.id)} tooltip="Delete file" tooltipOptions={{ position: "top" }}/>
            </div>
          )}
          frozen
          alignFrozen="right"
          style={{ width: "8rem" }}
        />
      </DataTable>
    </div>
  );
};

export default Catalog;
