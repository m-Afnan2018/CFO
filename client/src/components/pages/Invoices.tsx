'use client';
import { useEffect, useState } from 'react';
import type { Invoice } from '@/types';
import { api } from '@/lib/api';
import InvoiceDesigner from './InvoiceDesigner';

const statusBadge: Record<string, string> = { Paid: 'bg', Partial: 'ba', Overdue: 'br', Pending: 'bb' };

function fmt(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

export default function Invoices() {
  const [invoices, setInvoices]           = useState<Invoice[]>([]);
  const [loaded, setLoaded]               = useState(false);
  const [statusFilter, setStatusFilter]   = useState('All');
  const [designing, setDesigning]         = useState(false);
  const [editTarget, setEditTarget]       = useState<Invoice | undefined>(undefined);
  const [deleteId, setDeleteId]           = useState<string | null>(null);
  const [deleting, setDeleting]           = useState(false);

  function load() {
    api.getInvoices()
      .then(d => { setInvoices(d as Invoice[]); setLoaded(true); })
      .catch(() => setLoaded(true));
  }

  useEffect(() => { load(); }, []);

  const displayed = statusFilter === 'All'
    ? invoices
    : invoices.filter(i => i.status === statusFilter);

  const totalInvoiced = invoices.reduce((s, i) => s + i.total, 0);
  const collected     = invoices.filter(i => i.status === 'Paid').reduce((s, i) => s + i.total, 0);
  const overdue       = invoices.filter(i => i.status === 'Overdue').reduce((s, i) => s + i.total, 0);
  const pending       = invoices.filter(i => ['Pending', 'Partial'].includes(i.status)).reduce((s, i) => s + i.total, 0);

  function openNew() { setEditTarget(undefined); setDesigning(true); }
  function openEdit(inv: Invoice) { setEditTarget(inv); setDesigning(true); }

  function handleSaved(inv: Invoice) {
    setInvoices(prev => {
      const idx = prev.findIndex(i => i._id === inv._id);
      return idx >= 0 ? prev.map(i => i._id === inv._id ? inv : i) : [inv, ...prev];
    });
    setDesigning(false);
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.deleteInvoice(deleteId);
      setInvoices(prev => prev.filter(i => i._id !== deleteId));
    } catch {}
    setDeleting(false);
    setDeleteId(null);
  }

  if (designing) {
    return (
      <InvoiceDesigner
        invoice={editTarget}
        onSave={handleSaved}
        onClose={() => setDesigning(false)}
      />
    );
  }

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Invoice Management</div>
        <div className="topbar-right">
          <div className="fp">
            <i className="ti ti-filter" style={{ fontSize: '13px' }} />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="All">All Status</option>
              <option>Paid</option>
              <option>Pending</option>
              <option>Overdue</option>
              <option>Partial</option>
            </select>
          </div>
          <button className="btn btn-p" onClick={openNew}>
            <i className="ti ti-plus" />New Invoice
          </button>
        </div>
      </div>

      <div className="content">
        <div className="grid4" style={{ marginBottom: '18px' }}>
          <div className="kpi">
            <div className="kpi-label">Total Invoiced</div>
            <div className="kpi-value">{fmt(totalInvoiced)}</div>
            <div className="kpi-change" style={{ color: 'var(--text2)' }}>{invoices.length} invoices</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Collected</div>
            <div className="kpi-value" style={{ color: 'var(--emerald)' }}>{fmt(collected)}</div>
            <div className="kpi-change up">
              {totalInvoiced > 0 ? Math.round((collected / totalInvoiced) * 100) : 0}% collected
            </div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Overdue</div>
            <div className="kpi-value" style={{ color: 'var(--red)' }}>{fmt(overdue)}</div>
            <div className="kpi-change down">{invoices.filter(i => i.status === 'Overdue').length} invoices</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Pending</div>
            <div className="kpi-value" style={{ color: 'var(--amber)' }}>{fmt(pending)}</div>
            <div className="kpi-change" style={{ color: 'var(--text2)' }}>
              {invoices.filter(i => ['Pending', 'Partial'].includes(i.status)).length} invoices
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-title">
            All Invoices
            <span className="card-sub">{displayed.length} shown</span>
          </div>

          {!loaded ? (
            <div style={{ fontSize: '12px', color: 'var(--text3)', padding: '16px 0' }}>Loading…</div>
          ) : displayed.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center' }}>
              <div style={{ fontSize: '13px', color: 'var(--text3)', marginBottom: '12px' }}>
                {statusFilter === 'All' ? 'No invoices yet' : `No ${statusFilter} invoices`}
              </div>
              {statusFilter === 'All' && (
                <button className="btn btn-p" onClick={openNew}>
                  <i className="ti ti-plus" />Create your first invoice
                </button>
              )}
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Invoice #</th><th>Client</th><th>Date</th><th>Due Date</th>
                  <th>Amount</th><th>GST</th><th>Total</th><th>Status</th><th />
                </tr>
              </thead>
              <tbody>
                {displayed.map(inv => (
                  <tr key={inv._id}>
                    <td style={{ color: 'var(--indigo)', fontWeight: 700 }}>{inv.invoiceNumber}</td>
                    <td style={{ color: 'var(--text)', fontWeight: 500 }}>{inv.client}</td>
                    <td>{inv.date || '—'}</td>
                    <td>{inv.dueDate || '—'}</td>
                    <td>₹{inv.amount.toLocaleString('en-IN')}</td>
                    <td>₹{inv.gst.toLocaleString('en-IN')}</td>
                    <td style={{ fontWeight: 700, color: 'var(--text)' }}>₹{inv.total.toLocaleString('en-IN')}</td>
                    <td><span className={`badge ${statusBadge[inv.status]}`}>{inv.status}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button className="btn" style={{ padding: '4px 9px', fontSize: '11px' }}
                          title="Edit" onClick={() => openEdit(inv)}>
                          <i className="ti ti-pencil" style={{ fontSize: '12px' }} />
                        </button>
                        <button className="btn" style={{ padding: '4px 9px', fontSize: '11px', color: 'var(--red)' }}
                          title="Delete" onClick={() => setDeleteId(inv._id)}>
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

      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal" style={{ maxWidth: '360px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Delete Invoice</span>
              <button className="modal-close" onClick={() => setDeleteId(null)}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '13px', color: 'var(--text2)', margin: 0 }}>
                This will permanently delete the invoice. This cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn" style={{ background: 'var(--red)', color: '#fff', border: 'none' }}
                onClick={confirmDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
