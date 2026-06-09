'use client';
import '@/lib/chartSetup';
import { Doughnut } from 'react-chartjs-2';

export default function PaymentModeChart() {
  return (
    <Doughnut
      data={{
        labels: ['UPI','NEFT/RTGS','Cheque','Card'],
        datasets: [{
          data: [45,30,15,10],
          backgroundColor: ['#10b981','#6366f1','#f59e0b','#3b82f6'],
          borderWidth: 0,
        }],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#8b92a8', font: { size: 10 }, boxWidth: 8, padding: 6 } },
        },
        cutout: '60%',
      }}
    />
  );
}
