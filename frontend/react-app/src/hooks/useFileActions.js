// src/hooks/useFileActions.js
import { useToast } from "../context/ToastContext";
import { showMessage } from "../utils/messages";
import { FILES_API } from "../api/files";

import { showConfirm } from "../components/ConfirmDialog";

export const useFileActions = (reload, isDarkMode = false) => {
  const toast = useToast();

  const handleDownload = async (fileId) => {
    try {
      await FILES_API.downloadFile(fileId);
    } catch (error) {
      showMessage(toast, "error", `Download failed: ${error.message}`);
    }
  };

  const handleDelete = (fileId) => {
    showConfirm({
      message: "Are you sure you want to delete this file?",
      header: "Delete File",
      icon: "pi pi-exclamation-triangle",
      accept: async () => {
        try {
          await FILES_API.deleteFile(fileId);
          showMessage(toast, "success", "File deleted");
          reload?.();
        } catch (error) {
          showMessage(toast, "error", `Delete failed: ${error.message}`);
        }
      },
      reject: () => {
        showMessage(toast, "info", "Deletion cancelled");
      },
      isDarkMode,
    });
  };






  return { handleDownload, handleDelete };


};
