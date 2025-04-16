import React, { useEffect, useState } from "react";
import { PARAMETRICS_API } from "../api/parametrics";
import { getFileIconFromExt } from "../utils/icons";

const SupportedFileTypesTable = ({ isDarkMode, all_file_formats }) => {
  const [fileGroups, setFileGroups] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
  
    const fetchTypes = all_file_formats
      ? PARAMETRICS_API.getAllSupportedFileTypes()   // Make sure this method exists
      : PARAMETRICS_API.getSupportedFileTypes();
  
    fetchTypes
      .then(setFileGroups)
      .catch((err) => {
        console.error("Failed to fetch supported file types:", err);
        setFileGroups({});
      })
      .finally(() => setLoading(false));
  }, [all_file_formats]);
  

  if (loading) return <div className="p-4">Loading supported file types...</div>;

  return (
    <div className="p-4">
      <table className="w-full text-left border-collapse border border-gray-200 dark:border-gray-700">
          <tr style={{ backgroundColor: isDarkMode ? "#4444" : "#f9fafb" }}>
            <th className="px-4 py-2 border-b border-gray-300 dark:border-gray-700">Group</th>
            <th className="px-4 py-2 border-b border-gray-300 dark:border-gray-700">Supported File Types</th>
          </tr>
        <tbody>
          {Object.entries(fileGroups).map(([group, extensions]) => (
            <tr key={group} className="hover:bg-gray-50 dark:hover:bg-gray-800">
              <td className="px-4 py-2 border-b font-medium dark:border-gray-700 align-top w-1/4">
                {group.replace(/_/g, " ")}
              </td>
              <td className="px-4 py-2 border-b dark:border-gray-700">
                <div className="flex flex-wrap gap-4">
                  {Object.entries(extensions).map(([ext, label]) => (
                    <div
                      key={ext}
                      className="flex flex-col items-center text-center cursor-help"
                      title={label} // 👈 tooltip on hover
                    >
                      {getFileIconFromExt(ext)}
                      <span className="text-xs mt-1 ">{ext}</span>
                    </div>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SupportedFileTypesTable;
