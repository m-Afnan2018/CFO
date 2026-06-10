'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Invoice, Client, Employee } from '@/types';
import { api } from '@/lib/api';

interface AlertItem {
  id: string;
  icon: string;
  color: string;
  cls: string;
  title: string;
  sub: string;
  action: string;
  target: string;
}

function fmt(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

export default function Alerts() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([api.getInvoices(), api.getClients(), api.getEmployees()])
      .then(([inv, cli, emp]) => {
        setInvoices(inv as Invoice[]);
        setClients(cli as Client[]);
        setEmployees(emp as Employee[]);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const alerts: AlertItem[] = [];

  invoices.filter(i => i.status === 'Overdue').forEach(inv => {
    alerts.push({
      id: `od-${inv._id}`,
      icon: 'ti-alert-triangle', color: 'var(--red)', cls: 'a-od',
      title: `Invoice Overdue — ${inv.client}`,
      sub: `${inv.invoiceNumber} · ${fmt(inv.total)} · due ${inv.dueDate}`,
      action: 'Send Reminder', target: '/invoices',
    });
  });

  invoices.filter(i => i.status === 'Pending' || i.status === 'Partial').forEach(inv => {
    alerts.push({
      id: `pe-${inv._id}`,
      icon: 'ti-clock', color: 'var(--amber)', cls: 'a-pe',
      title: `Invoice ${inv.status} — ${inv.client}`,
      sub: `${inv.invoiceNumber} · ${fmt(inv.total)} · due ${inv.dueDate}`,
      action: 'Remind', target: '/invoices',
    });
  });

  clients.filter(c => c.status === 'Renewal Due').forEach(c => {
    alerts.push({
      id: `rn-${c._id}`,
      icon: 'ti-refresh', color: 'var(--amber)', cls: 'a-pe',
      title: `Contract Renewal — ${c.name}`,
      sub: `Renewal: ${c.renewal} · ${fmt(c.monthlyBilling)}/month`,
      action: 'Review', target: '/clients',
    });
  });

  const pendingPayroll = employees.filter(e => e.status === 'Pending');
  if (pendingPayroll.length > 0) {
    alerts.push({
      id: 'payroll-pending',
      icon: 'ti-users', color: 'var(--blue)', cls: 'a-in',
      title: 'Payroll Pending',
      sub: `${pendingPayroll.length} employee${pendingPayroll.length === 1 ? '' : 's'} awaiting payout · ${fmt(pendingPayroll.reduce((s, e) => s + (e.finalSalary || 0), 0))}`,
      action: 'View', target: '/payroll',
    });
  }

  const urgentCount = invoices.filter(i => i.status === 'Overdue').length;
  const totalAlerts = alerts.length;

  return (
    <div>
      <div className="topbar"><div className="topbar-title">Alerts &amp; Reminders</div></div>
      <div className="content">
        <div className="grid2">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <span style={{ fontSize: '15px', fontWeight: 700 }}>Active Alerts</span>
              {totalAlerts > 0 && (
                <span className={`badge ${urgentCount > 0 ? 'br' : 'ba'}`}>{totalAlerts} alert{totalAlerts === 1 ? '' : 's'}</span>
              )}
            </div>

            {!loaded ? (
              <div style={{ fontSize: '12px', color: 'var(--text3)', padding: '12px 0' }}>Loading…</div>
            ) : alerts.length === 0 ? (
              <div className="alert-item a-in">
                <i className="ti ti-circle-check" style={{ color: 'var(--emerald)', fontSize: '18px', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 600 }}>No active alerts</div>
                  <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '2px' }}>Everything looks on track — overdue invoices, renewals, and payroll will surface here automatically</div>
                </div>
              </div>
            ) : alerts.map(a => (
              <div key={a.id} className={`alert-item ${a.cls}`}>
                <i className={`ti ${a.icon}`} style={{ color: a.color, fontSize: '18px', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 600 }}>{a.title}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '2px' }}>{a.sub}</div>
                </div>
                <button className="btn" style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: '11px', flexShrink: 0 }} onClick={() => router.push(a.target)}>{a.action}</button>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-title" style={{ marginBottom: '12px' }}>Alert Thresholds</div>
            {[
              { k: 'Overdue Invoice Alert', v: 'Status = Overdue' },
              { k: 'Due Date Reminder', v: 'Status = Pending / Partial' },
              { k: 'Contract Renewal', v: 'Client status = Renewal Due' },
              { k: 'Payroll Reminder', v: 'Employee status = Pending' },
            ].map(row => (
              <div key={row.k} className="stat-row">
                <span className="sk">{row.k}</span>
                <span className="sv">{row.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
