import React from "react";
import { InputText } from "primereact/inputtext";
import { Chips } from "primereact/chips";
import { ProgressBar } from "primereact/progressbar";
import { Button } from "primereact/button";

const UploadLinkForm = ({
  projectId,
  setProjectId,
  fileLinks,
  handleFileLinksChange,
  handleSubmit,
  loading,
  uploadProgress,
}) => {
  return (
    <form onSubmit={handleSubmit}>
      <div className="input-container" style={{ marginBottom: "20px" }}>
        <InputText
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          placeholder="Enter Project ID"
        />
      </div>

      <div className="p-chips-container" style={{ marginBottom: "20px" }}>
        <Chips
          className="p-chips p-component"
          value={fileLinks}
          onChange={handleFileLinksChange}
          placeholder={fileLinks.length ? "" : "Paste file URLs here"}
          style={{ width: "100%" }}
        />
      </div>

      {loading && (
        <ProgressBar value={uploadProgress} style={{ height: "10px", marginTop: "10px" }} />
      )}

      <Button
        type="submit"
        className="btn btn-outline-primary"
        disabled={loading}
        style={{ marginBottom: "20px" }}
      >
        Upload
      </Button>
    </form>
  );
};

export default UploadLinkForm;
