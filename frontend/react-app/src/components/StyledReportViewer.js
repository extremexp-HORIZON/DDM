import React from "react";
import { getHtmlReportStyles, getSanitizedHtml } from "../utils/htmlUtils";

const StyledReportViewer = ({ htmlContent, isDarkMode }) => {
    if (!htmlContent) return null;

    // Use the same style and sanitization utilities as ReportPreview
    const style = getHtmlReportStyles(isDarkMode);
    const styledHtml = getSanitizedHtml(htmlContent, style);

    return (
        <div
            style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%" }}
        >
            <iframe
                title="Styled Profile Report"
                srcDoc={styledHtml}
                style={{
                    width: "100%",
                    height: "100vh", 
                    border: "none",
                    overflow: "hidden"
                }}
            />

        </div>
    );
};

export default StyledReportViewer;
