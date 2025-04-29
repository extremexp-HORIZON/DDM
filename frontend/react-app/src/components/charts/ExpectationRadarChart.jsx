import React, { useState, useEffect } from 'react';
import { Chart } from 'primereact/chart';

function ExpectationRadarChart({ expectations = [], activeCategories = [], type = "column" }) {
    const [chartData, setChartData] = useState({});
    const [chartOptions, setChartOptions] = useState({});

    useEffect(() => {
        const documentStyle = getComputedStyle(document.documentElement);
        const textColor = documentStyle.getPropertyValue('--text-color');
        const textColorSecondary = documentStyle.getPropertyValue('--text-color-secondary');

        const fixedCategories = type === "table"
            ? ["Volume", "Schema"]
            : ["Schema", "Completeness", "Uniqueness", "Validity", "Numeric"];

        const categoryCounts = {};
        fixedCategories.forEach(cat => {
            categoryCounts[cat.toLowerCase()] = 0;
        });

        expectations.forEach((exp) => {
            const expCategory = (exp.category || "Unknown").toLowerCase();
            if (categoryCounts.hasOwnProperty(expCategory)) {
                categoryCounts[expCategory]++;
            }
        });

        const data = {
            labels: fixedCategories,
            datasets: [
                {
                    label: type === "table" ? 'Table Expectations' : 'Column Expectations',
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    borderColor: documentStyle.getPropertyValue('--blue-500'),
                    pointBackgroundColor: documentStyle.getPropertyValue('--blue-500'),
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: documentStyle.getPropertyValue('--blue-500'),
                    data: fixedCategories.map(cat => {
                        const lowerCat = cat.toLowerCase();
                        return (activeCategories.length === 0 || activeCategories.includes(lowerCat))
                            ? categoryCounts[lowerCat] || 0
                            : 0;
                    })
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

export default ExpectationRadarChart;
