'use client';
import { useEffect, useState, useCallback } from 'react';
import type { Invoice, GSTFiling, SMTPConfig } from '@/types';
import { api } from '@/lib/api';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmt(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

function fmtPeriod(p: string) {
  const [y, m] = p.split('-');
  return `${MONTHS[Number(m) - 1]} ${y}`;
}

function defaultDueDate(period: string) {
  const [y, m] = period.split('-').map(Number);
  const next = m === 12 ? new Date(y + 1, 0, 20) : new Date(y, m, 20);
  return next.toISOString().slice(0, 10);
}

function gstSplit(gst: number, taxType?: string) {
  if (taxType === 'Interstate') return { cgst: 0, sgst: 0, igst: gst };
  const half = Math.floor(gst / 2);
  return { cgst: half, sgst: gst - half, igst: 0 };
}

interface MonthData {
  period: string;
  invoiceCount: number;
  revenue: number;
  outputGST: number;
  cgst: number;
  sgst: number;
  igst: number;
  filing?: GSTFiling;
}

export default function GST() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filings, setFilings]   = useState<GSTFiling[]>([]);
  const [smtp, setSmtp]         = useState<SMTPConfig | null>(null);
  const [loaded, setLoaded]     = useState(false);

  // Filing settings modal
  const [settingsModal, setSettingsModal]       = useState<MonthData | null>(null);
  const [settingsDueDate, setSettingsDueDate]   = useState('');
  const [settingsRemDays, setSettingsRemDays]   = useState(3);
  const [settingsRemEmail, setSettingsRemEmail] = useState('');
  const [settingsSaving, setSettingsSaving]     = useState(false);
  const [reminderSent, setReminderSent]         = useState(false);
  const [sendingReminder, setSendingReminder]   = useState(false);

  // Mark Filed modal
  const [filedModal, setFiledModal]   = useState<MonthData | null>(null);
  const [filedDate, setFiledDate]     = useState('');
  const [filedSaving, setFiledSaving] = useState(false);

  // SMTP panel
  const [showSmtp, setShowSmtp]   = useState(false);
  const [smtpForm, setSmtpForm]   = useState({ smtpHost: '', smtpPort: '587', smtpUser: '', smtpPass: '' });
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpMsg, setSmtpMsg]     = useState('');

  const load = useCallback(() => {
    Promise.all([api.getInvoices(), api.getGSTFilings(), api.getSMTPConfig()])
      .then(([inv, fil, sm]) => {
        setInvoices(inv as Invoice[]);
        setFilings(fil as GSTFiling[]);
        const s = sm as SMTPConfig;
        setSmtp(s);
        setSmtpForm({ smtpHost: s.smtpHost, smtpPort: String(s.smtpPort || 587), smtpUser: s.smtpUser, smtpPass: s.smtpPass || '' });
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Build per-month aggregates from invoices
  const monthMap = new Map<string, { invoiceCount: number; revenue: number; outputGST: number; cgst: number; sgst: number; igst: number }>();
  invoices.forEach(inv => {
    const period = inv.date?.slice(0, 7);
    if (!period) return;
    const e = monthMap.get(period) || { invoiceCount: 0, revenue: 0, outputGST: 0, cgst: 0, sgst: 0, igst: 0 };
    const split = gstSplit(inv.gst || 0, inv.taxType);
    e.invoiceCount += 1;
    e.revenue   += inv.total || 0;
    e.outputGST += inv.gst || 0;
    e.cgst += split.cgst; e.sgst += split.sgst; e.igst += split.igst;
    monthMap.set(period, e);
  });

  const months: MonthData[] = Array.from(monthMap.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([period, data]) => ({ period, ...data, filing: filings.find(f => f.period === period) }));

  const totalOutputGST = months.reduce((s, m) => s + m.outputGST, 0);
  const totalCGST      = months.reduce((s, m) => s + m.cgst, 0);
  const totalSGST      = months.reduce((s, m) => s + m.sgst, 0);
  const totalIGST      = months.reduce((s, m) => s + m.igst, 0);

  function openSettings(m: MonthData) {
    setSettingsModal(m);
    setSettingsDueDate(m.filing?.dueDate || defaultDueDate(m.period));
    setSettingsRemDays(m.filing?.reminderDays ?? 3);
    setSettingsRemEmail(m.filing?.reminderEmail || '');
    setReminderSent(false);
  }

  async function saveSettings() {
    if (!settingsModal) return;
    setSettingsSaving(true);
    try {
      const updated = await api.upsertGSTFiling({
        period:        settingsModal.period,
        dueDate:       settingsDueDate,
        reminderDays:  settingsRemDays,
        reminderEmail: settingsRemEmail,
        status:        settingsModal.filing?.status || 'Due',
      }) as GSTFiling;
      setFilings(prev => {
        const exists = prev.some(f => f.period === settingsModal.period);
        return exists ? prev.map(f => f.period === settingsModal.period ? updated : f) : [...prev, updated];
      });
      setSettingsModal(null);
    } catch { alert('Failed to save settings.'); }
    setSettingsSaving(false);
  }

  async function triggerReminder() {
    if (!settingsModal?.filing) return;
    setSendingReminder(true);
    try {
      await api.sendGSTReminder(settingsModal.filing._id);
      setReminderSent(true);
      setFilings(prev => prev.map(f => f._id === settingsModal.filing!._id ? { ...f, reminderSent: true } : f));
    } catch (e: unknown) {
      alert(`Failed to send: ${e instanceof Error ? e.message : String(e)}`);
    }
    setSendingReminder(false);
  }

  async function openFiledModal(m: MonthData) {
    let filing = m.filing;
    if (!filing) {
      try {
        filing = await api.upsertGSTFiling({
          period: m.period, dueDate: defaultDueDate(m.period),
          reminderDays: 3, reminderEmail: '', status: 'Due',
        }) as GSTFiling;
        setFilings(prev => [...prev, filing!]);
      } catch { alert('Failed to create filing record.'); return; }
    }
    setFiledModal({ ...m, filing });
    setFiledDate(filing.filedAt || new Date().toISOString().slice(0, 10));
  }

  async function confirmMarkFiled() {
    if (!filedModal?.filing) return;
    setFiledSaving(true);
    try {
      const updated = await api.markGSTFiled(filedModal.filing._id, filedDate) as GSTFiling;
      setFilings(prev => prev.map(f => f._id === updated._id ? updated : f));
      setFiledModal(null);
    } catch { alert('Failed to mark as filed.'); }
    setFiledSaving(false);
  }

  async function revertToDue(filing: GSTFiling) {
    if (!confirm(`Revert ${fmtPeriod(filing.period)} filing back to Due?`)) return;
    try {
      const updated = await api.markGSTDue(filing._id) as GSTFiling;
      setFilings(prev => prev.map(f => f._id === updated._id ? updated : f));
    } catch { alert('Failed to revert.'); }
  }

  async function saveSmtp() {
    setSmtpSaving(true); setSmtpMsg('');
    try {
      await api.saveSMTPConfig({ smtpHost: smtpForm.smtpHost, smtpPort: Number(smtpForm.smtpPort), smtpUser: smtpForm.smtpUser, smtpPass: smtpForm.smtpPass });
      const s = await api.getSMTPConfig() as SMTPConfig;
      setSmtp(s); setSmtpMsg('Saved successfully.');
    } catch { setSmtpMsg('Failed to save.'); }
    setSmtpSaving(false);
  }

  function filingStatusBadge(m: MonthData): { label: string; badge: string } {
    if (m.filing?.status === 'Filed') return { label: 'Filed', badge: 'bg' };
    if (!m.filing) return { label: 'Not Set', badge: 'br' };
    const daysLeft = Math.ceil((new Date(m.filing.dueDate).getTime() - Date.now()) / 86400000);
    if (daysLeft < 0)  return { label: 'Overdue', badge: 'br' };
    if (daysLeft <= 3) return { label: `Due in ${daysLeft}d`, badge: 'ba' };
    return { label: 'Due', badge: 'bi' };
  }

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">GST / Tax Summary</div>
        <div className="topbar-right">
          <button className="btn" onClick={() => setShowSmtp(v => !v)}>
            <i className="ti ti-settings" style={{ fontSize: '13px' }} />Email Settings
          </button>
        </div>
      </div>

      <div className="content">

        {/* KPIs */}
        <div className="grid4" style={{ marginBottom: '18px' }}>
          <div className="kpi">
            <div className="kpi-label">Total Output GST</div>
            <div className="kpi-value" style={{ color: 'var(--indigo)' }}>{fmt(totalOutputGST)}</div>
            <div className="kpi-change" style={{ color: 'var(--text2)' }}>All invoices</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">CGST (Central)</div>
            <div className="kpi-value" style={{ color: 'var(--emerald)' }}>{fmt(totalCGST)}</div>
            <div className="kpi-change" style={{ color: 'var(--text2)' }}>Intrastate share</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">SGST (State)</div>
            <div className="kpi-value" style={{ color: 'var(--blue)' }}>{fmt(totalSGST)}</div>
            <div className="kpi-change" style={{ color: 'var(--text2)' }}>Intrastate share</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">IGST (Interstate)</div>
            <div className="kpi-value" style={{ color: 'var(--amber)' }}>{fmt(totalIGST)}</div>
            <div className="kpi-change" style={{ color: 'var(--text2)' }}>Interstate invoices</div>
          </div>
        </div>

        {/* SMTP panel */}
        {showSmtp && (
          <div className="card" style={{ marginBottom: '16px' }}>
            <div className="card-title">
              Email / SMTP Settings
              <span className="card-sub" style={{ color: smtp?.configured ? 'var(--emerald)' : 'var(--red)' }}>
                {smtp?.configured ? '● Configured' : '○ Not configured'}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '12px' }}>
              Used to send GST reminder emails. For Gmail, create an App Password at <strong>myaccount.google.com → Security → App Passwords</strong>.
            </div>
            <div className="form-row">
              <div>
                <label className="form-label">SMTP Host</label>
                <input placeholder="smtp.gmail.com" value={smtpForm.smtpHost}
                  onChange={e => setSmtpForm(f => ({ ...f, smtpHost: e.target.value }))} />
              </div>
              <div style={{ maxWidth: '100px' }}>
                <label className="form-label">Port</label>
                <input type="number" placeholder="587" value={smtpForm.smtpPort}
                  onChange={e => setSmtpForm(f => ({ ...f, smtpPort: e.target.value }))} />
              </div>
            </div>
            <div className="form-row">
              <div>
                <label className="form-label">Username / Email</label>
                <input type="email" placeholder="yourname@gmail.com" value={smtpForm.smtpUser}
                  onChange={e => setSmtpForm(f => ({ ...f, smtpUser: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">Password / App Password</label>
                <input type="password" placeholder="Leave blank to keep existing" value={smtpForm.smtpPass}
                  onChange={e => setSmtpForm(f => ({ ...f, smtpPass: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
              <button className="btn btn-p" onClick={saveSmtp} disabled={smtpSaving}>
                <i className="ti ti-device-floppy" />{smtpSaving ? 'Saving…' : 'Save Settings'}
              </button>
              {smtpMsg && (
                <span style={{ fontSize: '12px', color: smtpMsg.includes('success') ? 'var(--emerald)' : 'var(--red)' }}>
                  {smtpMsg}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Monthly filings table */}
        <div className="card">
          <div className="card-title">
            Monthly GST Filings
            <span className="card-sub">{months.length} period{months.length !== 1 ? 's' : ''}</span>
          </div>

          {!loaded ? (
            <div style={{ fontSize: '12px', color: 'var(--text3)', padding: '12px 0' }}>Loading…</div>
          ) : months.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--text3)', padding: '24px 0', textAlign: 'center' }}>
              No invoices yet — add invoices to see monthly GST summary
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Invoices</th>
                  <th>Revenue</th>
                  <th style={{ color: 'var(--indigo)' }}>Output GST</th>
                  <th style={{ color: 'var(--emerald)' }}>CGST</th>
                  <th style={{ color: 'var(--blue)' }}>SGST</th>
                  <th style={{ color: 'var(--amber)' }}>IGST</th>
                  <th>Due Date</th>
                  <th>Reminder</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {months.map(m => {
                  const st = filingStatusBadge(m);
                  const hasReminder = !!(m.filing?.reminderEmail);
                  return (
                    <tr key={m.period}>
                      <td style={{ fontWeight: 700, color: 'var(--text)' }}>{fmtPeriod(m.period)}</td>
                      <td style={{ color: 'var(--text2)' }}>{m.invoiceCount}</td>
                      <td>{fmt(m.revenue)}</td>
                      <td style={{ fontWeight: 700, color: 'var(--indigo)' }}>{fmt(m.outputGST)}</td>
                      <td style={{ color: 'var(--emerald)' }}>{fmt(m.cgst)}</td>
                      <td style={{ color: 'var(--blue)' }}>{fmt(m.sgst)}</td>
                      <td style={{ color: 'var(--amber)' }}>{fmt(m.igst)}</td>
                      <td style={{ fontSize: '12px', color: 'var(--text2)' }}>
                        {m.filing?.dueDate || <span style={{ color: 'var(--text3)' }}>Not set</span>}
                      </td>
                      <td>
                        {hasReminder ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: m.filing?.reminderSent ? 'var(--emerald)' : 'var(--amber)' }}>
                            <i className={`ti ${m.filing?.reminderSent ? 'ti-bell-check' : 'ti-bell'}`} style={{ fontSize: '13px' }} />
                            {m.filing!.reminderDays}d prior
                          </span>
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--text3)' }}>—</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${st.badge}`}>{st.label}</span>
                        {m.filing?.status === 'Filed' && m.filing.filedAt && (
                          <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '2px' }}>
                            {m.filing.filedAt}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end' }}>
                          <button className="btn" style={{ padding: '4px 9px', fontSize: '11px' }}
                            title="Due date & reminder settings" onClick={() => openSettings(m)}>
                            <i className="ti ti-settings" style={{ fontSize: '12px' }} />
                          </button>
                          {m.filing?.status !== 'Filed' ? (
                            <button className="btn btn-p" style={{ padding: '4px 10px', fontSize: '11px' }}
                              onClick={() => openFiledModal(m)}>
                              <i className="ti ti-check" style={{ fontSize: '11px' }} />Mark Filed
                            </button>
                          ) : (
                            <button className="btn" style={{ padding: '4px 9px', fontSize: '11px', color: 'var(--text3)' }}
                              title="Revert to Due" onClick={() => m.filing && revertToDue(m.filing)}>
                              <i className="ti ti-arrow-back-up" style={{ fontSize: '11px' }} />
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

        {/* Tax summary card */}
        {months.length > 0 && (
          <div className="card" style={{ marginTop: '16px' }}>
            <div className="card-title">Tax Position Summary</div>
            {[
              { k: 'Total Output GST (All Invoices)', v: fmt(totalOutputGST), c: 'var(--indigo)' },
              { k: 'CGST — Central GST',              v: fmt(totalCGST),      c: 'var(--emerald)' },
              { k: 'SGST — State GST',                v: fmt(totalSGST),      c: 'var(--blue)' },
              { k: 'IGST — Integrated GST',           v: fmt(totalIGST),      c: 'var(--amber)' },
              { k: 'Net GST Payable (Output − Input)',v: fmt(totalOutputGST), c: 'var(--red)' },
              { k: 'Input Credit (GST on expenses)',   v: '₹0 — not tracked', c: '' },
            ].map(row => (
              <div key={row.k} className="stat-row">
                <span className="sk">{row.k}</span>
                <span className="sv" style={row.c ? { color: row.c } : {}}>{row.v}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Filing Settings Modal ── */}
      {settingsModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setSettingsModal(null); }}>
          <div className="modal" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <span className="modal-title">Filing Settings — {fmtPeriod(settingsModal.period)}</span>
              <button className="modal-close" onClick={() => setSettingsModal(null)}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '14px' }}>
                <label className="form-label">GSTR-3B Due Date</label>
                <input type="date" value={settingsDueDate} onChange={e => setSettingsDueDate(e.target.value)} />
                <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>
                  Standard deadline: 20th of the following month
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px', marginTop: '4px', marginBottom: '14px' }}>
                <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>Email Reminder</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <input type="number" min={1} max={30} value={settingsRemDays}
                    onChange={e => setSettingsRemDays(Number(e.target.value))}
                    style={{ width: '65px' }} />
                  <span style={{ fontSize: '13px', color: 'var(--text2)' }}>days before due date</span>
                </div>
                <input type="email" placeholder="accounts@ganesyx.com" value={settingsRemEmail}
                  onChange={e => setSettingsRemEmail(e.target.value)} />
                {settingsDueDate && settingsRemEmail && (
                  <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '6px' }}>
                    Reminder will be sent on: <strong>{(() => {
                      const d = new Date(settingsDueDate);
                      d.setDate(d.getDate() - settingsRemDays);
                      return d.toISOString().slice(0, 10);
                    })()}</strong> to <strong>{settingsRemEmail}</strong>
                  </div>
                )}
              </div>

              {settingsModal.filing && settingsRemEmail && (
                <div style={{ marginBottom: '4px' }}>
                  {smtp?.configured ? (
                    <button className="btn" style={{ fontSize: '12px', padding: '5px 12px' }}
                      onClick={triggerReminder} disabled={sendingReminder}>
                      <i className="ti ti-send" style={{ fontSize: '12px' }} />
                      {sendingReminder ? 'Sending…' : reminderSent ? '✓ Sent' : 'Send Test Reminder Now'}
                    </button>
                  ) : (
                    <div style={{ fontSize: '11px', color: 'var(--amber)', padding: '8px 10px', background: '#fffbeb', borderRadius: '6px' }}>
                      ⚠ SMTP not configured — click "Email Settings" at the top to set up.
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setSettingsModal(null)}>Cancel</button>
              <button className="btn btn-p" onClick={saveSettings} disabled={settingsSaving || !settingsDueDate}>
                <i className="ti ti-device-floppy" />{settingsSaving ? 'Saving…' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mark as Filed Modal ── */}
      {filedModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setFiledModal(null); }}>
          <div className="modal" style={{ maxWidth: '360px' }}>
            <div className="modal-header">
              <span className="modal-title">Mark as Filed — {fmtPeriod(filedModal.period)}</span>
              <button className="modal-close" onClick={() => setFiledModal(null)}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '12px' }}>
                <label className="form-label">Date Filed with GSTN</label>
                <input type="date" value={filedDate} onChange={e => setFiledDate(e.target.value)} />
              </div>
              <div style={{ padding: '10px 12px', background: 'var(--surface2)', borderRadius: '8px', fontSize: '12px' }}>
                <div className="stat-row" style={{ margin: 0 }}><span className="sk">Output GST</span><span className="sv" style={{ color: 'var(--indigo)', fontWeight: 700 }}>{fmt(filedModal.outputGST)}</span></div>
                <div className="stat-row" style={{ margin: 0 }}><span className="sk">CGST</span><span className="sv" style={{ color: 'var(--emerald)' }}>{fmt(filedModal.cgst)}</span></div>
                <div className="stat-row" style={{ margin: 0 }}><span className="sk">SGST</span><span className="sv" style={{ color: 'var(--blue)' }}>{fmt(filedModal.sgst)}</span></div>
                <div className="stat-row" style={{ margin: 0, borderBottom: 'none' }}><span className="sk">IGST</span><span className="sv" style={{ color: 'var(--amber)' }}>{fmt(filedModal.igst)}</span></div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setFiledModal(null)}>Cancel</button>
              <button className="btn btn-p" onClick={confirmMarkFiled} disabled={filedSaving || !filedDate}>
                <i className="ti ti-check" />{filedSaving ? 'Saving…' : 'Confirm Filed'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
