import React from "react";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Chips } from "primereact/chips";
import { Tag } from "primereact/tag";
import { getSeverity } from "../utils/severity";
import { getFileIconFromExt } from "../utils/icons";
import { formatFileSize } from "../utils/fileSizeFormatter"
import { formatDate } from '../utils/dateFormatter';

// Text input for inline editing
const textEditor = (options) => (
  <InputText
    type="text"
    value={options.value ?? ""}
    onChange={(e) => options.editorCallback(e.target.value)}
  />
);

// Text area for multiline editing
const textAreaEditor = (options) => (
  <InputTextarea
    value={options.value ?? ""}
    onChange={(e) => options.editorCallback(e.target.value)}
    rows={3}
    autoResize
    style={{ width: "100%" }}
  />
);

// Chips for tag-style use case editing
const chipsEditor = (options) => (
  <Chips
    value={Array.isArray(options.value) ? options.value : []}
    onChange={(e) => options.editorCallback(e.value || [])}
    separator=","
    itemTemplate={(option) => {
      const { display, color, icon } = getSeverity(option);
      return (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.2rem",
            padding: "0.1rem 0.2rem",
            color,
            border: `1px solid ${color}`,
            borderRadius: "0.2rem",
            backgroundColor: "transparent",
          }}
        >
          <i className={icon} style={{ fontSize: "1rem", color }}></i>
          <span>{display}</span>
        </div>
      );
    }}
  />
);

// For displaying use cases nicely
const useCaseTemplate = (rowData) => {
  if (!rowData.use_case) return null;

  const useCases = Array.isArray(rowData.use_case)
    ? rowData.use_case
    : rowData.use_case.split(",");

  return (
    <div style={{ display: "flex", flexWrap: "nowrap", gap: "0.3rem", overflowX: "auto" }}>
      {useCases.map((useCase, index) => {
        const { display, color, icon } = getSeverity(useCase);
        return (
          <Tag
            key={index}
            value={display}
            icon={icon}
            style={{
              color,
              backgroundColor: "transparent",
              border: `1px solid ${color}`,
              borderRadius: "0.3rem",
              padding: "0.2rem 0.5rem",
              whiteSpace: "nowrap",
            }}
          />
        );
      })}
    </div>
  );
};

const filenameWithIconTemplate = (rowData) => {
  const icon = getFileIconFromExt(rowData.file_type);
  const name = rowData.upload_filename || "Unnamed";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      {icon}
      <span>{name}</span>
    </div>
  );
};


const fileSizeTemplate = (rowData) => {
  return formatFileSize(rowData.file_size);
};


// For rendering parent file JSON block
const parentFilesTemplate = (data) => {
  const parentFiles = data.parent_files;

  if (!parentFiles || Object.keys(parentFiles).length === 0) {
    return <span>No relational files available</span>;
  }

  return (
    <pre style={{ whiteSpace: "pre-wrap", wordWrap: "break-word", maxHeight: "400px", overflow: "auto", padding: "10px" }}>
      {JSON.stringify(parentFiles, null, 2)}
    </pre>
  );
};

export const catalogColumns = (onCellEditComplete) => [
  {
    selectionMode: "multiple",
    style: { width: "3em" },
  },
  {
    field: "upload_filename",
    header: "Filename",
    editor: textEditor,
    body: filenameWithIconTemplate, // 👈 Here you use the icon-rendering function
    onCellEditComplete,
    sortable: true,
  },  
  {
    field: "description",
    header: "Description",
    editor: textAreaEditor,
    onCellEditComplete,
    sortable: true,
  },
  {
    field: "project_id",
    header: "Project",
    editor: textEditor,
    onCellEditComplete,
    sortable: true,
  },
  {
    field: "use_case",
    header: "Use Cases",
    body: useCaseTemplate,
    editor: chipsEditor,
    onCellEditComplete,
    sortable: true,
  },
  {
    field: "created",
    header: "Created",
    body: (rowData) => formatDate(rowData.created),
    sortable: true,
  },
  {
    field: "file_type",
    header: "File Type",
    sortable: true,
  },
  {
    field: "file_size",
    header: "File Size",
    body: fileSizeTemplate,
    sortable: true,
  },  
  {
    field: "user_id",
    header: "User",
    sortable: true,
  },
  {
    field: "parent_files",
    header: "Parent Files",
    body: parentFilesTemplate,
    sortable: true,
  },
  {
    field: "recdeleted",
    header: "Deleted",
    sortable: true,
    hidden: true,
  },
];
