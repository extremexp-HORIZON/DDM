import React, {useState} from "react";
import { TabMenu } from "primereact/tabmenu";
import { Timeline } from 'primereact/timeline';
import { Tag } from 'primereact/tag';
import { useTheme } from "../context/ThemeContext"; 
import "../styles/components/tabmenu.css"; 
import { Chart } from 'primereact/chart';
import { useMemo } from 'react';
import { Dropdown } from "primereact/dropdown";


const CatalogRowExpansion = ({ data, activeTabIndex, setActiveTabIndex }) => {
  const { isDarkMode } = useTheme();
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

  const [groupBy, setGroupBy] = useState("day");




  const groupOptions = [
    { label: "Hour", value: "hour" },
    { label: "Day", value: "day" },
    { label: "Week", value: "week" },
    { label: "Month", value: "month" },
  ];

  const [selectedIPs, setSelectedIPs] = useState([]);

  const ipOptions = useMemo(() => {
    const ips = new Set();
    data.file_actions?.forEach((a) => {
      if (a.action_type === "download" && a.metadata?.ip) {
        ips.add(a.metadata.ip);
      }
    });
    return Array.from(ips);
  }, [data.file_actions]);

  const downloadCounts = useMemo(() => {
    if (!Array.isArray(data.file_actions)) return null;

    const filteredIPs = Array.isArray(selectedIPs) && selectedIPs.length > 0 ? selectedIPs : ipOptions;


    const ipDownloads = {};
    filteredIPs.forEach((ip) => {
      ipDownloads[ip] = {};
    });

    const formatDate = (date) => {
      const d = new Date(date);
      if (groupBy === "hour") return `${d.toISOString().slice(0, 13)}:00`;
      if (groupBy === "day") return d.toISOString().split("T")[0];
      if (groupBy === "week") {
        const year = d.getFullYear();
        const week = Math.ceil(((d - new Date(year, 0, 1)) / 86400000 + new Date(year, 0, 1).getDay() + 1) / 7);
        return `${year}-W${String(week).padStart(2, "0")}`;
      }
      if (groupBy === "month") return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return "";
    };

    const allTimestamps = new Set();

    data.file_actions?.forEach((a) => {
      if (a.action_type !== "download" || !a.metadata?.ip) return;

      const ip = a.metadata.ip;
      const key = formatDate(a.timestamp);

      if (filteredIPs.includes(ip)) {
        if (!ipDownloads[ip]) ipDownloads[ip] = {};
        ipDownloads[ip][key] = (ipDownloads[ip][key] || 0) + 1;
        allTimestamps.add(key);
      }
    });

    const sortedKeys = Array.from(allTimestamps).sort((a, b) => new Date(a) - new Date(b));

    return {
      labels: sortedKeys,
      datasets: Object.entries(ipDownloads).map(([ip, counts]) => ({
        label: ip,
        data: sortedKeys.map(k => counts[k] || 0),
        fill: false,
        tension: 0.4,
      })),
    };
  }, [data.file_actions, groupBy, selectedIPs, ipOptions]);

  const doughnutData = useMemo(() => {
    const counts = {};
    data.file_actions?.forEach((a) => {
      if (a.action_type === "download" && a.metadata?.ip) {
        const ip = a.metadata.ip;
        counts[ip] = (counts[ip] || 0) + 1;
      }
    });

    const filtered = selectedIPs.length > 0
      ? Object.entries(counts).filter(([key]) => selectedIPs.includes(key))
      : Object.entries(counts);

    return {
      labels: filtered.map(([k]) => k),
      values: filtered.map(([, v]) => v),
    };
  }, [data.file_actions, selectedIPs]);





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
            {!data.file_metadata || Object.keys(data.file_metadata).length === 0
            ? "No File metadata available"
            : JSON.stringify(data.file_metadata, null, 2)}

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


        {activeTabIndex === 3 && (
          <div style={{ marginTop: "2rem", padding: "1rem" }}>
            {Array.isArray(data.file_actions) && data.file_actions.length > 0 ? (
              <Timeline
                value={data.file_actions}
                opposite={(item) => new Date(item.timestamp).toLocaleString()}
                content={(item) => {
                  return (
                    <div
                      className="p-card p-p-2"
                      style={{
                        backgroundColor: isDarkMode ? "#1e1e1e" : "#fff",
                        color: isDarkMode ? "#f5f5f5" : "#000",
                      }}
                    >
                      <div className="p-d-flex p-ai-center p-jc-between">
                        <Tag value={item.action_type} severity="info" />
                        <small style={{ color: isDarkMode ? "#ccc" : "#888" }}>
                          by {item.username}
                        </small>
                      </div>
                      {item.metadata && Object.keys(item.metadata).length > 0 && (
                        <pre
                          style={{
                            marginTop: "0.5rem",
                            fontSize: "0.75rem",
                            background: isDarkMode ? "#2a2a2a" : "#f9f9f9",
                            color: isDarkMode ? "#eee" : "#333",
                            padding: "0.5rem",
                            borderRadius: "4px",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                            maxWidth: "100%", // Optional: keeps it within container
                            overflowWrap: "break-word"
                          }}
                        >
                          {JSON.stringify(item.metadata, null, 2)}
                        </pre>
                      )}
                    </div>
                  );
                }}
                align="alternate"
              />
            ) : (
              <span>No file history available.</span>
            )}
          </div>
        )}

        {activeTabIndex === 4 && (
          <pre>
            {data.access_control
              ? JSON.stringify(data.access_control, null, 2)
              : "No Access Control metadata available"}
          </pre>
        )}


        {activeTabIndex === 5 && (
          <pre>
            {Array.isArray(data.parent_files)
              ? JSON.stringify(data.parent_files, null, 2)
              : JSON.stringify(data.parent_files, null, 2)}
          </pre>
        )}

        {activeTabIndex === 7 && (
          <div style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
              <Dropdown
                value={groupBy}
                options={groupOptions}
                onChange={(e) => setGroupBy(e.value)}
                placeholder="Time Interval"
              />
              <Dropdown
                value={selectedIPs}
                options={ipOptions.map(ip => ({ label: ip, value: ip }))}
                onChange={(e) => setSelectedIPs(e.value || [])}
                placeholder="Module IP"
                multiple
                showClear
              />


            </div>

            {downloadCounts ? (
              <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                <Chart
                  type="line"
                  data={downloadCounts}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: 'top' },
                      title: {
                        display: true,
                        text: `Downloads Over Time (${groupBy})`,
                      },
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        ticks: {
                          callback: val => Number.isInteger(val) ? val : null,
                          stepSize: 1,
                        },
                      },
                    },
                  }}
                  style={{ height: '250px', width: '48%' }}
                />

                <div style={{ width: '48%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <Chart
                      type="doughnut"
                      data={{
                        labels: doughnutData.labels,
                        datasets: [{
                          data: doughnutData.values,
                          backgroundColor: ['#42A5F5', '#66BB6A', '#FFA726', '#FF7043', '#AB47BC'],
                        }],
                      }}
                      options={{
                        plugins: {
                          legend: { position: 'top' },
                          title: { display: true, text: 'Download Distribution by IP' },
                        },
                        maintainAspectRatio: false, // important to let container control layout
                      }}
                      style={{ height: '250px', width: '100%' }}
                    />
                </div>

              </div>

            ) : (
              <p>No stats available</p>
            )}
          </div>
        )}




      </div>
    </div>
  );
};

export default CatalogRowExpansion;
