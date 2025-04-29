// src/hooks/useUploaderMetadata.js
import { useState } from "react";
import { UploaderMetadataAPI } from "../api/uploader_metadata"; // make sure path is correct

export const useUploaderMetadata = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
  
    const fetchUploaderMetadata = async (fileId) => {
      if (!fileId) return; 
      setError(null);
      try {
        const data = await UploaderMetadataAPI.getUploaderMetadataById(fileId);
        return data;
      } catch (err) {
        setError(err.message || "Failed to fetch uploader metadata");
        throw err;
      } finally {
        setLoading(false);
      }
    };
  
    return { fetchUploaderMetadata, loading, error };
  };
  
