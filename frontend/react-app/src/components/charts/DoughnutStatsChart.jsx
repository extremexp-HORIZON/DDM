import React, { useEffect, useState } from 'react';
import { Chart } from 'primereact/chart';

const DoughnutStatsChart = ({ passed = 0, failed = 0 }) => {
  const [chartData, setChartData] = useState({});
  const [chartOptions, setChartOptions] = useState({});
  const total = passed + failed;
  const successRate = total > 0 ? ((passed / total) * 100).toFixed(3) : "0";

  useEffect(() => {
    const documentStyle = getComputedStyle(document.documentElement);

    const data = {
      labels: [`Passed: ${passed}`, `Failed: ${failed}`],
      datasets: [
        {
          data: [passed, failed],
          backgroundColor: [
            documentStyle.getPropertyValue('--green-500'),
            documentStyle.getPropertyValue('--red-500')
          ],
          hoverBackgroundColor: [
            documentStyle.getPropertyValue('--green-400'),
            documentStyle.getPropertyValue('--red-400')
          ]
        }
      ]
    };

    const options = {
      cutout: '60%',
      plugins: {
        legend: {
          labels: {
            color: documentStyle.getPropertyValue('--text-color')
          }
        },
        title: {
          display: true,
          text: `Success Rate: ${successRate}%`,
          font: {
            size: 20
          },
          color: documentStyle.getPropertyValue('--text-color'),
          padding: {
            top: 10,
            bottom: 20
          }
        }
      }
    };

    setChartData(data);
    setChartOptions(options);
  }, [passed, failed]);

  return (
    <div style={{ width: '100%', maxWidth: '40rem', textAlign: 'center' }}>
      <Chart type="doughnut" data={chartData} options={chartOptions} />
    </div>
  );
};

export default DoughnutStatsChart;
