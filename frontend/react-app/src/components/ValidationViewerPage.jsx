import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';  // if you use React Router
import { VALIDATIONS_API } from '../api/validations';
import ValidationResultsViewer from '../components/ValidationResultsViewer';
import { useToast } from '../context/ToastContext';
import { showMessage } from '../utils/messages';
import { ProgressSpinner } from 'primereact/progressspinner';

const ValidationViewerPage = () => {
  const { suiteId, datasetId } = useParams();  // expects route like /viewer/:suiteId/:datasetId
  const toast = useToast();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);  // adjust if you have a ThemeContext

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await VALIDATIONS_API.getAllResults({
          dataset_id: [datasetId],
          suite_id: suiteId,
        });
        const data = res.data?.data;
        if (data && data.length > 0) {
          setResult(data[0]);  // use first matching result
        } else {
          showMessage(toast, 'warn', 'No results found for this suite and dataset.');
        }
      } catch (error) {
        console.error(error);
        showMessage(toast, 'error', 'Failed to fetch validation results.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [suiteId, datasetId, toast]);

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
