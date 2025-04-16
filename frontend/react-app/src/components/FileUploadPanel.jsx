import { Panel } from "primereact/panel";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Chips } from "primereact/chips";
import { Button } from "primereact/button";
import { getFileIcon } from "../utils/icons";
import { getSeverity } from "../utils/severity";
import ReportPreview from "./ReportPreview";

const FileUploadPanel = ({
  isDarkMode,
  files,
  tempValues,
  setFiles,
  handleTempChange,
  handleFieldChange,
  handleFieldSubmit,
  extractFileName,
  downloadHtmlReport,
  metadataStore,
  setMetadataStore,
  showMetadataDialog,
}) => {

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "15px", marginTop: "20px" }}>
      {files.map((fileObj, index) => (
        <Panel
          key={fileObj.id || index}
          toggleable
          collapsed={fileObj.collapsed}
          onToggle={(e) =>
            setFiles((prevFiles) =>
              prevFiles.map((f, i) => (i === index ? { ...f, collapsed: e.value } : f))
            )
          }
          style={{ width: "100%" }}
          header={
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                width: "100%",
                flexWrap: "wrap",
                padding: "10px",
                borderRadius: "5px",
              }}
            >
              {getFileIcon(fileObj)}

              <InputText
                value={
                  tempValues[`${fileObj.id}-name`] ??
                  metadataStore?.[fileObj.id]?.name ??
                  (fileObj.id.startsWith("temp-") ? fileObj.name : fileObj.upload_filename) ??
                  extractFileName(fileObj.file)
                }
                onChange={(e) => handleTempChange(fileObj.id, "name", e.target.value)}
                onBlur={(e) => handleFieldChange(fileObj.id, "name", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleFieldChange(fileObj.id, "name", e.target.value);
                  }
                }}
                placeholder="Filename"
                style={{ width: "150px" }}
              />

              <Chips
                value={
                  tempValues[`${fileObj.id}-useCases`] ??
                  metadataStore[fileObj.id]?.useCases ??
                  fileObj.use_case
                }
                onChange={(e) => {
                  const newUseCases = e.value;

                  handleTempChange(fileObj.id, "useCases", newUseCases);
                  setMetadataStore((prev) => ({
                    ...prev,
                    [fileObj.id]: {
                      ...prev[fileObj.id],
                      useCases: newUseCases,
                    },
                  }));

                  handleFieldChange(fileObj.id, "useCases", newUseCases); // ✅ fixed
                }}

                onBlur={(e) => handleFieldSubmit(fileObj.id, "useCases", e)}
                placeholder={
                  (
                    tempValues[`${fileObj.id}-useCases`] ??
                    metadataStore[fileObj.id]?.useCases ??
                    fileObj.use_case
                  )?.length === 0 ? "Use Cases" : undefined
                }

                className="p-chips p-component"
                itemTemplate={(useCase) => {
                  const { display, color, icon } = getSeverity(useCase);
                  return (
                    <div
                      style={{
                        backgroundColor: color,
                        color: "#fff",
                        padding: "4px 10px",
                        borderRadius: "15px",
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                        fontSize: "14px",
                      }}
                    >
                      <i className={icon} style={{ fontSize: "14px" }} />
                      <span>{display}</span>
                    </div>
                  );
                }}
                style={{
                  width: "250px",
                  minHeight: "35px",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "5px",
                }}
              />

              <InputTextarea
                value={
                  tempValues[`${fileObj.id}-description`] ??
                  metadataStore[fileObj.id]?.description ??
                  fileObj.description ??
                  ""
                }
                onChange={(e) => handleTempChange(fileObj.id, "description", e.target.value)}
                onBlur={(e) => handleFieldChange(fileObj.id, "description", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleFieldSubmit(fileObj.id, "description", e);
                  }
                }}
                placeholder="Description"
                autoResize
                rows={1}
                style={{ width: "250px" }}
              />

              <Button
                label="Metadata"
                icon="pi pi-pencil"
                className="p-button-text p-button-sm"
                style={{ border: "none" }}
                onClick={() => showMetadataDialog(fileObj.id)} // ✅ Use the prop from UploadFile
              />

              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                {(fileObj.statuses || []).map((s, i) => (
                  <span key={i} style={{ color: s.status.includes("✅") ? "green" : "grey" }}>
                    {s.status}
                  </span>
                ))}
              </div>

              {fileObj.profileHtml && (
                <Button
                  icon="pi pi-download"
                  className="p-button-rounded p-button-text"
                  style={{ border: "none" }}
                  tooltip="Download Report"
                  onClick={() => downloadHtmlReport(fileObj, isDarkMode)}
                />
              )}
            </div>
          }
        >
          {fileObj.profileHtml && (
            <ReportPreview htmlContent={fileObj.profileHtml} isDarkMode={isDarkMode} />
          )}
        </Panel>
      ))}
    </div>
  );
};

export default FileUploadPanel;
