import React from "react";
import { TabMenu } from "primereact/tabmenu";

const CatalogRowExpansion = ({ data, activeTabIndex, setActiveTabIndex }) => {
  const tabs = [
    { label: "File Metadata", icon: "pi pi-home" },
    { label: "Uploader Metadata", icon: "pi pi-list" },
    { label: "NFT Metadata", icon: "pi pi-tags" },
    { label: "File History", icon: "pi pi-history" },
    { label: "Access Control", icon: "pi pi-lock" },
    { label: "Parent Files", icon: "pi pi-code" },
    { label: "File Preview", icon: "pi pi-image" },
    { label: "File Stats", icon: "pi pi-chart-line" },
  ];

  return (
    <div className="p-3">
      <TabMenu
        model={tabs}
        activeIndex={activeTabIndex}
        onTabChange={(e) => setActiveTabIndex(e.index)}
        className="my-tabmenu"
      />
      <div className="tab-content" style={{ maxHeight: "400px", overflow: "auto" }}>
        {activeTabIndex === 0 && (
          <pre>
            {Object.keys(data.file_metadata || {}).length === 0
              ? "No File metadata available"
              : JSON.stringify(JSON.parse(data.file_metadata), null, 2)}
          </pre>
        )}

        {activeTabIndex === 1 && (
          <pre>
            {data?.uploader_metadata
              ? JSON.stringify(
                  typeof data.uploader_metadata === "string"
                    ? JSON.parse(data.uploader_metadata)
                    : data.uploader_metadata,
                  null,
                  2
                )
              : "No Uploader metadata available"}
          </pre>
        )}

        {activeTabIndex === 2 && (
          <pre>
            {Object.keys(data.nft_metadata || {}).length === 0
              ? "No NFT metadata available"
              : JSON.stringify(data.nft_metadata, null, 2)}
          </pre>
        )}

        {activeTabIndex === 5 && (
          <pre>
            {Array.isArray(data.parent_files)
              ? JSON.stringify(data.parent_files, null, 2)
              : JSON.stringify(data.parent_files, null, 2)}
          </pre>
        )}

        {/* You can expand for other tabs as needed */}
      </div>
    </div>
  );
};

export default CatalogRowExpansion;
