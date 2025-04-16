import React from "react";
import { InputText } from "primereact/inputtext";
import { Button } from "primereact/button";
import SupportedFileTypesDialog from "./SupportedFileTypesDialog";
import { useSupportedFileTypesDialog } from "../hooks/useSupportedFileTypesDialog";
import { useTheme } from "../context/ThemeContext";


const UploadFormHeader = ({ 
  options, 
  projectId, 
  setProjectId,
  all_file_formats,
}) => {
  const { className, chooseButton } = options;
  const { showFileExtensions, setShowFileExtensions } = useSupportedFileTypesDialog();
  const { isDarkMode } = useTheme();

  return (
    <div
      className={className}
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        width: "100%",
        padding: "10px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <InputText
          placeholder="Enter Project ID"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="p-inputtext p-component"
        />

      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <Button
          icon="pi pi-info-circle"
          className="p-button-text p-button-sm"
          onClick={() => setShowFileExtensions(true)}
        />
        {chooseButton}
      </div>


      <SupportedFileTypesDialog
        visible={showFileExtensions}
        onHide={() => setShowFileExtensions(false)}
        isDarkMode={isDarkMode}
        all_file_formats={all_file_formats}
      />
    </div>
  );
};

export default UploadFormHeader;
