'use client';
import '@/lib/chartSetup';
import { Bar } from 'react-chartjs-2';
import { useChartColors } from '@/context/ThemeContext';

const MONTHS = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'];
const REV = [18,21,23,25,27,26,29,31,34,36,39,42.6];
const EXP = [12,13.5,14.2,15.8,16.1,16.5,18.2,19.4,21.1,22.8,25.1,28.4];

export default function RevenueExpenseChart() {
  const { tick, grid, legend } = useChartColors();
  return (
    <Bar
      data={{
        labels: MONTHS,
        datasets: [
          { label: 'Revenue', data: REV, backgroundColor: 'rgba(16,185,129,0.8)', borderRadius: 4, borderSkipped: false as const },
          { label: 'Expenses', data: EXP, backgroundColor: 'rgba(99,102,241,0.6)', borderRadius: 4, borderSkipped: false as const },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: true, labels: { color: legend, font: { size: 11 }, boxWidth: 8 } } },
        scales: {
          x: { grid: { color: grid }, ticks: { color: tick, font: { size: 11 } } },
          y: { grid: { color: grid }, ticks: { color: tick, font: { size: 11 }, callback: (v) => `₹${v}L` } },
        },
      }}
    />
  );
}
