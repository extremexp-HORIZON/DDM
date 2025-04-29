import React, { useEffect, useState } from "react";
import { Chart } from "primereact/chart";

const TableExpectationBarChart = ({ expectations = [], expectationDescriptions = {} }) => {
  const [chartData, setChartData] = useState({});
  const [chartOptions, setChartOptions] = useState({});

  useEffect(() => {
    const documentStyle = getComputedStyle(document.documentElement);
    const textColor = documentStyle.getPropertyValue("--text-color");
    const textColorSecondary = documentStyle.getPropertyValue("--text-color-secondary");
    const surfaceBorder = documentStyle.getPropertyValue("--surface-border");

    const categoryStats = {};

    expectations.forEach((e) => {
      const expType = e.expectation_config?.type || "UnknownExpectation";
      const category = expectationDescriptions[expType]?.category || "Other";

      if (!categoryStats[category]) {
        categoryStats[category] = { passed: 0, failed: 0 };
      }

      e.success ? categoryStats[category].passed++ : categoryStats[category].failed++;
    });

    const categories = Object.keys(categoryStats);
    const passedData = categories.map((cat) => categoryStats[cat].passed);
    const failedData = categories.map((cat) => categoryStats[cat].failed);

    const data = {
      labels: categories,
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
              return `Category: ${categories[idx]}`;
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
  }, [expectations, expectationDescriptions]);

  return (
    <div style={{ 
      display: "flex", 
      justifyContent: "center", 
      alignItems: "center", 
      height: "400px", 
      width: "100%", 
      padding: "1rem", 
      border: "1px solid var(--surface-border)", 
      borderRadius: "12px", 
    }}>
      <div style={{ width: "100%", height: "100%" }}>
        <Chart 
          type="bar" 
          data={chartData} 
          options={chartOptions}
          style={{ width: "100%", height: "100%" }} 
        />
      </div>
    </div>
  );
} 

export default TableExpectationBarChart;
