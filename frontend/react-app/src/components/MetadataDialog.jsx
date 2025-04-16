import React from "react";
import { Dialog } from "primereact/dialog";
import { InputTextarea } from "primereact/inputtextarea";
import { InputSwitch } from "primereact/inputswitch";
import { FileUpload } from "primereact/fileupload";
import { Button } from "primereact/button";

const MetadataDialog = ({
    visible,
    onHide,
    isMetadataFile,
    setIsMetadataFile,
    metadataInput,
    setMetadataInput,
    onMetadataFileSelect,
    currentFileId,
    onSubmit,
    isDarkMode
}) => {
return (
    <Dialog
      visible={visible}
      onHide={onHide}
      header="Upload Metadata"
      className={isDarkMode ? "dark-mode" : ""}
    >
      {/* Metadata Input Toggle */}
      <div className="form-group align-items-center gap-2">
        <label className="text-sm font-medium">Select Metadata Input:</label>
        <InputSwitch
          checked={isMetadataFile}
          onChange={(e) => setIsMetadataFile(e.value)}
          tooltip={isMetadataFile ? "Switch to JSON Input" : "Switch to Metadata File Upload"}
        />
      </div>

      {/* Conditional Rendering: Metadata File Upload or JSON Input */}
      {isMetadataFile ? (
        <FileUpload
          mode="advanced"
          name="metadata"
          accept="application/json"
          maxFileSize={1000000} // 1MB Limit
          onSelect={onMetadataFileSelect}
          auto
          chooseLabel="Choose Metadata File"
        />
      ) : (
        <InputTextarea
          rows={5}
          value={metadataInput}
          onChange={(e) => setMetadataInput(e.target.value)}
          className="form-control mb-3"
          placeholder="Enter metadata in JSON format"
        />
      )}

      {/* ⚠️ Pending metadata warning */}
      {currentFileId?.startsWith("temp-") && (
        <div style={{ color: "orange", fontSize: "14px", marginBottom: "10px" }}>
          ⚠️ File metadata is not uploaded yet. Metadata will be submitted on upload.
        </div>
      )}

      <Button
        label="Save Metadata"
        onClick={() => onSubmit(currentFileId, metadataInput)}
        className="btn btn-outline-primary mt-2"
      />
    </Dialog>
  );
};

export default MetadataDialog;
