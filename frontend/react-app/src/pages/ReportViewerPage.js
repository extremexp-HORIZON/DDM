import React from 'react';
import { useParams } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { useFileHtmlReport } from '../hooks/useFileHtmlReport';
import StyledReportViewer from '../components/StyledReportViewer';
import { ProgressSpinner } from 'primereact/progressspinner';
import { useTheme } from "../context/ThemeContext";


const ReportViewerPage = () => {
  const { fileId } = useParams();
  const toast = useToast();
  const { isDarkMode } = useTheme();
  const { htmlContent, loading } = useFileHtmlReport(fileId, toast);

  if (loading) {
    return (
      <div className="flex justify-content-center align-items-center" style={{ height: '100vh' }}>
        <ProgressSpinner />
      </div>
    );
  }

  return (
    <div className={`dataset-container ${isDarkMode ? "dark-mode" : "light-mode"}`} style={{ padding: '2rem' }}>
      <h2 style={{ marginBottom: '1rem', textAlign:"center" }}>Report Viewer for File ID: {fileId}</h2>
      <StyledReportViewer htmlContent={htmlContent} isDarkMode={isDarkMode} />
    </div>
  );
};

export default ReportViewerPage;
