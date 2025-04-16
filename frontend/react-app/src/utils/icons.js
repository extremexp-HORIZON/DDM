// utils/getFileIcon.js
import { FileIcon, defaultStyles } from "react-file-icon";
import { availableSvgIcons } from "./availableSvgIcons";

export const getFileIcon = (fileObj) => {
  if (!fileObj) return null;

  let filename = "file.txt";

  if (fileObj.file?.name) {
    filename = fileObj.file.name;
  } else if (fileObj.name) {
    filename = fileObj.name;
  } else if (fileObj.file_url) {
    filename = fileObj.file_url.split("/").pop();
  }

  const ext = filename.split(".").pop().toUpperCase(); // SVGs are uppercase
  const lowerExt = ext.toLowerCase(); // react-file-icon uses lowercase keys

  if (availableSvgIcons.includes(ext)) {
    return (
      <img
        src={`/fileIcons/${ext}.svg`}
        alt={`${ext} icon`}
        style={{ width: "32px", height: "32px", marginRight: "8px" }}
      />
    );
  }

  // fallback to react-file-icon
  return (
    <div style={{ width: "24px", height: "24px", marginRight: "8px" }}>
      <FileIcon extension={lowerExt} {...(defaultStyles[lowerExt] || defaultStyles.txt)} />
    </div>
  );
};

export const getFileIconFromExt = (ext) => {
  if (!ext || typeof ext !== "string") return null;

  const cleanExt = ext.replace(/^\./, ""); // remove leading dot if present
  const upperExt = cleanExt.toUpperCase(); // SVGs are uppercase (e.g. CSV)
  const lowerExt = cleanExt.toLowerCase(); // react-file-icon keys (e.g. csv)

  if (availableSvgIcons.includes(upperExt)) {
    return (
      <img
        src={`/fileIcons/${upperExt}.svg`} // 👈 use the cleaned uppercase here
        alt={`${upperExt} icon`}
        style={{ width: "32px", height: "32px", marginRight: "8px" }}
      />
    );
  }

  return (
    <div style={{ width: "24px", height: "24px", marginRight: "8px" }}>
      <FileIcon extension={lowerExt} {...(defaultStyles[lowerExt] || defaultStyles.txt)} />
    </div>
  );
};



export const fileTypeItemTemplate = (option) => {
  return (
    <div className="flex align-items-center">
      {getFileIconFromExt(option.value)}
      <span>{option.label}</span>
    </div>
  );
};
