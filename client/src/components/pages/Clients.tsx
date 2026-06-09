'use client';
import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import type { Client } from '@/types';
import { api } from '@/lib/api';

const colorMap: Record<string, { bg: string; fg: string }> = {
  emerald: { bg: 'var(--emerald-dim)', fg: 'var(--emerald)' },
  indigo:  { bg: 'var(--indigo-dim)',  fg: 'var(--indigo)' },
  blue:    { bg: 'var(--blue-dim)',    fg: 'var(--blue)' },
  amber:   { bg: 'var(--amber-dim)',   fg: 'var(--amber)' },
  red:     { bg: 'var(--red-dim)',     fg: 'var(--red)' },
};

const statusBadge: Record<string, string> = { Active: 'bg', Inactive: 'br', 'Renewal Due': 'ba' };

const defaultClients: Client[] = [
  { _id: '1', name: 'Nexus Brands', email: 'nexus@brand.com', service: 'Social Media + SEO', monthlyBilling: 72000, manager: 'Riya Sharma', renewal: 'Jun 2025', status: 'Active', initials: 'NB', colorKey: 'emerald' },
  { _id: '2', name: 'BluePeak Retail', email: 'info@bluepeak.in', service: 'Performance Mktg', monthlyBilling: 58000, manager: 'Arjun Mehta', renewal: 'Aug 2025', status: 'Active', initials: 'BP', colorKey: 'indigo' },
  { _id: '3', name: 'Orion Digital', email: 'contact@orion.co', service: 'Web Dev + SEO', monthlyBilling: 49000, manager: 'Priya Kapoor', renewal: 'Apr 2025', status: 'Renewal Due', initials: 'OD', colorKey: 'blue' },
  { _id: '4', name: 'Kratos Corp', email: 'hi@kratos.com', service: 'Content Creation', monthlyBilling: 38000, manager: 'Riya Sharma', renewal: 'Sep 2025', status: 'Active', initials: 'KC', colorKey: 'amber' },
  { _id: '5', name: 'SkyEdge Media', email: 'sky@edge.media', service: 'Social Media', monthlyBilling: 31000, manager: 'Arjun Mehta', renewal: 'Jul 2025', status: 'Inactive', initials: 'SE', colorKey: 'red' },
];

const emptyForm = { name: '', email: '', service: 'Social Media', monthlyBilling: '', contractStart: '', paymentTerms: 'Net 15' };

export default function Clients() {
  const [clients, setClients] = useState<Client[]>(defaultClients);
  const [filtered, setFiltered] = useState<Client[]>(defaultClients);
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    api.getClients().then((d) => { setClients(d as Client[]); setFiltered(d as Client[]); }).catch(() => {});
  }, []);

  const search = (q: string) => setFiltered(clients.filter(c =>
    c.name.toLowerCase().includes(q.toLowerCase()) || c.service.toLowerCase().includes(q.toLowerCase())
  ));

  const save = async () => {
    try {
      const initials = form.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
      const newClient = await api.createClient({ ...form, monthlyBilling: Number(form.monthlyBilling), initials, colorKey: 'emerald' });
      const updated = [newClient as Client, ...clients];
      setClients(updated); setFiltered(updated);
    } catch {}
    setIsOpen(false); setForm(emptyForm);
  };

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Client Management</div>
        <div className="topbar-right">
          <input type="text" placeholder="Search clients…" style={{ width: '200px' }} onChange={e => search(e.target.value)} />
          <button className="btn btn-p" onClick={() => setIsOpen(true)}><i className="ti ti-plus" />Add Client</button>
        </div>
      </div>

      <div className="content">
        <div className="grid4" style={{ marginBottom: '18px' }}>
          <div className="kpi"><div className="kpi-label">Total Clients</div><div className="kpi-value">{clients.length}</div><div className="kpi-change up">+3 this month</div></div>
          <div className="kpi"><div className="kpi-label">Active</div><div className="kpi-value" style={{ color: 'var(--emerald)' }}>{clients.filter(c => c.status === 'Active').length}</div><div className="kpi-change" style={{ color: 'var(--text2)' }}>87.5% retention</div></div>
          <div className="kpi"><div className="kpi-label">Avg Monthly Billing</div><div className="kpi-value">₹1.77L</div><div className="kpi-change up">per client</div></div>
          <div className="kpi"><div className="kpi-label">Total LTV</div><div className="kpi-value">₹2.4Cr</div><div className="kpi-change up">Lifetime value</div></div>
        </div>

        <div className="card">
          <div className="card-title">All Clients<span className="card-sub">{filtered.length} total</span></div>
          <table>
            <thead><tr><th>Client</th><th>Service</th><th>Monthly Billing</th><th>Manager</th><th>Renewal</th><th>Status</th><th /></tr></thead>
            <tbody>
              {filtered.map(c => {
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
                    <td>{c.manager}</td>
                    <td>{c.renewal}</td>
                    <td><span className={`badge ${statusBadge[c.status]}`}>{c.status}</span></td>
                    <td><button className="btn" style={{ padding: '4px 10px', fontSize: '11px' }}>View</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal title="Add New Client" isOpen={isOpen} onClose={() => setIsOpen(false)} onSave={save}>
        <div className="form-row">
          <div><label className="form-label">Client Name</label><input placeholder="Nexus Brands" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="form-label">Email</label><input type="email" placeholder="contact@company.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
        </div>
        <div className="form-row">
          <div>
            <label className="form-label">Service Type</label>
            <select value={form.service} onChange={e => setForm({ ...form, service: e.target.value })}>
              <option>Social Media</option><option>SEO</option><option>Web Dev</option><option>Performance Mktg</option><option>Content</option><option>Ecommerce</option>
            </select>
          </div>
          <div><label className="form-label">Monthly Billing (₹)</label><input type="number" placeholder="50000" value={form.monthlyBilling} onChange={e => setForm({ ...form, monthlyBilling: e.target.value })} /></div>
        </div>
        <div className="form-row">
          <div><label className="form-label">Contract Start</label><input type="date" value={form.contractStart} onChange={e => setForm({ ...form, contractStart: e.target.value })} /></div>
          <div>
            <label className="form-label">Payment Terms</label>
            <select value={form.paymentTerms} onChange={e => setForm({ ...form, paymentTerms: e.target.value })}>
              <option>Net 15</option><option>Net 30</option><option>Advance</option>
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
