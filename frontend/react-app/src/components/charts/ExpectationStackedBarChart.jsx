import React, { useState, useEffect } from 'react';
import { Chart } from 'primereact/chart';

function ExpectationStackedBarChart({ expectations = [], activeCategories = [], selectedColumn = null, type = "column" }) {
    const [chartData, setChartData] = useState({});
    const [chartOptions, setChartOptions] = useState({});

    useEffect(() => {
        const documentStyle = getComputedStyle(document.documentElement);
        const textColor = documentStyle.getPropertyValue('--text-color');
        const textColorSecondary = documentStyle.getPropertyValue('--text-color-secondary');
        const surfaceBorder = documentStyle.getPropertyValue('--surface-border');

        const fixedCategories = type === "table"
            ? ["Volume", "Schema"]
            : ["Schema", "Completeness", "Uniqueness", "Validity", "Numeric"];

        const categoryColors = {
            schema: documentStyle.getPropertyValue('--blue-500'),
            completeness: documentStyle.getPropertyValue('--green-500'),
            uniqueness: documentStyle.getPropertyValue('--yellow-500'),
            validity: documentStyle.getPropertyValue('--cyan-500'),
            numeric: documentStyle.getPropertyValue('--pink-500'),
            volume: documentStyle.getPropertyValue('--orange-500')
        };

        let filteredExpectations = expectations;
        if (selectedColumn && type === "column") {
            filteredExpectations = expectations.filter(exp => exp.kwargs?.column === selectedColumn);
        }

        const columnCategoryCounts = {};

        filteredExpectations.forEach((exp) => {
            const colName = exp.kwargs?.column || "Table";
            const category = (exp.category || "unknown").toLowerCase();

            if (!columnCategoryCounts[colName]) {
                columnCategoryCounts[colName] = {};
                fixedCategories.forEach(cat => {
                    columnCategoryCounts[colName][cat.toLowerCase()] = 0;
                });
            }

            if (columnCategoryCounts[colName][category] !== undefined) {
                columnCategoryCounts[colName][category]++;
            }
        });

        const columnNames = Object.keys(columnCategoryCounts);

        const datasets = fixedCategories.map((cat) => {
            const catLower = cat.toLowerCase();
            return {
                type: 'bar',
                label: cat,
                backgroundColor: categoryColors[catLower] || documentStyle.getPropertyValue('--gray-500'),
                data: columnNames.map(col => columnCategoryCounts[col][catLower] || 0)
            };
        });

        const data = {
            labels: columnNames,
            datasets: datasets
        };

        const options = {
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: textColor
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                x: {
                    stacked: true,
                    ticks: {
                        color: textColorSecondary
                    },
                    grid: {
                        color: surfaceBorder
                    }
                },
                y: {
                    stacked: true,
                    ticks: {
                        color: textColorSecondary
                    },
                    grid: {
                        color: surfaceBorder
                    }
                }
            }
        };

        setChartData(data);
        setChartOptions(options);
    }, [expectations, activeCategories, selectedColumn, type]);

    return (
        <div 
            className="card"
            style={{
                height: "400px",
                width: "100%",
                margin: "0 auto",
                padding: "1rem",
                border: "1px solid var(--surface-border)",
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
            }}
        >
            <Chart 
                type="bar" 
                data={chartData} 
                options={chartOptions} 
                style={{ height: "100%", width: "100%" }}
            />
        </div>
    );
}

export default ExpectationStackedBarChart;
