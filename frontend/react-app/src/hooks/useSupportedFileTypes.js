import { useEffect, useState } from 'react';
import { PARAMETRICS_API } from '../api/parametrics';

export const useSupportedFileTypes = () => {
  const [fileTypes, setFileTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const fetchFileTypes = async () => {
      try {
        const data = await PARAMETRICS_API.getSupportedFileTypes();

        if (isMounted && typeof data === 'object') {
          const flatTypes = [];

          // Loop over category groups
          Object.entries(data).forEach(([category, extensions]) => {
            if (typeof extensions === 'object') {
              Object.entries(extensions).forEach(([ext, label]) => {
                flatTypes.push({
                  label: label, // or `${label} (${ext})`
                  value: ext.replace(/^\./, '') // remove dot from extension
                });
              });
            }
          });

          setFileTypes(flatTypes);
        }
      } catch (err) {
        if (isMounted) {
          setError('Failed to fetch supported file types');
          console.error(err);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchFileTypes();

    return () => {
      isMounted = false;
    };
  }, []);

  return { fileTypes, loading, error };
};
