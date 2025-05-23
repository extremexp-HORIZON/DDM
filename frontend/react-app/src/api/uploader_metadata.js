import axios from "axios";
import { BASE_URL } from "./base";

export const UploaderMetadataAPI = {
  upload: async (fileId, metadata) => {
    const url = `${BASE_URL}/uploader_metadata/${fileId}`;
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token")}`
    };

    const requestBody = { uploader_metadata: metadata };

    try {
      const response = await axios.post(url, requestBody, { headers });

      if (response.status < 200 || response.status >= 300) {
        throw new Error("Failed to upload uploader metadata");
      }

      return response.data;
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error.message ||
        "Failed to upload uploader metadata";
      throw new Error(message);
    }
  },

  getUploaderMetadataById: async (fileId) => {
    const url = `${BASE_URL}/uploader_metadata/${fileId}`;
    try {
      const response = await axios.get(url,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`
          }
        });
      return response.data; // assuming API returns JSON
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error.message ||
        "Failed to fetch uploader metadata";
      throw new Error(message);
    }
  },
};
