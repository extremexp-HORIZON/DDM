import { useState } from "react";
import { FILE_METADATA_API } from "../api/file_metadata"; // Adjust the import path as necessary

export const useFileMetadata = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);



  const fetchFileMetadata = async (fileId) => {
    setLoading(true);
    setError(null);
    try {
      const data = await FILE_METADATA_API.getFileMetadataById(fileId);
      return data;
    } catch (err) {
      setError(err.message || "Failed to fetch file metadata");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { fetchFileMetadata, loading, error };
};
