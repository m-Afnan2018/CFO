'use client';
import '@/lib/chartSetup';
import { Doughnut } from 'react-chartjs-2';

export default function ServiceMixChart() {
  return (
    <Doughnut
      data={{
        labels: ['Social','Perf.Mktg','Web Dev','SEO','Content'],
        datasets: [{
          data: [34,22,18,14,12],
          backgroundColor: ['#10b981','#6366f1','#3b82f6','#f59e0b','#ef4444'],
          borderWidth: 0,
        }],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#8b92a8', font: { size: 10 }, boxWidth: 8, padding: 6 } },
        },
        cutout: '65%',
      }}
    />
  );
}
