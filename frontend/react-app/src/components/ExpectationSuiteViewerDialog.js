import React from "react";
import { Dialog } from "primereact/dialog";
import ExpectationSuiteViewer from "./ExpectationSuiteViewer";

const ExpecationSuiteViewerDialog = ({ visible, onHide, suite, isDarkMode }) => {
  return (
    <Dialog
      header={suite?.suite_name || "Expectation Suite"}
      visible={visible}
      onHide={onHide}
      style={{ width: "80vw" }}
      modal
      className={isDarkMode ? "dark-mode" : ""}
    >
      <ExpectationSuiteViewer suite={suite} />
    </Dialog>
  );
};

export default ExpecationSuiteViewerDialog;
