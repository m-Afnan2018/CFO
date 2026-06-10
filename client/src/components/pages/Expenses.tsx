'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Modal from '@/components/ui/Modal';
import DeleteConfirm from '@/components/ui/DeleteConfirm';
import type { Expense } from '@/types';
import { api } from '@/lib/api';

const ExpenseTrendChart = dynamic(() => import('@/components/charts/ExpenseTrendChart'), { ssr: false });

const categoryBadge: Record<string, string> = { Salaries: 'bi', Software: 'bg', Freelancers: 'ba', Rent: 'bb', Marketing: 'br' };
const typeBadge: Record<string, string>     = { Fixed: 'bb', Variable: 'ba' };
const catColors: Record<string, string>     = {
  Salaries: 'var(--indigo)', Freelancers: 'var(--emerald)', Rent: 'var(--blue)',
  Software: 'var(--amber)', Marketing: 'var(--red)', 'Content Shoots': 'var(--amber)',
  Travel: 'var(--blue)', Utilities: 'var(--text3)', Miscellaneous: 'var(--text3)',
};

const emptyForm = {
  date: '', category: 'Salaries', vendor: '', amount: '',
  payMethod: 'Bank Transfer', type: 'Fixed', description: '',
};

function fmt(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n.toLocaleString('en-IN')}`;
}

export default function Expenses() {
  const [expenses, setExpenses]   = useState<Expense[]>([]);
  const [loaded, setLoaded]       = useState(false);
  const [isOpen, setIsOpen]       = useState(false);
  const [editing, setEditing]     = useState<Expense | null>(null);
  const [form, setForm]           = useState(emptyForm);
  const [catFilter, setCatFilter] = useState('All Categories');
  const [deleteId, setDeleteId]   = useState<string | null>(null);
  const [deleting, setDeleting]   = useState(false);

  function load() {
    api.getExpenses()
      .then(d => { setExpenses(d as Expense[]); setLoaded(true); })
      .catch(() => setLoaded(true));
  }

  useEffect(() => { load(); }, []);

  const displayed = catFilter === 'All Categories'
    ? expenses
    : expenses.filter(e => e.category === catFilter);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setIsOpen(true);
  }

  function openEdit(e: Expense) {
    setEditing(e);
    setForm({
      date: e.date, category: e.category, vendor: e.vendor || '',
      amount: String(e.amount), payMethod: 'Bank Transfer',
      type: e.type, description: e.description || '',
    });
    setIsOpen(true);
  }

  const save = async () => {
    if (!form.amount) return;
    try {
      const payload = { ...form, amount: Number(form.amount) };
      if (editing) {
        const updated = await api.updateExpense(editing._id, payload);
        setExpenses(prev => prev.map(e => e._id === editing._id ? updated as Expense : e));
      } else {
        const created = await api.createExpense(payload);
        setExpenses(prev => [created as Expense, ...prev]);
      }
      setIsOpen(false);
    } catch {}
  };

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.deleteExpense(deleteId);
      setExpenses(prev => prev.filter(e => e._id !== deleteId));
    } catch {}
    setDeleting(false);
    setDeleteId(null);
  }

  const total    = expenses.reduce((s, e) => s + e.amount, 0);
  const fixed    = expenses.filter(e => e.type === 'Fixed').reduce((s, e) => s + e.amount, 0);
  const variable = expenses.filter(e => e.type === 'Variable').reduce((s, e) => s + e.amount, 0);

  const catTotals = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {} as Record<string, number>);

  const catBars = Object.entries(catTotals).sort(([, a], [, b]) => b - a).slice(0, 7);
  const maxCat  = catBars[0]?.[1] || 1;
  const largest = catBars[0];

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Expense Management</div>
        <div className="topbar-right">
          <div className="fp">
            <select value={catFilter} onChange={e => setCatFilter(e.target.value)}>
              <option>All Categories</option><option>Salaries</option><option>Rent</option>
              <option>Software</option><option>Freelancers</option><option>Marketing</option>
              <option>Content Shoots</option><option>Travel</option><option>Utilities</option>
            </select>
          </div>
          <button className="btn btn-p" onClick={openAdd}><i className="ti ti-plus" />Add Expense</button>
        </div>
      </div>

      <div className="content">
        <div className="grid4" style={{ marginBottom: '18px' }}>
          <div className="kpi">
            <div className="kpi-label">Total Expenses</div>
            <div className="kpi-value">{total > 0 ? fmt(total) : '—'}</div>
            <div className="kpi-change" style={{ color: 'var(--text2)' }}>This period</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Fixed Costs</div>
            <div className="kpi-value">{fixed > 0 ? fmt(fixed) : '—'}</div>
            <div className="kpi-change" style={{ color: 'var(--text2)' }}>{total > 0 ? Math.round((fixed / total) * 100) : 0}% of total</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Variable Costs</div>
            <div className="kpi-value">{variable > 0 ? fmt(variable) : '—'}</div>
            <div className="kpi-change" style={{ color: 'var(--text2)' }}>{total > 0 ? Math.round((variable / total) * 100) : 0}% of total</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Largest Category</div>
            <div className="kpi-value" style={{ fontSize: '16px' }}>{largest ? largest[0] : '—'}</div>
            <div className="kpi-change" style={{ color: 'var(--text2)' }}>
              {largest ? `${fmt(largest[1])} (${Math.round((largest[1] / total) * 100)}%)` : 'No data'}
            </div>
          </div>
        </div>

        <div className="grid2">
          <div className="card">
            <div className="card-title">Expense by Category</div>
            {catBars.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text3)', padding: '8px 0' }}>No expense data yet</div>
            ) : catBars.map(([label, amt]) => (
              <div key={label} className="bar-row">
                <span className="bar-label">{label}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${Math.round((amt / maxCat) * 100)}%`, background: catColors[label] || 'var(--text3)' }} />
                </div>
                <span className="bar-val">{fmt(amt)}</span>
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
          {!loaded ? (
            <div style={{ fontSize: '12px', color: 'var(--text3)', padding: '16px 0' }}>Loading…</div>
          ) : displayed.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center' }}>
              <div style={{ fontSize: '13px', color: 'var(--text3)', marginBottom: '12px' }}>
                {catFilter !== 'All Categories' ? `No ${catFilter} expenses` : 'No expenses yet'}
              </div>
              {catFilter === 'All Categories' && (
                <button className="btn btn-p" onClick={openAdd}><i className="ti ti-plus" />Add first expense</button>
              )}
            </div>
          ) : (
            <table>
              <thead>
                <tr><th>Date</th><th>Category</th><th>Vendor</th><th>Description</th><th>Amount</th><th>Type</th><th /></tr>
              </thead>
              <tbody>
                {displayed.map(exp => (
                  <tr key={exp._id}>
                    <td>{exp.date}</td>
                    <td><span className={`badge ${categoryBadge[exp.category] || 'bb'}`}>{exp.category}</span></td>
                    <td>{exp.vendor || '—'}</td>
                    <td>{exp.description}</td>
                    <td style={{ color: 'var(--text)', fontWeight: 700 }}>₹{exp.amount.toLocaleString('en-IN')}</td>
                    <td><span className={`badge ${typeBadge[exp.type]}`}>{exp.type}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button className="btn" style={{ padding: '4px 9px', fontSize: '11px' }}
                          title="Edit" onClick={() => openEdit(exp)}>
                          <i className="ti ti-pencil" style={{ fontSize: '12px' }} />
                        </button>
                        <button className="btn" style={{ padding: '4px 9px', fontSize: '11px', color: 'var(--red)' }}
                          title="Delete" onClick={() => setDeleteId(exp._id)}>
                          <i className="ti ti-trash" style={{ fontSize: '12px' }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal title={editing ? 'Edit Expense' : 'Add Expense'} isOpen={isOpen} onClose={() => setIsOpen(false)} onSave={save}>
        <div className="form-row">
          <div><label className="form-label">Date</label><input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
          <div>
            <label className="form-label">Category</label>
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              <option>Salaries</option><option>Rent</option><option>Software</option><option>Freelancers</option>
              <option>Marketing</option><option>Content Shoots</option><option>Travel</option>
              <option>Utilities</option><option>Miscellaneous</option>
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

      {deleteId && (
        <DeleteConfirm
          title="Delete Expense"
          message="This will permanently delete this expense. This cannot be undone."
          onConfirm={confirmDelete}
          onCancel={() => setDeleteId(null)}
          loading={deleting}
        />
      )}
    </div>
  );
}
