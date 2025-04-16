// hooks/useMetadataDialogState.js
import { useState } from "react";

export const useMetadataDialog = () => {
  const [metadataDialog, setMetadataDialog] = useState(false);
  const [metadataInput, setMetadataInput] = useState("{}");
  const [metadataFile, setMetadataFile] = useState(null);
  const [currentFileId, setCurrentFileId] = useState(null);
  const [isMetadataFile, setIsMetadataFile] = useState(false);

  return {
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
  };
};
