import axios from "axios";
import { BASE_URL } from "./base";

export const FILES_API = {

  uploadFiles: async (formData) => {
    const response = await axios.post(`${BASE_URL}/files/upload`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
        Authorization: `Bearer ${localStorage.getItem("token")}`
      },
    });
    return response.data;
  },

 
  updateFileField: async (fileId, field, value) => {
    try {
      const response = await axios.patch(`${BASE_URL}/file/update/${fileId}`, {
        [field]: value,
      }, {
        headers : {
          Authorization: `Bearer ${localStorage.getItem("token")}`
        }
      });

      if (response.status !== 200) {
        throw new Error("Failed to update field");
      }

      return response.data.updated_data || {};
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error.message ||
        "Failed to update file";
      throw new Error(message);
    }
  },


  uploadViaLinks: async (projectId, files) => {
    const response = await axios.post(`${BASE_URL}/files/upload-links`, {
      project_id: projectId,
      files: files.map(({ file_url, name, description, useCases, metadata }) => ({
        file_url,
        name,
        description,
        use_cases: useCases,
        metadata,
      })),
    }, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`
      }
    });

    if (!response.data.files) {
      throw new Error("Invalid response format: Missing 'files' array.");
    }

    return response.data.files;
  },

  uploadChunk: async (formData) => {
    const response = await fetch(`${BASE_URL}/file/upload/async`, {
      method: "POST",
      body: formData,
    }, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`
      }
    });
  
    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || "Upload failed");
    }
  
    return response.json();
  },
  
  downloadFile: async (fileId) => {
    const response = await axios.get(`${BASE_URL}/file/${fileId}`, {
      responseType: "blob", // ← to handle binary data
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`
      }
    });

    const blob = new Blob([response.data]);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");

    const disposition = response.headers["content-disposition"];
    const filenameMatch = disposition?.match(/filename="?([^"]+)"?/);
    const filename = filenameMatch?.[1] || "downloaded_file";

    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  deleteFile: async (fileId) => {
    const response = await axios.delete(`${BASE_URL}/file/${fileId}/delete`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`
        }
      });
    return response.data;
  },

  deleteMultipleFiles: async (fileIds) => {
    const response = await axios.delete(`${BASE_URL}/files/delete`, {
      data: { file_ids: fileIds },
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`
      }
    });

    if (response.status !== 200) {
      throw new Error(response.data.message || "Failed to delete files.");
    }

    return response.data;
  },


  downloadMultipleFiles: async (fileIds) => {
    const response = await axios.post(
      `${BASE_URL}/files/download`,
      { file_ids: fileIds },
      { responseType: "blob" ,
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`
      }} // Important for ZIP
    );

    const blob = new Blob([response.data], { type: "application/zip" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");

    // Try to infer filename from Content-Disposition header
    const disposition = response.headers["content-disposition"];
    const filenameMatch = disposition?.match(/filename="?([^"]+)"?/);
    const filename = filenameMatch?.[1] || "downloaded_files.zip";

    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }
  
};