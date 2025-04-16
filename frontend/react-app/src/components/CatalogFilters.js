// components/CatalogFilters.js
import React from "react";
import { Calendar } from "primereact/calendar";
import { Chips } from "primereact/chips";
import { InputText } from "primereact/inputtext";

const CatalogFilters = ({ filters, setFilters }) => {
  return (
    <div className="filters-panel">
      <div className="filter-item">
        <label>Filenames:</label>
        <Chips
          value={filters.filename}
          onChange={(e) => setFilters({ ...filters, filename: e.value })}
          placeholder={filters.filename?.length ? "" : "  Add filenames"}
        />
      </div>

      <div className="filter-item">
        <label>Project ID:</label>
        <Chips
          value={filters.project_id}
          onChange={(e) => setFilters({ ...filters, project_id: e.value })}
          placeholder={filters.project_id?.length ? "" : "  Add Project IDs"}
        />
      </div>

      <div className="filter-item">
        <label>Use Cases:</label>
        <Chips
          value={filters.use_case}
          onChange={(e) => setFilters({ ...filters, use_case: e.value })}
          placeholder={filters.use_case?.length ? "" : "  Add use cases"}
        />
      </div>

      <div className="filter-item">
        <label>From Date:</label>
        <Calendar
          value={filters.fromDate}
          onChange={(e) => setFilters({ ...filters, fromDate: e.value })}
          showTime
          showButtonBar 
          placeholder={!filters.fromDate ? "From Datetime" : ""}
        />
      </div>

      <div className="filter-item">
        <label>To Date:</label>
        <Calendar
          value={filters.toDate}
          onChange={(e) => setFilters({ ...filters, toDate: e.value })}
          showTime
          showButtonBar 
          placeholder={!filters.toDate ? "To Datetime" : ""}
        />
      </div>

      <div className="filter-item">
        <label>File Types:</label>
        <Chips
          value={filters.file_type}
          onChange={(e) => setFilters({ ...filters, file_type: e.value })}
          placeholder={filters.file_type?.length ? "" : "  Add file types"}
        />
      </div>

      <div className="filter-item">
        <label>User IDs:</label>
        <Chips
          value={filters.user_id}
          onChange={(e) => setFilters({ ...filters, user_id: e.value })}
          placeholder={filters.user_id?.length ? "" : "  Add user IDs"}
        />
      </div>

      <div className="filter-item">
        <label>Parent Files:</label>
        <Chips
          value={filters.parent_files}
          onChange={(e) => setFilters({ ...filters, parent_files: e.value })}
          placeholder={filters.parent_files?.length ? "" : "  Add Parent Files"}
        />
      </div>

      <div className="filter-item">
        <label>Min File Size:</label>
        <InputText
          type="number"
          value={filters.size_from}
          onChange={(e) => setFilters({ ...filters, size_from: e.target.value })}
          placeholder="Min Bytes"
        />
      </div>

      <div className="filter-item">
        <label>Max File Size:</label>
        <InputText
          type="number"
          value={filters.size_to}
          onChange={(e) => setFilters({ ...filters, size_to: e.target.value })}
          placeholder="Max Bytes"
        />
      </div>
    </div>
  );
};

export default CatalogFilters;
