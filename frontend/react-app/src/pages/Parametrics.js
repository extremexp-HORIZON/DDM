import React, { useState, useRef } from "react";
import { useTheme } from "../context/ThemeContext";
import SupportedFileTypesTable from "../components/SupportedFileTypesTable";
import { InputSwitch } from "primereact/inputswitch";
import { Tooltip } from "primereact/tooltip";

const Parametrics = () => {
  const { isDarkMode } = useTheme();
  const [showAllFormats, setShowAllFormats] = useState(true);
  const tooltipRef = useRef(null);

  return (
    <div className={`dataset-container ${isDarkMode ? "dark-mode" : "light-mode"}`}>
      <div className="flex items-center gap-2 ms-4">
        <span className={`text-sm font-medium ${showAllFormats ? "" : "text-gray-400 opacity-60"}`}>
          All 
        </span>

        <span ref={tooltipRef}>
          <InputSwitch
            checked={showAllFormats}
            onChange={(e) => setShowAllFormats(e.value)}
          />
        </span>

        <span className={`text-sm font-medium ${!showAllFormats ? "" : "text-gray-400 opacity-60"}`}>
          Df-Compatible 
        </span>

        <Tooltip
          target={tooltipRef}
          content="Toggle between ALL and DF-COMPATIBLE"
          position="top"
        />
      </div>

      <SupportedFileTypesTable
        all_file_formats={showAllFormats}
        isDarkMode={isDarkMode}
      />
    </div>
  );
};

export default Parametrics;
