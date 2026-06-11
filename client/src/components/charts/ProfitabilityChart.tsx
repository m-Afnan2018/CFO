'use client';
import '@/lib/chartSetup';
import { Bar } from 'react-chartjs-2';
import { useChartColors } from '@/context/ThemeContext';

export default function ProfitabilityChart() {
  const { tick, grid, legend } = useChartColors();
  return (
    <Bar
      data={{
        labels: ['Social Media','Perf. Mktg','Web Dev','SEO','Ecommerce','Content'],
        datasets: [
          { label: 'Revenue (₹L)', data: [14.5,9.4,7.6,5.9,3.2,2.0], backgroundColor: 'rgba(99,102,241,0.7)', borderRadius: 3 },
          { label: 'Gross Profit (₹L)', data: [11.3,7.6,5.2,4.8,2.3,1.2], backgroundColor: 'rgba(59,130,246,0.7)', borderRadius: 3 },
          { label: 'Net Profit (₹L)', data: [7.2,5.4,2.4,3.0,1.2,0.6], backgroundColor: 'rgba(16,185,129,0.8)', borderRadius: 3 },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: legend, font: { size: 11 }, boxWidth: 8 } } },
        scales: {
          x: { grid: { color: grid }, ticks: { color: tick, font: { size: 11 } } },
          y: { grid: { color: grid }, ticks: { color: tick, font: { size: 11 }, callback: (v) => `₹${v}L` } },
        },
      }}
    />
  );
}
