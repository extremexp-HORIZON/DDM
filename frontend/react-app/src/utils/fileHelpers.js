// src/utils/fileHelpers.js
export const extractFileName = (fileObj) => {
    if (!fileObj) return "Unknown File";
    if (fileObj.name) return fileObj.name;
    if (fileObj.file?.name) return fileObj.file.name;
    return "Unknown File";
  };
  