import React, { useState } from "react";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import { useLinkUploader } from "../hooks/useLinkUploader";
import { showMessage } from "../utils/messages";
import FilePanel from "../components/FilePanel";
import MetadataDialog from "../components/MetadataDialog";
import UploadLinkForm from "../components/UploadLinkForm";


const LinkUploader = () => {
  const { isDarkMode } = useTheme();
  const toast = useToast();

  const {
    fileData,
    setFileData,
    tempValues,
    handleTempChange,
    extractFileName,
    handleFieldSubmit,
    handleSubmit,
    submitMetadata,
    uploadProgress,
    loading,
    downloadHtmlReport,
  } = useLinkUploader(toast);

  const [projectId, setProjectId] = useState("");
  const [fileLinks, setFileLinks] = useState([]);
  const [metadataDialog, setMetadataDialog] = useState(false);
  const [currentFileId, setCurrentFileId] = useState(null);
  const [isMetadataFile, setIsMetadataFile] = useState(false);
  const [metadataInput, setMetadataInput] = useState("{}");
  const [metadataFile, setMetadataFile] = useState(null);

  const handleFileLinksChange = (e) => {
    const updatedLinks = e.value;
    setFileLinks(updatedLinks);

    setFileData((prevData) => {
      return updatedLinks.map((link, index) => {
        const existingData = prevData.find((data) => data.file_url === link);
        return (
          existingData || {
            id: `temp-${index}`,
            file_url: link,
            name: link.split("/").pop(),
            description: "",
            useCases: [],
            metadata: {},
            metadataPending: false,
            statuses: [{ step: "Added", status: "🟡 Waiting for Upload" }],
          }
        );
      });
    });
  };

  const onMetadataFileSelect = async (event) => {
    if (event.files.length > 0) {
      const file = event.files[0];
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("Uploader metadata must be a valid JSON object.");
        }
        setMetadataInput(JSON.stringify(parsed, null, 2));
        setMetadataFile(parsed);
        showMessage(toast, "success", "Metadata file selected successfully.");
      } catch (err) {
        setMetadataFile(null);
        showMessage(toast, "error", `Invalid metadata file: ${err.message}`);
      }
    }
  };

  const handleSubmitWrapper = (e) => {
    e.preventDefault();
    handleSubmit(projectId, fileData);
  };

  const handleMetadataSubmit = async (fileId) => {
    const data = metadataFile || metadataInput;
    await submitMetadata(fileId, data);
    setMetadataDialog(false);
    setMetadataInput("{}");
    setMetadataFile(null);
  };

  const handleShowMetadataDialog = (fileId) => {
    const file = fileData.find((f) => f.id === fileId);
    if (!file) return;
    setCurrentFileId(fileId);
    if (file.metadata && typeof file.metadata === "object") {
      setMetadataInput(JSON.stringify(file.metadata, null, 2));
    } else {
      setMetadataInput("{}");
    }
    setMetadataFile(null);
    setMetadataDialog(true);
  };
  

  return (
    <div className={`dataset-container ${isDarkMode ? "dark-mode" : "light-mode"}`}>
      <h2>Upload Files from Links</h2>

      <UploadLinkForm
        projectId={projectId}
        setProjectId={setProjectId}
        fileLinks={fileLinks}
        handleFileLinksChange={handleFileLinksChange}
        handleSubmit={handleSubmitWrapper}
        loading={loading}
        uploadProgress={uploadProgress}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "15px",
          justifyContent: "center",
          marginTop: "20px",
          width: "100%",
        }}
      >
        {fileData.map((file, index) => (
          <FilePanel
            key={index}
            file={file}
            index={index}
            tempValues={tempValues}
            extractFileName={extractFileName}
            handleTempChange={handleTempChange}
            handleFieldSubmit={handleFieldSubmit}
            setFileData={setFileData}
            downloadHtmlReport={downloadHtmlReport}
            isDarkMode={isDarkMode}
            showMetadataDialog={handleShowMetadataDialog}
          />
        ))}
      </div>

      <MetadataDialog
        visible={metadataDialog}
        onHide={() => setMetadataDialog(false)}
        isMetadataFile={isMetadataFile}
        setIsMetadataFile={setIsMetadataFile}
        metadataInput={metadataInput}
        setMetadataInput={setMetadataInput}
        onMetadataFileSelect={onMetadataFileSelect}
        currentFileId={currentFileId}
        onSubmit={handleMetadataSubmit}
        isDarkMode={isDarkMode}
      />
    </div>
  );
};

export default LinkUploader;
