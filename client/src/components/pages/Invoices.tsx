'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DeleteConfirm from '@/components/ui/DeleteConfirm';
import type { Invoice } from '@/types';
import { api } from '@/lib/api';

const statusBadge: Record<string, string> = { Paid: 'bg', Partial: 'ba', Overdue: 'br', Pending: 'bb' };

function fmt(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

function fmtMonth(ym: string) {
  const [y, m] = ym.split('-');
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${names[parseInt(m) - 1]} ${y}`;
}

export default function Invoices() {
  const router = useRouter();
  const [invoices, setInvoices]         = useState<Invoice[]>([]);
  const [loaded, setLoaded]             = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');
  const [monthFilter, setMonthFilter]   = useState('');
  const [searchQ, setSearchQ]           = useState('');
  const [deleteId, setDeleteId]         = useState<string | null>(null);
  const [deleting, setDeleting]         = useState(false);
  const [markingPaid, setMarkingPaid]   = useState<string | null>(null);

  function load() {
    api.getInvoices()
      .then(d => { setInvoices(d as Invoice[]); setLoaded(true); })
      .catch(() => setLoaded(true));
  }

  useEffect(() => { load(); }, []);

  const months = Array.from(new Set(
    invoices.map(i => i.date?.slice(0, 7)).filter(Boolean) as string[]
  )).sort((a, b) => b.localeCompare(a));

  const displayed = invoices
    .filter(i => statusFilter === 'All' || i.status === statusFilter)
    .filter(i => !monthFilter || i.date?.startsWith(monthFilter))
    .filter(i => !searchQ ||
      i.client.toLowerCase().includes(searchQ.toLowerCase()) ||
      i.invoiceNumber.toLowerCase().includes(searchQ.toLowerCase())
    );

  const totalInvoiced = invoices.reduce((s, i) => s + i.total, 0);
  const collected     = invoices.filter(i => i.status === 'Paid').reduce((s, i) => s + i.total, 0);
  const overdue       = invoices.filter(i => i.status === 'Overdue').reduce((s, i) => s + i.total, 0);
  const pending       = invoices.filter(i => ['Pending', 'Partial'].includes(i.status)).reduce((s, i) => s + i.total, 0);

  async function markAsPaid(inv: Invoice) {
    setMarkingPaid(inv._id);
    try {
      const updated = await api.updateInvoice(inv._id, { status: 'Paid' });
      setInvoices(prev => prev.map(i => i._id === inv._id ? updated as Invoice : i));
    } catch {}
    setMarkingPaid(null);
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

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Invoice Management</div>
        <div className="topbar-right">
          <input
            type="text"
            placeholder="Search client / invoice…"
            style={{ width: '180px' }}
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
          />
          {months.length > 0 && (
            <div className="fp">
              <i className="ti ti-calendar" style={{ fontSize: '13px' }} />
              <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
                <option value="">All Months</option>
                {months.map(m => <option key={m} value={m}>{fmtMonth(m)}</option>)}
              </select>
            </div>
          )}
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
          <button className="btn btn-p" onClick={() => router.push('/invoices/new')}>
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
                {statusFilter === 'All' && !searchQ && !monthFilter
                  ? 'No invoices yet'
                  : 'No invoices match your filters'}
              </div>
              {statusFilter === 'All' && !searchQ && !monthFilter && (
                <button className="btn btn-p" onClick={() => router.push('/invoices/new')}>
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
                        {inv.status !== 'Paid' && (
                          <button
                            className="btn"
                            style={{ padding: '4px 9px', fontSize: '11px', color: 'var(--emerald)' }}
                            title="Mark as Paid"
                            onClick={() => markAsPaid(inv)}
                            disabled={markingPaid === inv._id}
                          >
                            <i className={`ti ${markingPaid === inv._id ? 'ti-loader-2' : 'ti-circle-check'}`} style={{ fontSize: '13px' }} />
                          </button>
                        )}
                        <button className="btn" style={{ padding: '4px 9px', fontSize: '11px' }}
                          title="Edit" onClick={() => router.push(`/invoices/${inv._id}/edit`)}>
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
        <DeleteConfirm
          title="Delete Invoice"
          message="This will permanently delete the invoice. This cannot be undone."
          onConfirm={confirmDelete}
          onCancel={() => setDeleteId(null)}
          loading={deleting}
        />
      )}
    </div>
  );
}
