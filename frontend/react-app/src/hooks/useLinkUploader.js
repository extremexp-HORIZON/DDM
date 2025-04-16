import { useState } from "react";
import { FILES_API } from "../api/files";
import { UploaderMetadataAPI } from "../api/uploader_metadata";
import { showMessage } from "../utils/messages";
import { downloadHtmlReport } from "../utils/downloadHtmlReport";
import { pollFetchTask } from "./polling";


export const useLinkUploader = (toast) => {
  const [fileData, setFileData] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [tempValues, setTempValues] = useState({});

  const handleTempChange = (fileId, field, value) => {
    setTempValues((prev) => ({
      ...prev,
      [`${fileId}-${field}`]: value,
    }));
  };

  const extractFileName = (file) => {
    if (!file) return "Unknown File";
    if (file.name) return file.name;
    if (file.file_url) return file.file_url.split("/").pop() || "file.txt";
    return "Unknown File";
  };

  const handleFieldSubmit = (fileId, field, event) => {
    if (!fileId) return;
    const tempKey = `${fileId}-${field}`;
    if (tempValues[tempKey] != null) {
      const newValue = tempValues[tempKey];
      setFileData((prev) =>
        prev.map((file) => (file.id === fileId ? { ...file, [field]: newValue } : file))
      );

      if (!fileId.startsWith("temp-")) {
        updateField(fileId, field, newValue);
      } else {
        showMessage(toast, "info", `${field} saved locally.`);
      }
  
      setTempValues((prev) => {
        const copy = { ...prev };
        delete copy[tempKey];
        return copy;
      });
    }
  };
  

  const updateField = async (fileId, field, newValue) => {
    const fieldMapping = {
      name: "upload_filename",
      useCases: "use_case",
      description: "description",
    };
    const backendField = fieldMapping[field] || field;

    try {
      await FILES_API.updateFileField(fileId, backendField, newValue);
      showMessage(toast, "success", `${field} updated.New value: ${newValue}`);
    } catch (err) {
      showMessage(toast, "error", err.message);
    }
  };

  const submitMetadata = async (fileId, metadata) => {
    if (!fileId || fileId.startsWith("temp-")) {
      showMessage(toast, "warn", "Cannot submit metadata for temporary files.");
      return;
    }

    try {
      const parsed = typeof metadata === "string" ? JSON.parse(metadata) : metadata;
      if (typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Invalid JSON object.");
      }

      const response = await UploaderMetadataAPI.upload(fileId, parsed);
      console.log("✅ Metadata uploaded:", response);

      setFileData((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, metadata: parsed } : f))
      );
      showMessage(toast, "success", "Metadata uploaded.");
    } catch (err) {
      showMessage(toast, "error", err.message || "Metadata upload failed.");
    }
  };

  const handleSubmit = async (projectId, files) => {
    if (!projectId.trim()) {
      showMessage(toast, "error", "Project ID required.");
      return;
    }

    if (!files.length || !files.every((f) => f.file_url)) {
      showMessage(toast, "error", "Each file must have a valid file URL.");
      return;
    }

    setLoading(true);
    setUploadProgress(0);
    try {
      const uploaded = await FILES_API.uploadViaLinks(projectId, files);
      showMessage(toast, "success", "Files submitted!");
      setUploadProgress(100);

      setFileData((prev) =>
        prev.map((f) => {
          const match = uploaded.find((u) => u.file_url === f.file_url);
          return match
            ? {
                ...f,
                ...match,
                id: match.file_id,
                statuses: [
                  { step: "Upload", status: "✅ Uploaded" },
                  { step: "Downloading", status: "⏳ Downloading..." },
                ],
              }
            : f;
        })
      );

      uploaded.forEach((f) => {
        if (f.fetch_task_id) {
          pollFetchTask(f.fetch_task_id, f.file_id, f.process_task_id, setFileData, toast);
        }
      });
      
      
    } catch (err) {
      showMessage(toast, "error", err.message || "Upload failed.");
    } finally {
      setLoading(false);
    }
  };
  
  return {
    fileData,
    setFileData,
    tempValues,
    handleTempChange,
    extractFileName,
    handleFieldSubmit,
    handleSubmit,
    updateField,
    submitMetadata,
    uploadProgress,
    loading,
    downloadHtmlReport,
  };
};
