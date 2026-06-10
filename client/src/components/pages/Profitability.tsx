'use client';
import { useEffect, useState } from 'react';
import type { Invoice, Client } from '@/types';
import { api } from '@/lib/api';

function fmt(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

export default function Profitability() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([api.getInvoices(), api.getClients()])
      .then(([inv, cli]) => { setInvoices(inv as Invoice[]); setClients(cli as Client[]); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);

  const serviceByClient = new Map(clients.map(c => [c.name, c.service || 'Unassigned']));
  const byService = new Map<string, { revenue: number; count: number }>();
  invoices.forEach(inv => {
    const service = serviceByClient.get(inv.client) || 'Unassigned';
    const entry = byService.get(service) || { revenue: 0, count: 0 };
    entry.revenue += inv.total || 0;
    entry.count += 1;
    byService.set(service, entry);
  });
  const rows = Array.from(byService.entries())
    .map(([name, e]) => ({ name, ...e }))
    .sort((a, b) => b.revenue - a.revenue);
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const highest = rows[0];
  const lowest = rows[rows.length - 1];

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Service-wise Profitability</div>
      </div>
      <div className="content">
        <div className="grid3" style={{ marginBottom: '18px' }}>
          <div className="kpi" style={{ borderLeft: '3px solid var(--indigo)' }}>
            <div className="kpi-label">Highest Revenue Service</div>
            <div className="kpi-value" style={{ color: 'var(--indigo)', fontSize: '16px' }}>{highest ? highest.name : '—'}</div>
            <div className="kpi-change" style={{ color: 'var(--text2)' }}>{highest && totalRevenue > 0 ? `${((highest.revenue / totalRevenue) * 100).toFixed(0)}% revenue share` : 'No data yet'}</div>
          </div>
          <div className="kpi" style={{ borderLeft: '3px solid var(--amber)' }}>
            <div className="kpi-label">Lowest Revenue Service</div>
            <div className="kpi-value" style={{ color: 'var(--amber)', fontSize: '16px' }}>{rows.length > 1 ? lowest.name : '—'}</div>
            <div className="kpi-change" style={{ color: 'var(--text2)' }}>{rows.length > 1 && totalRevenue > 0 ? `${((lowest.revenue / totalRevenue) * 100).toFixed(0)}% revenue share` : 'No data yet'}</div>
          </div>
          <div className="kpi" style={{ borderLeft: '3px solid var(--emerald)' }}>
            <div className="kpi-label">Total Service Revenue</div>
            <div className="kpi-value" style={{ color: 'var(--emerald)', fontSize: '16px' }}>{fmt(totalRevenue)}</div>
            <div className="kpi-change" style={{ color: 'var(--text2)' }}>Across {rows.length} service{rows.length === 1 ? '' : 's'}</div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: '16px' }}>
          <div className="card-title">Revenue by Service<span className="card-sub">No data yet</span></div>
          <div style={{ height: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: '12px' }}>
            Add clients and invoices to see service-wise revenue
          </div>
        </div>

        <div className="card">
          <div className="card-title">Service-wise Revenue Breakdown</div>
          {!loaded ? (
            <div style={{ fontSize: '12px', color: 'var(--text3)', padding: '12px 0' }}>Loading…</div>
          ) : rows.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--text3)', padding: '12px 0' }}>No invoiced revenue recorded yet — cost/margin breakdowns will appear once invoices and clients are added</div>
          ) : (
            <table>
              <thead><tr><th>Service</th><th>Revenue</th><th>Invoices</th><th>Revenue Share</th></tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.name}>
                    <td style={{ color: 'var(--text)', fontWeight: 600 }}>{r.name}</td>
                    <td style={{ color: 'var(--emerald)', fontWeight: 700 }}>{fmt(r.revenue)}</td>
                    <td>{r.count}</td>
                    <td><span className="badge bg">{totalRevenue > 0 ? ((r.revenue / totalRevenue) * 100).toFixed(0) : 0}%</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
