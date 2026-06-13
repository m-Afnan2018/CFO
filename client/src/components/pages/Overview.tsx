'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DashboardKPIs, Invoice, Client, Employee } from '@/types';
import { api } from '@/lib/api';
import KpiCard from '@/components/ui/KpiCard';
import styles from './Overview.module.css';

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
          <div className={styles.alertRow} onClick={() => router.push('/alerts')}>
            <div className="dot-alert" />
            <span className={styles.alertLabel}>{alertCount === null ? '…' : alertCount} Alert{alertCount === 1 ? '' : 's'}</span>
          </div>
        </div>
      </div>

      <div className="content">
        <div className="grid4">
          <KpiCard
            label="Total Revenue"
            value={fmt(kpis.totalRevenue)}
            icon="ti-trending-up"
            iconBg="var(--emerald-dim)"
            iconColor="var(--emerald)"
            sub="This month"
          />
          <KpiCard
            label="Net Profit"
            value={fmt(kpis.netProfit)}
            icon="ti-coin"
            iconBg="var(--indigo-dim)"
            iconColor="var(--indigo)"
            valueColor="var(--emerald)"
            sub={`Margin: ${kpis.netProfitMargin}%`}
            subCls="up"
          />
          <KpiCard
            label="Pending Receivables"
            value={fmt(kpis.pendingReceivables)}
            icon="ti-clock"
            iconBg="var(--amber-dim)"
            iconColor="var(--amber)"
            valueColor="var(--amber)"
            sub={`${kpis.pendingCount} invoices pending`}
          />
          <KpiCard
            label="Total Expenses"
            value={fmt(kpis.totalExpenses)}
            icon="ti-receipt"
            iconBg="var(--red-dim)"
            iconColor="var(--red)"
            sub="This month"
          />
          <KpiCard
            label="Cash In Bank"
            value={fmt(kpis.cashInBank)}
            icon="ti-building-bank"
            iconBg="var(--blue-dim)"
            iconColor="var(--blue)"
            sub={cashRunway === '—' ? 'Available' : `${cashRunway}mo runway`}
            subCls="up"
          />
          <KpiCard
            label="Monthly Burn"
            value={fmt(kpis.monthlyBurn)}
            icon="ti-flame"
            iconBg="var(--red-dim)"
            iconColor="var(--red)"
            sub={cashRunway === '—' ? 'No burn data' : `${cashRunway}mo runway`}
          />
          <KpiCard
            label="Active Clients"
            value={kpis.activeClients}
            icon="ti-users"
            iconBg="var(--indigo-dim)"
            iconColor="var(--indigo)"
            sub={`${kpis.totalClients} total`}
          />
          <KpiCard
            label="Overdue Payments"
            value={fmt(kpis.overduePayments)}
            icon="ti-alert-triangle"
            iconBg="var(--red-dim)"
            iconColor="var(--red)"
            valueColor="var(--red)"
            sub={`${kpis.overdueCount} invoices overdue`}
            subCls="down"
          />
        </div>

        <div className="grid21">
          <div className="card">
            <div className="card-title">Revenue &amp; Expense Trend<span className="card-sub">No data yet</span></div>
            <div className={styles.placeholder}>
              Add invoices and expenses to see the trend chart
            </div>
          </div>
          <div className="card">
            <div className="card-title">Profit Margin %<span className="card-sub">No data yet</span></div>
            <div className={styles.placeholder}>
              No margin data yet
            </div>
          </div>
        </div>

        <div className="grid3">
          <div className="card">
            <div className="card-title">Top Clients by Revenue</div>
            {topClients.length === 0 ? (
              <div className={styles.emptySmall}>No client data yet</div>
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
            <div className={styles.placeholderMd}>
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
              <div className={styles.emptySmall}>No transactions yet</div>
            ) : (
              <table>
                <thead><tr><th>Invoice</th><th>Client</th><th>Amount</th><th>Date</th><th>Status</th></tr></thead>
                <tbody>
                  {invoices.slice(0, 5).map(inv => (
                    <tr key={inv._id}>
                      <td className={styles.invoiceNum}>{inv.invoiceNumber}</td>
                      <td>{inv.client}</td>
                      <td className={styles.invoiceAmount}>₹{inv.total.toLocaleString('en-IN')}</td>
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
              <div className={styles.emptySmall}>No pending dues</div>
            ) : upcomingDues.map(inv => (
              <div key={inv._id} className="stat-row">
                <div>
                  <div className={styles.dueClient}>{inv.client}</div>
                  <div className={styles.dueDate}>Due: {inv.dueDate || '—'}</div>
                </div>
                <span
                  className={styles.dueAmount}
                  style={{ '--due-color': inv.status === 'Overdue' ? 'var(--red)' : 'var(--amber)' } as React.CSSProperties}
                >
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
