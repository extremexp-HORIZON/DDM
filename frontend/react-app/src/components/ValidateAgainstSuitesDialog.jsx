import React, { useState } from "react";
import { Dialog } from "primereact/dialog";
import { Chips } from "primereact/chips";
import { Button } from "primereact/button";

const ValidateAgainstSuitesDialog = ({ visible, onHide, onSubmit, fileId }) => {
  const [suiteIds, setSuiteIds] = useState([]);

  const handleSubmit = () => {
    if (suiteIds.length > 0) {
      onSubmit(fileId, suiteIds);
      onHide();
      setSuiteIds([]); // clear after submit
    }
  };

  return (
    <Dialog
      header="Validate Against Suite IDs"
      visible={visible}
      onHide={() => {
        setSuiteIds([]);
        onHide();
      }}
      style={{ width: "30vw" }}
      modal
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <label htmlFor="suite-ids">Suite IDs:</label>
        
        <Chips
          id="suite-ids"
          value={suiteIds}
          onChange={(e) => setSuiteIds(e.value)}
          placeholder="Paste or type suite IDs"
          className="p-inputtext-sm"
        />

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button
            label="Validate"
            icon="pi pi-check"
            size="small" // <- THIS
            onClick={handleSubmit}
            disabled={!suiteIds.length}
            className="p-button-success"
          />
        </div>
      </div>
    </Dialog>
  );
};

export default ValidateAgainstSuitesDialog;
