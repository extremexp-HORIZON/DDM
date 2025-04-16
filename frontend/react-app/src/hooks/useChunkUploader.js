import { useToast } from "../context/ToastContext";
import { FILES_API } from "../api/files";
import { pollTaskResult } from "../api/tasks";
import { showMessage } from "../utils/messages";
import { pollMergeTask } from "./polling";
import { extractFileName } from "../utils/fileHelpers";

const CHUNK_SIZE = 2 * 1024 * 1024;

const FIELD_MAP = {
  name: "upload_filename",
  description: "description",
  useCases: "use_case",
};

export const useChunkUploader = ({ setFiles }) => {
  const toast = useToast();

  const uploadFile = async (fileObj, index) => {
    const file = fileObj.file;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    let uploadedChunks = 0;
    let fileId = fileObj.fileId || null;

    const steps = ["Uploading", "Merging", "Processing"];
    setFiles(prev => {
      const updated = [...prev];
      const current = updated[index];
      const existing = current.statuses?.map(s => s.step) || [];
      const missing = steps.filter(s => !existing.includes(s));
      current.statuses = [...(current.statuses || []), ...missing.map(step => ({ step, status: `⏳ ${step}` }))];
      return updated;
    });

    for (let i = 0; i < totalChunks; i++) {
      const chunkIndex = i;
      const chunk = file.slice(chunkIndex * CHUNK_SIZE, (chunkIndex + 1) * CHUNK_SIZE);
      const currentFileId = fileId; // capture current value
      const formData = new FormData();
      formData.append("file", chunk);
      formData.append("chunk_index", chunkIndex);
      formData.append("total_chunks", totalChunks);
      formData.append("filename", file.name);
      formData.append("project_id", fileObj.projectId);
      if (currentFileId) formData.append("file_id", currentFileId);

      try {
        const data = await FILES_API.uploadChunk(formData);
        uploadedChunks++;

        setFiles(prev => {
          const updated = [...prev];
          const f = updated[index];

          f.progress = Math.round((uploadedChunks / totalChunks) * 100);

          if (chunkIndex === 0 && data.file_id) {
            fileId = data.file_id;
            f.fileId = fileId;
            f.file.id = fileId;
            f.id = fileId;
          }

          if (data.merge_task_id) f.mergeTaskId = data.merge_task_id;
          if (data.metadata_task_id) f.metadataTaskId = data.metadata_task_id;

          f.statuses = f.statuses.map(s =>
            s.step === "Uploading"
              ? {
                  ...s,
                  status:
                    uploadedChunks === totalChunks
                      ? "✅ Upload Complete!"
                      : `⏳ Uploading ${uploadedChunks}/${totalChunks}`,
                }
              : s
          );

          return updated;
        });

        if (chunkIndex === totalChunks - 1 && fileId) {
          showMessage(toast, "success", `File ${file.name} uploaded successfully!`);
          pollMergeTask(data.merge_task_id, index, file.name, setFiles, toast);
        }
      } catch (err) {
        console.error("❌ Upload error:", err);
        showMessage(toast, "error", `Failed to upload ${file.name}.`);

        setFiles(prev =>
          prev.map((f, idx) =>
            idx === index
              ? {
                  ...f,
                  statuses: f.statuses.map(s =>
                    s.step === "Uploading" ? { ...s, status: "❌ Upload Failed!" } : s
                  ),
                }
              : f
          )
        );
        return;
      }
    }
  };

  const updateField = async (fileId, field, newValue) => {
    if (!fileId) return;
    const backendField = FIELD_MAP[field] || field;
  
    setFiles(prev => {
      const updated = [...prev];
      const fileIndex = updated.findIndex(f => f.id === fileId);
      if (fileIndex === -1) return prev;
  
      // 💡 Don't mutate the file, add a custom field like `upload_filename`
      updated[fileIndex] = {
        ...updated[fileIndex],
        [field]: newValue, // This is a top-level key, not on file itself
      };
  
      return updated;
    });
  
    try {
      const res = await FILES_API.updateFileField(fileId, backendField, newValue);
      showMessage(toast, "success", `Updated ${field} successfully.`);
      if (res.task_id) {
        const result = await pollTaskResult(res.task_id, 5000, 300000);
        setFiles(prev =>
          prev.map(f =>
            f.id === fileId
              ? {
                  ...f,
                  [field]: result[backendField],
                }
              : f
          )
        );
      }
    } catch (err) {
      showMessage(toast, "error", err.message);
    }
  };
  

  return { 
    uploadFile, 
    updateField, 
    extractFileName 
  };
};
