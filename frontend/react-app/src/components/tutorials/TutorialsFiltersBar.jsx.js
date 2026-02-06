// src/components/tutorials/TutorialsFiltersBar.jsx
import React from "react";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";

export default function TutorialsFiltersBar({
  globalFilter,
  onChangeGlobalFilter,
  statusFilter,
  onChangeStatusFilter,
}) {
  const statusOptions = [
    { label: "All", value: "all" },
    { label: "Pending", value: "pending" },
    { label: "Submitted", value: "submitted" },
    { label: "Passed", value: "passed" },
    { label: "Rejected", value: "rejected" },
  ];

  return (
    <div className="flex gap-2 items-center mb-2" style={{ flexWrap: "wrap" }}>
      <Dropdown
        value={statusFilter}
        options={statusOptions}
        onChange={(e) => onChangeStatusFilter?.(e.value)}
        placeholder="Status"
        style={{ minWidth: "12rem" }}
      />
      <span className="p-input-icon-left" style={{ minWidth: "18rem" }}>
        <i className="pi pi-search" />
        <InputText
          value={globalFilter}
          onChange={(e) => onChangeGlobalFilter?.(e.target.value)}
          placeholder="Search tutorial…"
          style={{ width: "100%" }}
        />
      </span>
    </div>
  );
}
