'use client';
import { useEffect, useState, useCallback } from 'react';
import type { Invoice, TDSFiling, SMTPConfig } from '@/types';
import { api } from '@/lib/api';

function fmt(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

function dateToQuarter(dateStr: string): string {
  const [y, m] = dateStr.split('-').map(Number);
  if (m >= 4  && m <= 6)  return `FY${y}-Q1`;
  if (m >= 7  && m <= 9)  return `FY${y}-Q2`;
  if (m >= 10 && m <= 12) return `FY${y}-Q3`;
  return `FY${y - 1}-Q4`;
}

function quarterLabel(q: string) {
  const fy = parseInt(q.slice(2, 6));
  const n  = parseInt(q.slice(-1));
  const ranges: Record<number, string> = { 1: 'Apr–Jun', 2: 'Jul–Sep', 3: 'Oct–Dec', 4: 'Jan–Mar' };
  const year = n === 4 ? fy + 1 : fy;
  return `${ranges[n]} ${year}  (FY${String(fy).slice(2)}-${String(fy + 1).slice(2)} Q${n})`;
}

function defaultDueDate(q: string): string {
  const fy = parseInt(q.slice(2, 6));
  const n  = parseInt(q.slice(-1));
  const map: Record<number, string> = {
    1: `${fy}-07-31`,
    2: `${fy}-10-31`,
    3: `${fy + 1}-01-31`,
    4: `${fy + 1}-05-31`,
  };
  return map[n];
}

function tdsSplit(inv: Invoice) {
  const amt = inv.tdsAmount || 0;
  const sec = inv.tdsSection || 'None';
  return {
    tds194J:  sec === '194J' ? amt : 0,
    tds194C:  sec === '194C' ? amt : 0,
    tdsOther: sec !== '194J' && sec !== '194C' && sec !== 'None' ? amt : 0,
  };
}

interface QuarterData {
  quarter: string;
  invoiceCount: number;
  grossAmount: number;
  tdsTotal: number;
  tds194J: number;
  tds194C: number;
  tdsOther: number;
  filing?: TDSFiling;
}

export default function TDS() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filings, setFilings]   = useState<TDSFiling[]>([]);
  const [smtp, setSmtp]         = useState<SMTPConfig | null>(null);
  const [loaded, setLoaded]     = useState(false);

  const [settingsModal, setSettingsModal]       = useState<QuarterData | null>(null);
  const [settingsDueDate, setSettingsDueDate]   = useState('');
  const [settingsRemDays, setSettingsRemDays]   = useState(3);
  const [settingsRemEmail, setSettingsRemEmail] = useState('');
  const [settingsSaving, setSettingsSaving]     = useState(false);
  const [reminderSent, setReminderSent]         = useState(false);
  const [sendingReminder, setSendingReminder]   = useState(false);

  const [receivedModal, setReceivedModal]   = useState<QuarterData | null>(null);
  const [receivedDate, setReceivedDate]     = useState('');
  const [receivedSaving, setReceivedSaving] = useState(false);

  const [showSmtp, setShowSmtp]     = useState(false);
  const [smtpForm, setSmtpForm]     = useState({ smtpHost: '', smtpPort: '587', smtpUser: '', smtpPass: '' });
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpMsg, setSmtpMsg]       = useState('');

  const load = useCallback(() => {
    Promise.all([api.getInvoices(), api.getTDSFilings(), api.getSMTPConfig()])
      .then(([inv, fil, sm]) => {
        setInvoices(inv as Invoice[]);
        setFilings(fil as TDSFiling[]);
        const s = sm as SMTPConfig;
        setSmtp(s);
        setSmtpForm({ smtpHost: s.smtpHost, smtpPort: String(s.smtpPort || 587), smtpUser: s.smtpUser, smtpPass: s.smtpPass || '' });
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  useEffect(() => { load(); }, [load]);

  const quarterMap = new Map<string, { invoiceCount: number; grossAmount: number; tdsTotal: number; tds194J: number; tds194C: number; tdsOther: number }>();
  invoices.forEach(inv => {
    if (!inv.date) return;
    const q = dateToQuarter(inv.date);
    const e = quarterMap.get(q) || { invoiceCount: 0, grossAmount: 0, tdsTotal: 0, tds194J: 0, tds194C: 0, tdsOther: 0 };
    const split = tdsSplit(inv);
    e.invoiceCount += 1;
    e.grossAmount += inv.amount || 0;
    e.tdsTotal += inv.tdsAmount || 0;
    e.tds194J  += split.tds194J;
    e.tds194C  += split.tds194C;
    e.tdsOther += split.tdsOther;
    quarterMap.set(q, e);
  });

  const quarters: QuarterData[] = Array.from(quarterMap.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([quarter, data]) => ({ quarter, ...data, filing: filings.find(f => f.quarter === quarter) }));

  const totalTDS   = quarters.reduce((s, q) => s + q.tdsTotal, 0);
  const total194J  = quarters.reduce((s, q) => s + q.tds194J, 0);
  const total194C  = quarters.reduce((s, q) => s + q.tds194C, 0);
  const totalOther = quarters.reduce((s, q) => s + q.tdsOther, 0);

  function openSettings(q: QuarterData) {
    setSettingsModal(q);
    setSettingsDueDate(q.filing?.dueDate || defaultDueDate(q.quarter));
    setSettingsRemDays(q.filing?.reminderDays ?? 3);
    setSettingsRemEmail(q.filing?.reminderEmail || '');
    setReminderSent(false);
  }

  async function saveSettings() {
    if (!settingsModal) return;
    setSettingsSaving(true);
    try {
      const updated = await api.upsertTDSFiling({
        quarter:       settingsModal.quarter,
        dueDate:       settingsDueDate,
        reminderDays:  settingsRemDays,
        reminderEmail: settingsRemEmail,
        status:        settingsModal.filing?.status || 'Pending',
      }) as TDSFiling;
      setFilings(prev => {
        const exists = prev.some(f => f.quarter === settingsModal.quarter);
        return exists ? prev.map(f => f.quarter === settingsModal.quarter ? updated : f) : [...prev, updated];
      });
      setSettingsModal(null);
    } catch { alert('Failed to save settings.'); }
    setSettingsSaving(false);
  }

  async function triggerReminder() {
    if (!settingsModal?.filing) return;
    setSendingReminder(true);
    try {
      await api.sendTDSReminder(settingsModal.filing._id);
      setReminderSent(true);
      setFilings(prev => prev.map(f => f._id === settingsModal.filing!._id ? { ...f, reminderSent: true } : f));
    } catch (e: unknown) {
      alert(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    setSendingReminder(false);
  }

  async function openReceivedModal(q: QuarterData) {
    let filing = q.filing;
    if (!filing) {
      try {
        filing = await api.upsertTDSFiling({
          quarter: q.quarter, dueDate: defaultDueDate(q.quarter),
          reminderDays: 3, reminderEmail: '', status: 'Pending',
        }) as TDSFiling;
        setFilings(prev => [...prev, filing!]);
      } catch { alert('Failed to create filing record.'); return; }
    }
    setReceivedModal({ ...q, filing });
    setReceivedDate(filing.receivedAt || new Date().toISOString().slice(0, 10));
  }

  async function confirmMarkReceived() {
    if (!receivedModal?.filing) return;
    setReceivedSaving(true);
    try {
      const updated = await api.markTDSReceived(receivedModal.filing._id, receivedDate) as TDSFiling;
      setFilings(prev => prev.map(f => f._id === updated._id ? updated : f));
      setReceivedModal(null);
    } catch { alert('Failed to mark as received.'); }
    setReceivedSaving(false);
  }

  async function revertToPending(filing: TDSFiling) {
    if (!confirm(`Revert ${quarterLabel(filing.quarter)} back to Pending?`)) return;
    try {
      const updated = await api.markTDSPending(filing._id) as TDSFiling;
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

  function statusBadge(q: QuarterData): { label: string; badge: string } {
    if (q.filing?.status === 'Received') return { label: 'Received', badge: 'bg' };
    if (!q.filing) return { label: 'Not Set', badge: 'br' };
    const daysLeft = Math.ceil((new Date(q.filing.dueDate).getTime() - Date.now()) / 86400000);
    if (daysLeft < 0)  return { label: 'Overdue', badge: 'br' };
    if (daysLeft <= 3) return { label: `Due in ${daysLeft}d`, badge: 'ba' };
    return { label: 'Pending', badge: 'bi' };
  }

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">TDS Summary</div>
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
            <div className="kpi-label">Total TDS Receivable</div>
            <div className="kpi-value" style={{ color: 'var(--amber)' }}>{fmt(totalTDS)}</div>
            <div className="kpi-change" style={{ color: 'var(--text2)' }}>All invoices</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">TDS u/s 194J</div>
            <div className="kpi-value" style={{ color: 'var(--indigo)' }}>{fmt(total194J)}</div>
            <div className="kpi-change" style={{ color: 'var(--text2)' }}>Professional services</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">TDS u/s 194C</div>
            <div className="kpi-value" style={{ color: 'var(--blue)' }}>{fmt(total194C)}</div>
            <div className="kpi-change" style={{ color: 'var(--text2)' }}>Contractor</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">TDS — Other Sections</div>
            <div className="kpi-value" style={{ color: 'var(--emerald)' }}>{fmt(totalOther)}</div>
            <div className="kpi-change" style={{ color: 'var(--text2)' }}>194H / 194I / etc.</div>
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
              Used to send TDS reminder emails. Shared with GST settings.
            </div>
            <div className="form-row">
              <div><label className="form-label">SMTP Host</label>
                <input placeholder="smtp.gmail.com" value={smtpForm.smtpHost} onChange={e => setSmtpForm(f => ({ ...f, smtpHost: e.target.value }))} /></div>
              <div style={{ maxWidth: '100px' }}><label className="form-label">Port</label>
                <input type="number" placeholder="587" value={smtpForm.smtpPort} onChange={e => setSmtpForm(f => ({ ...f, smtpPort: e.target.value }))} /></div>
            </div>
            <div className="form-row">
              <div><label className="form-label">Username / Email</label>
                <input type="email" placeholder="yourname@gmail.com" value={smtpForm.smtpUser} onChange={e => setSmtpForm(f => ({ ...f, smtpUser: e.target.value }))} /></div>
              <div><label className="form-label">Password / App Password</label>
                <input type="password" placeholder="Leave blank to keep existing" value={smtpForm.smtpPass} onChange={e => setSmtpForm(f => ({ ...f, smtpPass: e.target.value }))} /></div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
              <button className="btn btn-p" onClick={saveSmtp} disabled={smtpSaving}>
                <i className="ti ti-device-floppy" />{smtpSaving ? 'Saving…' : 'Save Settings'}
              </button>
              {smtpMsg && <span style={{ fontSize: '12px', color: smtpMsg.includes('success') ? 'var(--emerald)' : 'var(--red)' }}>{smtpMsg}</span>}
            </div>
          </div>
        )}

        {/* Quarterly table */}
        <div className="card">
          <div className="card-title">
            Quarterly TDS Summary
            <span className="card-sub">{quarters.length} quarter{quarters.length !== 1 ? 's' : ''}</span>
          </div>
          {!loaded ? (
            <div style={{ fontSize: '12px', color: 'var(--text3)', padding: '12px 0' }}>Loading…</div>
          ) : quarters.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--text3)', padding: '24px 0', textAlign: 'center' }}>
              No invoices yet — add invoices with TDS deducted to see quarterly summary here
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Quarter</th>
                  <th>Invoices</th>
                  <th>Gross Amount</th>
                  <th style={{ color: 'var(--amber)' }}>TDS Total</th>
                  <th style={{ color: 'var(--indigo)' }}>194J</th>
                  <th style={{ color: 'var(--blue)' }}>194C</th>
                  <th style={{ color: 'var(--emerald)' }}>Others</th>
                  <th>Due Date</th>
                  <th>Reminder</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {quarters.map(q => {
                  const st = statusBadge(q);
                  return (
                    <tr key={q.quarter}>
                      <td style={{ fontWeight: 700, color: 'var(--text)', fontSize: '12px' }}>{quarterLabel(q.quarter)}</td>
                      <td style={{ color: 'var(--text2)' }}>{q.invoiceCount}</td>
                      <td>{fmt(q.grossAmount)}</td>
                      <td style={{ fontWeight: 700, color: 'var(--amber)' }}>{fmt(q.tdsTotal)}</td>
                      <td style={{ color: 'var(--indigo)' }}>{fmt(q.tds194J)}</td>
                      <td style={{ color: 'var(--blue)' }}>{fmt(q.tds194C)}</td>
                      <td style={{ color: 'var(--emerald)' }}>{fmt(q.tdsOther)}</td>
                      <td style={{ fontSize: '12px', color: 'var(--text2)' }}>
                        {q.filing?.dueDate || <span style={{ color: 'var(--text3)' }}>Not set</span>}
                      </td>
                      <td>
                        {q.filing?.reminderEmail ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: q.filing?.reminderSent ? 'var(--emerald)' : 'var(--amber)' }}>
                            <i className={`ti ${q.filing?.reminderSent ? 'ti-bell-check' : 'ti-bell'}`} style={{ fontSize: '13px' }} />
                            {q.filing!.reminderDays}d prior
                          </span>
                        ) : <span style={{ fontSize: '11px', color: 'var(--text3)' }}>—</span>}
                      </td>
                      <td>
                        <span className={`badge ${st.badge}`}>{st.label}</span>
                        {q.filing?.status === 'Received' && q.filing.receivedAt && (
                          <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '2px' }}>{q.filing.receivedAt}</div>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end' }}>
                          <button className="btn" style={{ padding: '4px 9px', fontSize: '11px' }}
                            title="Due date & reminder settings" onClick={() => openSettings(q)}>
                            <i className="ti ti-settings" style={{ fontSize: '12px' }} />
                          </button>
                          {q.filing?.status !== 'Received' ? (
                            <button className="btn btn-p" style={{ padding: '4px 10px', fontSize: '11px' }}
                              onClick={() => openReceivedModal(q)}>
                              <i className="ti ti-check" style={{ fontSize: '11px' }} />Received
                            </button>
                          ) : (
                            <button className="btn" style={{ padding: '4px 9px', fontSize: '11px', color: 'var(--text3)' }}
                              title="Revert to Pending" onClick={() => q.filing && revertToPending(q.filing)}>
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

        {/* TDS position summary */}
        {quarters.length > 0 && (
          <div className="card" style={{ marginTop: '16px' }}>
            <div className="card-title">TDS Position Summary</div>
            {[
              { k: 'Total TDS Receivable (All Quarters)',   v: fmt(totalTDS),   c: 'var(--amber)' },
              { k: 'TDS u/s 194J — Professional Services',  v: fmt(total194J),  c: 'var(--indigo)' },
              { k: 'TDS u/s 194C — Contractor Payments',   v: fmt(total194C),  c: 'var(--blue)' },
              { k: 'TDS u/s 194H / 194I / Others',         v: fmt(totalOther), c: 'var(--emerald)' },
              { k: 'Certificates Received (Quarters)',
                v: `${filings.filter(f => f.status === 'Received').length} / ${quarters.length}`, c: '' },
              { k: 'TDS Credit (verify via Form 26AS)', v: 'Check TRACES portal', c: '' },
            ].map(row => (
              <div key={row.k} className="stat-row">
                <span className="sk">{row.k}</span>
                <span className="sv" style={row.c ? { color: row.c } : {}}>{row.v}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {settingsModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setSettingsModal(null); }}>
          <div className="modal" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <span className="modal-title">TDS Settings — {quarterLabel(settingsModal.quarter)}</span>
              <button className="modal-close" onClick={() => setSettingsModal(null)}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '14px' }}>
                <label className="form-label">Certificate Due Date</label>
                <input type="date" value={settingsDueDate} onChange={e => setSettingsDueDate(e.target.value)} />
                <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>
                  Deadline for clients to issue Form 16A TDS certificate
                </div>
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px', marginBottom: '14px' }}>
                <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>Email Reminder</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <input type="number" min={1} max={30} value={settingsRemDays}
                    onChange={e => setSettingsRemDays(Number(e.target.value))} style={{ width: '65px' }} />
                  <span style={{ fontSize: '13px', color: 'var(--text2)' }}>days before due date</span>
                </div>
                <input type="email" placeholder="accounts@ganesyx.com" value={settingsRemEmail}
                  onChange={e => setSettingsRemEmail(e.target.value)} />
                {settingsDueDate && settingsRemEmail && (
                  <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '6px' }}>
                    Reminder on: <strong>{(() => {
                      const d = new Date(settingsDueDate);
                      d.setDate(d.getDate() - settingsRemDays);
                      return d.toISOString().slice(0, 10);
                    })()}</strong> → <strong>{settingsRemEmail}</strong>
                  </div>
                )}
              </div>
              {settingsModal.filing && settingsRemEmail && (
                smtp?.configured ? (
                  <button className="btn" style={{ fontSize: '12px', padding: '5px 12px' }}
                    onClick={triggerReminder} disabled={sendingReminder}>
                    <i className="ti ti-send" style={{ fontSize: '12px' }} />
                    {sendingReminder ? 'Sending…' : reminderSent ? '✓ Sent' : 'Send Test Reminder Now'}
                  </button>
                ) : (
                  <div style={{ fontSize: '11px', color: 'var(--amber)', padding: '8px 10px', background: '#fffbeb', borderRadius: '6px' }}>
                    ⚠ SMTP not configured — click &quot;Email Settings&quot; to set up.
                  </div>
                )
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

      {/* Mark Received Modal */}
      {receivedModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setReceivedModal(null); }}>
          <div className="modal" style={{ maxWidth: '360px' }}>
            <div className="modal-header">
              <span className="modal-title">Mark Received — {quarterLabel(receivedModal.quarter)}</span>
              <button className="modal-close" onClick={() => setReceivedModal(null)}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '12px' }}>
                <label className="form-label">Date Received (Form 16A)</label>
                <input type="date" value={receivedDate} onChange={e => setReceivedDate(e.target.value)} />
              </div>
              <div style={{ padding: '10px 12px', background: 'var(--surface2)', borderRadius: '8px', fontSize: '12px' }}>
                <div className="stat-row" style={{ margin: 0 }}>
                  <span className="sk">TDS Total</span>
                  <span className="sv" style={{ color: 'var(--amber)', fontWeight: 700 }}>{fmt(receivedModal.tdsTotal)}</span>
                </div>
                <div className="stat-row" style={{ margin: 0 }}>
                  <span className="sk">194J</span>
                  <span className="sv" style={{ color: 'var(--indigo)' }}>{fmt(receivedModal.tds194J)}</span>
                </div>
                <div className="stat-row" style={{ margin: 0 }}>
                  <span className="sk">194C</span>
                  <span className="sv" style={{ color: 'var(--blue)' }}>{fmt(receivedModal.tds194C)}</span>
                </div>
                <div className="stat-row" style={{ margin: 0, borderBottom: 'none' }}>
                  <span className="sk">Others</span>
                  <span className="sv" style={{ color: 'var(--emerald)' }}>{fmt(receivedModal.tdsOther)}</span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setReceivedModal(null)}>Cancel</button>
              <button className="btn btn-p" onClick={confirmMarkReceived} disabled={receivedSaving || !receivedDate}>
                <i className="ti ti-check" />{receivedSaving ? 'Saving…' : 'Confirm Received'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
