'use client';
import '@/lib/chartSetup';
import { Bar } from 'react-chartjs-2';

export default function ExpenseTrendChart() {
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
          x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#555e73', font: { size: 11 } } },
          y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#555e73', font: { size: 11 }, callback: (v) => `₹${v}L` } },
        },
      }}
    />
  );
}
