'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type { Employee, ColorKey, SalaryRecord, PayPeriodSummary, EmployeeTrend, SalaryAnalytics } from '@/types';
import { api } from '@/lib/api';

const DeptPayrollChart = dynamic(() => import('@/components/charts/DeptPayrollChart'), { ssr: false });

const COLOR_KEYS: ColorKey[] = ['emerald', 'indigo', 'blue', 'amber', 'red'];
const DEPARTMENTS = ['Account Mgmt', 'Performance', 'Web Dev', 'Content', 'SEO', 'Design', 'Operations', 'HR', 'Finance'];

const colorMap: Record<string, { bg: string; fg: string }> = {
  emerald: { bg: 'var(--emerald-dim)', fg: 'var(--emerald)' },
  indigo:  { bg: 'var(--indigo-dim)',  fg: 'var(--indigo)' },
  blue:    { bg: 'var(--blue-dim)',    fg: 'var(--blue)' },
  amber:   { bg: 'var(--amber-dim)',   fg: 'var(--amber)' },
  red:     { bg: 'var(--red-dim)',     fg: 'var(--red)' },
};

function mkInitials(name: string) {
  return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function fmt(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

const emptyForm = {
  name: '', department: DEPARTMENTS[0], baseSalary: '', incentives: '0',
  deductions: '0', status: 'Pending' as 'Paid' | 'Pending', colorKey: 'emerald' as ColorKey,
};

type FormState = typeof emptyForm;

// ── helpers ──────────────────────────────────────────────────────────────────

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function periodLabel(p: string) {
  const [y, m] = p.split('-');
  return `${MONTHS[parseInt(m, 10) - 1]} ${y}`;
}

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ── component ────────────────────────────────────────────────────────────────

export default function Payroll() {
  const [tab, setTab] = useState<'employees' | 'history' | 'analytics'>('employees');

  // ── employees tab ──
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // ── history tab ──
  const [periods, setPeriods] = useState<PayPeriodSummary[]>([]);
  const [periodsLoaded, setPeriodsLoaded] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [records, setRecords] = useState<SalaryRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [showRunModal, setShowRunModal] = useState(false);
  const [runPeriod, setRunPeriod] = useState(currentPeriod);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState('');
  const [markingAll, setMarkingAll] = useState(false);
  const [deletingPeriod, setDeletingPeriod] = useState(false);

  // ── analytics tab ──
  const [analytics, setAnalytics] = useState<SalaryAnalytics | null>(null);
  const [analyticsLoaded, setAnalyticsLoaded] = useState(false);
  const [totalRevenue, setTotalRevenue] = useState(0);

  function load() {
    api.getEmployees().then((d) => { setEmployees(d as Employee[]); setLoaded(true); }).catch(() => setLoaded(true));
  }

  function loadPeriods() {
    api.getSalaryPeriods().then((d) => { setPeriods(d as PayPeriodSummary[]); setPeriodsLoaded(true); }).catch(() => setPeriodsLoaded(true));
  }

  function loadRecords(period: string) {
    if (!period) return;
    setRecordsLoading(true);
    api.getSalaryRecords(period)
      .then((d) => { setRecords(d as SalaryRecord[]); })
      .catch(() => {})
      .finally(() => setRecordsLoading(false));
  }

  function loadAnalytics() {
    api.getSalaryAnalytics()
      .then((d) => { setAnalytics(d as SalaryAnalytics); setAnalyticsLoaded(true); })
      .catch(() => setAnalyticsLoaded(true));
    api.getInvoices()
      .then((inv: unknown) => {
        const invoices = inv as Array<{ total: number; status: string }>;
        setTotalRevenue(invoices.filter(i => i.status === 'Paid').reduce((s, i) => s + (i.total || 0), 0));
      })
      .catch(() => {});
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { if (tab === 'history') loadPeriods(); }, [tab]);
  useEffect(() => { if (tab === 'analytics') loadAnalytics(); }, [tab]);
  useEffect(() => { loadRecords(selectedPeriod); }, [selectedPeriod]);

  const base = Number(form.baseSalary) || 0;
  const inc  = Number(form.incentives) || 0;
  const ded  = Number(form.deductions) || 0;
  const computedFinal = base + inc - ded;

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(emp: Employee) {
    setEditing(emp);
    setForm({
      name: emp.name, department: emp.department,
      baseSalary: String(emp.baseSalary), incentives: String(emp.incentives),
      deductions: String(emp.deductions), status: emp.status, colorKey: emp.colorKey,
    });
    setShowModal(true);
  }

  async function save() {
    if (!form.name.trim() || !form.baseSalary) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(), department: form.department,
      baseSalary: base, incentives: inc, deductions: ded, finalSalary: computedFinal,
      status: form.status, colorKey: form.colorKey, initials: mkInitials(form.name),
    };
    try {
      if (editing) {
        await api.updateEmployee(editing._id, payload);
      } else {
        await api.createEmployee(payload);
      }
      load();
      setShowModal(false);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await api.deleteEmployee(deleteId).catch(() => {});
    setDeleteId(null);
    load();
  }

  async function toggleStatus(emp: Employee) {
    const next = emp.status === 'Paid' ? 'Pending' : 'Paid';
    await api.updateEmployee(emp._id, { ...emp, status: next }).catch(() => {});
    load();
  }

  async function processPayroll() {
    const pending = employees.filter(e => e.status === 'Pending');
    if (!pending.length) return;
    setProcessing(true);
    await Promise.all(pending.map(e => api.updateEmployee(e._id, { ...e, status: 'Paid' }).catch(() => {})));
    setProcessing(false);
    load();
  }

  async function runPayroll() {
    setRunning(true);
    setRunError('');
    try {
      await api.runPayroll(runPeriod);
      setShowRunModal(false);
      loadPeriods();
      setSelectedPeriod(runPeriod);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed';
      setRunError(msg.includes('409') || msg.includes('already') ? `Payroll for ${periodLabel(runPeriod)} already exists` : msg);
    } finally {
      setRunning(false);
    }
  }

  async function toggleRecord(rec: SalaryRecord) {
    const next = rec.status === 'Paid' ? 'Pending' : 'Paid';
    await api.updateSalaryRecord(rec._id, { status: next }).catch(() => {});
    loadRecords(selectedPeriod);
    loadPeriods();
  }

  async function markAllPaid() {
    if (!selectedPeriod) return;
    setMarkingAll(true);
    await api.processPeriod(selectedPeriod).catch(() => {});
    setMarkingAll(false);
    loadRecords(selectedPeriod);
    loadPeriods();
  }

  async function deletePeriod() {
    if (!selectedPeriod) return;
    setDeletingPeriod(true);
    await api.deleteSalaryPeriod(selectedPeriod).catch(() => {});
    setDeletingPeriod(false);
    setSelectedPeriod('');
    setRecords([]);
    loadPeriods();
  }

  const totalPayroll    = employees.reduce((s, e) => s + e.finalSalary, 0);
  const totalPaid       = employees.filter(e => e.status === 'Paid').reduce((s, e) => s + e.finalSalary, 0);
  const totalPending    = employees.filter(e => e.status === 'Pending').reduce((s, e) => s + e.finalSalary, 0);
  const totalIncentives = employees.reduce((s, e) => s + e.incentives, 0);
  const pendingCount    = employees.filter(e => e.status === 'Pending').length;

  const selPeriodData = periods.find(p => p._id === selectedPeriod);
  const recPendingCount = records.filter(r => r.status === 'Pending').length;

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Payroll Management</div>
        <div className="topbar-right">
          {tab === 'employees' && pendingCount > 0 && (
            <button className="btn" onClick={processPayroll} disabled={processing}>
              <i className="ti ti-send" />{processing ? 'Processing…' : `Process Payroll (${pendingCount})`}
            </button>
          )}
          {tab === 'employees' && (
            <button className="btn btn-p" onClick={openAdd}>
              <i className="ti ti-plus" />Add Employee
            </button>
          )}
          {tab === 'history' && (
            <button className="btn btn-p" onClick={() => { setRunPeriod(currentPeriod()); setRunError(''); setShowRunModal(true); }}>
              <i className="ti ti-calendar-plus" />Run Payroll
            </button>
          )}
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg)', padding: '0 24px', display: 'flex', gap: '0' }}>
        {([
            ['employees', 'Employees'],
            ['history', 'Payroll History'],
            ['analytics', 'Analytics'],
          ] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '12px 20px', fontSize: '13px', fontWeight: tab === t ? 700 : 400,
            color: tab === t ? 'var(--indigo)' : 'var(--text2)', background: 'none', border: 'none',
            borderBottom: tab === t ? '2px solid var(--indigo)' : '2px solid transparent',
            cursor: 'pointer',
          }}>
            {label}
          </button>
        ))}
      </div>

      <div className="content">
        {tab === 'employees' && (<>
        <div className="grid4" style={{ marginBottom: '18px' }}>
          <div className="kpi">
            <div className="kpi-label">Total Payroll</div>
            <div className="kpi-value">{fmt(totalPayroll)}</div>
            <div className="kpi-change" style={{ color: 'var(--text2)' }}>{employees.length} employee{employees.length === 1 ? '' : 's'}</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Disbursed</div>
            <div className="kpi-value" style={{ color: 'var(--emerald)' }}>{fmt(totalPaid)}</div>
            <div className="kpi-change up">{employees.filter(e => e.status === 'Paid').length} paid</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Pending Payout</div>
            <div className="kpi-value" style={{ color: pendingCount > 0 ? 'var(--amber)' : 'var(--text)' }}>{fmt(totalPending)}</div>
            <div className="kpi-change" style={{ color: 'var(--text2)' }}>{pendingCount} pending</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Total Incentives</div>
            <div className="kpi-value">{fmt(totalIncentives)}</div>
            <div className="kpi-change" style={{ color: 'var(--text2)' }}>Across all employees</div>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Employee Payroll</div>
          {!loaded ? (
            <div style={{ fontSize: '12px', color: 'var(--text3)', padding: '12px 0' }}>Loading…</div>
          ) : employees.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--text3)', padding: '24px 0', textAlign: 'center' }}>
              No employees yet — click <strong>Add Employee</strong> to get started
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Employee</th><th>Department</th><th>Base Salary</th>
                  <th>Incentives</th><th>Deductions</th><th>Final Salary</th>
                  <th>Status</th><th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {employees.map(emp => {
                  const col = colorMap[emp.colorKey] || colorMap.emerald;
                  return (
                    <tr key={emp._id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div className="avatar" style={{ background: col.bg, color: col.fg }}>{emp.initials}</div>
                          <span style={{ fontWeight: 500 }}>{emp.name}</span>
                        </div>
                      </td>
                      <td style={{ color: 'var(--text2)' }}>{emp.department}</td>
                      <td>{fmt(emp.baseSalary)}</td>
                      <td style={{ color: 'var(--emerald)' }}>+{fmt(emp.incentives)}</td>
                      <td style={{ color: 'var(--red)' }}>−{fmt(emp.deductions)}</td>
                      <td style={{ fontWeight: 700 }}>{fmt(emp.finalSalary)}</td>
                      <td>
                        <button
                          className={`badge ${emp.status === 'Paid' ? 'bg' : 'ba'}`}
                          style={{ cursor: 'pointer', border: 'none' }}
                          onClick={() => toggleStatus(emp)}
                          title="Click to toggle"
                        >
                          {emp.status}
                        </button>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button className="btn" style={{ padding: '4px 8px' }} onClick={() => openEdit(emp)}>
                            <i className="ti ti-pencil" />
                          </button>
                          <button className="btn" style={{ padding: '4px 8px', color: 'var(--red)' }} onClick={() => setDeleteId(emp._id)}>
                            <i className="ti ti-trash" />
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

        {tab === 'history' && (<>
          {/* Period selector + summary */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px', flexWrap: 'wrap' }}>
            <select className="form-input" style={{ width: 'auto', minWidth: '180px' }}
              value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)}>
              <option value="">— Select a pay period —</option>
              {periods.map(p => (
                <option key={p._id} value={p._id}>{periodLabel(p._id)}</option>
              ))}
            </select>
            {selectedPeriod && recPendingCount > 0 && (
              <button className="btn" onClick={markAllPaid} disabled={markingAll}>
                <i className="ti ti-check" />{markingAll ? 'Marking…' : `Mark All Paid (${recPendingCount})`}
              </button>
            )}
            {selectedPeriod && (
              <button className="btn" style={{ color: 'var(--red)', marginLeft: 'auto' }} onClick={deletePeriod} disabled={deletingPeriod}>
                <i className="ti ti-trash" />{deletingPeriod ? 'Deleting…' : 'Delete Period'}
              </button>
            )}
          </div>

          {/* Selected period KPIs */}
          {selPeriodData && (
            <div className="grid4" style={{ marginBottom: '18px' }}>
              <div className="kpi">
                <div className="kpi-label">Total Payroll</div>
                <div className="kpi-value">{fmt(selPeriodData.total)}</div>
                <div className="kpi-change" style={{ color: 'var(--text2)' }}>{selPeriodData.count} employees</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Disbursed</div>
                <div className="kpi-value" style={{ color: 'var(--emerald)' }}>{fmt(selPeriodData.paid)}</div>
                <div className="kpi-change up">{selPeriodData.paidCount} paid</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Pending</div>
                <div className="kpi-value" style={{ color: selPeriodData.pending > 0 ? 'var(--amber)' : 'var(--text)' }}>{fmt(selPeriodData.pending)}</div>
                <div className="kpi-change" style={{ color: 'var(--text2)' }}>{selPeriodData.count - selPeriodData.paidCount} pending</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Completion</div>
                <div className="kpi-value" style={{ color: selPeriodData.paidCount === selPeriodData.count ? 'var(--emerald)' : 'var(--amber)' }}>
                  {selPeriodData.count > 0 ? Math.round((selPeriodData.paidCount / selPeriodData.count) * 100) : 0}%
                </div>
                <div className="kpi-change" style={{ color: 'var(--text2)' }}>
                  {selPeriodData.paidCount === selPeriodData.count ? 'Fully disbursed' : 'In progress'}
                </div>
              </div>
            </div>
          )}

          {/* Records table */}
          {selectedPeriod && (
            <div className="card" style={{ marginBottom: '20px' }}>
              <div className="card-title">
                {periodLabel(selectedPeriod)} — Salary Breakdown
              </div>
              {recordsLoading ? (
                <div style={{ fontSize: '12px', color: 'var(--text3)', padding: '12px 0' }}>Loading…</div>
              ) : records.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'var(--text3)', padding: '12px 0' }}>No records for this period</div>
              ) : (
                <table>
                  <thead>
                    <tr><th>Employee</th><th>Department</th><th>Base</th><th>Incentives</th><th>Deductions</th><th>Final</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {records.map(rec => {
                      const col = colorMap[rec.colorKey] || colorMap.emerald;
                      return (
                        <tr key={rec._id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div className="avatar" style={{ background: col.bg, color: col.fg }}>{rec.initials}</div>
                              <span style={{ fontWeight: 500 }}>{rec.name}</span>
                            </div>
                          </td>
                          <td style={{ color: 'var(--text2)' }}>{rec.department}</td>
                          <td>{fmt(rec.baseSalary)}</td>
                          <td style={{ color: 'var(--emerald)' }}>+{fmt(rec.incentives)}</td>
                          <td style={{ color: 'var(--red)' }}>−{fmt(rec.deductions)}</td>
                          <td style={{ fontWeight: 700 }}>{fmt(rec.finalSalary)}</td>
                          <td>
                            <button
                              className={`badge ${rec.status === 'Paid' ? 'bg' : 'ba'}`}
                              style={{ cursor: 'pointer', border: 'none' }}
                              onClick={() => toggleRecord(rec)}
                              title="Click to toggle"
                            >
                              {rec.status}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* All periods overview */}
          <div className="card">
            <div className="card-title">All Pay Periods</div>
            {!periodsLoaded ? (
              <div style={{ fontSize: '12px', color: 'var(--text3)', padding: '12px 0' }}>Loading…</div>
            ) : periods.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text3)', padding: '12px 0' }}>
                No payroll runs yet — click <strong>Run Payroll</strong> to create the first one
              </div>
            ) : (
              <table>
                <thead>
                  <tr><th>Period</th><th>Employees</th><th>Total Payroll</th><th>Disbursed</th><th>Pending</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {periods.map(p => (
                    <tr key={p._id} style={{ cursor: 'pointer' }} onClick={() => setSelectedPeriod(p._id)}>
                      <td style={{ color: 'var(--indigo)', fontWeight: 700 }}>{periodLabel(p._id)}</td>
                      <td>{p.count}</td>
                      <td style={{ fontWeight: 600 }}>{fmt(p.total)}</td>
                      <td style={{ color: 'var(--emerald)' }}>{fmt(p.paid)}</td>
                      <td style={{ color: p.pending > 0 ? 'var(--amber)' : 'var(--text3)' }}>{fmt(p.pending)}</td>
                      <td>
                        <span className={`badge ${p.paidCount === p.count ? 'bg' : 'ba'}`}>
                          {p.paidCount === p.count ? 'Complete' : `${p.count - p.paidCount} pending`}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>)}

        {tab === 'analytics' && <AnalyticsTab
          employees={employees}
          analytics={analytics}
          analyticsLoaded={analyticsLoaded}
          totalRevenue={totalRevenue}
        />}
      </div>

      {/* Run Payroll Modal */}
      {showRunModal && (
        <div className="modal-overlay" onClick={() => setShowRunModal(false)}>
          <div className="modal" style={{ maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Run Payroll</span>
              <button className="modal-close" onClick={() => setShowRunModal(false)}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body">
              <div className="form-field">
                <label className="form-label">Pay Period</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <select className="form-input"
                    value={runPeriod.split('-')[1]}
                    onChange={e => setRunPeriod(`${runPeriod.split('-')[0]}-${e.target.value}`)}>
                    {MONTHS.map((m, i) => (
                      <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>
                    ))}
                  </select>
                  <select className="form-input"
                    value={runPeriod.split('-')[0]}
                    onChange={e => setRunPeriod(`${e.target.value}-${runPeriod.split('-')[1]}`)}>
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '8px' }}>
                This will snapshot all <strong>{employees.length}</strong> current employee{employees.length === 1 ? '' : 's'} into a new payroll run for <strong>{periodLabel(runPeriod)}</strong>. All records start as Pending.
              </div>
              {runError && (
                <div style={{ fontSize: '12px', color: 'var(--red)', marginTop: '8px', padding: '8px', background: 'var(--red-dim)', borderRadius: '6px' }}>
                  {runError}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setShowRunModal(false)}>Cancel</button>
              <button className="btn btn-p" onClick={runPayroll} disabled={running || employees.length === 0}>
                {running ? 'Running…' : `Run for ${periodLabel(runPeriod)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{editing ? 'Edit Employee' : 'Add Employee'}</span>
              <button className="modal-close" onClick={() => setShowModal(false)}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-field">
                  <label className="form-label">Full Name *</label>
                  <input className="form-input" placeholder="e.g. Riya Sharma" value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label className="form-label">Department</label>
                  <select className="form-input" value={form.department}
                    onChange={e => setForm(f => ({ ...f, department: e.target.value }))}>
                    {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div className="form-field" style={{ marginBottom: 0 }}>
                  <label className="form-label">Base Salary (₹) *</label>
                  <input className="form-input" type="number" min="0" placeholder="75000" value={form.baseSalary}
                    onChange={e => setForm(f => ({ ...f, baseSalary: e.target.value }))} />
                </div>
                <div className="form-field" style={{ marginBottom: 0 }}>
                  <label className="form-label">Incentives (₹)</label>
                  <input className="form-input" type="number" min="0" placeholder="0" value={form.incentives}
                    onChange={e => setForm(f => ({ ...f, incentives: e.target.value }))} />
                </div>
                <div className="form-field" style={{ marginBottom: 0 }}>
                  <label className="form-label">Deductions (₹)</label>
                  <input className="form-input" type="number" min="0" placeholder="0" value={form.deductions}
                    onChange={e => setForm(f => ({ ...f, deductions: e.target.value }))} />
                </div>
              </div>

              <div className="form-field" style={{ background: 'var(--bg3)', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px' }}>
                <label className="form-label" style={{ marginBottom: '4px' }}>Final Salary (auto-calculated)</label>
                <div style={{ fontSize: '20px', fontWeight: 800, color: computedFinal >= 0 ? 'var(--emerald)' : 'var(--red)' }}>
                  {fmt(computedFinal)}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>
                  {base > 0 ? `₹${base.toLocaleString('en-IN')} base + ₹${inc.toLocaleString('en-IN')} incentives − ₹${ded.toLocaleString('en-IN')} deductions` : 'Enter base salary above'}
                </div>
              </div>

              <div className="form-row">
                <div className="form-field" style={{ marginBottom: 0 }}>
                  <label className="form-label">Payment Status</label>
                  <select className="form-input" value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value as 'Paid' | 'Pending' }))}>
                    <option value="Pending">Pending</option>
                    <option value="Paid">Paid</option>
                  </select>
                </div>
                <div className="form-field" style={{ marginBottom: 0 }}>
                  <label className="form-label">Color Tag</label>
                  <select className="form-input" value={form.colorKey}
                    onChange={e => setForm(f => ({ ...f, colorKey: e.target.value as ColorKey }))}>
                    {COLOR_KEYS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-p" onClick={save} disabled={saving || !form.name.trim() || !form.baseSalary}>
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Employee'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal" style={{ maxWidth: '360px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Remove Employee</span>
              <button className="modal-close" onClick={() => setDeleteId(null)}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '13px', color: 'var(--text2)', margin: 0 }}>
                This will permanently remove the employee record. This cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn" style={{ background: 'var(--red)', color: '#fff', border: 'none' }} onClick={confirmDelete}>
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Analytics Tab ─────────────────────────────────────────────────────────────

interface AnalyticsProps {
  employees: Employee[];
  analytics: SalaryAnalytics | null;
  analyticsLoaded: boolean;
  totalRevenue: number;
}

function AnalyticsTab({ employees, analytics, analyticsLoaded, totalRevenue }: AnalyticsProps) {
  // Department breakdown from current employee roster
  const deptMap = new Map<string, { count: number; total: number }>();
  employees.forEach(emp => {
    const d = emp.department || 'Unassigned';
    const cur = deptMap.get(d) || { count: 0, total: 0 };
    deptMap.set(d, { count: cur.count + 1, total: cur.total + emp.finalSalary });
  });
  const depts = Array.from(deptMap.entries())
    .map(([name, v]) => ({ name, ...v, avg: Math.round(v.total / v.count) }))
    .sort((a, b) => b.total - a.total);
  const totalPayroll = employees.reduce((s, e) => s + e.finalSalary, 0);
  const avgSalary = employees.length > 0 ? Math.round(totalPayroll / employees.length) : 0;
  const payrollToRevenue = totalRevenue > 0 ? ((totalPayroll / totalRevenue) * 100).toFixed(1) : null;

  // Employee trends from salary history
  const trends = analytics?.employeeTrends ?? [];
  const allPeriods = Array.from(
    new Set(trends.flatMap(t => t.periods.map(p => p.period)))
  ).sort();
  const recentPeriods = allPeriods.slice(-6);

  return (
    <>
      {/* KPI row */}
      <div className="grid4" style={{ marginBottom: '18px' }}>
        <div className="kpi">
          <div className="kpi-label">Total Headcount</div>
          <div className="kpi-value">{employees.length}</div>
          <div className="kpi-change" style={{ color: 'var(--text2)' }}>{depts.length} department{depts.length === 1 ? '' : 's'}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Monthly Payroll</div>
          <div className="kpi-value">{fmt(totalPayroll)}</div>
          <div className="kpi-change" style={{ color: 'var(--text2)' }}>Current roster</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Avg Salary</div>
          <div className="kpi-value">{fmt(avgSalary)}</div>
          <div className="kpi-change" style={{ color: 'var(--text2)' }}>Per employee</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Payroll / Revenue</div>
          <div className="kpi-value" style={{ color: payrollToRevenue ? (parseFloat(payrollToRevenue) > 50 ? 'var(--red)' : parseFloat(payrollToRevenue) > 30 ? 'var(--amber)' : 'var(--emerald)') : 'var(--text)' }}>
            {payrollToRevenue ? `${payrollToRevenue}%` : '—'}
          </div>
          <div className="kpi-change" style={{ color: 'var(--text2)' }}>
            {payrollToRevenue ? `of ₹${(totalRevenue / 100000).toFixed(1)}L revenue` : 'No paid invoices yet'}
          </div>
        </div>
      </div>

      {/* Department breakdown */}
      <div className="grid2" style={{ marginBottom: '18px' }}>
        <div className="card">
          <div className="card-title">Department Breakdown<span className="card-sub">From current employee roster</span></div>
          {employees.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--text3)', padding: '12px 0' }}>No employees yet</div>
          ) : (
            <table>
              <thead><tr><th>Department</th><th>Headcount</th><th>Avg Salary</th><th>Total Cost</th><th>Share</th></tr></thead>
              <tbody>
                {depts.map(d => (
                  <tr key={d.name}>
                    <td style={{ fontWeight: 600 }}>{d.name}</td>
                    <td>{d.count}</td>
                    <td>{fmt(d.avg)}</td>
                    <td style={{ color: 'var(--indigo)', fontWeight: 700 }}>{fmt(d.total)}</td>
                    <td>
                      <span className="badge bg">
                        {totalPayroll > 0 ? ((d.total / totalPayroll) * 100).toFixed(0) : 0}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <div className="card-title">Payroll by Department</div>
          {depts.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--text3)', padding: '12px 0' }}>No data yet</div>
          ) : (
            <div style={{ height: `${Math.max(160, depts.length * 44)}px` }}>
              <DeptPayrollChart
                labels={depts.map(d => d.name)}
                data={depts.map(d => d.total)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Salary trend table */}
      <div className="card">
        <div className="card-title">
          Employee Salary Trends
          <span className="card-sub">Period-over-period from payroll history</span>
        </div>
        {!analyticsLoaded ? (
          <div style={{ fontSize: '12px', color: 'var(--text3)', padding: '12px 0' }}>Loading…</div>
        ) : trends.length === 0 ? (
          <div style={{ fontSize: '12px', color: 'var(--text3)', padding: '12px 0' }}>
            No payroll runs yet — run at least one pay period from the Payroll History tab to see trends
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department</th>
                  {recentPeriods.map(p => <th key={p}>{periodLabel(p)}</th>)}
                  <th>Avg (₹)</th>
                </tr>
              </thead>
              <tbody>
                {trends.map((trend: EmployeeTrend) => {
                  const col = colorMap[trend.colorKey] || colorMap.emerald;
                  const periodMap = new Map(trend.periods.map(p => [p.period, p.finalSalary]));
                  const vals = recentPeriods.map(p => periodMap.get(p) ?? null);
                  const known = vals.filter((v): v is number => v !== null);
                  const avg = known.length > 0 ? Math.round(known.reduce((s, v) => s + v, 0) / known.length) : 0;
                  return (
                    <tr key={trend._id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div className="avatar" style={{ background: col.bg, color: col.fg }}>{trend.initials}</div>
                          <span style={{ fontWeight: 500 }}>{trend.name}</span>
                        </div>
                      </td>
                      <td style={{ color: 'var(--text2)' }}>{trend.department}</td>
                      {vals.map((v, i) => {
                        const prev = i > 0 ? vals[i - 1] : null;
                        const up = v !== null && prev !== null && v > prev;
                        const dn = v !== null && prev !== null && v < prev;
                        return (
                          <td key={recentPeriods[i]} style={{ color: up ? 'var(--emerald)' : dn ? 'var(--red)' : 'var(--text)', fontWeight: v !== null ? 600 : 400 }}>
                            {v !== null ? (
                              <span>
                                {fmt(v)}
                                {up && <i className="ti ti-arrow-up-right" style={{ fontSize: '10px', marginLeft: '3px' }} />}
                                {dn && <i className="ti ti-arrow-down-right" style={{ fontSize: '10px', marginLeft: '3px' }} />}
                              </span>
                            ) : <span style={{ color: 'var(--text3)' }}>—</span>}
                          </td>
                        );
                      })}
                      <td style={{ fontWeight: 700, color: 'var(--text)' }}>{known.length > 0 ? fmt(avg) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
