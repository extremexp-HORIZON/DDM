import { useState, useEffect } from 'react';
import { FILE_METADATA_API } from '../api/file_metadata';
import { showMessage } from '../utils/messages';

export const useFileHtmlReport = (fileId, toast) => {
  const [htmlContent, setHtmlContent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReport = async () => {
      setLoading(true);
      try {
        const data = await FILE_METADATA_API.fetchHtmlReport(fileId);
        setHtmlContent(data || '<p>No report content available.</p>');
      } catch (error) {
        console.error(error);
        showMessage(toast, 'error', 'Failed to load report.');
      } finally {
        setLoading(false);
      }
    };

    if (fileId) {
      fetchReport();
    }
  }, [fileId, toast]);

  return { htmlContent, loading };
};
