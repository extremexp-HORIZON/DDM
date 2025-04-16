// src/pages/FileUploader.js
import React, { useState } from "react";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import MetadataDialog from "../components/MetadataDialog";
import FileUploadPanel from "../components/FileUploadPanel";
import UploadFormHeader from "../components/UploadFormHeader";
import { useMetadataDialog} from "../hooks/useMetadataDialog"
import { useChunkUploader } from "../hooks/useChunkUploader";
import { UploaderMetadataAPI } from "../api/uploader_metadata";
import { downloadHtmlReport } from "../utils/downloadHtmlReport";
import { showMessage } from "../utils/messages";
import { FileUpload } from "primereact/fileupload";

const ChunkUploader = () => {
  const toast = useToast();
  const { isDarkMode } = useTheme();
  const [files, setFiles] = useState([]);
  const [projectId, setProjectId] = useState("");
  const [tempDescription, setTempDescription] = useState({});
  const [tempUseCases, setTempUseCases] = useState({});
  const [tempFilename, setTempFilename] = useState({});
  const [metadataStore, setMetadataStore] = useState({});
  const all_file_formats=true;

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

  const { 
    uploadFile, 
    updateField, 
    extractFileName 
  } = useChunkUploader({ setFiles });

  const onUpload = (event) => {
    if (!projectId.trim()) {
      showMessage(toast, "error", "Project ID is required.");
      return;
    }
    const uploadedFiles = event.files.map((file) => {
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      return {
        id: tempId,
        file,
        progress: 0,
        statuses: [
          { step: "Uploading", status: "⏳ Uploading." },
          { step: "Merging", status: "⏳ Waiting for merge" },
          { step: "Processing", status: "⏳ Waiting for report" }
        ],
        collapsed: true,
        mergeTaskId: null,
        metadataTaskId: null,
        profileHtml: "",
        startTime: Date.now(),
        projectId
      };
    });

    setFiles(prevFiles => [...prevFiles, ...uploadedFiles]);
    uploadedFiles.forEach((fileObj, index) => uploadFile(fileObj, index));
  };

  const onMetadataFileSelect = (event) => {
    if (event.files.length > 0) {
      setMetadataFile(event.files[0]);
    }
  };

  const submitMetadata = async () => {
    if (!currentFileId) {
      showMessage(toast, "error", "No file selected or fileId missing.");
      return;
    }

    let metadataToSend = {};
    try {
      if (isMetadataFile) {
        if (!metadataFile) {
          showMessage(toast, "error", "Please select a metadata file.");
          return;
        }
        const fileText = await metadataFile.text();
        metadataToSend = JSON.parse(fileText);
      } else {
        metadataToSend = JSON.parse(metadataInput);
      }

      if (typeof metadataToSend !== "object" || Array.isArray(metadataToSend)) {
        throw new Error("Metadata must be a valid JSON object.");
      }
    } catch (err) {
      showMessage(toast, "error", err.message);
      return;
    }

    try {
      await UploaderMetadataAPI.upload(currentFileId, metadataToSend);
      setMetadataStore(prev => ({
        ...prev,
        [currentFileId]: metadataToSend
      }));
      showMessage(toast, "success", "Metadata uploaded successfully.");
      setMetadataDialog(false);
      setMetadataFile(null);
      setMetadataInput("{}");
    } catch (error) {
      showMessage(toast, "error", error.message);
    }
  };

  const showMetadataDialog = (fileId) => {
    const file = files.find(f => f.id === fileId);
    if (!file) return;
    setCurrentFileId(fileId);
    const cached = metadataStore[fileId];
    if (cached && typeof cached === "object") {
      setMetadataInput(JSON.stringify(cached, null, 2));
    } else {
      setMetadataInput("{}");
    }
    setMetadataFile(null);
    setMetadataDialog(true);
  };
  

  return (
    <div className={`dataset-container ${isDarkMode ? "dark-mode" : "light-mode"}`} style={{ maxWidth: "100%", margin: "auto", border: "none" }}>
      <h2>Async Multi-File Uploader</h2>
      <FileUpload
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
              <p className="ms-1 text-1xl text-primary">Drag and drop files here</p>
            </div>
          ) : null
        }
      />

      <FileUploadPanel
        files={files}
        tempValues={{
          ...Object.fromEntries(Object.entries(tempFilename).map(([k, v]) => [`${k}-name`, v])),
          ...Object.fromEntries(Object.entries(tempUseCases).map(([k, v]) => [`${k}-useCases`, v])),
          ...Object.fromEntries(Object.entries(tempDescription).map(([k, v]) => [`${k}-description`, v]))
        }}
        metadataStore={metadataStore}
        setMetadataStore={setMetadataStore}
        handleTempChange={(fileId, field, value) => {
          if (field === "name") setTempFilename((prev) => ({ ...prev, [fileId]: value }));
          if (field === "description") setTempDescription((prev) => ({ ...prev, [fileId]: value }));
          if (field === "useCases") setTempUseCases((prev) => ({ ...prev, [fileId]: value }));
        }}
        handleFieldChange={updateField}
        handleFieldSubmit={(fileId, field, _) => {
          if (field === "name") updateField(fileId, "upload_filename", tempFilename[fileId]);
          if (field === "description") updateField(fileId, "description", tempDescription[fileId]);
          if (field === "useCases") updateField(fileId, "use_case", tempUseCases[fileId]);
        }}
        extractFileName={extractFileName}
        isDarkMode={isDarkMode}
        setMetadataDialog={setMetadataDialog}
        setMetadataInput={setMetadataInput}
        setCurrentFileId={setCurrentFileId}
        setFiles={setFiles}
        downloadHtmlReport={downloadHtmlReport}
        showMetadataDialog={showMetadataDialog}
      />

      <MetadataDialog
        visible={metadataDialog}
        onHide={() => setMetadataDialog(false)}
        isMetadataFile={isMetadataFile}
        setIsMetadataFile={setIsMetadataFile}
        metadataInput={metadataInput}
        setMetadataInput={setMetadataInput}
        onMetadataFileSelect={onMetadataFileSelect}
        currentFileId={currentFileId}
        onSubmit={() => submitMetadata(currentFileId, metadataInput)}
        isDarkMode={isDarkMode}
      />
    </div>
  );
};

export default ChunkUploader;
