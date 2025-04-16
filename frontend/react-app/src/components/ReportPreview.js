// components/ReportPreview.js
import React from "react";
import { getHtmlReportStyles, getSanitizedHtml } from "../utils/htmlUtils";

const ReportPreview = ({ htmlContent, isDarkMode }) => {
  if (!htmlContent) return null;

  const style = getHtmlReportStyles(isDarkMode);
  const fullHtml = getSanitizedHtml(htmlContent, style);

  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%" }}
    >
      <iframe
        title="Profile Report"
        srcDoc={fullHtml}
        style={{ width: "100%", height: "700px", border: "none" }}
      />
    </div>
  );
};

export default ReportPreview;
