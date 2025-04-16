import { Panel } from "primereact/panel";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Chips } from "primereact/chips";
import { Button } from "primereact/button";
import { getFileIconFromExt  } from "../utils/icons";
import { getSeverity } from "../utils/severity";
import ReportPreview from "./ReportPreview";

const FilePanel = ({
    isDarkMode,
    file,
    tempValues,
    index,
    handleTempChange,
    handleFieldSubmit,
    extractFileName,
    setFileData,
    downloadHtmlReport,
    showMetadataDialog
  }) => {
    const ext = (file.name || file.upload_filename || file.file_url || "").split(".").pop()?.toLowerCase();

    return (
        <Panel
            key={index}
            style={{
                width: "100%",
            }}
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
                    {getFileIconFromExt (ext)}
                    {/* ✅ Filename Field (Enter or Blur to Save) */}
                    <InputText
                        value={tempValues[`${file.id}-name`] ?? file.name ?? extractFileName(file)}
                        onChange={(e) => handleTempChange(file.id, "name", e.target.value)}
                        onBlur={(e) => handleFieldSubmit(file.id, "name", e)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                handleFieldSubmit(file.id, "name", e);
                            }
                        }}
                        placeholder="Filename"
                        style={{ width: "150px" }}
                    />
                    {/* ✅ Use Cases (Blur to Save) */}
                    <Chips
                        value={tempValues[`${file.id}-useCases`] ?? file.useCases}
                        onChange={(e) => handleTempChange(file.id, "useCases", e.value)}
                        onBlur={() => handleFieldSubmit(file.id, "useCases")} // ✅ Updates state only on Blur
                        placeholder={(tempValues[`${file.id}-useCases`] ?? file.useCases)?.length ? "" : "Use Cases"}
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
                                    <i className={icon} style={{ fontSize: "14px" }}></i>
                                    <span>{display}</span>
                                </div>
                            );
                        }}
                        style={{
                            width: "200px",
                            minHeight: "35px",
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "5px",
                        }}
                    />
                    {/* ✅ Description Field (Enter or Blur to Save) */}
                    <InputTextarea
                        value={tempValues[`${file.id}-description`] ?? file.description}
                        onChange={(e) => handleTempChange(file.id, "description", e.target.value)}
                        onBlur={(e) => handleFieldSubmit(file.id, "description", e)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                handleFieldSubmit(file.id, "description", e);
                            }
                        }}
                        placeholder="Description"
                        autoResize
                        rows={1}
                        style={{ width: "250px" }}
                    />

                    {/* ✅ Metadata Button */}
                    <Button
                        label="Metadata"
                        icon="pi pi-pencil"
                        className="p-button-text p-button-sm"
                        tooltip="Upload Metadata"
                        style={{ border: "none" }}
                        onClick={() => showMetadataDialog(file.id)}
                    />

                    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                        {(file.statuses || []).map((s, i) => (
                            <span key={i} style={{ color: s.status.includes("✅") ? "green" : "grey" }}>
                                {s.status}
                            </span>
                        ))}
                    </div>

                    {/* ✅ Download Report Button */}
                    {file.profileHtml && (
                        <Button
                            icon="pi pi-download"
                            className="p-button-rounded p-button-text"
                            style={{ border: "none" }}
                            tooltip="Download Report"
                            onClick={() => downloadHtmlReport(file, isDarkMode)}

                        />
                    )}
                </div>
            }
            toggleable
            collapsed={file.collapsed}
            onToggle={(e) => setFileData(prevFiles =>
                prevFiles.map((f, idx) =>
                    idx === index ? { ...f, collapsed: e.value } : f
                )
            )}
        >
        {file.profileHtml && (
            <ReportPreview htmlContent={file.profileHtml} isDarkMode={isDarkMode} />

        )}

    </Panel>
    );
};

export default FilePanel;