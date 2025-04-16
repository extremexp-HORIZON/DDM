import React, { useState, useRef } from "react";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import FileUploadPanel from "../components/FileUploadPanel";
import MetadataDialog from "../components/MetadataDialog";
import UploadFormHeader from "../components/UploadFormHeader";
import { useFileUploader } from "../hooks/useFileUploader";
import { useMetadataDialog } from "../hooks/useMetadataDialog";
import { UploaderMetadataAPI } from "../api/uploader_metadata";
import { FileUpload } from "primereact/fileupload";
import { Button } from "primereact/button";
import { showMessage } from "../utils/messages";

const FileUploader = () => {
  const { isDarkMode } = useTheme();
  const all_file_formats=true;
  const toast = useToast();
  const fileUploadRef = useRef(null);

  const [projectId, setProjectId] = useState("");

  const {
    files,
    setFiles,
    tempValues,
    metadataStore,
    setMetadataStore,
    uploading,
    handleTempChange,
    handleFieldChange,
    handleFieldSubmit,
    handleUpload,
    onUpload,
    extractFileName,
    downloadHtmlReport,
  } = useFileUploader({ toast, fileUploadRef });

  const {
    metadataDialog,
    setMetadataDialog,
    metadataInput,
    setMetadataInput,
    metadataFile,
    setMetadataFile,
    currentFileId,
    setCurrentFileId,
    isMetadataFile,
    setIsMetadataFile,
  } = useMetadataDialog();
  


  const handleShowMetadataDialog = (fileId) => {
    const file = files.find((f) => f.id === fileId);
    if (!file) return;

    setCurrentFileId(fileId);

    const cached = metadataStore[fileId]?.metadata;
    if (cached && typeof cached === "object") {
      setMetadataInput(JSON.stringify(cached, null, 2));
    } else {
      setMetadataInput("{}");
    }

    setMetadataFile(null);
    setMetadataDialog(true);
  };

  const handleMetadataFileSelect = async (event) => {
    if (event.files.length > 0) {
      const file = event.files[0];
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("Uploader metadata must be a valid JSON object.");
        }
        setMetadataInput(JSON.stringify(parsed, null, 2));
        setMetadataFile(parsed);
        showMessage(toast, "success", "Metadata file selected successfully.");
      } catch (err) {
        setMetadataFile(null);
        showMessage(toast, "error", `Invalid metadata file: ${err.message}`);
      }
    }
  };

  const handleSubmit = async () => {
    if (!currentFileId) {
      showMessage(toast, "error", "No file selected.");
      return;
    }
  
    const data = metadataFile || metadataInput;
    let parsed;
  
    try {
      parsed = typeof data === "string" ? JSON.parse(data) : data;
      if (typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Metadata must be a valid JSON object.");
      }
    } catch (err) {
      showMessage(toast, "error", `Invalid metadata: ${err.message}`);
      return;
    }
  
    const existing = metadataStore[currentFileId]?.metadata;
    const isEqual = JSON.stringify(existing) === JSON.stringify(parsed);
  
    if (isEqual) {
      showMessage(toast, "info", "No changes detected in metadata.");
    } else if (currentFileId.startsWith("temp-")) {
      // 🟡 Temp file: save locally
      setMetadataStore((prev) => ({
        ...prev,
        [currentFileId]: {
          ...(prev[currentFileId] || {}),
          metadata: parsed,
          metadataSubmitted: false,
        },
      }));
      showMessage(toast, "info", "Metadata updated locally and will be uploaded with the file.");
    } else {
      // ✅ Uploaded file: make API call
      try {
        const res = await UploaderMetadataAPI.upload(currentFileId, parsed);
        console.log("✅ Metadata uploaded:", res);
  
        setMetadataStore((prev) => ({
          ...prev,
          [currentFileId]: {
            ...(prev[currentFileId] || {}),
            metadata: parsed,
            metadataSubmitted: true,
          },
        }));
        showMessage(toast, "success", "Metadata uploaded successfully.");
      } catch (err) {
        showMessage(toast, "error", err.message || "Failed to upload metadata.");
        return;
      }
    }
    // Clean up after dialog
    setMetadataDialog(false);
    setMetadataFile(null);
    setMetadataInput("{}");
    setCurrentFileId(null);
  };
  
  

  return (
    <div className={`dataset-container ${isDarkMode ? "dark-mode" : "light-mode"}`}>
      <h2>Upload Files and Metadata</h2>

      <FileUpload
        ref={fileUploadRef}
        mode="advanced"
        customUpload
        uploadHandler={onUpload}
        multiple
        auto
        headerTemplate={(options) => (
        <UploadFormHeader
          options={options}
          projectId={projectId}
          setProjectId={setProjectId}
          all_file_formats={all_file_formats}
        />
        )}
        itemTemplate={() => null}
        emptyTemplate={
          files.length === 0 ? (
            <div className="flex align-items-center flex-column text-sm text-gray-500 dark:text-gray-300">
              <i className="pi pi-cloud-upload text-2xl text-primary" />
              <p className="ms-1 text-primary">Drag and drop files here</p>
            </div>
          ) : null
        }
      />

      <FileUploadPanel
        isDarkMode={isDarkMode}
        files={files}
        tempValues={tempValues}
        metadataStore={metadataStore}
        setFiles={setFiles}
        extractFileName={extractFileName}
        setMetadataStore={setMetadataStore}
        handleTempChange={handleTempChange}
        handleFieldChange={handleFieldChange}
        handleFieldSubmit={handleFieldSubmit}
        downloadHtmlReport={downloadHtmlReport}
        showMetadataDialog={handleShowMetadataDialog}
      />

      <Button
        label="Upload All"
        className="p-button-outlined mt-3"
        onClick={() => handleUpload(projectId)}
        disabled={uploading}
      />

      <MetadataDialog
        isDarkMode={isDarkMode}
        visible={metadataDialog}
        onHide={() => setMetadataDialog(false)}
        isMetadataFile={isMetadataFile}
        setIsMetadataFile={setIsMetadataFile}
        metadataInput={metadataInput}
        setMetadataInput={setMetadataInput}
        onMetadataFileSelect={handleMetadataFileSelect}
        currentFileId={currentFileId}
        onSubmit={handleSubmit} // 👈 this one from here
      />
    </div>
  );
};

export default FileUploader;
