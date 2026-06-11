'use client';
import '@/lib/chartSetup';
import { Bar } from 'react-chartjs-2';
import { useChartColors } from '@/context/ThemeContext';

export default function ExpenseTrendChart() {
  const { tick, grid } = useChartColors();
  return (
    <Bar
      data={{
        labels: ['Oct','Nov','Dec','Jan','Feb','Mar'],
        datasets: [{
          data: [21.1,22.8,25.1,22.8,25.1,28.4],
          backgroundColor: 'rgba(239,68,68,0.7)',
          borderRadius: 4,
        }],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: grid }, ticks: { color: tick, font: { size: 11 } } },
          y: { grid: { color: grid }, ticks: { color: tick, font: { size: 11 }, callback: (v) => `₹${v}L` } },
        },
      }}
    />
  );
}
