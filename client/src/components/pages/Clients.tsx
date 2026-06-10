'use client';
import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import DeleteConfirm from '@/components/ui/DeleteConfirm';
import type { Client, ColorKey, ServiceItem } from '@/types';
import { api } from '@/lib/api';

const colorMap: Record<string, { bg: string; fg: string }> = {
  emerald: { bg: 'var(--emerald-dim)', fg: 'var(--emerald)' },
  indigo:  { bg: 'var(--indigo-dim)',  fg: 'var(--indigo)' },
  blue:    { bg: 'var(--blue-dim)',    fg: 'var(--blue)' },
  amber:   { bg: 'var(--amber-dim)',   fg: 'var(--amber)' },
  red:     { bg: 'var(--red-dim)',     fg: 'var(--red)' },
};

const colorKeys: ColorKey[]                 = ['emerald', 'indigo', 'blue', 'amber', 'red'];
const colorLabels: Record<ColorKey, string>  = { emerald: 'Green', indigo: 'Indigo', blue: 'Blue', amber: 'Amber', red: 'Red' };
const statusBadge: Record<string, string>    = { Active: 'bg', Inactive: 'br', 'Renewal Due': 'ba' };

const SERVICE_OPTIONS = [
  'Social Media', 'SEO', 'Web Dev', 'Performance Mktg',
  'Content Creation', 'Ecommerce', 'Email Marketing', 'Paid Ads', 'Branding',
];

const emptyForm = {
  name: '', email: '', manager: '', renewal: '',
  status: 'Active' as Client['status'],
  paymentTerms: 'Net 15', colorKey: 'emerald' as ColorKey,
  serviceAmounts: {} as Record<string, string>,
};

function fmt(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

export default function Clients() {
  const [clients, setClients]   = useState<Client[]>([]);
  const [loaded, setLoaded]     = useState(false);
  const [searchQ, setSearchQ]   = useState('');
  const [isOpen, setIsOpen]     = useState(false);
  const [editing, setEditing]   = useState<Client | null>(null);
  const [form, setForm]         = useState(emptyForm);
  const [saving, setSaving]     = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  function load() {
    api.getClients()
      .then(d => { setClients(d as Client[]); setLoaded(true); })
      .catch(() => setLoaded(true));
  }

  useEffect(() => { load(); }, []);

  const displayed = !searchQ
    ? clients
    : clients.filter(c =>
        c.name.toLowerCase().includes(searchQ.toLowerCase()) ||
        c.service.toLowerCase().includes(searchQ.toLowerCase())
      );

  function openAdd() {
    const nextColor = colorKeys[clients.length % colorKeys.length];
    setEditing(null);
    setForm({ ...emptyForm, colorKey: nextColor });
    setIsOpen(true);
  }

  function openEdit(c: Client) {
    setEditing(c);
    const serviceAmounts: Record<string, string> = {};
    if (c.serviceBreakdown?.length) {
      c.serviceBreakdown.forEach(i => { serviceAmounts[i.name] = String(i.amount); });
    } else if (c.service) {
      const svcs = c.service.split(' + ').map(s => s.trim()).filter(Boolean);
      svcs.forEach((s, idx) => {
        serviceAmounts[s] = svcs.length === 1 ? String(c.monthlyBilling) : '';
      });
    }
    setForm({
      name: c.name, email: c.email, manager: c.manager || '',
      renewal: c.renewal || '', status: c.status,
      paymentTerms: 'Net 15', colorKey: c.colorKey, serviceAmounts,
    });
    setIsOpen(true);
  }

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const initials: string = form.name.trim().split(/\s+/).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
      const serviceBreakdown: ServiceItem[] = Object.entries(form.serviceAmounts)
        .map(([name, amount]) => ({ name, amount: Number(amount) || 0 }));
      const monthlyBilling = serviceBreakdown.reduce((s, i) => s + i.amount, 0);
      const service = serviceBreakdown.map(i => i.name).join(' + ') || '—';
      const payload = {
        name: form.name, email: form.email, service, monthlyBilling, serviceBreakdown,
        manager: form.manager, renewal: form.renewal, status: form.status,
        paymentTerms: form.paymentTerms, colorKey: form.colorKey, initials,
      };
      if (editing) {
        const updated = await api.updateClient(editing._id, payload);
        setClients(prev => prev.map(c => c._id === editing._id ? updated as Client : c));
      } else {
        const created = await api.createClient(payload);
        setClients(prev => [created as Client, ...prev]);
      }
      setIsOpen(false);
    } catch {}
    setSaving(false);
  };

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.deleteClient(deleteId);
      setClients(prev => prev.filter(c => c._id !== deleteId));
    } catch {}
    setDeleting(false);
    setDeleteId(null);
  }

  const totalBilling = clients.reduce((s, c) => s + c.monthlyBilling, 0);
  const avgBilling   = clients.length > 0 ? Math.round(totalBilling / clients.length) : 0;
  const activeCount  = clients.filter(c => c.status === 'Active').length;
  const retentionPct = clients.length > 0 ? Math.round((activeCount / clients.length) * 100) : 0;

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Client Management</div>
        <div className="topbar-right">
          <input
            type="text"
            placeholder="Search clients…"
            style={{ width: '200px' }}
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
          />
          <button className="btn btn-p" onClick={openAdd}><i className="ti ti-plus" />Add Client</button>
        </div>
      </div>

      <div className="content">
        <div className="grid4" style={{ marginBottom: '18px' }}>
          <div className="kpi">
            <div className="kpi-label">Total Clients</div>
            <div className="kpi-value">{clients.length}</div>
            <div className="kpi-change" style={{ color: 'var(--text2)' }}>
              {clients.length === 0 ? 'Add your first client' : 'In system'}
            </div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Active</div>
            <div className="kpi-value" style={{ color: 'var(--emerald)' }}>{activeCount}</div>
            <div className="kpi-change" style={{ color: 'var(--text2)' }}>
              {clients.length > 0 ? `${retentionPct}% retention` : '—'}
            </div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Avg Monthly Billing</div>
            <div className="kpi-value">{avgBilling > 0 ? fmt(avgBilling) : '—'}</div>
            <div className="kpi-change up">per client</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Monthly Revenue</div>
            <div className="kpi-value">{totalBilling > 0 ? fmt(totalBilling) : '—'}</div>
            <div className="kpi-change up">from clients</div>
          </div>
        </div>

        <div className="card">
          <div className="card-title">All Clients<span className="card-sub">{displayed.length} shown</span></div>
          {!loaded ? (
            <div style={{ fontSize: '12px', color: 'var(--text3)', padding: '16px 0' }}>Loading…</div>
          ) : displayed.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center' }}>
              <div style={{ fontSize: '13px', color: 'var(--text3)', marginBottom: '12px' }}>
                {searchQ ? 'No clients match your search' : 'No clients yet'}
              </div>
              {!searchQ && (
                <button className="btn btn-p" onClick={openAdd}>
                  <i className="ti ti-plus" />Add your first client
                </button>
              )}
            </div>
          ) : (
            <table>
              <thead>
                <tr><th>Client</th><th>Service</th><th>Monthly Billing</th><th>Manager</th><th>Renewal</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {displayed.map(c => {
                  const col = colorMap[c.colorKey] || colorMap.emerald;
                  return (
                    <tr key={c._id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                          <div className="avatar" style={{ background: col.bg, color: col.fg }}>{c.initials}</div>
                          <div>
                            <div style={{ color: 'var(--text)', fontWeight: 600 }}>{c.name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{c.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>{c.service}</td>
                      <td style={{ color: 'var(--text)', fontWeight: 700 }}>₹{c.monthlyBilling.toLocaleString('en-IN')}</td>
                      <td>{c.manager || '—'}</td>
                      <td>{c.renewal || '—'}</td>
                      <td><span className={`badge ${statusBadge[c.status]}`}>{c.status}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button className="btn" style={{ padding: '4px 9px', fontSize: '11px' }}
                            title="Edit" onClick={() => openEdit(c)}>
                            <i className="ti ti-pencil" style={{ fontSize: '12px' }} />
                          </button>
                          <button className="btn" style={{ padding: '4px 9px', fontSize: '11px', color: 'var(--red)' }}
                            title="Delete" onClick={() => setDeleteId(c._id)}>
                            <i className="ti ti-trash" style={{ fontSize: '12px' }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal
        title={editing ? 'Edit Client' : 'Add New Client'}
        isOpen={isOpen}
        onClose={() => { setIsOpen(false); setSaving(false); }}
        onSave={save}
      >
        <div className="form-row">
          <div><label className="form-label">Client Name</label><input placeholder="Nexus Brands" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="form-label">Email</label><input type="email" placeholder="contact@company.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label className="form-label">Services</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
            {SERVICE_OPTIONS.map(svc => {
              const active = svc in form.serviceAmounts;
              return (
                <button
                  key={svc}
                  type="button"
                  onClick={() => {
                    const next = { ...form.serviceAmounts };
                    if (active) { delete next[svc]; } else { next[svc] = ''; }
                    setForm({ ...form, serviceAmounts: next });
                  }}
                  style={{
                    padding: '4px 11px', fontSize: '11px', borderRadius: '20px', cursor: 'pointer',
                    border: `1px solid ${active ? 'var(--indigo)' : 'var(--border)'}`,
                    background: active ? 'var(--indigo-dim)' : 'transparent',
                    color: active ? 'var(--indigo)' : 'var(--text2)',
                    fontWeight: active ? 600 : 400,
                    transition: 'all 0.12s',
                  }}
                >
                  {active && <i className="ti ti-check" style={{ fontSize: '10px', marginRight: '4px' }} />}
                  {svc}
                </button>
              );
            })}
          </div>
        </div>
        {Object.keys(form.serviceAmounts).length > 0 && (
          <div style={{ marginBottom: '12px', background: 'var(--surface2,var(--surface))', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px' }}>
            <div style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
              Monthly Pricing
            </div>
            {Object.entries(form.serviceAmounts).map(([svc, amt]) => (
              <div key={svc} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ flex: 1, fontSize: '12px', color: 'var(--text2)' }}>{svc}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text3)' }}>₹</span>
                  <input
                    type="number"
                    placeholder="0"
                    value={amt}
                    onChange={e => setForm({ ...form, serviceAmounts: { ...form.serviceAmounts, [svc]: e.target.value } })}
                    style={{ width: '110px' }}
                  />
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: '4px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: 600 }}>Monthly Total</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
                ₹{Object.values(form.serviceAmounts).reduce((s, v) => s + (Number(v) || 0), 0).toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        )}
        <div className="form-row">
          <div><label className="form-label">Account Manager</label><input placeholder="Manager name" value={form.manager} onChange={e => setForm({ ...form, manager: e.target.value })} /></div>
          <div><label className="form-label">Renewal Date</label><input placeholder="e.g. Jun 2025" value={form.renewal} onChange={e => setForm({ ...form, renewal: e.target.value })} /></div>
        </div>
        <div className="form-row">
          <div>
            <label className="form-label">Status</label>
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Client['status'] })}>
              <option>Active</option><option>Inactive</option><option>Renewal Due</option>
            </select>
          </div>
          <div>
            <label className="form-label">Accent Color</label>
            <select value={form.colorKey} onChange={e => setForm({ ...form, colorKey: e.target.value as ColorKey })}>
              {colorKeys.map(k => <option key={k} value={k}>{colorLabels[k]}</option>)}
            </select>
          </div>
        </div>
      </Modal>

      {deleteId && (
        <DeleteConfirm
          title="Delete Client"
          message="This will permanently delete the client. This cannot be undone."
          onConfirm={confirmDelete}
          onCancel={() => setDeleteId(null)}
          loading={deleting}
        />
      )}
    </div>
  );
}
