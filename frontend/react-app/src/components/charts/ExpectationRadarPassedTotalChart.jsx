import React, { useState, useEffect } from 'react';
import { Chart } from 'primereact/chart';

function ExpectationRadarPassedTotalChart({ expectations = [], activeCategories = [], type = "column" }) {
    const [chartData, setChartData] = useState({});
    const [chartOptions, setChartOptions] = useState({});

    useEffect(() => {
        const documentStyle = getComputedStyle(document.documentElement);
        const textColor = documentStyle.getPropertyValue('--text-color');
        const textColorSecondary = documentStyle.getPropertyValue('--text-color-secondary');

        const fixedCategories = type === "table"
            ? ["Volume", "Schema"]
            : ["Schema", "Completeness", "Uniqueness", "Validity", "Numeric"];

        const passedCounts = {};
        const totalCounts = {};
        const failedCounts = {};

        fixedCategories.forEach(cat => {
            const key = cat.toLowerCase();
            passedCounts[key] = 0;
            totalCounts[key] = 0;
            failedCounts[key] = 0;
        });

        expectations.forEach((exp) => {
            const expCategory = (exp.category || "unknown").toLowerCase();
            if (passedCounts.hasOwnProperty(expCategory)) {
                totalCounts[expCategory]++;
                exp.success ? passedCounts[expCategory]++ : failedCounts[expCategory]++;
            }
        });

        const finalCategories = fixedCategories.filter(cat => {
            const key = cat.toLowerCase();
            return activeCategories.length === 0 || activeCategories.includes(key);
        });

        const data = {
            labels: finalCategories,
            datasets: [
                {
                    label: 'Passed',
                    backgroundColor: 'rgba(0, 200, 83, 0.2)',
                    borderColor: documentStyle.getPropertyValue('--green-500'),
                    borderWidth: 2,
                    pointBackgroundColor: documentStyle.getPropertyValue('--green-500'),
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: documentStyle.getPropertyValue('--green-500'),
                    data: finalCategories.map(cat => passedCounts[cat.toLowerCase()] || 0)
                },
                {
                    label: 'Failed',
                    backgroundColor: 'rgba(244, 67, 54, 0.2)',
                    borderColor: documentStyle.getPropertyValue('--red-500'),
                    borderWidth: 2,
                    pointBackgroundColor: documentStyle.getPropertyValue('--red-500'),
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: documentStyle.getPropertyValue('--red-500'),
                    data: finalCategories.map(cat => failedCounts[cat.toLowerCase()] || 0)
                },
                {
                    label: 'Total',
                    backgroundColor: 'rgba(33, 150, 243, 0.2)',
                    borderColor: documentStyle.getPropertyValue('--blue-500'),
                    borderDash: [5, 5],
                    borderWidth: 2,
                    pointBackgroundColor: documentStyle.getPropertyValue('--blue-500'),
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: documentStyle.getPropertyValue('--blue-500'),
                    data: finalCategories.map(cat => totalCounts[cat.toLowerCase()] || 0)
                }
            ]
        };

        const options = {
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: textColor
                    }
                }
            },
            scales: {
                r: {
                    startAngle: type === "table" ? -90 : undefined,
                    min: 0,
                    ticks: {
                        stepSize: 1
                    },
                    grid: {
                        color: textColorSecondary
                    },
                    pointLabels: {
                        color: textColor
                    },
                    angleLines: {
                        color: textColorSecondary
                    }
                }
            }
        };

        setChartData(data);
        setChartOptions(options);
    }, [expectations, activeCategories, type]);

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
                type="radar"
                data={chartData}
                options={chartOptions}
                style={{ height: "100%", width: "100%" }}
            />
        </div>
    );
}

export default ExpectationRadarPassedTotalChart;
