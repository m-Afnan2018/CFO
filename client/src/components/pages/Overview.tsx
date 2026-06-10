'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DashboardKPIs, Invoice, Client, Employee } from '@/types';
import { api } from '@/lib/api';

const zeroKPIs: DashboardKPIs = {
  totalRevenue: 0, netProfit: 0, netProfitMargin: 0,
  pendingReceivables: 0, totalExpenses: 0, cashInBank: 0,
  monthlyBurn: 0, activeClients: 0, totalClients: 0,
  overduePayments: 0, overdueCount: 0, pendingCount: 0,
};

const statusBadge: Record<string, string> = { Paid: 'bg', Partial: 'ba', Overdue: 'br', Pending: 'bb' };
const barColors = ['var(--emerald)', 'var(--indigo)', 'var(--blue)', 'var(--amber)', 'var(--text3)'];

function fmt(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

export default function Overview() {
  const router = useRouter();
  const [kpis, setKpis]             = useState<DashboardKPIs>(zeroKPIs);
  const [invoices, setInvoices]     = useState<Invoice[]>([]);
  const [clients, setClients]       = useState<Client[]>([]);
  const [alertCount, setAlertCount] = useState<number | null>(null);

  useEffect(() => {
    api.getDashboardKPIs().then(d => setKpis(d as DashboardKPIs)).catch(() => {});
    api.getInvoices().then(d => setInvoices(d as Invoice[])).catch(() => {});
    api.getClients().then(d => setClients(d as Client[])).catch(() => {});
    Promise.all([api.getInvoices(), api.getClients(), api.getEmployees()])
      .then(([inv, cli, emp]) => {
        const invoiceAlerts = (inv as Invoice[]).filter(i => ['Overdue', 'Pending', 'Partial'].includes(i.status)).length;
        const renewalAlerts = (cli as Client[]).filter(c => c.status === 'Renewal Due').length;
        const payrollAlert  = (emp as Employee[]).some(e => e.status === 'Pending') ? 1 : 0;
        setAlertCount(invoiceAlerts + renewalAlerts + payrollAlert);
      })
      .catch(() => {});
  }, []);

  const topClients   = [...clients].sort((a, b) => b.monthlyBilling - a.monthlyBilling).slice(0, 5);
  const maxBilling   = topClients[0]?.monthlyBilling || 1;
  const upcomingDues = invoices.filter(i => ['Pending', 'Partial', 'Overdue'].includes(i.status)).slice(0, 4);

  const collectionEff = kpis.totalRevenue > 0
    ? Math.round(((kpis.totalRevenue - kpis.pendingReceivables) / kpis.totalRevenue) * 100)
    : 0;
  const cashRunway = kpis.monthlyBurn > 0
    ? (kpis.cashInBank / kpis.monthlyBurn).toFixed(1)
    : '—';
  const avgInvoice = invoices.length > 0
    ? Math.round(invoices.reduce((s, i) => s + i.total, 0) / invoices.length)
    : 0;

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">CFO Overview</div>
        <div className="topbar-right">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }} onClick={() => router.push('/alerts')}>
            <div className="dot-alert" />
            <span style={{ fontSize: '12px', color: 'var(--text2)' }}>{alertCount === null ? '…' : alertCount} Alert{alertCount === 1 ? '' : 's'}</span>
          </div>
        </div>
      </div>

      <div className="content">
        <div className="grid4">
          <div className="kpi">
            <div className="kpi-label">Total Revenue<div className="kpi-ico" style={{ background: 'var(--emerald-dim)' }}><i className="ti ti-trending-up" style={{ color: 'var(--emerald)' }} /></div></div>
            <div className="kpi-value">{fmt(kpis.totalRevenue)}</div>
            <div className="kpi-change" style={{ color: 'var(--text2)' }}>This month</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Net Profit<div className="kpi-ico" style={{ background: 'var(--indigo-dim)' }}><i className="ti ti-coin" style={{ color: 'var(--indigo)' }} /></div></div>
            <div className="kpi-value" style={{ color: 'var(--emerald)' }}>{fmt(kpis.netProfit)}</div>
            <div className="kpi-change up"><i className="ti ti-arrow-up-right" style={{ fontSize: '11px' }} />Margin: {kpis.netProfitMargin}%</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Pending Receivables<div className="kpi-ico" style={{ background: 'var(--amber-dim)' }}><i className="ti ti-clock" style={{ color: 'var(--amber)' }} /></div></div>
            <div className="kpi-value" style={{ color: 'var(--amber)' }}>{fmt(kpis.pendingReceivables)}</div>
            <div className="kpi-change" style={{ color: 'var(--text2)' }}>{kpis.pendingCount} invoices pending</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Total Expenses<div className="kpi-ico" style={{ background: 'var(--red-dim)' }}><i className="ti ti-receipt" style={{ color: 'var(--red)' }} /></div></div>
            <div className="kpi-value">{fmt(kpis.totalExpenses)}</div>
            <div className="kpi-change" style={{ color: 'var(--text2)' }}>This month</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Cash In Bank<div className="kpi-ico" style={{ background: 'var(--blue-dim)' }}><i className="ti ti-building-bank" style={{ color: 'var(--blue)' }} /></div></div>
            <div className="kpi-value">{fmt(kpis.cashInBank)}</div>
            <div className="kpi-change up"><i className="ti ti-arrow-up-right" style={{ fontSize: '11px' }} />{cashRunway === '—' ? 'Available' : `${cashRunway}mo runway`}</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Monthly Burn<div className="kpi-ico" style={{ background: 'var(--red-dim)' }}><i className="ti ti-flame" style={{ color: 'var(--red)' }} /></div></div>
            <div className="kpi-value">{fmt(kpis.monthlyBurn)}</div>
            <div className="kpi-change" style={{ color: 'var(--text2)' }}>{cashRunway === '—' ? 'No burn data' : `${cashRunway}mo runway`}</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Active Clients<div className="kpi-ico" style={{ background: 'var(--indigo-dim)' }}><i className="ti ti-users" style={{ color: 'var(--indigo)' }} /></div></div>
            <div className="kpi-value">{kpis.activeClients}</div>
            <div className="kpi-change" style={{ color: 'var(--text2)' }}>{kpis.totalClients} total</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Overdue Payments<div className="kpi-ico" style={{ background: 'var(--red-dim)' }}><i className="ti ti-alert-triangle" style={{ color: 'var(--red)' }} /></div></div>
            <div className="kpi-value" style={{ color: 'var(--red)' }}>{fmt(kpis.overduePayments)}</div>
            <div className="kpi-change down">{kpis.overdueCount} invoices overdue</div>
          </div>
        </div>

        <div className="grid21">
          <div className="card">
            <div className="card-title">Revenue & Expense Trend<span className="card-sub">No data yet</span></div>
            <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: '12px' }}>
              Add invoices and expenses to see the trend chart
            </div>
          </div>
          <div className="card">
            <div className="card-title">Profit Margin %<span className="card-sub">No data yet</span></div>
            <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: '12px' }}>
              No margin data yet
            </div>
          </div>
        </div>

        <div className="grid3">
          <div className="card">
            <div className="card-title">Top Clients by Revenue</div>
            {topClients.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text3)', padding: '8px 0' }}>No client data yet</div>
            ) : topClients.map((c, i) => (
              <div key={c._id} className="bar-row">
                <span className="bar-label">{c.name}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${Math.round((c.monthlyBilling / maxBilling) * 100)}%`, background: barColors[i] }} />
                </div>
                <span className="bar-val">{fmt(c.monthlyBilling)}</span>
              </div>
            ))}
          </div>
          <div className="card">
            <div className="card-title">Service Revenue Mix</div>
            <div style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: '12px' }}>
              No service data yet
            </div>
          </div>
          <div className="card">
            <div className="card-title">Financial Health</div>
            {[
              { k: 'Collection Efficiency', v: `${collectionEff}%`,                                c: collectionEff >= 80 ? 'var(--emerald)' : collectionEff >= 60 ? 'var(--amber)' : 'var(--red)' },
              { k: 'Avg Invoice Value',     v: avgInvoice > 0 ? fmt(avgInvoice) : '—',             c: '' },
              { k: 'Monthly Burn Rate',     v: fmt(kpis.monthlyBurn),                              c: 'var(--red)' },
              { k: 'Cash Runway',           v: cashRunway === '—' ? '—' : `${cashRunway} months`,  c: '' },
              { k: 'Pending Invoices',      v: String(kpis.pendingCount),                          c: kpis.pendingCount > 0 ? 'var(--amber)' : '' },
              { k: 'Overdue Amount',        v: fmt(kpis.overduePayments),                          c: kpis.overduePayments > 0 ? 'var(--red)' : '' },
            ].map(row => (
              <div key={row.k} className="stat-row">
                <span className="sk">{row.k}</span>
                <span className="sv" style={row.c ? { color: row.c } : {}}>{row.v}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid21">
          <div className="card">
            <div className="card-title">Recent Transactions</div>
            {invoices.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text3)', padding: '8px 0' }}>No transactions yet</div>
            ) : (
              <table>
                <thead><tr><th>Invoice</th><th>Client</th><th>Amount</th><th>Date</th><th>Status</th></tr></thead>
                <tbody>
                  {invoices.slice(0, 5).map(inv => (
                    <tr key={inv._id}>
                      <td style={{ color: 'var(--indigo)', fontWeight: 700 }}>{inv.invoiceNumber}</td>
                      <td>{inv.client}</td>
                      <td style={{ color: 'var(--text)', fontWeight: 600 }}>₹{inv.total.toLocaleString('en-IN')}</td>
                      <td>{inv.date}</td>
                      <td><span className={`badge ${statusBadge[inv.status]}`}>{inv.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="card">
            <div className="card-title">Upcoming Dues</div>
            {upcomingDues.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text3)', padding: '8px 0' }}>No pending dues</div>
            ) : upcomingDues.map(inv => (
              <div key={inv._id} className="stat-row">
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text)', fontWeight: 500 }}>{inv.client}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text3)' }}>Due: {inv.dueDate || '—'}</div>
                </div>
                <span style={{ color: inv.status === 'Overdue' ? 'var(--red)' : 'var(--amber)', fontWeight: 700 }}>
                  {fmt(inv.total)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
