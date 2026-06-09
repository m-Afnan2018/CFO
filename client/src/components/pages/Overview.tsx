'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type { Page, DashboardKPIs, Invoice, Client, Employee } from '@/types';
import { api } from '@/lib/api';

const RevenueExpenseChart = dynamic(() => import('@/components/charts/RevenueExpenseChart'), { ssr: false });
const MarginChart = dynamic(() => import('@/components/charts/MarginChart'), { ssr: false });
const ServiceMixChart = dynamic(() => import('@/components/charts/ServiceMixChart'), { ssr: false });

const defaultKPIs: DashboardKPIs = {
  totalRevenue: 4260000, netProfit: 1420000, netProfitMargin: 33.3,
  pendingReceivables: 890000, totalExpenses: 2840000, cashInBank: 2210000,
  monthlyBurn: 940000, activeClients: 21, totalClients: 24,
  overduePayments: 320000, overdueCount: 4, pendingCount: 12,
};

const defaultInvoices: Invoice[] = [
  { _id: '1', invoiceNumber: '#INV-0089', client: 'Nexus Brands', date: '12 Mar 2025', dueDate: '15 Mar', amount: 105932, gst: 19068, total: 125000, status: 'Paid' },
  { _id: '2', invoiceNumber: '#INV-0088', client: 'BluePeak Retail', date: '10 Mar 2025', dueDate: '14 Mar', amount: 83051, gst: 14949, total: 98000, status: 'Paid' },
  { _id: '3', invoiceNumber: '#INV-0087', client: 'Kratos Corp', date: '08 Mar 2025', dueDate: '11 Mar', amount: 63559, gst: 11441, total: 75000, status: 'Partial' },
  { _id: '4', invoiceNumber: '#INV-0086', client: 'Orion Digital', date: '05 Mar 2025', dueDate: '07 Mar', amount: 118644, gst: 21356, total: 140000, status: 'Overdue' },
  { _id: '5', invoiceNumber: '#INV-0085', client: 'SkyEdge Media', date: '02 Mar 2025', dueDate: '01 Mar', amount: 52966, gst: 9534, total: 62500, status: 'Pending' },
];

const statusBadge: Record<string, string> = { Paid: 'bg', Partial: 'ba', Overdue: 'br', Pending: 'bb' };

function fmt(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

interface Props { onNavigate: (p: Page) => void; }

export default function Overview({ onNavigate }: Props) {
  const [kpis, setKpis] = useState<DashboardKPIs>(defaultKPIs);
  const [invoices, setInvoices] = useState<Invoice[]>(defaultInvoices);
  const [alertCount, setAlertCount] = useState<number | null>(null);

  useEffect(() => {
    api.getDashboardKPIs().then((d) => setKpis(d as DashboardKPIs)).catch(() => {});
    api.getInvoices().then((d) => setInvoices((d as Invoice[]).slice(0, 5))).catch(() => {});
    Promise.all([api.getInvoices(), api.getClients(), api.getEmployees()])
      .then(([inv, cli, emp]) => {
        const invoiceAlerts = (inv as Invoice[]).filter(i => ['Overdue', 'Pending', 'Partial'].includes(i.status)).length;
        const renewalAlerts = (cli as Client[]).filter(c => c.status === 'Renewal Due').length;
        const payrollAlert = (emp as Employee[]).some(e => e.status === 'Pending') ? 1 : 0;
        setAlertCount(invoiceAlerts + renewalAlerts + payrollAlert);
      })
      .catch(() => {});
  }, []);

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">CFO Overview</div>
        <div className="topbar-right">
          <div className="fp">
            <i className="ti ti-calendar" style={{ fontSize: '13px' }} />
            <select defaultValue="This Month">
              <option>This Month</option><option>Last Month</option><option>Q4 FY2025</option><option>FY 2024-25</option>
            </select>
          </div>
          <div className="fp">
            <i className="ti ti-filter" style={{ fontSize: '13px' }} />
            <select defaultValue="All Services">
              <option>All Services</option><option>Social Media</option><option>SEO</option><option>Web Dev</option><option>Perf. Mktg</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }} onClick={() => onNavigate('alerts')}>
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
            <div className="kpi-change up"><i className="ti ti-arrow-up-right" style={{ fontSize: '11px' }} />+18.4% vs last month</div>
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
            <div className="kpi-change down"><i className="ti ti-arrow-down-right" style={{ fontSize: '11px' }} />+6.2% vs last month</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Cash In Bank<div className="kpi-ico" style={{ background: 'var(--blue-dim)' }}><i className="ti ti-building-bank" style={{ color: 'var(--blue)' }} /></div></div>
            <div className="kpi-value">{fmt(kpis.cashInBank)}</div>
            <div className="kpi-change up"><i className="ti ti-arrow-up-right" style={{ fontSize: '11px' }} />Healthy runway</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Monthly Burn<div className="kpi-ico" style={{ background: 'var(--red-dim)' }}><i className="ti ti-flame" style={{ color: 'var(--red)' }} /></div></div>
            <div className="kpi-value">{fmt(kpis.monthlyBurn)}</div>
            <div className="kpi-change" style={{ color: 'var(--text2)' }}>~2.4 months runway</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Active Clients<div className="kpi-ico" style={{ background: 'var(--indigo-dim)' }}><i className="ti ti-users" style={{ color: 'var(--indigo)' }} /></div></div>
            <div className="kpi-value">{kpis.activeClients}</div>
            <div className="kpi-change up"><i className="ti ti-arrow-up-right" style={{ fontSize: '11px' }} />+3 this month</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Overdue Payments<div className="kpi-ico" style={{ background: 'var(--red-dim)' }}><i className="ti ti-alert-triangle" style={{ color: 'var(--red)' }} /></div></div>
            <div className="kpi-value" style={{ color: 'var(--red)' }}>{fmt(kpis.overduePayments)}</div>
            <div className="kpi-change down">{kpis.overdueCount} invoices overdue</div>
          </div>
        </div>

        <div className="grid21">
          <div className="card">
            <div className="card-title">Revenue & Expense Trend<span className="card-sub">Apr 2024 – Mar 2025</span></div>
            <div className="cw"><RevenueExpenseChart /></div>
          </div>
          <div className="card">
            <div className="card-title">Profit Margin %<span className="card-sub">Monthly</span></div>
            <div className="cw"><MarginChart /></div>
          </div>
        </div>

        <div className="grid3">
          <div className="card">
            <div className="card-title">Top Clients by Revenue</div>
            {[
              { label: 'Nexus Brands', w: 88, color: 'var(--emerald)', val: '₹7.2L' },
              { label: 'BluePeak Retail', w: 74, color: 'var(--indigo)', val: '₹5.8L' },
              { label: 'Orion Digital', w: 62, color: 'var(--blue)', val: '₹4.9L' },
              { label: 'Kratos Corp', w: 51, color: 'var(--amber)', val: '₹3.8L' },
              { label: 'SkyEdge Media', w: 40, color: 'var(--text3)', val: '₹3.1L' },
            ].map(r => (
              <div key={r.label} className="bar-row">
                <span className="bar-label">{r.label}</span>
                <div className="bar-track"><div className="bar-fill" style={{ width: `${r.w}%`, background: r.color }} /></div>
                <span className="bar-val">{r.val}</span>
              </div>
            ))}
          </div>
          <div className="card">
            <div className="card-title">Service Revenue Mix</div>
            <div className="cw cw-sm"><ServiceMixChart /></div>
          </div>
          <div className="card">
            <div className="card-title">Financial Health</div>
            {[
              { k: 'Collection Efficiency', v: '87%', c: 'var(--emerald)' },
              { k: 'MoM Revenue Growth', v: '+18.4%', c: 'var(--emerald)' },
              { k: 'Avg Invoice Value', v: '₹74,800', c: '' },
              { k: 'Avg Days to Pay', v: '22 days', c: 'var(--amber)' },
              { k: 'Monthly Burn Rate', v: '₹9.4L', c: 'var(--red)' },
              { k: 'Cash Runway', v: '2.4 months', c: '' },
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
            <table>
              <thead><tr><th>Invoice</th><th>Client</th><th>Amount</th><th>Date</th><th>Status</th></tr></thead>
              <tbody>
                {invoices.map(inv => (
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
          </div>
          <div className="card">
            <div className="card-title">Upcoming Dues</div>
            {[
              { name: 'SkyEdge Media', due: 'Due: 15 Mar 2025', amt: '₹62,500', c: 'var(--amber)' },
              { name: 'BrandMart Ltd', due: 'Due: 18 Mar 2025', amt: '₹88,000', c: 'var(--amber)' },
              { name: 'Zenith Works', due: 'Due: 22 Mar 2025', amt: '₹45,000', c: 'var(--text)' },
              { name: 'Apex Finance', due: 'Due: 28 Mar 2025', amt: '₹1,10,000', c: 'var(--text)' },
            ].map(d => (
              <div key={d.name} className="stat-row">
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text)', fontWeight: 500 }}>{d.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{d.due}</div>
                </div>
                <span style={{ color: d.c, fontWeight: 700 }}>{d.amt}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
