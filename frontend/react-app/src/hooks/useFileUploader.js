import { useState } from "react";
import { FILES_API } from "../api/files";
import { showMessage } from "../utils/messages";
import { pollMetadataTask } from "../hooks/polling";
import { downloadHtmlReport } from "../utils/downloadHtmlReport";
import { UploaderMetadataAPI } from "../api/uploader_metadata";
import { extractFileName } from "../utils/fileHelpers";

export const useFileUploader =  ({ toast, fileUploadRef }) => {
    const [files, setFiles] = useState([]);
    const [tempValues, setTempValues] = useState({});
    const [metadataStore, setMetadataStore] = useState({});
    const [uploading, setUploading] = useState(false);

    const handleTempChange = (fileId, field, value) => {
        setTempValues((prev) => ({
            ...prev,
            [`${fileId}-${field}`]: value,
        }));
    };
        
    const updateField = async (fileId, field, newValue) => {
        if (!fileId || fileId.startsWith("temp-")) return;
        const fieldMapping = {
            name: "upload_filename",
            description: "description",
            useCases: "use_case",
        };
        const backendField = fieldMapping[field] || field;
        try {
            const updatedData = await FILES_API.updateFileField(fileId, backendField, newValue);
            showMessage(toast, "success", `Updated ${field} to: ${JSON.stringify(updatedData[backendField])}`);
        } catch (err) {
            showMessage(toast, "error", err.message);
        }
    };

    const handleFieldChange = (fileId, field, value) => {
        const prevValue = metadataStore[fileId]?.[field];
        if (prevValue === value) return;
    
        setTempValues((prev) => ({ ...prev, [`${fileId}-${field}`]: value }));
        setMetadataStore((prev) => ({
            ...prev,
            [fileId]: { ...prev[fileId], [field]: value },
        }));
    
        if (!fileId.startsWith("temp-")) {
            updateField(fileId, field, value).then(() => {
                setFiles((prev) =>
                    prev.map((file) =>
                        file.id === fileId ? { ...file, [field]: value } : file
                    )
                );
            });
        } else {
            showMessage(toast, "success", `Updated ${field} to: ${value}`);
        }
    };
    

    const handleFieldSubmit = (fileId, field) => {
        const newValue = tempValues[`${fileId}-${field}`];
        if (newValue === undefined) return;
        if (metadataStore[fileId]?.[field] === newValue) return;
        setMetadataStore((prev) => ({
            ...prev,
            [fileId]: { ...prev[fileId], [field]: newValue },
        }));
        if (!fileId.startsWith("temp-")) {
            setFiles((prev) =>
                prev.map((file) =>
                    file.id === fileId ? { ...file, [field]: newValue } : file
                )
            );
        } else {
            showMessage(toast, "success", `${field} updated successfully!`);
        }
    };

    const onUpload = (event) => {
        if (!event?.files?.length) return;
        const newFiles = event.files.map((file, index) => ({
            id: `temp-${Date.now()}-${index}`,
            file,
            progress: 0,
            collapsed: true,
            statuses: [{ step: "Added", status: "🟡 Waiting for Upload" }],
        }));
        if (fileUploadRef.current) fileUploadRef.current.clear();
        setFiles((prev) => [...prev, ...newFiles]);
    };

    const submitMetadata = async (fileId, metadata) => {
        if (!fileId) return;
      
        let parsedMetadata;
        try {
          parsedMetadata = typeof metadata === "string" ? JSON.parse(metadata) : metadata;
          if (typeof parsedMetadata !== "object" || Array.isArray(parsedMetadata)) {
            throw new Error("Metadata must be a valid JSON object.");
          }
        } catch (err) {
          showMessage(toast, "error", `Invalid metadata: ${err.message}`);
          return;
        }
      
        // 🛑 Don't upload yet if file hasn't been uploaded
        if (fileId.startsWith("temp-")) {
          setMetadataStore((prev) => ({
            ...prev,
            [fileId]: {
              ...prev[fileId],
              metadata: parsedMetadata,
              metadataSubmitted: false, // ← mark it pending
            },
          }));
          showMessage(toast, "info", "Metadata saved locally and will be uploaded with the file.");
          return;
        }
      
        // ✅ Upload now if real fileId
        try {
          await UploaderMetadataAPI.upload(fileId, parsedMetadata);
          setMetadataStore((prev) => ({
            ...prev,
            [fileId]: {
              ...prev[fileId],
              metadata: parsedMetadata,
              metadataSubmitted: true,
            },
          }));
          showMessage(toast, "success", "Metadata uploaded successfully.");
        } catch (err) {
          showMessage(toast, "error", `Failed to upload metadata: ${err.message}`);
        }
    };
      


    const handleUpload = async (projectId) => {
        setUploading(true);

        if (!projectId.trim()) {
            showMessage(toast, "warn", "Please enter a valid Project ID.");
            setUploading(false);
            return;
        }

        const formData = new FormData();
        formData.append("project_id", projectId);

        const filesToUpload = files.filter((f) => f.id.startsWith("temp-"));
        if (!filesToUpload.length) {
            showMessage(toast, "info", "No new files to upload.");
            setUploading(false);
            return;
        }

        const metadataFiles = [];

        filesToUpload.forEach((f) => {
            const meta = metadataStore[f.id] || {};
            formData.append("files", f.file);
            formData.append("user_filenames", meta.name || f.file.name);
            formData.append("descriptions", meta.description || "");
            formData.append("use_case", JSON.stringify(meta.useCases || []));

            if (meta.metadata) {
            const metaBlob = new Blob([
                typeof meta.metadata === "string"
                ? meta.metadata
                : JSON.stringify(meta.metadata)
            ], { type: "application/json" });

            const metaFile = new File([metaBlob], `metadata_${f.file.name}.json`, {
                type: "application/json"
            });

            metadataFiles.push(metaFile);
            }
        });

        metadataFiles.forEach((f) => formData.append("metadata-files", f));

        try {
            const response = await FILES_API.uploadFiles(formData);
            const uploaded = response.files;
            const uploadedNames = uploaded.map(f => f.upload_filename);

            // 🔁 Update files and carry over metadata
            setFiles((prev) => {
            const existing = prev.filter((f) => !f.id.startsWith("temp-"));

            const updated = uploaded.map((f) => {
                const tempId = filesToUpload.find(tempFile => tempFile.file.name === f.upload_filename)?.id;
                const localMeta = metadataStore[tempId] || {};

                return {
                id: f.id,
                upload_filename: f.upload_filename,
                name: localMeta.name || f.upload_filename,
                description: localMeta.description || "",
                use_case: localMeta.useCases || [],
                metadata: localMeta.metadata || {},
                collapsed: true, 
                statuses: [
                    { step: "Upload Complete", status: "✅ Upload Complete" },
                    { step: "Processing Metadata", status: "⏳ Processing..." },
                ],
                };
            });

            return [...existing, ...updated];
            });

            // 🔁 Move metadataStore from temp to real ID
            uploaded.forEach((f) => {
            const tempId = filesToUpload.find(tempFile => tempFile.file.name === f.upload_filename)?.id;
            if (metadataStore[tempId]) {
                setMetadataStore((prev) => ({
                ...prev,
                [f.id]: metadataStore[tempId],
                }));
            }

            if (f.metadata_task_id) {
                pollMetadataTask(f.metadata_task_id, f.id, setFiles, toast);
            }
            });

            showMessage(toast, "success", `${uploaded.length} file(s) uploaded: ${uploadedNames.join(", ")}`);
        } catch (err) {
            console.error("Upload failed:", err);
            showMessage(toast, "error", "Upload failed.");
        } finally {
            setUploading(false);
        }
    };

  return {
    files,
    setFiles,
    tempValues,
    handleTempChange,
    handleFieldChange,
    handleFieldSubmit,
    metadataStore,
    setMetadataStore,
    onUpload,
    handleUpload,
    submitMetadata,
    uploading,
    fileUploadRef,
    downloadHtmlReport,
    extractFileName
  };
};
