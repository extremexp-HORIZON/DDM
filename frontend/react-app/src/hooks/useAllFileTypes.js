import { useEffect, useState } from 'react';
import { PARAMETRICS_API } from '../api/parametrics';

export const useAllFileTypes = () => {
  const [fileTypes, setFileTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const fetchFileTypes = async () => {
      try {
        const data = await PARAMETRICS_API.getAllSupportedFileTypes(); // 🔥 <-- changed here

        if (isMounted && typeof data === 'object') {
          const flatTypes = [];

          Object.entries(data).forEach(([category, extensions]) => {
            if (typeof extensions === 'object') {
              Object.entries(extensions).forEach(([ext, label]) => {
                flatTypes.push({
                  label: label, // or `${label} (${ext})` if you want
                  value: ext.replace(/^\./, '') // remove leading dot
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
