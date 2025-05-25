// src/utils/fileHelpers.js
export const extractFileName = (fileObj) => {
    if (!fileObj) return "Unknown File";
    if (fileObj.name) return fileObj.name;
    if (fileObj.filename) return fileObj.filename; 
    if (fileObj.file?.name) return fileObj.file.name;
    if (fileObj.file?.filename) return fileObj.file.filename;

    
    return "Unknown File";
  };
  