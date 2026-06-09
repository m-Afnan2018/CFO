'use client';
import '@/lib/chartSetup';
import { Line } from 'react-chartjs-2';

const MONTHS = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'];
const MARGIN = [33,36,38,37,40,37,37,37,38,37,36,33];

export default function MarginChart() {
  return (
    <Line
      data={{
        labels: MONTHS,
        datasets: [{
          data: MARGIN,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16,185,129,0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: '#10b981',
        }],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#555e73', font: { size: 11 } } },
          y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#555e73', font: { size: 11 }, callback: (v) => `${v}%` } },
        },
      }}
    />
  );
}
