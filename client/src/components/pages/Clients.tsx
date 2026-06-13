'use client';
import { useEffect, useState, useCallback } from 'react';
import Modal from '@/components/ui/Modal';
import DeleteConfirm from '@/components/ui/DeleteConfirm';
import PageHeader from '@/components/ui/PageHeader';
import type { Client, ClientRecord, ClientBillingPeriod, ColorKey, ServiceItem, PaymentEntry, Service } from '@/types';
import { api } from '@/lib/api';
import ClientsYearly from './ClientsYearly';
import styles from './Clients.module.css';

const colorMap: Record<string, { bg: string; fg: string }> = {
  emerald: { bg: 'var(--emerald-dim)', fg: 'var(--emerald)' },
  indigo:  { bg: 'var(--indigo-dim)',  fg: 'var(--indigo)' },
  blue:    { bg: 'var(--blue-dim)',    fg: 'var(--blue)' },
  amber:   { bg: 'var(--amber-dim)',   fg: 'var(--amber)' },
  red:     { bg: 'var(--red-dim)',     fg: 'var(--red)' },
};

const colorKeys: ColorKey[]                 = ['emerald', 'indigo', 'blue', 'amber', 'red'];
const colorLabels: Record<ColorKey, string> = { emerald: 'Green', indigo: 'Indigo', blue: 'Blue', amber: 'Amber', red: 'Red' };
const statusBadge: Record<string, string>   = { Active: 'bg', Inactive: 'br', 'Renewal Due': 'ba' };
const recBadge: Record<string, string>      = { Pending: 'br', Paid: 'bg', Partial: 'ba' };


const emptyForm = {
  name: '', email: '', manager: '', renewal: '',
  status: 'Active' as Client['status'],
  paymentTerms: 'Net 15', colorKey: 'emerald' as ColorKey,
  serviceAmounts: {} as Record<string, string>,
  serviceTypes:  {} as Record<string, 'Monthly' | 'One Time'>,
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtPeriod(p: string) {
  if (!p) return '';
  const [y, m] = p.split('-');
  return `${MONTHS[Number(m) - 1]} ${y}`;
}
function nowPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function shiftMonth(p: string, delta: number) {
  const [y, m] = p.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function fmt(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

export default function Clients() {
  // ── Clients tab ──────────────────────────────────────────────
  const [clients, setClients]   = useState<Client[]>([]);
  const [loaded, setLoaded]     = useState(false);
  const [searchQ, setSearchQ]   = useState('');
  const [isOpen, setIsOpen]     = useState(false);
  const [editing, setEditing]   = useState<Client | null>(null);
  const [form, setForm]         = useState(emptyForm);
  const [saving, setSaving]     = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Billing tab ───────────────────────────────────────────────
  const [tab, setTab]                   = useState<'clients' | 'billing' | 'yearly'>('clients');
  const [billingPeriods, setBillingPeriods] = useState<ClientBillingPeriod[]>([]);
  const [billingRecords, setBillingRecords] = useState<ClientRecord[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState(nowPeriod);
  const [runningBilling, setRunningBilling]       = useState(false);
  const [processingAll, setProcessingAll]         = useState(false);
  const [deletingPeriod, setDeletingPeriod]       = useState(false);
  const [billingLoaded, setBillingLoaded]         = useState(false);
  const [generatingInvoice, setGeneratingInvoice] = useState<string | null>(null);

  // ── Service options (loaded from /api/services) ────
  const [serviceOptions, setServiceOptions] = useState<string[]>([]);
  const [newSvcName, setNewSvcName] = useState('');

  function addServiceOption(raw: string) {
    const name = raw.trim();
    if (!name || serviceOptions.includes(name)) return;
    setRunEntries(prev => prev.map(e => ({ ...e, services: [...e.services, { name, amount: '0', included: true }] })));
    setNewSvcName('');
  }

  // ── Services popup (billing tab) ─────────────────────────────
  const [servicePopup, setServicePopup] = useState<ClientRecord | null>(null);

  // ── Payment detail popup (view-only) ────────────────────────────
  const [payDetail, setPayDetail] = useState<ClientRecord | null>(null);

  // ── Payment modal ─────────────────────────────────────────────
  const [payModal, setPayModal]   = useState<ClientRecord | null>(null);
  const [payEntries, setPayEntries] = useState<PaymentEntry[]>([]);
  const [paySaving, setPaySaving] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const emptyEntry = (): PaymentEntry => ({ amount: 0, method: 'Online', mode: 'UPI', receivedFrom: '', date: today });

  function openPayModal(r: ClientRecord) {
    setPayModal(r);
    setPayEntries(r.payments?.length ? [...r.payments] : [{ amount: r.monthlyBilling, method: 'Online', mode: 'UPI', receivedFrom: '', date: today }]);
  }

  function updateEntry(i: number, patch: Partial<PaymentEntry>) {
    setPayEntries(prev => prev.map((e, idx) => idx === i ? { ...e, ...patch } : e));
  }

  function addEntry() {
    setPayEntries(prev => {
      const remaining = (payModal?.monthlyBilling ?? 0) - prev.reduce((s, e) => s + (Number(e.amount) || 0), 0);
      return [...prev, { ...emptyEntry(), amount: Math.max(0, remaining) }];
    });
  }

  function removeEntry(i: number) {
    setPayEntries(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev);
  }

  async function confirmPayment() {
    if (!payModal) return;
    const total = payEntries.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    if (total <= 0) { alert('Enter at least one payment amount.'); return; }
    for (const e of payEntries) {
      if (e.method === 'Online' && !e.mode) { alert('Select a payment mode for each online entry.'); return; }
    }
    setPaySaving(true);
    try {
      const status: ClientRecord['status'] = total >= payModal.monthlyBilling ? 'Paid' : 'Partial';
      const updated = await api.updateClientRecord(payModal._id, { status, payments: payEntries }) as ClientRecord;
      setBillingRecords(prev => prev.map(r => r._id === payModal._id ? updated : r));
      loadBillingPeriods();
      setPayModal(null);
    } catch (e: unknown) {
      alert(`Payment failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    setPaySaving(false);
  }

  // ── Run-billing review modal ───────────────────────────────────
  type SvcEntry  = { name: string; amount: string; included: boolean; };
  type RunEntry  = { clientId: string; name: string; manager: string; initials: string; colorKey: string; included: boolean; services: SvcEntry[]; };
  const [showRunModal, setShowRunModal] = useState(false);
  const [runEntries, setRunEntries]     = useState<RunEntry[]>([]);

  // ── Data loading ──────────────────────────────────────────────
  function loadClients() {
    api.getClients()
      .then(d => { setClients(d as Client[]); setLoaded(true); })
      .catch(() => setLoaded(true));
  }

  function loadBillingPeriods() {
    api.getClientBillingPeriods()
      .then(d => setBillingPeriods(d as ClientBillingPeriod[]))
      .catch(() => {});
  }

  const loadBillingRecords = useCallback((period: string) => {
    setBillingLoaded(false);
    api.getClientRecords(period)
      .then(d => { setBillingRecords(d as ClientRecord[]); setBillingLoaded(true); })
      .catch(() => { setBillingRecords([]); setBillingLoaded(true); });
  }, []);

  useEffect(() => { loadClients(); }, []);

  useEffect(() => {
    api.getServices()
      .then(d => setServiceOptions((d as Service[]).map(s => s.name)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (tab === 'billing') {
      loadBillingPeriods();
      loadBillingRecords(selectedPeriod);
    }
  }, [tab, selectedPeriod, loadBillingRecords]);

  // ── Billing tab helpers ───────────────────────────────────────
  const periodExists    = billingPeriods.some(p => p._id === selectedPeriod);
  const periodSummary   = billingPeriods.find(p => p._id === selectedPeriod);
  const activeClients   = clients.filter(c => c.status === 'Active');
  const pendingRecords  = billingRecords.filter(r => r.status === 'Pending');

  function openRunModal() {
    setRunEntries(activeClients.map(c => {
      // Only include services the client has, and only Monthly ones
      const services: SvcEntry[] = (c.serviceBreakdown?.length
        ? c.serviceBreakdown.filter(s => !s.type || s.type === 'Monthly')
        : (c.service || '').split(' + ').map(s => s.trim()).filter(Boolean)
            .map(name => ({ name, amount: Math.round((c.monthlyBilling || 0) / ((c.service || '').split(' + ').length || 1)), type: 'Monthly' as const }))
      ).map(s => ({ name: s.name, amount: String(s.amount), included: true }));
      return { clientId: c._id, name: c.name, manager: c.manager || '', initials: c.initials, colorKey: c.colorKey, included: services.length > 0, services };
    }));
    setShowRunModal(true);
  }

  async function confirmRunBilling() {
    const selected = runEntries.filter(e => e.included);
    if (!selected.length) { alert('Select at least one client.'); return; }
    setShowRunModal(false);
    setRunningBilling(true);
    try {
      const payload = selected.map(e => {
        const svcs = e.services.filter(s => s.included);
        return {
          clientId: e.clientId, name: e.name,
          service: svcs.map(s => s.name).join(' + ') || '—',
          monthlyBilling: svcs.reduce((sum, s) => sum + (Number(s.amount) || 0), 0),
          manager: e.manager, initials: e.initials, colorKey: e.colorKey,
        };
      });
      const created = await api.runClientBilling(selectedPeriod, payload) as ClientRecord[];
      setBillingRecords(created);
      loadBillingPeriods();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('409')) alert(`Billing for ${fmtPeriod(selectedPeriod)} already exists.`);
      else alert(`Run Billing failed: ${msg}`);
    }
    setRunningBilling(false);
  }

  async function processAll() {
    if (!confirm(`Mark all ${pendingRecords.length} pending clients as Paid for ${fmtPeriod(selectedPeriod)}?`)) return;
    setProcessingAll(true);
    try {
      await api.processClientPeriod(selectedPeriod);
      loadBillingRecords(selectedPeriod);
      loadBillingPeriods();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(`Mark All Paid failed: ${msg}`);
    }
    setProcessingAll(false);
  }

  async function updateRecord(id: string, data: Partial<ClientRecord>) {
    try {
      const updated = await api.updateClientRecord(id, data) as ClientRecord;
      setBillingRecords(prev => prev.map(r => r._id === id ? updated : r));
      loadBillingPeriods();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(`Update failed: ${msg}`);
    }
  }

  async function deletePeriod() {
    if (!confirm(`Delete all billing records for ${fmtPeriod(selectedPeriod)}?`)) return;
    setDeletingPeriod(true);
    try {
      await api.deleteClientBillingPeriod(selectedPeriod);
      setBillingRecords([]);
      loadBillingPeriods();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(`Delete failed: ${msg}`);
    }
    setDeletingPeriod(false);
  }

  async function generateInvoice(r: ClientRecord) {
    if (r.invoiceId) { window.location.href = '/invoices'; return; }
    setGeneratingInvoice(r._id);
    try {
      const client  = clients.find(c => c._id === r.clientId);
      const { number } = await api.getNextInvoiceNumber() as { number: string };
      const today   = new Date();
      const due     = new Date(today);
      due.setDate(due.getDate() + 15);
      const fmtDate = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      const monthlyServices = client?.serviceBreakdown?.filter(s => !s.type || s.type === 'Monthly') ?? [];
      const lineItems = monthlyServices.length > 0
        ? monthlyServices.map(s => ({ description: s.name, qty: 1, unitPrice: s.amount, amount: s.amount }))
        : [{ description: r.service, qty: 1, unitPrice: r.monthlyBilling, amount: r.monthlyBilling }];

      const amount = lineItems.reduce((s, i) => s + i.amount, 0);
      const gst    = Math.round(amount * 0.18);

      const created = await api.createInvoice({
        invoiceNumber: number,
        client:      r.name,
        clientEmail: client?.email ?? '',
        date:        fmtDate(today),
        dueDate:     fmtDate(due),
        lineItems,
        amount,
        gst,
        gstRate: 18,
        total:  amount + gst,
        notes:  `Monthly billing — ${fmtPeriod(r.billingPeriod)}`,
        status: r.status === 'Paid' ? 'Paid' : 'Pending',
      }) as { _id: string };

      await api.updateClientRecord(r._id, { invoiceId: created._id });
      window.location.href = '/invoices';
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(`Failed to generate invoice: ${msg}`);
      setGeneratingInvoice(null);
    }
  }

  // ── Clients tab logic (unchanged) ────────────────────────────
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
    const serviceTypes:  Record<string, 'Monthly' | 'One Time'> = {};
    if (c.serviceBreakdown?.length) {
      c.serviceBreakdown.forEach(i => {
        serviceAmounts[i.name] = String(i.amount);
        serviceTypes[i.name]   = i.type ?? 'Monthly';
      });
    } else if (c.service) {
      c.service.split(' + ').map(s => s.trim()).filter(Boolean).forEach(s => {
        serviceAmounts[s] = '';
        serviceTypes[s]   = 'Monthly';
      });
    }
    setForm({
      name: c.name, email: c.email, manager: c.manager || '',
      renewal: c.renewal || '', status: c.status,
      paymentTerms: 'Net 15', colorKey: c.colorKey, serviceAmounts, serviceTypes,
    });
    setIsOpen(true);
  }

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const initials: string = form.name.trim().split(/\s+/).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
      const serviceBreakdown: ServiceItem[] = Object.entries(form.serviceAmounts)
        .map(([name, amount]) => ({ name, amount: Number(amount) || 0, type: form.serviceTypes[name] ?? 'Monthly' }));
      const monthlyBilling = serviceBreakdown.filter(i => i.type !== 'One Time').reduce((s, i) => s + i.amount, 0);
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

  const totalBilling  = clients.reduce((s, c) => s + c.monthlyBilling, 0);
  const avgBilling    = clients.length > 0 ? Math.round(totalBilling / clients.length) : 0;
  const activeCount   = clients.filter(c => c.status === 'Active').length;
  const retentionPct  = clients.length > 0 ? Math.round((activeCount / clients.length) * 100) : 0;

  return (
    <div>
      <PageHeader title="Client Management">
        {tab === 'clients' ? (<>
          <input
            type="text"
            placeholder="Search clients…"
            className={styles.searchInput}
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
          />
          <button className="btn btn-p" onClick={openAdd}><i className="ti ti-plus" />Add Client</button>
        </>) : tab === 'billing' ? (<>
          {periodExists && pendingRecords.length > 0 && (
            <button className="btn btn-p" onClick={processAll} disabled={processingAll}>
              <i className="ti ti-check" />Mark All Paid ({pendingRecords.length})
            </button>
          )}
          {!periodExists && (
            <button className="btn btn-p" onClick={openRunModal} disabled={runningBilling || activeClients.length === 0}>
              <i className="ti ti-player-play" />
              {runningBilling ? 'Running…' : `Run Billing (${activeClients.length})`}
            </button>
          )}
        </>) : null}
      </PageHeader>

      <div className="content">
        {/* Tabs */}
        <div className={`tabs ${styles.tabsBar}`}>
          <button className={`tab${tab === 'clients' ? ' active' : ''}`} onClick={() => setTab('clients')}>
            <i className={`ti ti-users ${styles.tabIcon}`} />Clients
          </button>
          <button className={`tab${tab === 'billing' ? ' active' : ''}`} onClick={() => setTab('billing')}>
            <i className={`ti ti-refresh ${styles.tabIcon}`} />Monthly Billing
          </button>
          <button className={`tab${tab === 'yearly' ? ' active' : ''}`} onClick={() => setTab('yearly')}>
            <i className={`ti ti-calendar-stats ${styles.tabIcon}`} />Yearly
          </button>
        </div>

        {/* ── CLIENTS TAB ─────────────────────────────────────────── */}
        {tab === 'clients' && (<>
          <div className={`grid4 ${styles.kpiGrid}`}>
            <div className="kpi">
              <div className="kpi-label">Total Clients</div>
              <div className="kpi-value">{clients.length}</div>
              <div className={`kpi-change ${styles.kpiText2}`}>
                {clients.length === 0 ? 'Add your first client' : 'In system'}
              </div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Active</div>
              <div className={`kpi-value ${styles.kpiEmerald}`}>{activeCount}</div>
              <div className={`kpi-change ${styles.kpiText2}`}>
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
              <div className={styles.loadingText}>Loading…</div>
            ) : displayed.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyMsg}>
                  {searchQ ? 'No clients match your search' : 'No clients yet'}
                </div>
                {!searchQ && <button className="btn btn-p" onClick={openAdd}><i className="ti ti-plus" />Add your first client</button>}
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
                          <div className={styles.rowGap9}>
                            <div className="avatar" style={{ background: col.bg, color: col.fg }}>{c.initials}</div>
                            <div>
                              <div className={styles.clientName}>{c.name}</div>
                              <div className={styles.clientEmail}>{c.email}</div>
                            </div>
                          </div>
                        </td>
                        <td>{c.service}</td>
                        <td className={styles.billingAmount}>₹{c.monthlyBilling.toLocaleString('en-IN')}</td>
                        <td>{c.manager || '—'}</td>
                        <td>{c.renewal || '—'}</td>
                        <td><span className={`badge ${statusBadge[c.status]}`}>{c.status}</span></td>
                        <td>
                          <div className={styles.rowEnd}>
                            <button className={`btn ${styles.btnSm}`} title="Edit" onClick={() => openEdit(c)}>
                              <i className={`ti ti-pencil ${styles.btnSmIcon}`} />
                            </button>
                            <button className={`btn ${styles.btnSmDanger}`} title="Delete" onClick={() => setDeleteId(c._id)}>
                              <i className={`ti ti-trash ${styles.btnSmIcon}`} />
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
        </>)}

        {/* ── YEARLY TAB ──────────────────────────────────────────── */}
        {tab === 'yearly' && <ClientsYearly />}

        {/* ── MONTHLY BILLING TAB ──────────────────────────────────── */}
        {tab === 'billing' && (<>
          {/* Period navigator */}
          <div className={styles.periodNav}>
            <button className={`btn ${styles.periodNavBtn}`} onClick={() => setSelectedPeriod(p => shiftMonth(p, -1))}>
              <i className="ti ti-chevron-left" />
            </button>
            <span className={styles.periodLabel}>
              {fmtPeriod(selectedPeriod)}
            </span>
            <button className={`btn ${styles.periodNavBtn}`} onClick={() => setSelectedPeriod(p => shiftMonth(p, 1))}>
              <i className="ti ti-chevron-right" />
            </button>
            {periodExists && (
              <button className={`btn ${styles.periodDeleteBtn}`}
                title="Delete this billing period" onClick={deletePeriod} disabled={deletingPeriod}>
                <i className="ti ti-trash" />
              </button>
            )}
          </div>

          {/* Summary KPIs */}
          {periodSummary && (
            <div className={`grid4 ${styles.billingKpiGrid}`}>
              <div className="kpi">
                <div className="kpi-label">Total Billing</div>
                <div className="kpi-value">{periodSummary.total > 0 ? fmt(periodSummary.total) : '—'}</div>
                <div className={`kpi-change ${styles.kpiText2}`}>{periodSummary.count} clients</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Pending</div>
                <div className={`kpi-value ${styles.kpiPending}`}>{periodSummary.pending > 0 ? fmt(periodSummary.pending) : '—'}</div>
                <div className={`kpi-change ${styles.kpiText2}`}>
                  {periodSummary.count - periodSummary.paidCount} clients
                </div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Collected</div>
                <div className={`kpi-value ${styles.kpiCollected}`}>{periodSummary.paid > 0 ? fmt(periodSummary.paid) : '—'}</div>
                <div className="kpi-change up">{periodSummary.paidCount} clients paid</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Collection Rate</div>
                <div className={`kpi-value ${styles.kpiCollected}`}>
                  {periodSummary.count > 0 ? `${Math.round((periodSummary.paidCount / periodSummary.count) * 100)}%` : '—'}
                </div>
                <div className="kpi-change up">{fmtPeriod(selectedPeriod)}</div>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-title">
              Billing — {fmtPeriod(selectedPeriod)}
              {periodExists && <span className="card-sub">{billingRecords.length} clients</span>}
            </div>

            {!periodExists ? (
              <div className={styles.billingEmpty}>
                <div className={styles.billingEmptyMsg}>
                  No billing records for {fmtPeriod(selectedPeriod)}
                </div>
                {activeClients.length > 0 ? (
                  <button className="btn btn-p" onClick={openRunModal} disabled={runningBilling}>
                    <i className="ti ti-player-play" />
                    {runningBilling ? 'Running…' : `Run Billing for ${fmtPeriod(selectedPeriod)} (${activeClients.length} active clients)`}
                  </button>
                ) : (
                  <div className={styles.noActiveClients}>No active clients. Add clients first.</div>
                )}
              </div>
            ) : !billingLoaded ? (
              <div className={styles.loadingText}>Loading…</div>
            ) : (
              <table>
                <thead>
                  <tr><th>Client</th><th>Monthly Billing</th><th>Received</th><th>Manager</th><th>Status</th><th /></tr>
                </thead>
                <tbody>
                  {billingRecords.map(r => {
                    const col = colorMap[r.colorKey] || colorMap.emerald;
                    return (
                      <tr key={r._id}>
                        <td>
                          <div
                            className={styles.clientCell}
                            onClick={() => setServicePopup(r)}
                            title="View services"
                          >
                            <div className="avatar" style={{ background: col.bg, color: col.fg }}>{r.initials}</div>
                            <div>
                              <div className={styles.clientName}>{r.name}</div>
                              <div className={styles.clientEmail}>{r.service}</div>
                            </div>
                          </div>
                        </td>
                        <td className={styles.billingAmount}>₹{r.monthlyBilling.toLocaleString('en-IN')}</td>
                        <td>
                          {r.payments && r.payments.length > 0 ? (() => {
                            const received = r.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
                            return (
                              <button type="button" onClick={() => setPayDetail(r)} className={styles.receivedBtn}>
                                <span style={{ fontWeight: 700, color: received >= r.monthlyBilling ? 'var(--emerald)' : 'var(--amber)', textDecoration: 'underline dotted' }}>
                                  ₹{received.toLocaleString('en-IN')}
                                </span>
                                <div className={styles.receivedEntries}>
                                  {r.payments.length} entr{r.payments.length === 1 ? 'y' : 'ies'}
                                </div>
                              </button>
                            );
                          })() : <span className={styles.receivedNone}>—</span>}
                        </td>
                        <td className={styles.managerText}>{r.manager || '—'}</td>
                        <td><span className={`badge ${recBadge[r.status]}`}>{r.status}</span></td>
                        <td>
                          <div className={styles.billingActions}>
                            <button
                              className={`btn ${styles.btnInvoice}`}
                              onClick={() => generateInvoice(r)}
                              disabled={generatingInvoice === r._id}
                              title={r.invoiceId ? 'View Invoice' : 'Generate Invoice'}
                            >
                              <i className={`ti ti-file-invoice ${styles.btnInvoiceIcon}`} />
                              {generatingInvoice === r._id ? '…' : r.invoiceId ? 'View Invoice' : 'Invoice'}
                            </button>
                            {(r.status === 'Pending' || r.status === 'Partial') && (
                              <button className={`btn btn-p ${styles.btnPay}`}
                                onClick={() => openPayModal(r)}>
                                <i className={`ti ti-credit-card ${styles.btnInvoiceIcon}`} />
                                {r.status === 'Partial' ? 'Update Payment' : 'Mark Paid'}
                              </button>
                            )}
                            {(r.status === 'Paid' || r.status === 'Partial') && (
                              <button className={`btn ${styles.btnUndo}`}
                                onClick={() => updateRecord(r._id, { status: 'Pending' })}>
                                <i className={`ti ti-arrow-back-up ${styles.btnInvoiceIcon}`} />Undo
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>)}
      </div>

      {/* Client add/edit modal */}
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
        <div className={styles.servicesMb}>
          <label className="form-label">Services</label>
          <div className={styles.servicePillsRow}>
            {serviceOptions.map(svc => {
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
          <div className={styles.servicePricingBox}>
            <div className={styles.servicePricingLabel}>
              Service Pricing
            </div>
            {Object.entries(form.serviceAmounts).map(([svc, amt]) => {
              const svcType = form.serviceTypes[svc] ?? 'Monthly';
              return (
              <div key={svc} className={styles.servicePricingRow}>
                <span className={styles.servicePricingName}>{svc}</span>
                {/* Monthly / One Time toggle */}
                <div className={styles.serviceTypeToggle}>
                  {(['Monthly', 'One Time'] as const).map(t => (
                    <button key={t} type="button"
                      onClick={() => setForm({ ...form, serviceTypes: { ...form.serviceTypes, [svc]: t } })}
                      style={{
                        padding: '2px 7px', fontSize: '10px', borderRadius: '4px', cursor: 'pointer',
                        border: `1px solid ${svcType === t ? 'var(--indigo)' : 'var(--border)'}`,
                        background: svcType === t ? 'var(--indigo-dim)' : 'transparent',
                        color: svcType === t ? 'var(--indigo)' : 'var(--text3)',
                        fontWeight: svcType === t ? 600 : 400,
                      }}
                    >{t}</button>
                  ))}
                </div>
                <div className={styles.servicePricingAmountGroup}>
                  <span className={styles.servicePricingRupee}>₹</span>
                  <input
                    type="number"
                    placeholder="0"
                    value={amt}
                    onChange={e => setForm({ ...form, serviceAmounts: { ...form.serviceAmounts, [svc]: e.target.value } })}
                    className={styles.servicePricingAmountInput}
                  />
                </div>
              </div>
              );
            })}
            <div className={styles.servicePricingTotal}>
              <span className={styles.servicePricingTotalLabel}>Monthly Billing Total</span>
              <span className={styles.servicePricingTotalValue}>
                ₹{Object.entries(form.serviceAmounts)
                    .filter(([svc]) => (form.serviceTypes[svc] ?? 'Monthly') === 'Monthly')
                    .reduce((s, [, v]) => s + (Number(v) || 0), 0)
                    .toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        )}
        <div className="form-row">
          <div><label className="form-label">Account Manager</label><input placeholder="Manager name" value={form.manager} onChange={e => setForm({ ...form, manager: e.target.value })} /></div>
          <div><label className="form-label">Renewal Date</label><input placeholder="e.g. Jun 2026" value={form.renewal} onChange={e => setForm({ ...form, renewal: e.target.value })} /></div>
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

      {/* ── Services popup ── */}
      {servicePopup && (() => {
        const client = clients.find(c => c._id === servicePopup.clientId);
        const col    = colorMap[servicePopup.colorKey] || colorMap.emerald;
        const svcs: { name: string; amount: number }[] =
          client?.serviceBreakdown?.length
            ? client.serviceBreakdown
            : servicePopup.service.split(' + ').map(n => ({ name: n.trim(), amount: 0 }));
        const total = svcs.reduce((s, v) => s + v.amount, 0) || servicePopup.monthlyBilling;
        return (
          <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setServicePopup(null); }}>
            <div className={`modal ${styles.servicesModal}`}>
              <div className="modal-header">
                <div className={styles.servicesModalHeader}>
                  <div className="avatar" style={{ background: col.bg, color: col.fg }}>{servicePopup.initials}</div>
                  <span className="modal-title">{servicePopup.name}</span>
                </div>
                <button className="modal-close" onClick={() => setServicePopup(null)}><i className="ti ti-x" /></button>
              </div>
              <div className="modal-body">
                <div className={styles.sectionLabel}>Active Services</div>
                {svcs.map(s => (
                  <div key={s.name} className={styles.serviceRow}>
                    <span className="badge bi" style={{ fontSize: '12px' }}>{s.name}</span>
                    {s.amount > 0 && <span className={styles.serviceAmount}>₹{s.amount.toLocaleString('en-IN')}</span>}
                  </div>
                ))}
                <div className={styles.servicesTotalRow}>
                  <span className={styles.servicesTotalLabel}>Monthly Total</span>
                  <span className={styles.servicesTotalValue}>₹{total.toLocaleString('en-IN')}</span>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-p" onClick={() => setServicePopup(null)}>Close</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Payment detail popup ── */}
      {payDetail && (() => {
        const col      = colorMap[payDetail.colorKey] || colorMap.emerald;
        const received = (payDetail.payments ?? []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
        const balance  = payDetail.monthlyBilling - received;
        return (
          <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setPayDetail(null); }}>
            <div className={`modal ${styles.payDetailModal}`}>
              <div className="modal-header">
                <div className={styles.payDetailHeaderInner}>
                  <div className="avatar" style={{ background: col.bg, color: col.fg }}>{payDetail.initials}</div>
                  <div>
                    <div className="modal-title">{payDetail.name}</div>
                    <div className={styles.payDetailPeriod}>{fmtPeriod(payDetail.billingPeriod)}</div>
                  </div>
                </div>
                <button className="modal-close" onClick={() => setPayDetail(null)}><i className="ti ti-x" /></button>
              </div>

              <div className="modal-body">
                {/* Summary row */}
                <div className={styles.payDetailSummary}>
                  <div className={styles.payDetailSummaryCard}>
                    <div className={styles.payDetailSummaryLabel}>Billed</div>
                    <div className={styles.payDetailSummaryValue}>₹{payDetail.monthlyBilling.toLocaleString('en-IN')}</div>
                  </div>
                  <div className={styles.payDetailSummaryCard}>
                    <div className={styles.payDetailSummaryLabel}>Received</div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: received >= payDetail.monthlyBilling ? 'var(--emerald)' : 'var(--amber)' }}>₹{received.toLocaleString('en-IN')}</div>
                  </div>
                  {balance > 0 && (
                    <div className={styles.payDetailSummaryCard}>
                      <div className={styles.payDetailSummaryLabel}>Pending</div>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--red)' }}>₹{balance.toLocaleString('en-IN')}</div>
                    </div>
                  )}
                </div>

                {/* Payment entries */}
                <div className={styles.payEntriesSectionLabel}>
                  Payment Entries
                </div>
                <div className={styles.payEntriesList}>
                  {(payDetail.payments ?? []).map((p, i) => (
                    <div key={i} className={styles.payEntryRow}>
                      <div className={styles.payEntryDate}>
                        <div className={styles.payEntryLabel}>Date</div>
                        <div className={styles.payEntryDateValue}>{p.date || '—'}</div>
                      </div>
                      <div className={styles.payEntryAmountCol}>
                        <div className={styles.payEntryLabel}>Amount</div>
                        <div className={styles.payEntryAmountValue}>₹{Number(p.amount).toLocaleString('en-IN')}</div>
                      </div>
                      <div className={styles.payEntryMethodCol}>
                        <div className={styles.payEntryLabel}>{p.method}</div>
                        <div className={styles.payEntryMethodValue}>
                          {p.method === 'Online' ? (p.mode || '—') : (p.receivedFrom ? `From: ${p.receivedFrom}` : 'Cash')}
                        </div>
                      </div>
                      <span className={`badge ${p.method === 'Online' ? 'bi' : 'ba'} ${styles.payEntryBadge}`}>{p.method}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn" onClick={() => { setPayDetail(null); openPayModal(payDetail); }}>
                  <i className="ti ti-pencil" />Edit Payment
                </button>
                <button className="btn btn-p" onClick={() => setPayDetail(null)}>Close</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Payment modal ── */}
      {payModal && (() => {
        const billing = payModal.monthlyBilling;
        const total   = payEntries.reduce((s, e) => s + (Number(e.amount) || 0), 0);
        const balance = billing - total;
        const isOver  = total > billing;
        const isFull  = total === billing;
        return (
          <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setPayModal(null); }}>
            <div className={`modal ${styles.payModal}`}>
              <div className="modal-header">
                <span className="modal-title">Payment — {payModal.name}</span>
                <button className="modal-close" onClick={() => setPayModal(null)}><i className="ti ti-x" /></button>
              </div>

              <div className={`modal-body ${styles.payModalBody}`}>
                {/* Billing context bar */}
                <div className={styles.payContextBar}>
                  <span className={styles.payContextLabel}>Monthly Billing</span>
                  <span className={styles.payContextValue}>₹{billing.toLocaleString('en-IN')}</span>
                </div>

                {/* Payment entries */}
                <div className={styles.payEntriesContainer}>
                  {payEntries.map((entry, i) => (
                    <div key={i} className={styles.payEntryCard}>

                      {/* Row 1: Amount + Online/Offline */}
                      <div className={styles.payEntryCardRow1}>
                        <div className={styles.payEntryAmountGroup}>
                          <span className={styles.payEntryRupeeSign}>₹</span>
                          <input
                            type="number" min={0}
                            value={entry.amount || ''}
                            onChange={e => updateEntry(i, { amount: Number(e.target.value) || 0 })}
                            placeholder="0"
                            style={{ width: '100%', fontWeight: 700, fontSize: '14px' }}
                          />
                        </div>
                        <div className={styles.payMethodToggle}>
                          {(['Online', 'Offline'] as const).map(m => (
                            <button key={m} type="button"
                              onClick={() => updateEntry(i, { method: m, mode: m === 'Online' ? 'UPI' : undefined, receivedFrom: m === 'Offline' ? '' : undefined })}
                              style={{
                                padding: '5px 12px', fontSize: '12px', cursor: 'pointer', border: 'none',
                                background: entry.method === m ? 'var(--indigo)' : 'transparent',
                                color: entry.method === m ? '#fff' : 'var(--text2)',
                                fontWeight: entry.method === m ? 700 : 400,
                              }}>
                              {m}
                            </button>
                          ))}
                        </div>
                        {payEntries.length > 1 && (
                          <button type="button" onClick={() => removeEntry(i)} className={styles.payEntryRemoveBtn}>
                            <i className={`ti ti-x ${styles.payEntryRemoveIcon}`} />
                          </button>
                        )}
                      </div>

                      {/* Date received */}
                      <div className={styles.payDateRow}>
                        <input
                          type="date"
                          value={entry.date || today}
                          onChange={e => updateEntry(i, { date: e.target.value })}
                          className={styles.payDateInput}
                        />
                      </div>

                      {/* Row 2: mode chips (Online) or received-from (Offline) */}
                      {entry.method === 'Online' && (
                        <div className={styles.payModeChips}>
                          {['Bank Transfer', 'UPI', 'NEFT', 'RTGS', 'Cheque'].map(mode => (
                            <button key={mode} type="button" onClick={() => updateEntry(i, { mode })}
                              style={{
                                padding: '4px 11px', fontSize: '11px', borderRadius: '20px', cursor: 'pointer',
                                border: `1px solid ${entry.mode === mode ? 'var(--indigo)' : 'var(--border)'}`,
                                background: entry.mode === mode ? 'var(--indigo-dim)' : 'transparent',
                                color: entry.mode === mode ? 'var(--indigo)' : 'var(--text2)',
                                fontWeight: entry.mode === mode ? 700 : 400,
                              }}>
                              {mode}
                            </button>
                          ))}
                        </div>
                      )}
                      {entry.method === 'Offline' && (
                        <input
                          type="text"
                          placeholder="Received from (e.g. John, front desk)"
                          value={entry.receivedFrom || ''}
                          onChange={e => updateEntry(i, { receivedFrom: e.target.value })}
                          style={{ width: '100%', fontSize: '12px' }}
                        />
                      )}
                    </div>
                  ))}

                  {/* Add entry button */}
                  <button type="button" className={`btn ${styles.addEntryBtn}`} onClick={addEntry}>
                    <i className={`ti ti-plus ${styles.addEntryIcon}`} />Add Payment Entry
                  </button>
                </div>

                {/* Summary bar */}
                <div className={styles.paySummaryBar}>
                  <div className={styles.paySummaryLabel}>
                    Total received: <strong style={{ color: isOver ? 'var(--red)' : isFull ? 'var(--emerald)' : 'var(--amber)' }}>
                      ₹{total.toLocaleString('en-IN')}
                    </strong>
                  </div>
                  {!isFull && !isOver && balance > 0 && (
                    <div className={styles.payPartialMsg}>
                      ₹{balance.toLocaleString('en-IN')} pending → will be marked <strong>Partial</strong>
                    </div>
                  )}
                  {isFull && (
                    <div className={styles.payFullMsg}>
                      <i className={`ti ti-circle-check ${styles.payFullIcon}`} />Full payment
                    </div>
                  )}
                  {isOver && (
                    <div className={styles.payOverMsg}>
                      ₹{(total - billing).toLocaleString('en-IN')} over billing — check amounts
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn" onClick={() => setPayModal(null)}>Cancel</button>
                <button className="btn btn-p" onClick={confirmPayment} disabled={paySaving || total <= 0 || isOver}>
                  <i className="ti ti-check" />
                  {paySaving ? 'Saving…' : isFull ? 'Confirm Paid' : `Confirm Partial (₹${total.toLocaleString('en-IN')})`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Run Billing review modal ── */}
      {showRunModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowRunModal(false); }}>
          <div className={`modal ${styles.runModal}`}>
            <div className="modal-header">
              <span className="modal-title">Review Billing — {fmtPeriod(selectedPeriod)}</span>
              <button className="modal-close" onClick={() => setShowRunModal(false)}><i className="ti ti-x" /></button>
            </div>

            <div className={`modal-body ${styles.runModalBody}`}>
              {runEntries.map((entry, i) => {
                const col        = colorMap[entry.colorKey] || colorMap.emerald;
                const clientTotal = entry.services.filter(s => s.included).reduce((sum, s) => sum + (Number(s.amount) || 0), 0);

                return (
                  <div key={entry.clientId} className={styles.runClientRow} style={{ opacity: entry.included ? 1 : 0.45 }}>

                    {/* Client header */}
                    <div className={entry.included ? styles.runClientHeader : styles.rowGap10}>
                      <input
                        type="checkbox"
                        checked={entry.included}
                        onChange={ev => setRunEntries(prev => prev.map((r, j) => j === i ? { ...r, included: ev.target.checked } : r))}
                        className={styles.runCheckbox}
                      />
                      <div className={`avatar ${styles.runAvatar}`} style={{ background: col.bg, color: col.fg }}>{entry.initials}</div>
                      <span className={styles.runClientName}>{entry.name}</span>
                      {entry.included && (
                        <span className={styles.runClientTotal}>
                          ₹{clientTotal.toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>

                    {/* Service checkbox list */}
                    {entry.included && (
                      <div className={styles.runSvcList}>
                        {entry.services.map((svc, si) => (
                          <div key={svc.name} className={svc.included ? styles.runSvcRowActive : styles.runSvcRow}>
                            <input
                              type="checkbox"
                              checked={svc.included}
                              onChange={ev => setRunEntries(prev => prev.map((r, j) =>
                                j === i ? { ...r, services: r.services.map((s, k) => k === si ? { ...s, included: ev.target.checked } : s) } : r
                              ))}
                              className={styles.runSvcCheckbox}
                            />
                            <span style={{ flex: 1, fontSize: '12px', color: svc.included ? 'var(--text)' : 'var(--text3)', fontWeight: svc.included ? 500 : 400 }}>
                              {svc.name}
                            </span>
                            {svc.included && (<>
                              <span className={styles.runSvcRupee}>₹</span>
                              <input
                                type="number"
                                value={svc.amount}
                                onChange={ev => setRunEntries(prev => prev.map((r, j) =>
                                  j === i ? { ...r, services: r.services.map((s, k) => k === si ? { ...s, amount: ev.target.value } : s) } : r
                                ))}
                                className={styles.runSvcInput}
                                min="0"
                              />
                            </>)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

            </div>

            {/* Footer: total + actions */}
            {(() => {
              const total = runEntries.filter(e => e.included).reduce((sum, e) =>
                sum + e.services.filter(s => s.included).reduce((s2, s) => s2 + (Number(s.amount) || 0), 0), 0);
              const count = runEntries.filter(e => e.included).length;
              return (<>
                <div className={styles.runFooterSummary}>
                  <span className={styles.runFooterCount}>{count} client{count !== 1 ? 's' : ''} selected</span>
                  <span className={styles.runFooterTotal}>Total: ₹{total.toLocaleString('en-IN')}</span>
                </div>
                <div className="modal-footer">
                  <button className="btn" onClick={() => setShowRunModal(false)}>Cancel</button>
                  <button className="btn btn-p" onClick={confirmRunBilling} disabled={count === 0}>
                    <i className="ti ti-player-play" />Run Billing ({count})
                  </button>
                </div>
              </>);
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
