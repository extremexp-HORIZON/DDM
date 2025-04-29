import React from "react";
import { Chips } from "primereact/chips";
import { Calendar } from "primereact/calendar";
import "../styles/components/form.css";

const ValidationResultsFilters = ({
  filters,
  setFilters,
  isDarkMode,
}) => {
  const update = (key, value) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const inputBlock = (label, content) => (
    <div className="filter-item" style={{ flex: "1 1 45%" }} key={label}>
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
        "Dataset Names",
        <Chips
          value={filters.dataset_name}
          onChange={(e) => update("dataset_name", e.value)}
          placeholder="Add dataset names"
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
        "From Run Time",
        <Calendar
          value={filters.run_time_from}
          onChange={(e) => update("run_time_from", e.value)}
          showTime
          showButtonBar
          placeholder="From date"
          className={`filter-input ${isDarkMode ? "dark-mode" : ""}`}
        />
      )}

      {inputBlock(
        "To Run Time",
        <Calendar
          value={filters.run_time_to}
          onChange={(e) => update("run_time_to", e.value)}
          showTime
          showButtonBar
          placeholder="To date"
          className={`filter-input ${isDarkMode ? "dark-mode" : ""}`}
        />
      )}
    </div>
  );
};

export default ValidationResultsFilters;
