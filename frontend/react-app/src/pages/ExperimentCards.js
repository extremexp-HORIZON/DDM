import React from "react";
import { useTheme } from "../context/ThemeContext"; // Dark mode support


const ExperimentCards = () => {
  const { isDarkMode } = useTheme();

  return (
    <div className={`dataset-container ${isDarkMode ? "dark-mode" : "light-mode"} p-4`}>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className="rounded-lg border border-gray-300 dark:border-gray-700 p-4 shadow-sm"
          >
            <h4 className="text-lg font-semibold mb-2">Experiment #{n}</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">Placeholder content...</p>
          </div>
        ))}
      </div>

      <p className="text-center text-sm text-gray-500 dark:text-gray-400 italic">
        🚧 Under construction — more features coming soon!
      </p>
    </div>
  );
};

export default ExperimentCards;
