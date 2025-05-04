import React from 'react';
import { useParams } from 'react-router-dom';
import { ProgressSpinner } from 'primereact/progressspinner';
import { useToast } from '../context/ToastContext';
import ValidationResultsViewer from '../components/ValidationResultsViewer';
import { useValidationResult } from '../hooks/useValidationResult';

const ValidationViewerPage = () => {
  const { suiteId, datasetId } = useParams();  // expects route like /viewer/:suiteId/:datasetId
  const toast = useToast();
  const { result, loading } = useValidationResult(suiteId, datasetId, toast);
  const isDarkMode = false;  // adjust if you have a ThemeContext

  if (loading) {
    return (
      <div className="flex justify-content-center align-items-center" style={{ height: '100vh' }}>
        <ProgressSpinner />
      </div>
    );
  }

  if (!result) {
    return <div style={{ textAlign: 'center', marginTop: '2rem' }}>No validation result available.</div>;
  }

  return (
    <div>
      <ValidationResultsViewer result={result} isDarkMode={isDarkMode} />
    </div>
  );
};

export default ValidationViewerPage;
