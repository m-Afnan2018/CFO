'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Modal from '@/components/ui/Modal';
import type { Expense } from '@/types';
import { api } from '@/lib/api';

const ExpenseTrendChart = dynamic(() => import('@/components/charts/ExpenseTrendChart'), { ssr: false });

const defaultExpenses: Expense[] = [
  { _id: '1', date: '10 Mar 2025', category: 'Salaries', vendor: '—', description: 'March salary disbursement', amount: 1420000, type: 'Fixed' },
  { _id: '2', date: '08 Mar 2025', category: 'Software', vendor: 'Adobe Inc', description: 'Creative Cloud annual', amount: 32000, type: 'Fixed' },
  { _id: '3', date: '05 Mar 2025', category: 'Freelancers', vendor: 'Content Tribe', description: 'Video production — 3 clients', amount: 85000, type: 'Variable' },
  { _id: '4', date: '03 Mar 2025', category: 'Rent', vendor: 'PropSol Pvt', description: 'Office rent — March', amount: 95000, type: 'Fixed' },
];

const categoryBadge: Record<string, string> = { Salaries: 'bi', Software: 'bg', Freelancers: 'ba', Rent: 'bb', Marketing: 'br' };
const typeBadge: Record<string, string> = { Fixed: 'bb', Variable: 'ba' };

const emptyForm = { date: '', category: 'Salaries', vendor: '', amount: '', payMethod: 'Bank Transfer', type: 'Fixed', description: '' };

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>(defaultExpenses);
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [catFilter, setCatFilter] = useState('All Categories');

  useEffect(() => {
    api.getExpenses().then((d) => setExpenses(d as Expense[])).catch(() => {});
  }, []);

  const displayed = catFilter === 'All Categories' ? expenses : expenses.filter(e => e.category === catFilter);

  const save = async () => {
    try {
      const exp = await api.createExpense({ ...form, amount: Number(form.amount) });
      setExpenses([exp as Expense, ...expenses]);
    } catch {}
    setIsOpen(false); setForm(emptyForm);
  };

  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const fixed = expenses.filter(e => e.type === 'Fixed').reduce((s, e) => s + e.amount, 0);
  const variable = expenses.filter(e => e.type === 'Variable').reduce((s, e) => s + e.amount, 0);

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Expense Management</div>
        <div className="topbar-right">
          <div className="fp">
            <select value={catFilter} onChange={e => setCatFilter(e.target.value)}>
              <option>All Categories</option><option>Salaries</option><option>Rent</option><option>Software</option><option>Freelancers</option>
            </select>
          </div>
          <button className="btn btn-p" onClick={() => setIsOpen(true)}><i className="ti ti-plus" />Add Expense</button>
        </div>
      </div>

      <div className="content">
        <div className="grid4" style={{ marginBottom: '18px' }}>
          <div className="kpi"><div className="kpi-label">Total Expenses</div><div className="kpi-value">₹{(total / 100000).toFixed(1)}L</div><div className="kpi-change down">+6.2% MoM</div></div>
          <div className="kpi"><div className="kpi-label">Fixed Costs</div><div className="kpi-value">₹{(fixed / 100000).toFixed(1)}L</div><div className="kpi-change" style={{ color: 'var(--text2)' }}>{total > 0 ? Math.round((fixed / total) * 100) : 0}% of total</div></div>
          <div className="kpi"><div className="kpi-label">Variable Costs</div><div className="kpi-value">₹{(variable / 100000).toFixed(1)}L</div><div className="kpi-change" style={{ color: 'var(--text2)' }}>{total > 0 ? Math.round((variable / total) * 100) : 0}% of total</div></div>
          <div className="kpi"><div className="kpi-label">Largest Category</div><div className="kpi-value" style={{ fontSize: '16px' }}>Salaries</div><div className="kpi-change" style={{ color: 'var(--text2)' }}>₹14.2L (50%)</div></div>
        </div>

        <div className="grid2">
          <div className="card">
            <div className="card-title">Expense by Category</div>
            {[
              { label: 'Salaries', w: 100, color: 'var(--indigo)', val: '₹14.2L' },
              { label: 'Freelancers', w: 35, color: 'var(--emerald)', val: '₹3.8L' },
              { label: 'Rent', w: 28, color: 'var(--blue)', val: '₹2.8L' },
              { label: 'Software Tools', w: 18, color: 'var(--amber)', val: '₹1.9L' },
              { label: 'Content Shoots', w: 15, color: 'var(--red)', val: '₹1.6L' },
              { label: 'Ads & Marketing', w: 13, color: 'var(--text3)', val: '₹1.4L' },
              { label: 'Other', w: 10, color: 'var(--text3)', val: '₹2.7L' },
            ].map(r => (
              <div key={r.label} className="bar-row">
                <span className="bar-label">{r.label}</span>
                <div className="bar-track"><div className="bar-fill" style={{ width: `${r.w}%`, background: r.color }} /></div>
                <span className="bar-val">{r.val}</span>
              </div>
            ))}
          </div>
          <div className="card">
            <div className="card-title">Expense Trend<span className="card-sub">Last 6 months</span></div>
            <div className="cw"><ExpenseTrendChart /></div>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Recent Expenses</div>
          <table>
            <thead><tr><th>Date</th><th>Category</th><th>Vendor</th><th>Description</th><th>Amount</th><th>Type</th></tr></thead>
            <tbody>
              {displayed.map(exp => (
                <tr key={exp._id}>
                  <td>{exp.date}</td>
                  <td><span className={`badge ${categoryBadge[exp.category] || 'bb'}`}>{exp.category}</span></td>
                  <td>{exp.vendor}</td>
                  <td>{exp.description}</td>
                  <td style={{ color: 'var(--text)', fontWeight: 700 }}>₹{exp.amount.toLocaleString('en-IN')}</td>
                  <td><span className={`badge ${typeBadge[exp.type]}`}>{exp.type}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal title="Add Expense" isOpen={isOpen} onClose={() => setIsOpen(false)} onSave={save}>
        <div className="form-row">
          <div><label className="form-label">Date</label><input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
          <div>
            <label className="form-label">Category</label>
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              <option>Salaries</option><option>Rent</option><option>Software</option><option>Freelancers</option><option>Marketing</option><option>Content Shoots</option><option>Travel</option><option>Utilities</option><option>Miscellaneous</option>
            </select>
          </div>
        </div>
        <div className="form-row">
          <div><label className="form-label">Vendor</label><input placeholder="Vendor name" value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} /></div>
          <div><label className="form-label">Amount (₹)</label><input type="number" placeholder="50000" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
        </div>
        <div className="form-row">
          <div>
            <label className="form-label">Payment Method</label>
            <select value={form.payMethod} onChange={e => setForm({ ...form, payMethod: e.target.value })}>
              <option>Bank Transfer</option><option>UPI</option><option>Cash</option><option>Card</option>
            </select>
          </div>
          <div>
            <label className="form-label">Type</label>
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
              <option>Fixed</option><option>Variable</option>
            </select>
          </div>
        </div>
        <div style={{ marginBottom: '8px' }}>
          <label className="form-label">Description</label>
          <input placeholder="Brief description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
        </div>
      </Modal>
    </div>
  );
}
