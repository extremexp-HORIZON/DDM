// src/api/fileMetadata.js
import axios from "axios";
import { useToast } from "../context/ToastContext";
import { showMessage } from "../utils/messages";
import { BASE_URL } from "./base";

export const FILE_METADATA_API = {
  fetchHtmlReport: async (fileId) => {
    const response = await axios.get(`${BASE_URL}/file_metadata/report/${fileId}`, {
      headers: { "Content-Type": "text/html" },
      responseType: "text", // ensure it's returned as a string
    });
    return response.data;
  },

  downloadReportsZip: async (fileIds) => {
    const response = await axios.post(
      `${BASE_URL}/file_metadata/reports`,
      { file_ids: fileIds },
      {
        responseType: "blob", // ZIP file
      }
    );

    const blob = new Blob([response.data], { type: "application/zip" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");

    const filename = response.headers["content-disposition"]?.match(/filename="?([^"]+)"?/)?.[1] || "reports.zip";

    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  getFileMetadataById: async (fileId) => {
    const response = await axios.get(`${BASE_URL}/file_metadata/${fileId}`);
    return response.data;
  },


};
