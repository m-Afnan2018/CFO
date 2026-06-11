'use client';
import '@/lib/chartSetup';
import { Chart } from 'react-chartjs-2';
import type { ChartData } from 'chart.js';
import { useChartColors } from '@/context/ThemeContext';

const MONTHS = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'];
const REV = [18,21,23,25,27,26,29,31,34,36,39,42.6];
const EXP = [12,13.5,14.2,15.8,16.1,16.5,18.2,19.4,21.1,22.8,25.1,28.4];
const NET = REV.map((r, i) => Math.round((r - EXP[i]) * 10) / 10);

export default function CashFlowChart() {
  const { tick, grid, legend } = useChartColors();
  const data: ChartData<'bar'> = {
    labels: MONTHS,
    datasets: [
      { label: 'Inflow (₹L)', data: REV, backgroundColor: 'rgba(16,185,129,0.7)', borderRadius: 3 },
      { label: 'Outflow (₹L)', data: EXP.map(v => -v), backgroundColor: 'rgba(239,68,68,0.6)', borderRadius: 3 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { label: 'Net (₹L)', data: NET, type: 'line' as any, borderColor: '#6366f1', backgroundColor: 'transparent', tension: 0.4, pointRadius: 3, pointBackgroundColor: '#6366f1' } as any,
    ],
  };
  return (
    <Chart
      type="bar"
      data={data}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: legend, font: { size: 11 }, boxWidth: 8 } } },
        scales: {
          x: { grid: { color: grid }, ticks: { color: tick, font: { size: 11 } } },
          y: { grid: { color: grid }, ticks: { color: tick, font: { size: 11 }, callback: (v) => `₹${Math.abs(Number(v))}L` } },
        },
      }}
    />
  );
}

