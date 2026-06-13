'use client';
import { useEffect, useState, useCallback } from 'react';
import type { Invoice, GSTFiling, SMTPConfig } from '@/types';
import { api } from '@/lib/api';
import styles from './GST.module.css';

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
            <div className={`kpi-value ${styles.kpiIndigo}`}>{fmt(totalOutputGST)}</div>
            <div className={`kpi-change ${styles.kpiSub}`}>All invoices</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">CGST (Central)</div>
            <div className={`kpi-value ${styles.kpiEmerald}`}>{fmt(totalCGST)}</div>
            <div className={`kpi-change ${styles.kpiSub}`}>Intrastate share</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">SGST (State)</div>
            <div className={`kpi-value ${styles.kpiBlue}`}>{fmt(totalSGST)}</div>
            <div className={`kpi-change ${styles.kpiSub}`}>Intrastate share</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">IGST (Interstate)</div>
            <div className={`kpi-value ${styles.kpiAmber}`}>{fmt(totalIGST)}</div>
            <div className={`kpi-change ${styles.kpiSub}`}>Interstate invoices</div>
          </div>
        </div>

        {/* SMTP panel */}
        {showSmtp && (
          <div className={`card ${styles.smtpCard}`}>
            <div className="card-title">
              Email / SMTP Settings
              <span className={`card-sub ${smtp?.configured ? styles.smtpConfigured : styles.smtpNotConfigured}`}>
                {smtp?.configured ? '● Configured' : '○ Not configured'}
              </span>
            </div>
            <div className={styles.smtpInfo}>
              Used to send GST reminder emails. For Gmail, create an App Password at <strong>myaccount.google.com → Security → App Passwords</strong>.
            </div>
            <div className="form-row">
              <div>
                <label className="form-label">SMTP Host</label>
                <input placeholder="smtp.gmail.com" value={smtpForm.smtpHost}
                  onChange={e => setSmtpForm(f => ({ ...f, smtpHost: e.target.value }))} />
              </div>
              <div className={styles.portField}>
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
            <div className={styles.smtpSaveRow}>
              <button className="btn btn-p" onClick={saveSmtp} disabled={smtpSaving}>
                <i className="ti ti-device-floppy" />{smtpSaving ? 'Saving…' : 'Save Settings'}
              </button>
              {smtpMsg && (
                <span className={smtpMsg.includes('success') ? styles.smtpMsgOk : styles.smtpMsgErr}>
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
            <div className={styles.loadingText}>Loading…</div>
          ) : months.length === 0 ? (
            <div className={styles.emptyText}>
              No invoices yet — add invoices to see monthly GST summary
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Invoices</th>
                  <th>Revenue</th>
                  <th className={styles.thIndigo}>Output GST</th>
                  <th className={styles.thEmerald}>CGST</th>
                  <th className={styles.thBlue}>SGST</th>
                  <th className={styles.thAmber}>IGST</th>
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
                      <td className={styles.periodCell}>{fmtPeriod(m.period)}</td>
                      <td className={styles.countCell}>{m.invoiceCount}</td>
                      <td>{fmt(m.revenue)}</td>
                      <td className={styles.outputGstCell}>{fmt(m.outputGST)}</td>
                      <td className={styles.cgstCell}>{fmt(m.cgst)}</td>
                      <td className={styles.sgstCell}>{fmt(m.sgst)}</td>
                      <td className={styles.igstCell}>{fmt(m.igst)}</td>
                      <td className={styles.dueDateCell}>
                        {m.filing?.dueDate || <span className={styles.dueDateNotSet}>Not set</span>}
                      </td>
                      <td>
                        {hasReminder ? (
                          <span className={`${styles.reminderSet} ${m.filing?.reminderSent ? styles.reminderSent : styles.reminderPending}`}>
                            <i className={`ti ${m.filing?.reminderSent ? 'ti-bell-check' : 'ti-bell'} ${styles.reminderBellIcon}`} />
                            {m.filing!.reminderDays}d prior
                          </span>
                        ) : (
                          <span className={styles.reminderNone}>—</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${st.badge}`}>{st.label}</span>
                        {m.filing?.status === 'Filed' && m.filing.filedAt && (
                          <div className={styles.filedAt}>
                            {m.filing.filedAt}
                          </div>
                        )}
                      </td>
                      <td>
                        <div className={styles.actionsGroup}>
                          <button className={`btn ${styles.btnSettings}`}
                            title="Due date & reminder settings" onClick={() => openSettings(m)}>
                            <i className={`ti ti-settings ${styles.settingsIcon}`} />
                          </button>
                          {m.filing?.status !== 'Filed' ? (
                            <button className={`btn btn-p ${styles.btnMarkFiled}`}
                              onClick={() => openFiledModal(m)}>
                              <i className={`ti ti-check ${styles.checkIcon}`} />Mark Filed
                            </button>
                          ) : (
                            <button className={`btn ${styles.btnRevert}`}
                              title="Revert to Due" onClick={() => m.filing && revertToDue(m.filing)}>
                              <i className={`ti ti-arrow-back-up ${styles.revertIcon}`} />
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
          <div className={`card ${styles.taxSummaryCard}`}>
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
                <span className="sv" style={row.c ? { '--sv-color': row.c, color: 'var(--sv-color)' } as React.CSSProperties : {}}>{row.v}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Filing Settings Modal ── */}
      {settingsModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setSettingsModal(null); }}>
          <div className={`modal ${styles.settingsModalWidth}`}>
            <div className="modal-header">
              <span className="modal-title">Filing Settings — {fmtPeriod(settingsModal.period)}</span>
              <button className="modal-close" onClick={() => setSettingsModal(null)}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body">
              <div className={styles.dueDateSection}>
                <label className="form-label">GSTR-3B Due Date</label>
                <input type="date" value={settingsDueDate} onChange={e => setSettingsDueDate(e.target.value)} />
                <div className={styles.dueDateHint}>
                  Standard deadline: 20th of the following month
                </div>
              </div>

              <div className={styles.reminderSection}>
                <label className={`form-label ${styles.reminderLabel}`}>Email Reminder</label>
                <div className={styles.reminderDaysRow}>
                  <input type="number" min={1} max={30} value={settingsRemDays}
                    onChange={e => setSettingsRemDays(Number(e.target.value))}
                    className={styles.reminderDaysInput} />
                  <span className={styles.reminderDaysText}>days before due date</span>
                </div>
                <input type="email" placeholder="accounts@ganesyx.com" value={settingsRemEmail}
                  onChange={e => setSettingsRemEmail(e.target.value)} />
                {settingsDueDate && settingsRemEmail && (
                  <div className={styles.reminderPreview}>
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
                    <button className={`btn ${styles.btnSendReminder}`}
                      onClick={triggerReminder} disabled={sendingReminder}>
                      <i className={`ti ti-send ${styles.sendIcon}`} />
                      {sendingReminder ? 'Sending…' : reminderSent ? '✓ Sent' : 'Send Test Reminder Now'}
                    </button>
                  ) : (
                    <div className={styles.smtpWarning}>
                      ⚠ SMTP not configured — click &quot;Email Settings&quot; at the top to set up.
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
          <div className={`modal ${styles.filedModalWidth}`}>
            <div className="modal-header">
              <span className="modal-title">Mark as Filed — {fmtPeriod(filedModal.period)}</span>
              <button className="modal-close" onClick={() => setFiledModal(null)}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body">
              <div className={styles.filedDateSection}>
                <label className="form-label">Date Filed with GSTN</label>
                <input type="date" value={filedDate} onChange={e => setFiledDate(e.target.value)} />
              </div>
              <div className={styles.filedSummary}>
                <div className="stat-row" style={{ margin: 0 }}><span className="sk">Output GST</span><span className={`sv ${styles.svIndigo}`}>{fmt(filedModal.outputGST)}</span></div>
                <div className="stat-row" style={{ margin: 0 }}><span className="sk">CGST</span><span className={`sv ${styles.svEmerald}`}>{fmt(filedModal.cgst)}</span></div>
                <div className="stat-row" style={{ margin: 0 }}><span className="sk">SGST</span><span className={`sv ${styles.svBlue}`}>{fmt(filedModal.sgst)}</span></div>
                <div className="stat-row" style={{ margin: 0, borderBottom: 'none' }}><span className="sk">IGST</span><span className={`sv ${styles.svAmber}`}>{fmt(filedModal.igst)}</span></div>
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
