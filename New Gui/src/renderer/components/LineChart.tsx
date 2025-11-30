import React, { useRef, useEffect } from 'react';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

Chart.register(...registerables);

interface LineChartProps {
  data: { time: Date; value: number }[];
  color?: string;
  height?: number;
  yAxis?: { min?: number; max?: number };
}

const LineChart: React.FC<LineChartProps> = ({ 
  data, 
  color = '#22c55e', 
  height = 300,
  yAxis = {}
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // Destroy existing chart
    if (chartRef.current) {
      chartRef.current.destroy();
    }

    // Prepare data
    const chartData = {
      labels: data.map(d => d.time.toLocaleTimeString()),
      datasets: [{
        label: 'Value',
        data: data.map(d => d.value),
        borderColor: color,
        backgroundColor: color + '20',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: color,
        pointHoverBorderColor: '#ffffff',
        pointHoverBorderWidth: 2
      }]
    };

    const config: ChartConfiguration = {
      type: 'line',
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: '#1e293b',
            titleColor: '#ffffff',
            bodyColor: '#ffffff',
            borderColor: color,
            borderWidth: 1,
            padding: 12,
            displayColors: false,
            callbacks: {
              title: (context) => {
                const index = context[0].dataIndex;
                return data[index]?.time.toLocaleString() || '';
              }
            }
          }
        },
        scales: {
          x: {
            display: false
          },
          y: {
            beginAtZero: yAxis.min === undefined,
            min: yAxis.min,
            max: yAxis.max,
            grid: {
              color: '#475569',
              drawBorder: false
            },
            ticks: {
              color: '#94a3b8',
              font: {
                size: 12
              }
            }
          }
        },
        interaction: {
          mode: 'nearest',
          axis: 'x',
          intersect: false
        }
      }
    };

    chartRef.current = new Chart(ctx, config);

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [data, color, yAxis]);

  return (
    <div style={{ height: `${height}px` }}>
      <canvas ref={canvasRef} />
    </div>
  );
};

export default LineChart;