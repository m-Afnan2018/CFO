'use client';
import { useEffect, useState } from 'react';
import type { Invoice } from '@/types';
import { api } from '@/lib/api';

function fmt(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

function monthKey(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return 'Unknown';
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

export default function GST() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.getInvoices().then((d) => { setInvoices(d as Invoice[]); setLoaded(true); }).catch(() => setLoaded(true));
  }, []);

  const outputGST = invoices.reduce((s, i) => s + (i.gst || 0), 0);
  const totalRevenue = invoices.reduce((s, i) => s + (i.total || 0), 0);
  const effectiveRate = totalRevenue > 0 ? ((outputGST / totalRevenue) * 100).toFixed(1) : '0';

  const byMonth = new Map<string, { output: number; revenue: number; date: Date }>();
  invoices.forEach(inv => {
    const key = monthKey(inv.date);
    const d = new Date(inv.date);
    const entry = byMonth.get(key) || { output: 0, revenue: 0, date: Number.isNaN(d.getTime()) ? new Date(0) : d };
    entry.output += inv.gst || 0;
    entry.revenue += inv.total || 0;
    byMonth.set(key, entry);
  });
  const months = Array.from(byMonth.entries())
    .sort((a, b) => b[1].date.getTime() - a[1].date.getTime())
    .slice(0, 6);
  const now = new Date();

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">GST / Tax Summary</div>
        <div className="topbar-right">
          <button className="btn"><i className="ti ti-download" />Export</button>
        </div>
      </div>
      <div className="content">
        <div className="grid4" style={{ marginBottom: '18px' }}>
          <div className="kpi"><div className="kpi-label">GST Collected (Output)</div><div className="kpi-value" style={{ color: 'var(--emerald)' }}>{fmt(outputGST)}</div><div className="kpi-change" style={{ color: 'var(--text2)' }}>{effectiveRate}% on {fmt(totalRevenue)}</div></div>
          <div className="kpi"><div className="kpi-label">GST Paid (Input)</div><div className="kpi-value" style={{ color: 'var(--red)' }}>₹0</div><div className="kpi-change" style={{ color: 'var(--text2)' }}>Not tracked on expenses</div></div>
          <div className="kpi"><div className="kpi-label">Net GST Payable</div><div className="kpi-value" style={{ color: 'var(--amber)' }}>{fmt(outputGST)}</div></div>
          <div className="kpi"><div className="kpi-label">TDS Collected</div><div className="kpi-value">₹0</div><div className="kpi-change" style={{ color: 'var(--text2)' }}>Not tracked</div></div>
        </div>

        <div className="grid2">
          <div className="card">
            <div className="card-title">Monthly GST Summary<span className="card-sub">From invoice records</span></div>
            {!loaded ? (
              <div style={{ fontSize: '12px', color: 'var(--text3)', padding: '12px 0' }}>Loading…</div>
            ) : months.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text3)', padding: '12px 0' }}>No invoices recorded yet</div>
            ) : (
              <table>
                <thead><tr><th>Month</th><th>Output GST</th><th>Net Payable</th><th>Status</th></tr></thead>
                <tbody>
                  {months.map(([label, entry]) => {
                    const isPast = entry.date.getFullYear() < now.getFullYear() ||
                      (entry.date.getFullYear() === now.getFullYear() && entry.date.getMonth() < now.getMonth());
                    return (
                      <tr key={label}>
                        <td style={{ color: 'var(--text)' }}>{label}</td>
                        <td style={{ color: 'var(--emerald)' }}>{fmt(entry.output)}</td>
                        <td style={{ fontWeight: 700, color: 'var(--text)' }}>{fmt(entry.output)}</td>
                        <td><span className={`badge ${isPast ? 'bg' : 'ba'}`}>{isPast ? 'Filed' : 'Due'}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          <div className="card">
            <div className="card-title">Tax Insights</div>
            {[
              { k: 'Total GST Collected', v: fmt(outputGST), c: '' },
              { k: 'Total GST Paid (Input)', v: '₹0 — not tracked', c: '' },
              { k: 'Net GST Position', v: fmt(outputGST), c: 'var(--amber)' },
              { k: 'Effective GST Rate', v: `${effectiveRate}%`, c: '' },
              { k: 'TDS Collected', v: '₹0 — not tracked', c: '' },
              { k: 'Invoices Counted', v: `${invoices.length}`, c: '' },
            ].map(row => (
              <div key={row.k} className="stat-row">
                <span className="sk">{row.k}</span>
                <span className="sv" style={row.c ? { color: row.c } : {}}>{row.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
