'use client';
import '@/lib/chartSetup';
import { Bar } from 'react-chartjs-2';

interface Props {
  labels: string[];
  data: number[];
}

const COLORS = [
  'rgba(99,102,241,0.75)',
  'rgba(16,185,129,0.75)',
  'rgba(59,130,246,0.75)',
  'rgba(245,158,11,0.75)',
  'rgba(239,68,68,0.75)',
  'rgba(139,92,246,0.75)',
  'rgba(20,184,166,0.75)',
  'rgba(249,115,22,0.75)',
  'rgba(236,72,153,0.75)',
];

export default function DeptPayrollChart({ labels, data }: Props) {
  if (!labels.length) return null;
  return (
    <Bar
      data={{
        labels,
        datasets: [{
          label: 'Payroll (₹)',
          data,
          backgroundColor: labels.map((_, i) => COLORS[i % COLORS.length]),
          borderRadius: 5,
          barThickness: 22,
        }],
      }}
      options={{
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const v = ctx.parsed.x ?? 0;
                return ` ₹${v >= 100000 ? (v / 100000).toFixed(1) + 'L' : v.toLocaleString('en-IN')}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: {
              color: '#555e73', font: { size: 11 },
              callback: (v) => `₹${Number(v) >= 100000 ? (Number(v) / 100000).toFixed(0) + 'L' : v}`,
            },
          },
          y: {
            grid: { display: false },
            ticks: { color: '#94a3b8', font: { size: 12 } },
          },
        },
      }}
    />
  );
}
