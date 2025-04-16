import React from "react";
import { Dialog } from "primereact/dialog";
import SupportedFileTypesTable from "./SupportedFileTypesTable"; // your table component

const SupportedFileTypesDialog = ({ visible, onHide, isDarkMode, all_file_formats }) => {
  return (
    <Dialog
      header="Supported File Types"
      visible={visible}
      onHide={onHide}
      style={{ width: "60vw" }}
      modal
      className={isDarkMode ? "dark-mode" : ""}
    >
      <SupportedFileTypesTable isDarkMode={isDarkMode} all_file_formats={all_file_formats}/>
    </Dialog>
  );
};

export default SupportedFileTypesDialog;
