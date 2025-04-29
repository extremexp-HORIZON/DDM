import React from "react";
import { Chips } from "primereact/chips";
import { Calendar } from "primereact/calendar";
import { MultiSelect } from "primereact/multiselect";
import { fileTypeItemTemplate } from "../utils/icons";
import { categoryOptions, itemTemplate } from "../utils/categoryOptions";
import "../styles/components/form.css";

const ExpectationSuiteFilters = ({
  filters,
  setFilters,
  fileTypes,
  fileTypesLoading,
  fileTypesError,
  isDarkMode,
}) => {
  const update = (key, value) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const inputBlock = (label, content) => (
    <div className="filter-item" style={{ flex: "1 1 45%" }}>
      <label>{label}:</label>
      {content}
    </div>
  );

  return (
    <div
      className={isDarkMode ? "dark-mode" : ""}
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "1rem",
        marginBottom: "1.5rem",
        alignItems: "flex-end",
      }}
    >
      {inputBlock(
        "Categories",
        <MultiSelect
          value={filters.category}
          options={categoryOptions}
          onChange={(e) => update("category", e.value)}
          placeholder="Select categories"
          display="chip"
          filter
          itemTemplate={itemTemplate}
          className={`filter-input ${isDarkMode ? "dark-mode" : ""}`}
        />
      )}
      {inputBlock(
        "File Types",
        <MultiSelect
          value={filters.file_types}
          options={fileTypes}
          onChange={(e) => update("file_types", e.value)}
          placeholder="Select File Types"
          display="chip"
          filter
          itemTemplate={fileTypeItemTemplate}
          disabled={fileTypesLoading || !!fileTypesError}
          className={`filter-input ${isDarkMode ? "dark-mode" : ""}`}
        />
      )}
      {inputBlock(
        "Suite Names",
        <Chips
          value={filters.suite_name}
          onChange={(e) => update("suite_name", e.value)}
          placeholder="Add suite names"
          className={`filter-input ${isDarkMode ? "dark-mode" : ""}`}
        />
      )}

      {inputBlock(
        "User IDs",
        <Chips
          value={filters.user_id}
          onChange={(e) => update("user_id", e.value)}
          placeholder="Add user IDs"
          className={`filter-input ${isDarkMode ? "dark-mode" : ""}`}
        />
      )}

      {inputBlock(
        "From Date",
        <Calendar
          value={filters.created_from}
          onChange={(e) => update("created_from", e.value)}
          showTime
          showButtonBar
          placeholder="From Date"
          className={`filter-input ${isDarkMode ? "dark-mode" : ""}`}
        />
      )}

      {inputBlock(
        "To Date",
        <Calendar
          value={filters.created_to}
          onChange={(e) => update("created_to", e.value)}
          showTime
          showButtonBar
          placeholder="To Date"
          className={`filter-input ${isDarkMode ? "dark-mode" : ""}`}

        />
      )}
    </div>
  );
};

export default ExpectationSuiteFilters;
