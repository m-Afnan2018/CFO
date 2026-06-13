'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type { Invoice } from '@/types';
import { api } from '@/lib/api';
import styles from './Payments.module.css';

const PaymentModeChart = dynamic(() => import('@/components/charts/PaymentModeChart'), { ssr: false });

function fmt(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

const AGING_BUCKETS = [
  { label: '0–30 days', max: 30, color: 'var(--emerald)' },
  { label: '31–60 days', max: 60, color: 'var(--amber)' },
  { label: '61–90 days', max: 90, color: 'var(--red)' },
  { label: '90+ days', max: Infinity, color: '#7f1d1d' },
];

function daysSince(dateStr: string) {
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - parsed.getTime()) / 86400000));
}

export default function Payments() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.getInvoices().then((d) => { setInvoices(d as Invoice[]); setLoaded(true); }).catch(() => setLoaded(true));
  }, []);

  const collected = invoices.filter(i => i.status === 'Paid');
  const pending = invoices.filter(i => i.status === 'Pending');
  const overdue = invoices.filter(i => i.status === 'Overdue');
  const partial = invoices.filter(i => i.status === 'Partial');
  const sum = (list: Invoice[]) => list.reduce((s, i) => s + (i.total || 0), 0);

  const outstanding = [...pending, ...overdue, ...partial];
  const buckets = AGING_BUCKETS.map(b => ({ ...b, total: 0 }));
  outstanding.forEach(inv => {
    const d = daysSince(inv.date);
    const bucket = buckets.find(b => d <= b.max) || buckets[buckets.length - 1];
    bucket.total += inv.total || 0;
  });
  const maxBucket = Math.max(1, ...buckets.map(b => b.total));

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Payment Tracking</div>
      </div>
      <div className="content">
        <div className={`grid4 ${styles.grid4mb}`}>
          <div className="kpi">
            <div className="kpi-label">Total Collected</div>
            <div className={`kpi-value ${styles.valGreen}`}>{fmt(sum(collected))}</div>
            <div className={`kpi-change ${styles.kpiChangeSub}`}>{collected.length} invoices</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Pending</div>
            <div className={`kpi-value ${styles.valAmber}`}>{fmt(sum(pending))}</div>
            <div className={`kpi-change ${styles.kpiChangeSub}`}>{pending.length} invoices</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Overdue</div>
            <div className={`kpi-value ${styles.valRed}`}>{fmt(sum(overdue))}</div>
            <div className="kpi-change down">{overdue.length} invoices</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Partial Payments</div>
            <div className={`kpi-value ${styles.valIndigo}`}>{fmt(sum(partial))}</div>
            <div className={`kpi-change ${styles.kpiChangeSub}`}>{partial.length} invoices</div>
          </div>
        </div>
        <div className="grid2">
          <div className="card">
            <div className="card-title">Receivable Aging</div>
            {!loaded ? (
              <div className={styles.loadingMsg}>Loading…</div>
            ) : outstanding.length === 0 ? (
              <div className={styles.loadingMsg}>No outstanding receivables</div>
            ) : buckets.map(b => (
              <div key={b.label} className="bar-row">
                <span className="bar-label">{b.label}</span>
                <div className="bar-track"><div className="bar-fill" style={{ width: `${(b.total / maxBucket) * 100}%`, background: b.color }} /></div>
                <span className="bar-val">{fmt(b.total)}</span>
              </div>
            ))}
          </div>
          <div className="card">
            <div className="card-title">Payment Mode Split</div>
            <div className="cw cw-sm"><PaymentModeChart /></div>
          </div>
        </div>
      </div>
    </div>
  );
}
