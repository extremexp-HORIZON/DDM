// hooks/useSupportedFileTypesDialog.js
import { useState } from "react";

export const useSupportedFileTypesDialog = () => {
  const [showFileExtensions, setShowFileExtensions] = useState(false);

  return {
    showFileExtensions,
    setShowFileExtensions,
  };
};
