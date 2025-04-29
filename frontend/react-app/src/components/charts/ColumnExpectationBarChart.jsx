import React, { useEffect, useState } from "react";
import { Chart } from "primereact/chart";

const ColumnExpectationBarChart = ({ expectations = [] }) => {
  const [chartData, setChartData] = useState({});
  const [chartOptions, setChartOptions] = useState({});

  useEffect(() => {
    const documentStyle = getComputedStyle(document.documentElement);
    const textColor = documentStyle.getPropertyValue("--text-color");
    const textColorSecondary = documentStyle.getPropertyValue("--text-color-secondary");
    const surfaceBorder = documentStyle.getPropertyValue("--surface-border");

    const columnStats = {}; 
    expectations.forEach((e) => {
      const col = e.expectation_config?.kwargs?.column || "Unknown";
      const expType = e.expectation_config?.type || "UnknownExpectation";

      if (!columnStats[col]) {
        columnStats[col] = { passed: 0, failed: 0, expectations: new Set() };
      }

      e.success ? columnStats[col].passed++ : columnStats[col].failed++;
      columnStats[col].expectations.add(expType);
    });

    const columns = Object.keys(columnStats);
    const passedData = columns.map((col) => columnStats[col].passed);
    const failedData = columns.map((col) => columnStats[col].failed);

    const data = {
      labels: columns, 
      datasets: [
        {
          label: "Passed",
          backgroundColor: documentStyle.getPropertyValue("--green-500"),
          borderColor: documentStyle.getPropertyValue("--green-500"),
          data: passedData,
        },
        {
          label: "Failed",
          backgroundColor: documentStyle.getPropertyValue("--red-500"),
          borderColor: documentStyle.getPropertyValue("--red-500"),
          data: failedData,
        },
      ],
    };

    const options = {
      maintainAspectRatio: false,
      aspectRatio: 0.8,
      plugins: {
        legend: {
          labels: {
            color: textColor,
          },
        },
        tooltip: {
          callbacks: {
            title: (tooltipItems) => {
              const idx = tooltipItems[0].dataIndex;
              return `Column:\n- `+columns[idx];
            },
            afterTitle: (tooltipItems) => {
              const idx = tooltipItems[0].dataIndex;
              const expectationsList = Array.from(columnStats[columns[idx]].expectations)
                .map((exp) => `- ${exp}`)
                .join('\n');
              return `Expectations:\n${expectationsList}`;
            }
          }
        }
      },
      scales: {
        x: {
          stacked: false,  
          ticks: {
            color: textColorSecondary,
            font: {
              weight: 500,
            },
          },
          grid: {
            display: false,
            drawBorder: false,
          },
        },
        y: {
          stacked: false, 
          ticks: {
            color: textColorSecondary,
          },
          grid: {
            color: surfaceBorder,
            drawBorder: false,
          },
        },
      },
    };

    setChartData(data);
    setChartOptions(options);
  }, [expectations]);

  return (
    <div className="card" style={{ height: "400px", width: "100%", margin: "0 auto", padding: "1rem", border: "1px solid var(--surface-border)", borderRadius: "12px" }}>
      <Chart 
        type="bar"
        data={chartData}
        options={chartOptions}
        style={{ height: "100%", width: "100%" }}
      />
    </div>
  );
}  

export default ColumnExpectationBarChart;
