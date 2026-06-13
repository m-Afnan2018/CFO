'use client';
import { useState } from 'react';
import type { Client, Invoice, Expense, SalaryRecord, PayPeriodSummary } from '@/types';
import { api } from '@/lib/api';
import styles from './Reports.module.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTHS    = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const NOW       = new Date();
const THIS_YEAR = String(NOW.getFullYear());

function inr(n: number) {
  const abs = Math.abs(n).toLocaleString('en-IN');
  return n < 0 ? `₹${abs} (Loss)` : `₹${abs}`;
}

function fmtDate(d: string) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = '﻿' + [headers, ...rows].map(r => r.map(esc).join(',')).join('\n');
  const a   = document.createElement('a');
  a.href    = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function openPrintWindow(title: string, body: string) {
  const win = window.open('', '_blank', 'width=1050,height=780');
  if (!win) { alert('Allow pop-ups to view the PDF.'); return; }
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${title}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:36px 40px;color:#0f172a;font-size:12px;background:#fff}
h1{font-size:22px;font-weight:700;color:#0f172a}
.meta{font-size:12px;color:#64748b;margin:3px 0 22px}
.summary{display:flex;gap:12px;margin-bottom:22px;flex-wrap:wrap}
.kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;min-width:130px}
.kpi-l{font-size:10px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px}
.kpi-v{font-size:18px;font-weight:700}
.sec{font-size:13px;font-weight:700;margin:20px 0 8px}
table{width:100%;border-collapse:collapse;font-size:11.5px}
thead tr{background:#f1f5f9}
th{padding:8px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#475569;border-bottom:2px solid #e2e8f0}
td{padding:7px 10px;border-bottom:1px solid #f1f5f9;color:#334155;vertical-align:middle}
.r{text-align:right}.b{font-weight:700}
.total td{border-top:2px solid #cbd5e1;font-weight:700;background:#f8fafc}
.g{color:#059669}.red{color:#dc2626}.am{color:#d97706}
.bg{background:#dcfce7;color:#16a34a;border-radius:10px;padding:2px 7px;font-size:10px;font-weight:700;display:inline-block}
.br{background:#f1f5f9;color:#475569;border-radius:10px;padding:2px 7px;font-size:10px;font-weight:700;display:inline-block}
.ba{background:#fef3c7;color:#d97706;border-radius:10px;padding:2px 7px;font-size:10px;font-weight:700;display:inline-block}
.rr{background:#fee2e2;color:#dc2626;border-radius:10px;padding:2px 7px;font-size:10px;font-weight:700;display:inline-block}
@media print{@page{margin:18mm}button{display:none}}
</style></head><body>
${body}
<script>window.onload=()=>setTimeout(()=>window.print(),350);</script>
</body></html>`);
  win.document.close();
}

// ── Report generators ─────────────────────────────────────────────────────────

async function genPL(year: string, fmt: 'pdf' | 'csv') {
  const [inv, exp] = await Promise.all([api.getInvoices(), api.getExpenses()]);
  const invoices   = inv as Invoice[];
  const expenses   = exp as Expense[];

  const rows = MONTHS.map((mon, i) => {
    const k   = `${year}-${String(i + 1).padStart(2, '0')}`;
    const rev = invoices.filter(v => v.status === 'Paid' && v.date?.startsWith(k)).reduce((s, v) => s + v.total, 0);
    const ded = expenses.filter(e => e.date?.startsWith(k)).reduce((s, e) => s + e.amount, 0);
    const net = rev - ded;
    return { label: `${mon} ${year}`, rev, ded, net, margin: rev > 0 ? Math.round((net / rev) * 100) : 0 };
  });

  const tRev = rows.reduce((s, r) => s + r.rev, 0);
  const tDed = rows.reduce((s, r) => s + r.ded, 0);
  const tNet = tRev - tDed;
  const tMar = tRev > 0 ? Math.round((tNet / tRev) * 100) : 0;

  if (fmt === 'csv') {
    downloadCSV(`PL_Report_${year}.csv`,
      ['Month', 'Revenue (Rs)', 'Expenses (Rs)', 'Net Profit (Rs)', 'Margin %'],
      [...rows.map(r => [r.label, r.rev, r.ded, r.net, r.margin]),
       ['TOTAL', tRev, tDed, tNet, tMar]]);
  } else {
    openPrintWindow(`P&L ${year}`, `
      <h1>Profit &amp; Loss Report</h1>
      <div class="meta">Ganesyx Pvt Ltd &nbsp;&middot;&nbsp; Year ${year}</div>
      <div class="summary">
        <div class="kpi"><div class="kpi-l">Total Revenue</div><div class="kpi-v g">&#8377;${tRev.toLocaleString('en-IN')}</div></div>
        <div class="kpi"><div class="kpi-l">Total Expenses</div><div class="kpi-v red">&#8377;${tDed.toLocaleString('en-IN')}</div></div>
        <div class="kpi"><div class="kpi-l">Net Profit</div><div class="kpi-v ${tNet >= 0 ? 'g' : 'red'}">&#8377;${Math.abs(tNet).toLocaleString('en-IN')}</div></div>
        <div class="kpi"><div class="kpi-l">Avg Margin</div><div class="kpi-v">${tMar}%</div></div>
      </div>
      <table>
        <thead><tr><th>Month</th><th class="r">Revenue</th><th class="r">Expenses</th><th class="r">Net Profit</th><th class="r">Margin</th></tr></thead>
        <tbody>
          ${rows.filter(r => r.rev > 0 || r.ded > 0).map(r => `
            <tr><td>${r.label}</td>
              <td class="r g">&#8377;${r.rev.toLocaleString('en-IN')}</td>
              <td class="r red">&#8377;${r.ded.toLocaleString('en-IN')}</td>
              <td class="r b ${r.net >= 0 ? 'g' : 'red'}">${inr(r.net)}</td>
              <td class="r">${r.margin}%</td>
            </tr>`).join('')}
          <tr class="total"><td>TOTAL</td>
            <td class="r">&#8377;${tRev.toLocaleString('en-IN')}</td>
            <td class="r">&#8377;${tDed.toLocaleString('en-IN')}</td>
            <td class="r ${tNet >= 0 ? 'g' : 'red'}">${inr(tNet)}</td>
            <td class="r">${tMar}%</td>
          </tr>
        </tbody>
      </table>`);
  }
}

async function genCashFlow(year: string, fmt: 'pdf' | 'csv') {
  const [inv, exp] = await Promise.all([api.getInvoices(), api.getExpenses()]);
  const invoices   = inv as Invoice[];
  const expenses   = exp as Expense[];

  let cumulative = 0;
  const rows = MONTHS.map((mon, i) => {
    const k       = `${year}-${String(i + 1).padStart(2, '0')}`;
    const inflow  = invoices.filter(v => v.status === 'Paid' && v.date?.startsWith(k)).reduce((s, v) => s + v.total, 0);
    const outflow = expenses.filter(e => e.date?.startsWith(k)).reduce((s, e) => s + e.amount, 0);
    cumulative   += inflow - outflow;
    return { label: `${mon} ${year}`, inflow, outflow, net: inflow - outflow, cumulative };
  });

  const tIn  = rows.reduce((s, r) => s + r.inflow, 0);
  const tOut = rows.reduce((s, r) => s + r.outflow, 0);

  if (fmt === 'csv') {
    downloadCSV(`CashFlow_${year}.csv`,
      ['Month', 'Cash Inflow (Rs)', 'Cash Outflow (Rs)', 'Net Flow (Rs)', 'Cumulative (Rs)'],
      rows.map(r => [r.label, r.inflow, r.outflow, r.net, r.cumulative]));
  } else {
    openPrintWindow(`Cash Flow ${year}`, `
      <h1>Cash Flow Statement</h1>
      <div class="meta">Ganesyx Pvt Ltd &nbsp;&middot;&nbsp; Year ${year}</div>
      <div class="summary">
        <div class="kpi"><div class="kpi-l">Total Inflow</div><div class="kpi-v g">&#8377;${tIn.toLocaleString('en-IN')}</div></div>
        <div class="kpi"><div class="kpi-l">Total Outflow</div><div class="kpi-v red">&#8377;${tOut.toLocaleString('en-IN')}</div></div>
        <div class="kpi"><div class="kpi-l">Net Flow</div><div class="kpi-v ${tIn - tOut >= 0 ? 'g' : 'red'}">&#8377;${Math.abs(tIn - tOut).toLocaleString('en-IN')}</div></div>
        <div class="kpi"><div class="kpi-l">Closing Balance</div><div class="kpi-v">&#8377;${cumulative.toLocaleString('en-IN')}</div></div>
      </div>
      <table>
        <thead><tr><th>Month</th><th class="r">Cash In</th><th class="r">Cash Out</th><th class="r">Net Flow</th><th class="r">Cumulative</th></tr></thead>
        <tbody>
          ${rows.filter(r => r.inflow > 0 || r.outflow > 0).map(r => `
            <tr><td>${r.label}</td>
              <td class="r g">&#8377;${r.inflow.toLocaleString('en-IN')}</td>
              <td class="r red">&#8377;${r.outflow.toLocaleString('en-IN')}</td>
              <td class="r b ${r.net >= 0 ? 'g' : 'red'}">${inr(r.net)}</td>
              <td class="r b">&#8377;${r.cumulative.toLocaleString('en-IN')}</td>
            </tr>`).join('')}
        </tbody>
      </table>`);
  }
}

async function genClientRevenue(year: string, fmt: 'pdf' | 'csv') {
  const [rawC, rawI] = await Promise.all([api.getClients(), api.getInvoices()]);
  const clients      = rawC as Client[];
  const invoices     = rawI as Invoice[];

  const rows = clients.map(c => {
    const ytd = invoices.filter(i => i.status === 'Paid' && i.client === c.name && i.date?.startsWith(year))
                        .reduce((s, i) => s + i.total, 0);
    return { ...c, ytd };
  }).sort((a, b) => b.ytd - a.ytd);

  const tMRR = clients.filter(c => c.status === 'Active').reduce((s, c) => s + c.monthlyBilling, 0);
  const tYTD = rows.reduce((s, r) => s + r.ytd, 0);

  if (fmt === 'csv') {
    downloadCSV(`Client_Revenue_${year}.csv`,
      ['Client', 'Email', 'Service', 'Monthly Billing (Rs)', 'Manager', 'Status', `YTD Revenue ${year} (Rs)`],
      rows.map(r => [r.name, r.email, r.service, r.monthlyBilling, r.manager || '—', r.status, r.ytd]));
  } else {
    openPrintWindow(`Client Revenue ${year}`, `
      <h1>Client Revenue Report</h1>
      <div class="meta">Ganesyx Pvt Ltd &nbsp;&middot;&nbsp; Year ${year}</div>
      <div class="summary">
        <div class="kpi"><div class="kpi-l">Total Clients</div><div class="kpi-v">${clients.length}</div></div>
        <div class="kpi"><div class="kpi-l">Active</div><div class="kpi-v g">${clients.filter(c => c.status === 'Active').length}</div></div>
        <div class="kpi"><div class="kpi-l">Monthly MRR</div><div class="kpi-v">&#8377;${tMRR.toLocaleString('en-IN')}</div></div>
        <div class="kpi"><div class="kpi-l">YTD Collected</div><div class="kpi-v g">&#8377;${tYTD.toLocaleString('en-IN')}</div></div>
      </div>
      <table>
        <thead><tr><th>Client</th><th>Service</th><th class="r">Monthly Billing</th><th>Manager</th><th>Status</th><th class="r">YTD Revenue</th></tr></thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td><div class="b">${r.name}</div><div style="font-size:10px;color:#94a3b8">${r.email}</div></td>
              <td>${r.service}</td>
              <td class="r">&#8377;${r.monthlyBilling.toLocaleString('en-IN')}</td>
              <td>${r.manager || '—'}</td>
              <td><span class="${r.status === 'Active' ? 'bg' : r.status === 'Inactive' ? 'br' : 'ba'}">${r.status}</span></td>
              <td class="r b g">&#8377;${r.ytd.toLocaleString('en-IN')}</td>
            </tr>`).join('')}
          <tr class="total"><td colspan="2">TOTAL</td>
            <td class="r">&#8377;${tMRR.toLocaleString('en-IN')}</td>
            <td colspan="2"></td>
            <td class="r">&#8377;${tYTD.toLocaleString('en-IN')}</td>
          </tr>
        </tbody>
      </table>`);
  }
}

async function genExpenses(year: string, fmt: 'pdf' | 'csv') {
  const raw   = await api.getExpenses();
  const all   = (raw as Expense[]).filter(e => e.date?.startsWith(year)).sort((a, b) => a.date.localeCompare(b.date));
  const total = all.reduce((s, e) => s + e.amount, 0);

  const byCat: Record<string, number> = {};
  all.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + e.amount; });
  const catRows = Object.entries(byCat).sort(([, a], [, b]) => b - a);

  if (fmt === 'csv') {
    downloadCSV(`Expense_Report_${year}.csv`,
      ['Date', 'Category', 'Vendor', 'Description', 'Amount (Rs)', 'Type'],
      [...all.map(e => [fmtDate(e.date), e.category, e.vendor, e.description, e.amount, e.type]),
       ['', '', '', 'TOTAL', total, '']]);
  } else {
    openPrintWindow(`Expense Report ${year}`, `
      <h1>Expense Report</h1>
      <div class="meta">Ganesyx Pvt Ltd &nbsp;&middot;&nbsp; Year ${year}</div>
      <div class="summary">
        <div class="kpi"><div class="kpi-l">Total Expenses</div><div class="kpi-v red">&#8377;${total.toLocaleString('en-IN')}</div></div>
        <div class="kpi"><div class="kpi-l">Transactions</div><div class="kpi-v">${all.length}</div></div>
        <div class="kpi"><div class="kpi-l">Categories</div><div class="kpi-v">${catRows.length}</div></div>
        <div class="kpi"><div class="kpi-l">Avg / Month</div><div class="kpi-v">&#8377;${Math.round(total / 12).toLocaleString('en-IN')}</div></div>
      </div>
      <div class="sec">By Category</div>
      <table>
        <thead><tr><th>Category</th><th class="r">Amount</th><th class="r">% of Total</th></tr></thead>
        <tbody>
          ${catRows.map(([cat, amt]) => `
            <tr><td>${cat}</td>
              <td class="r">&#8377;${amt.toLocaleString('en-IN')}</td>
              <td class="r">${total > 0 ? Math.round((amt / total) * 100) : 0}%</td>
            </tr>`).join('')}
        </tbody>
      </table>
      <div class="sec">All Transactions</div>
      <table>
        <thead><tr><th>Date</th><th>Category</th><th>Vendor</th><th>Description</th><th>Type</th><th class="r">Amount</th></tr></thead>
        <tbody>
          ${all.map(e => `
            <tr><td>${fmtDate(e.date)}</td><td>${e.category}</td><td>${e.vendor}</td>
              <td style="font-size:11px">${e.description}</td>
              <td><span class="${e.type === 'Fixed' ? 'br' : 'ba'}">${e.type}</span></td>
              <td class="r b">&#8377;${e.amount.toLocaleString('en-IN')}</td>
            </tr>`).join('')}
          <tr class="total"><td colspan="5">TOTAL</td><td class="r">&#8377;${total.toLocaleString('en-IN')}</td></tr>
        </tbody>
      </table>`);
  }
}

async function genOutstanding(_year: string, fmt: 'pdf' | 'csv') {
  const raw     = await api.getInvoices();
  const today   = new Date();
  const pending = (raw as Invoice[]).filter(i => ['Pending','Overdue','Partial'].includes(i.status));

  const rows = pending.map(i => {
    const days   = Math.floor((today.getTime() - new Date(i.dueDate).getTime()) / 86400000);
    const bucket = days <= 0 ? 'Current' : days <= 30 ? '1–30 days' : days <= 60 ? '31–60 days' : days <= 90 ? '61–90 days' : '90+ days';
    return { ...i, days, bucket };
  }).sort((a, b) => b.days - a.days);

  const total   = rows.reduce((s, r) => s + r.total, 0);
  const overdue = rows.filter(r => r.days > 0).length;

  if (fmt === 'csv') {
    downloadCSV(`Outstanding_Report.csv`,
      ['Invoice #', 'Client', 'Issue Date', 'Due Date', 'Amount (Rs)', 'Days Overdue', 'Status', 'Bucket'],
      rows.map(r => [r.invoiceNumber, r.client, fmtDate(r.date), fmtDate(r.dueDate), r.total, Math.max(0, r.days), r.status, r.bucket]));
  } else {
    openPrintWindow(`Outstanding Report`, `
      <h1>Outstanding Invoice Report</h1>
      <div class="meta">Ganesyx Pvt Ltd &nbsp;&middot;&nbsp; As of ${fmtDate(today.toISOString())}</div>
      <div class="summary">
        <div class="kpi"><div class="kpi-l">Total Outstanding</div><div class="kpi-v red">&#8377;${total.toLocaleString('en-IN')}</div></div>
        <div class="kpi"><div class="kpi-l">Invoices</div><div class="kpi-v">${rows.length}</div></div>
        <div class="kpi"><div class="kpi-l">Overdue</div><div class="kpi-v red">${overdue}</div></div>
        <div class="kpi"><div class="kpi-l">Current</div><div class="kpi-v am">${rows.length - overdue}</div></div>
      </div>
      <table>
        <thead><tr><th>Invoice #</th><th>Client</th><th>Issue Date</th><th>Due Date</th><th class="r">Amount</th><th>Status</th><th>Aging</th></tr></thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td class="b">${r.invoiceNumber}</td>
              <td>${r.client}</td>
              <td>${fmtDate(r.date)}</td>
              <td>${fmtDate(r.dueDate)}</td>
              <td class="r b">&#8377;${r.total.toLocaleString('en-IN')}</td>
              <td><span class="${r.status === 'Overdue' ? 'rr' : r.status === 'Partial' ? 'ba' : 'br'}">${r.status}</span></td>
              <td><span class="${r.days > 90 ? 'rr' : r.days > 30 ? 'ba' : r.days > 0 ? 'ba' : 'bg'}">${r.bucket}</span></td>
            </tr>`).join('')}
          <tr class="total"><td colspan="4">TOTAL OUTSTANDING</td><td class="r">&#8377;${total.toLocaleString('en-IN')}</td><td colspan="2"></td></tr>
        </tbody>
      </table>`);
  }
}

async function genPayroll(year: string, fmt: 'pdf' | 'csv') {
  const rawPeriods = await api.getSalaryPeriods();
  const periods    = (rawPeriods as PayPeriodSummary[]).filter(p => p._id.startsWith(year));

  const all: SalaryRecord[] = [];
  await Promise.all(
    periods.map(p => api.getSalaryRecords(p._id).then(r => all.push(...(r as SalaryRecord[]))))
  );
  all.sort((a, b) => (a.payPeriod + a.name).localeCompare(b.payPeriod + b.name));

  const tNet  = all.reduce((s, r) => s + r.finalSalary, 0);
  const tPaid = all.filter(r => r.status === 'Paid').reduce((s, r) => s + r.finalSalary, 0);

  if (fmt === 'csv') {
    downloadCSV(`Payroll_Report_${year}.csv`,
      ['Period', 'Employee', 'Department', 'Basic (Rs)', 'HRA (Rs)', 'Special Allow. (Rs)', 'Incentives (Rs)', 'PF (Rs)', 'ESI (Rs)', 'PT (Rs)', 'TDS (Rs)', 'Other Ded. (Rs)', 'Net Salary (Rs)', 'Status'],
      all.map(r => [
        r.payPeriod, r.name, r.department,
        r.baseSalary, r.hra ?? 0, r.specialAllowance ?? 0, r.incentives,
        r.providentFund ?? 0, r.esi ?? 0, r.professionalTax ?? 0, r.tds ?? 0, r.deductions,
        r.finalSalary, r.status,
      ]));
  } else {
    openPrintWindow(`Payroll Report ${year}`, `
      <h1>Payroll Report</h1>
      <div class="meta">Ganesyx Pvt Ltd &nbsp;&middot;&nbsp; Year ${year}</div>
      <div class="summary">
        <div class="kpi"><div class="kpi-l">Total Disbursed</div><div class="kpi-v">&#8377;${tPaid.toLocaleString('en-IN')}</div></div>
        <div class="kpi"><div class="kpi-l">Pay Periods</div><div class="kpi-v">${periods.length}</div></div>
        <div class="kpi"><div class="kpi-l">Employees</div><div class="kpi-v">${new Set(all.map(r => r.name)).size}</div></div>
        <div class="kpi"><div class="kpi-l">Total Net Pay</div><div class="kpi-v">&#8377;${tNet.toLocaleString('en-IN')}</div></div>
      </div>
      <table>
        <thead><tr><th>Period</th><th>Employee</th><th>Dept</th><th class="r">Basic</th><th class="r">Gross</th><th class="r">Deductions</th><th class="r">Net Pay</th><th>Status</th></tr></thead>
        <tbody>
          ${all.map(r => {
            const gross = r.baseSalary + (r.hra ?? 0) + (r.specialAllowance ?? 0) + r.incentives;
            const ded   = (r.providentFund ?? 0) + (r.esi ?? 0) + (r.professionalTax ?? 0) + (r.tds ?? 0) + r.deductions;
            return `<tr>
              <td>${r.payPeriod}</td><td class="b">${r.name}</td>
              <td style="font-size:11px">${r.department}</td>
              <td class="r">&#8377;${r.baseSalary.toLocaleString('en-IN')}</td>
              <td class="r">&#8377;${gross.toLocaleString('en-IN')}</td>
              <td class="r red">&#8377;${ded.toLocaleString('en-IN')}</td>
              <td class="r b">&#8377;${r.finalSalary.toLocaleString('en-IN')}</td>
              <td><span class="${r.status === 'Paid' ? 'bg' : 'br'}">${r.status}</span></td>
            </tr>`;
          }).join('')}
          <tr class="total"><td colspan="6">TOTAL NET PAY</td><td class="r">&#8377;${tNet.toLocaleString('en-IN')}</td><td></td></tr>
        </tbody>
      </table>`);
  }
}

// ── Config ────────────────────────────────────────────────────────────────────

type GenFn = (year: string, fmt: 'pdf' | 'csv') => Promise<void>;

const REPORT_LIST: { key: string; icon: string; color: string; bg: string; title: string; sub: string; desc: string; gen: GenFn }[] = [
  { key: 'pl',          icon: 'ti-report-money', color: 'var(--emerald)', bg: 'var(--emerald-dim)', title: 'P&L Report',           sub: 'Profit & Loss Statement', desc: 'Revenue, expenses, and net profit breakdown by month for the selected year.',         gen: genPL },
  { key: 'cashflow',    icon: 'ti-cash',          color: 'var(--indigo)',  bg: 'var(--indigo-dim)',  title: 'Cash Flow Statement',   sub: 'Inflows & Outflows',      desc: 'Monthly cash movement, net flow, and cumulative balance for the selected year.',     gen: genCashFlow },
  { key: 'clients',     icon: 'ti-users',          color: 'var(--blue)',   bg: 'var(--blue-dim)',    title: 'Client Revenue Report', sub: 'Per-client analysis',     desc: 'Monthly billing, YTD collected revenue, and status breakdown per client.',          gen: genClientRevenue },
  { key: 'expenses',    icon: 'ti-receipt',        color: 'var(--amber)',  bg: 'var(--amber-dim)',   title: 'Expense Report',        sub: 'Category-wise spending',  desc: 'Detailed expense breakdown by category, vendor, and department.',                   gen: genExpenses },
  { key: 'outstanding', icon: 'ti-file-invoice',   color: 'var(--red)',    bg: 'var(--red-dim)',     title: 'Outstanding Report',    sub: 'Aging & dues',            desc: 'Pending and overdue invoices with aging buckets and collection status.',             gen: genOutstanding },
  { key: 'payroll',     icon: 'ti-users-group',    color: 'var(--emerald)',bg: 'var(--emerald-dim)', title: 'Payroll Report',        sub: 'Salary & incentives',     desc: 'Monthly payroll disbursement, component-wise deductions, and team cost analysis.', gen: genPayroll },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function Reports() {
  const [year, setYear]       = useState(THIS_YEAR);
  const [loading, setLoading] = useState<string | null>(null);

  const years: string[] = [];
  for (let y = NOW.getFullYear() + 1; y >= 2023; y--) years.push(String(y));

  async function handle(key: string, gen: GenFn, fmt: 'pdf' | 'csv') {
    const id = `${key}-${fmt}`;
    setLoading(id);
    try {
      await gen(year, fmt);
    } catch (err) {
      console.error(err);
      alert('Could not generate the report. Make sure data exists for the selected year.');
    }
    setLoading(null);
  }

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Financial Reports</div>
        <div className="topbar-right">
          <select value={year} onChange={e => setYear(e.target.value)} className={styles.yearSelect}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="content">
        <div className="grid3">
          {REPORT_LIST.map(r => {
            const pdfBusy = loading === `${r.key}-pdf`;
            const csvBusy = loading === `${r.key}-csv`;
            const busy    = !!loading;
            return (
              <div
                key={r.key}
                className="card"
                style={{ transition: 'border-color 0.15s' }}
                onMouseOver={e => (e.currentTarget.style.borderColor = r.color)}
                onMouseOut={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <div className={styles.cardHeader}>
                  <div
                    className={styles.iconBox}
                    style={{ '--icon-bg': r.bg, '--icon-color': r.color } as React.CSSProperties}
                  >
                    <i className={`ti ${r.icon} ${styles.iconEl}`} />
                  </div>
                  <div>
                    <div className={styles.cardTitleText}>{r.title}</div>
                    <div className={styles.cardSubText}>{r.sub}</div>
                  </div>
                </div>
                <div className={styles.cardDesc}>{r.desc}</div>
                <div className={styles.btnRow}>
                  <button
                    className={`btn ${styles.btnFlex}`}
                    style={pdfBusy ? { opacity: 0.65 } : undefined}
                    disabled={busy}
                    onClick={() => handle(r.key, r.gen, 'pdf')}
                  >
                    {pdfBusy
                      ? <><i className={`ti ti-loader-2 ${styles.iconAnim}`} />&nbsp;Generating…</>
                      : <><i className={`ti ti-file-type-pdf ${styles.iconNorm}`} />&nbsp;PDF</>}
                  </button>
                  <button
                    className={`btn ${styles.btnFlex}`}
                    style={csvBusy ? { opacity: 0.65 } : undefined}
                    disabled={busy}
                    onClick={() => handle(r.key, r.gen, 'csv')}
                  >
                    {csvBusy
                      ? <><i className={`ti ti-loader-2 ${styles.iconAnim}`} />&nbsp;Generating…</>
                      : <><i className={`ti ti-table ${styles.iconNorm}`} />&nbsp;Excel</>}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
