'use client';
import { useEffect, useState } from 'react';
import type { Invoice, Expense, DashboardKPIs } from '@/types';
import { api } from '@/lib/api';
import styles from './CashFlow.module.css';

function fmt(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

export default function CashFlow() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);

  useEffect(() => {
    api.getInvoices().then((d) => setInvoices(d as Invoice[])).catch(() => {});
    api.getExpenses().then((d) => setExpenses(d as Expense[])).catch(() => {});
    api.getDashboardKPIs().then((d) => setKpis(d as DashboardKPIs)).catch(() => {});
  }, []);

  const inflow = invoices.filter(i => i.status === 'Paid').reduce((s, i) => s + (i.total || 0), 0);
  const outflow = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const net = inflow - outflow;
  const pendingReceivables = invoices
    .filter(i => i.status !== 'Paid')
    .reduce((s, i) => s + (i.total || 0), 0);
  const bankBalance = kpis?.cashInBank ?? 0;
  const monthlyBurn = kpis?.monthlyBurn ?? 0;
  const runway = monthlyBurn > 0 ? (bankBalance / monthlyBurn).toFixed(1) : '—';

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Cash Flow Tracker</div>
        <div className="topbar-right" />
      </div>
      <div className="content">
        <div className="cf-sum">
          <div className="cf-item">
            <div className="cf-label">Cash Inflow</div>
            <div className={`cf-val ${styles.valGreen}`}>{fmt(inflow)}</div>
          </div>
          <div className="cf-item">
            <div className="cf-label">Cash Outflow</div>
            <div className={`cf-val ${styles.valRed}`}>{fmt(outflow)}</div>
          </div>
          <div className="cf-item">
            <div className="cf-label">Net Cash Flow</div>
            <div className={`cf-val ${styles.valBlue}`}>{fmt(net)}</div>
          </div>
        </div>
        <div className="grid2">
          <div className="card">
            <div className="card-title">Cash Flow Chart<span className="card-sub">No data yet</span></div>
            <div className={styles.placeholder}>
              Add invoices and expenses to see monthly cash flow
            </div>
          </div>
          <div className="card">
            <div className="card-title">Runway &amp; Forecast</div>
            {[
              { k: 'Current Bank Balance', v: fmt(bankBalance), c: 'var(--emerald)' },
              { k: 'Monthly Burn Rate', v: fmt(monthlyBurn), c: 'var(--red)' },
              { k: 'Cash Runway', v: runway === '—' ? '—' : `${runway} months`, c: 'var(--amber)' },
              { k: 'Pending Receivables', v: fmt(pendingReceivables), c: '' },
              { k: 'Total Recorded Expenses', v: fmt(outflow), c: '' },
              { k: 'Net Position (Receivables − Expenses)', v: fmt(pendingReceivables - outflow), c: pendingReceivables - outflow >= 0 ? 'var(--emerald)' : 'var(--red)' },
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
