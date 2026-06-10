'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type { Employee, ColorKey, SalaryRecord, EmployeeTrend, SalaryAnalytics } from '@/types';
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

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function periodLabel(p: string) {
  const [y, m] = p.split('-');
  return `${MONTHS[parseInt(m, 10) - 1]} ${y}`;
}

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function calcFinal(base: number, incentives: number, bonus: number, leaveDays: number, deductions: number) {
  const leaveDeduction = Math.round(base / 26 * leaveDays);
  return base + incentives + bonus - leaveDeduction - deductions;
}

const emptyForm = {
  name: '', department: DEPARTMENTS[0], baseSalary: '', incentives: '0', deductions: '0', colorKey: 'emerald' as ColorKey,
};

export default function Payroll() {
  const [tab, setTab] = useState<'employees' | 'payroll' | 'analytics'>('payroll');

  // --- employees ---
  const [employees, setEmployees]       = useState<Employee[]>([]);
  const [loaded, setLoaded]             = useState(false);
  const [showModal, setShowModal]       = useState(false);
  const [editing, setEditing]           = useState<Employee | null>(null);
  const [form, setForm]                 = useState<typeof emptyForm>(emptyForm);
  const [saving, setSaving]             = useState(false);
  const [deleteId, setDeleteId]         = useState<string | null>(null);
  const [incrementEmp, setIncrementEmp] = useState<Employee | null>(null);
  const [incrType, setIncrType]         = useState<'pct' | 'fixed'>('pct');
  const [incrVal, setIncrVal]           = useState('');
  const [incrSaving, setIncrSaving]     = useState(false);

  // --- monthly payroll ---
  const [payPeriod, setPayPeriod]           = useState<string>(currentPeriod);
  const [records, setRecords]               = useState<SalaryRecord[]>([]);
  const [recordsLoaded, setRecordsLoaded]   = useState(false);
  const [generating, setGenerating]         = useState(false);
  const [generateError, setGenerateError]   = useState('');
  const [markingAll, setMarkingAll]         = useState(false);
  const [deletingPeriod, setDeletingPeriod] = useState(false);
  const [savingRecord, setSavingRecord]     = useState<string | null>(null);
  const [inlineEdits, setInlineEdits]       = useState<Record<string, { leaveDays: string; bonus: string }>>({});

  // --- analytics ---
  const [analytics, setAnalytics]             = useState<SalaryAnalytics | null>(null);
  const [analyticsLoaded, setAnalyticsLoaded] = useState(false);
  const [totalRevenue, setTotalRevenue]       = useState(0);

  function load() {
    api.getEmployees()
      .then(d => { setEmployees(d as Employee[]); setLoaded(true); })
      .catch(() => setLoaded(true));
  }

  function loadPayroll(period: string) {
    setRecordsLoaded(false);
    setGenerateError('');
    api.getSalaryRecords(period)
      .then(d => {
        const recs = d as SalaryRecord[];
        setRecords(recs);
        const edits: Record<string, { leaveDays: string; bonus: string }> = {};
        recs.forEach(r => { edits[r._id] = { leaveDays: String(r.leaveDays ?? 0), bonus: String(r.bonus ?? 0) }; });
        setInlineEdits(edits);
        setRecordsLoaded(true);
      })
      .catch(() => setRecordsLoaded(true));
  }

  function loadAnalytics() {
    api.getSalaryAnalytics()
      .then(d => { setAnalytics(d as SalaryAnalytics); setAnalyticsLoaded(true); })
      .catch(() => setAnalyticsLoaded(true));
    api.getInvoices()
      .then((inv: unknown) => {
        const invoices = inv as Array<{ total: number; status: string }>;
        setTotalRevenue(invoices.filter(i => i.status === 'Paid').reduce((s, i) => s + (i.total || 0), 0));
      })
      .catch(() => {});
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { if (tab === 'payroll') loadPayroll(payPeriod); }, [tab, payPeriod]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (tab === 'analytics') loadAnalytics(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const base          = Number(form.baseSalary) || 0;
  const inc           = Number(form.incentives) || 0;
  const ded           = Number(form.deductions) || 0;
  const computedFinal = base + inc - ded;

  function openAdd() {
    setEditing(null); setForm(emptyForm); setShowModal(true);
  }

  function openEdit(emp: Employee) {
    setEditing(emp);
    setForm({
      name: emp.name, department: emp.department,
      baseSalary: String(emp.baseSalary), incentives: String(emp.incentives),
      deductions: String(emp.deductions), colorKey: emp.colorKey,
    });
    setShowModal(true);
  }

  async function save() {
    if (!form.name.trim() || !form.baseSalary) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(), department: form.department,
      baseSalary: base, incentives: inc, deductions: ded, finalSalary: computedFinal,
      colorKey: form.colorKey, initials: mkInitials(form.name),
    };
    try {
      if (editing) { await api.updateEmployee(editing._id, payload); }
      else { await api.createEmployee(payload); }
      load(); setShowModal(false);
    } finally { setSaving(false); }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await api.deleteEmployee(deleteId).catch(() => {});
    setDeleteId(null); load();
  }

  function newBase() {
    if (!incrementEmp) return 0;
    const v = parseFloat(incrVal) || 0;
    return incrType === 'pct'
      ? Math.round(incrementEmp.baseSalary * (1 + v / 100))
      : Math.round(incrementEmp.baseSalary + v);
  }

  async function applyIncrement() {
    if (!incrementEmp) return;
    setIncrSaving(true);
    const nb = newBase();
    const nf = nb + incrementEmp.incentives - incrementEmp.deductions;
    await api.updateEmployee(incrementEmp._id, { baseSalary: nb, finalSalary: nf }).catch(() => {});
    setIncrSaving(false); setIncrementEmp(null); setIncrVal(''); load();
  }

  function shiftMonth(delta: number) {
    const [y, m] = payPeriod.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setPayPeriod(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  async function generatePayroll() {
    setGenerating(true); setGenerateError('');
    try {
      await api.runPayroll(payPeriod);
      loadPayroll(payPeriod);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed';
      setGenerateError(
        msg.includes('409') || msg.includes('already')
          ? `Payroll for ${periodLabel(payPeriod)} already exists`
          : msg
      );
      setGenerating(false);
    }
  }

  function getEdits(id: string) {
    return inlineEdits[id] || { leaveDays: '0', bonus: '0' };
  }

  function getDisplayFinal(rec: SalaryRecord) {
    const e = getEdits(rec._id);
    return calcFinal(rec.baseSalary, rec.incentives, parseInt(e.bonus) || 0, parseInt(e.leaveDays) || 0, rec.deductions);
  }

  function handleInlineChange(id: string, field: 'leaveDays' | 'bonus', val: string) {
    setInlineEdits(prev => ({ ...prev, [id]: { ...getEdits(id), [field]: val } }));
  }

  async function saveRecord(rec: SalaryRecord) {
    if (rec.status === 'Paid') return;
    const e          = getEdits(rec._id);
    const leaveDays  = Math.max(0, parseInt(e.leaveDays) || 0);
    const bonus      = Math.max(0, parseInt(e.bonus) || 0);
    if (leaveDays === (rec.leaveDays ?? 0) && bonus === (rec.bonus ?? 0)) return;
    const leaveDeduction = Math.round(rec.baseSalary / 26 * leaveDays);
    const finalSalary    = calcFinal(rec.baseSalary, rec.incentives, bonus, leaveDays, rec.deductions);
    setSavingRecord(rec._id);
    const updated = await api.updateSalaryRecord(rec._id, { leaveDays, leaveDeduction, bonus, finalSalary }).catch(() => null);
    if (updated) setRecords(prev => prev.map(r => r._id === rec._id ? updated as SalaryRecord : r));
    setSavingRecord(null);
  }

  async function markPaid(rec: SalaryRecord) {
    const e              = getEdits(rec._id);
    const leaveDays      = Math.max(0, parseInt(e.leaveDays) || 0);
    const bonus          = Math.max(0, parseInt(e.bonus) || 0);
    const leaveDeduction = Math.round(rec.baseSalary / 26 * leaveDays);
    const finalSalary    = calcFinal(rec.baseSalary, rec.incentives, bonus, leaveDays, rec.deductions);
    setSavingRecord(rec._id);
    const updated = await api.updateSalaryRecord(rec._id, { leaveDays, leaveDeduction, bonus, finalSalary, status: 'Paid' }).catch(() => null);
    if (updated) setRecords(prev => prev.map(r => r._id === rec._id ? updated as SalaryRecord : r));
    setSavingRecord(null);
  }

  async function markAllPaid() {
    if (!records.length) return;
    setMarkingAll(true);
    await api.processPeriod(payPeriod).catch(() => {});
    setMarkingAll(false);
    loadPayroll(payPeriod);
  }

  async function deletePeriod() {
    setDeletingPeriod(true);
    await api.deleteSalaryPeriod(payPeriod).catch(() => {});
    setDeletingPeriod(false);
    setRecords([]); setInlineEdits({}); setRecordsLoaded(true);
  }

  const totalPayroll    = employees.reduce((s, e) => s + e.finalSalary, 0);
  const avgSalary       = employees.length > 0 ? Math.round(totalPayroll / employees.length) : 0;
  const deptCount       = new Set(employees.map(e => e.department)).size;

  const recTotal        = records.reduce((s, r) => s + getDisplayFinal(r), 0);
  const recPaid         = records.filter(r => r.status === 'Paid').reduce((s, r) => s + getDisplayFinal(r), 0);
  const recPendingCount = records.filter(r => r.status === 'Pending').length;

  const inputSx = {
    padding: '4px 8px', fontSize: '12px', textAlign: 'center' as const,
    border: '1px solid var(--border)', borderRadius: '6px',
    background: 'var(--bg2)', color: 'var(--text)',
  };

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Payroll Management</div>
        <div className="topbar-right">
          {tab === 'employees' && (
            <button className="btn btn-p" onClick={openAdd}>
              <i className="ti ti-plus" />Add Employee
            </button>
          )}
          {tab === 'payroll' && records.length > 0 && (<>
            {recPendingCount > 0 && (
              <button className="btn" onClick={markAllPaid} disabled={markingAll}>
                <i className="ti ti-checks" />
                {markingAll ? 'Marking…' : `Mark All Paid (${recPendingCount})`}
              </button>
            )}
            <button className="btn" style={{ color: 'var(--red)' }} onClick={deletePeriod} disabled={deletingPeriod}>
              <i className="ti ti-trash" />{deletingPeriod ? 'Deleting…' : 'Delete Period'}
            </button>
          </>)}
        </div>
      </div>

      <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg)', padding: '0 24px', display: 'flex' }}>
        {([['employees', 'Employees'], ['payroll', 'Monthly Payroll'], ['analytics', 'Analytics']] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '12px 20px', fontSize: '13px', fontWeight: tab === t ? 700 : 400,
            color: tab === t ? 'var(--indigo)' : 'var(--text2)', background: 'none', border: 'none',
            borderBottom: tab === t ? '2px solid var(--indigo)' : '2px solid transparent', cursor: 'pointer',
          }}>
            {label}
          </button>
        ))}
      </div>

      <div className="content">

        {/* ── Employees Tab ── */}
        {tab === 'employees' && (<>
          <div className="grid4" style={{ marginBottom: '18px' }}>
            <div className="kpi">
              <div className="kpi-label">Headcount</div>
              <div className="kpi-value">{employees.length}</div>
              <div className="kpi-change" style={{ color: 'var(--text2)' }}>{deptCount} dept{deptCount !== 1 ? 's' : ''}</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Monthly Payroll</div>
              <div className="kpi-value">{fmt(totalPayroll)}</div>
              <div className="kpi-change" style={{ color: 'var(--text2)' }}>Gross roster cost</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Avg Salary</div>
              <div className="kpi-value">{fmt(avgSalary)}</div>
              <div className="kpi-change" style={{ color: 'var(--text2)' }}>Per employee</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Total Incentives</div>
              <div className="kpi-value">{fmt(employees.reduce((s, e) => s + e.incentives, 0))}</div>
              <div className="kpi-change" style={{ color: 'var(--text2)' }}>Across all employees</div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Employee Roster</div>
            {!loaded ? (
              <div style={{ fontSize: '12px', color: 'var(--text3)', padding: '12px 0' }}>Loading…</div>
            ) : employees.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text3)', padding: '32px 0', textAlign: 'center' }}>
                No employees yet — click <strong>Add Employee</strong> to get started
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Employee</th><th>Department</th><th>Base Salary</th>
                    <th>Incentives</th><th>Deductions</th><th>Net Salary</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
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
                        <td style={{ fontWeight: 700, color: 'var(--indigo)' }}>{fmt(emp.finalSalary)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button className="btn"
                              style={{ padding: '4px 10px', fontSize: '11px', color: 'var(--emerald)' }}
                              title="Salary Increment"
                              onClick={() => { setIncrementEmp(emp); setIncrType('pct'); setIncrVal(''); }}>
                              <i className="ti ti-trending-up" style={{ fontSize: '13px' }} />
                            </button>
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

        {/* ── Monthly Payroll Tab ── */}
        {tab === 'payroll' && (<>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <button className="btn" style={{ padding: '6px 14px' }} onClick={() => shiftMonth(-1)}>
              <i className="ti ti-chevron-left" style={{ fontSize: '14px' }} />
            </button>
            <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text)', minWidth: '150px', textAlign: 'center' }}>
              {periodLabel(payPeriod)}
            </div>
            <button className="btn" style={{ padding: '6px 14px' }} onClick={() => shiftMonth(1)}>
              <i className="ti ti-chevron-right" style={{ fontSize: '14px' }} />
            </button>
            {payPeriod !== currentPeriod() && (
              <button className="btn" style={{ fontSize: '11px' }} onClick={() => setPayPeriod(currentPeriod())}>
                This Month
              </button>
            )}
          </div>

          {!recordsLoaded ? (
            <div style={{ fontSize: '12px', color: 'var(--text3)', padding: '60px 0', textAlign: 'center' }}>Loading…</div>
          ) : records.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: '36px', marginBottom: '14px' }}>📋</div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', marginBottom: '6px' }}>
                No payroll for {periodLabel(payPeriod)}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '20px' }}>
                {employees.length > 0
                  ? `Snapshot ${employees.length} employee${employees.length !== 1 ? 's' : ''} from the current roster into this pay period.`
                  : 'Add employees from the Employees tab before generating payroll.'}
              </div>
              {generateError && (
                <div style={{ fontSize: '12px', color: 'var(--red)', padding: '8px 16px', background: 'var(--red-dim)', borderRadius: '8px', display: 'inline-block', marginBottom: '16px' }}>
                  {generateError}
                </div>
              )}
              {employees.length > 0 && (
                <button className="btn btn-p" onClick={generatePayroll} disabled={generating}>
                  <i className="ti ti-calendar-plus" />
                  {generating ? 'Generating…' : `Generate Payroll for ${periodLabel(payPeriod)}`}
                </button>
              )}
            </div>
          ) : (<>
            <div className="grid4" style={{ marginBottom: '18px' }}>
              <div className="kpi">
                <div className="kpi-label">Total Payroll</div>
                <div className="kpi-value">{fmt(recTotal)}</div>
                <div className="kpi-change" style={{ color: 'var(--text2)' }}>{records.length} employees</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Disbursed</div>
                <div className="kpi-value" style={{ color: 'var(--emerald)' }}>{fmt(recPaid)}</div>
                <div className="kpi-change up">{records.filter(r => r.status === 'Paid').length} paid</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Pending</div>
                <div className="kpi-value" style={{ color: recPendingCount > 0 ? 'var(--amber)' : 'var(--text)' }}>
                  {fmt(recTotal - recPaid)}
                </div>
                <div className="kpi-change" style={{ color: 'var(--text2)' }}>{recPendingCount} pending</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Completion</div>
                <div className="kpi-value" style={{ color: recPendingCount === 0 ? 'var(--emerald)' : 'var(--amber)' }}>
                  {records.length > 0 ? Math.round(((records.length - recPendingCount) / records.length) * 100) : 0}%
                </div>
                <div className="kpi-change" style={{ color: 'var(--text2)' }}>
                  {recPendingCount === 0 ? 'Fully disbursed' : 'In progress'}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-title">
                {periodLabel(payPeriod)} — Salary Breakdown
                <span className="card-sub">Edit leave days &amp; bonus per row · auto-saves on blur</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Employee</th><th>Department</th><th>Base</th>
                      <th style={{ textAlign: 'center' }}>Leave Days</th>
                      <th>Leave Ded.</th>
                      <th style={{ textAlign: 'center' }}>Bonus (₹)</th>
                      <th>Deductions</th><th>Net Salary</th><th />
                    </tr>
                  </thead>
                  <tbody>
                    {records.map(rec => {
                      const col         = colorMap[rec.colorKey] || colorMap.emerald;
                      const e           = getEdits(rec._id);
                      const leaveDays   = parseInt(e.leaveDays) || 0;
                      const bonus       = parseInt(e.bonus) || 0;
                      const leaveDeduct = Math.round(rec.baseSalary / 26 * leaveDays);
                      const netSalary   = calcFinal(rec.baseSalary, rec.incentives, bonus, leaveDays, rec.deductions);
                      const isSaving    = savingRecord === rec._id;
                      const isPaid      = rec.status === 'Paid';
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
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="number" min="0" max="31"
                              value={e.leaveDays}
                              onChange={ev => handleInlineChange(rec._id, 'leaveDays', ev.target.value)}
                              onBlur={() => saveRecord(rec)}
                              style={{ ...inputSx, width: '60px' }}
                              disabled={isSaving || isPaid}
                            />
                          </td>
                          <td style={{ color: leaveDays > 0 ? 'var(--red)' : 'var(--text3)', fontSize: '12px' }}>
                            {leaveDays > 0 ? `−${fmt(leaveDeduct)}` : '—'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="number" min="0"
                              value={e.bonus}
                              onChange={ev => handleInlineChange(rec._id, 'bonus', ev.target.value)}
                              onBlur={() => saveRecord(rec)}
                              style={{ ...inputSx, width: '80px' }}
                              disabled={isSaving || isPaid}
                            />
                          </td>
                          <td style={{ color: 'var(--red)', fontSize: '12px' }}>−{fmt(rec.deductions)}</td>
                          <td style={{ fontWeight: 700, color: 'var(--indigo)', fontSize: '14px', whiteSpace: 'nowrap' }}>
                            {fmt(netSalary)}
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {isPaid ? (
                              <span className="badge bg" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <i className="ti ti-circle-check" style={{ fontSize: '11px' }} /> Paid
                              </span>
                            ) : (
                              <button
                                className="btn"
                                style={{ padding: '4px 12px', fontSize: '12px', color: 'var(--emerald)', whiteSpace: 'nowrap' }}
                                onClick={() => markPaid(rec)}
                                disabled={isSaving}
                              >
                                <i className={`ti ${isSaving ? 'ti-loader-2' : 'ti-circle-check'}`} style={{ fontSize: '13px' }} />
                                {isSaving ? 'Saving…' : 'Mark Paid'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>)}
        </>)}

        {tab === 'analytics' && <AnalyticsTab
          employees={employees}
          analytics={analytics}
          analyticsLoaded={analyticsLoaded}
          totalRevenue={totalRevenue}
        />}
      </div>

      {/* ── Add / Edit Employee ── */}
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
                <label className="form-label" style={{ marginBottom: '4px' }}>Net Salary (auto-calculated)</label>
                <div style={{ fontSize: '20px', fontWeight: 800, color: computedFinal >= 0 ? 'var(--emerald)' : 'var(--red)' }}>
                  {fmt(computedFinal)}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>
                  {base > 0
                    ? `₹${base.toLocaleString('en-IN')} base + ₹${inc.toLocaleString('en-IN')} incentives − ₹${ded.toLocaleString('en-IN')} deductions`
                    : 'Enter base salary above'}
                </div>
              </div>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-label">Color Tag</label>
                <select className="form-input" value={form.colorKey}
                  onChange={e => setForm(f => ({ ...f, colorKey: e.target.value as ColorKey }))}>
                  {COLOR_KEYS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
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

      {/* ── Salary Increment ── */}
      {incrementEmp && (
        <div className="modal-overlay" onClick={() => { setIncrementEmp(null); setIncrVal(''); }}>
          <div className="modal" style={{ maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Salary Increment</span>
              <button className="modal-close" onClick={() => { setIncrementEmp(null); setIncrVal(''); }}>
                <i className="ti ti-x" />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px', padding: '12px', background: 'var(--bg3)', borderRadius: '10px' }}>
                <div className="avatar"
                  style={{ background: colorMap[incrementEmp.colorKey]?.bg, color: colorMap[incrementEmp.colorKey]?.fg }}>
                  {incrementEmp.initials}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)' }}>{incrementEmp.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text2)' }}>
                    {incrementEmp.department} &middot; Current base: <strong>{fmt(incrementEmp.baseSalary)}</strong>
                  </div>
                </div>
              </div>
              <div className="form-field">
                <label className="form-label">Increment Type</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {(['pct', 'fixed'] as const).map(t => (
                    <label key={t} style={{
                      display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px',
                      cursor: 'pointer', flex: 1, padding: '10px 12px',
                      border: `2px solid ${incrType === t ? 'var(--indigo)' : 'var(--border)'}`,
                      borderRadius: '8px',
                      background: incrType === t ? 'var(--indigo-dim)' : 'transparent',
                      transition: 'all 0.15s',
                    }}>
                      <input type="radio" name="incrType" value={t} checked={incrType === t}
                        onChange={() => setIncrType(t)} style={{ accentColor: 'var(--indigo)' }} />
                      {t === 'pct' ? 'Percentage (%)' : 'Fixed Amount (₹)'}
                    </label>
                  ))}
                </div>
              </div>
              <div className="form-field">
                <label className="form-label">
                  {incrType === 'pct' ? 'Percentage Increase' : 'Fixed Increase (₹)'}
                </label>
                <input className="form-input" type="number" min="0"
                  placeholder={incrType === 'pct' ? 'e.g. 10' : 'e.g. 5000'}
                  value={incrVal} onChange={e => setIncrVal(e.target.value)} />
              </div>
              {incrVal && parseFloat(incrVal) > 0 && (
                <div style={{ background: 'var(--emerald-dim)', borderRadius: '10px', padding: '12px 14px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text2)', marginBottom: '4px' }}>New Base Salary</div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--emerald)' }}>{fmt(newBase())}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '4px' }}>
                    +{fmt(newBase() - incrementEmp.baseSalary)} increase from {fmt(incrementEmp.baseSalary)}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => { setIncrementEmp(null); setIncrVal(''); }}>Cancel</button>
              <button className="btn btn-p" onClick={applyIncrement}
                disabled={incrSaving || !incrVal || parseFloat(incrVal) <= 0}>
                {incrSaving ? 'Applying…' : 'Apply Increment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Employee Confirm ── */}
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
  const deptMap = new Map<string, { count: number; total: number }>();
  employees.forEach(emp => {
    const d   = emp.department || 'Unassigned';
    const cur = deptMap.get(d) || { count: 0, total: 0 };
    deptMap.set(d, { count: cur.count + 1, total: cur.total + emp.finalSalary });
  });
  const depts = Array.from(deptMap.entries())
    .map(([name, v]) => ({ name, ...v, avg: Math.round(v.total / v.count) }))
    .sort((a, b) => b.total - a.total);
  const totalPayroll     = employees.reduce((s, e) => s + e.finalSalary, 0);
  const avgSalary        = employees.length > 0 ? Math.round(totalPayroll / employees.length) : 0;
  const payrollToRevenue = totalRevenue > 0 ? ((totalPayroll / totalRevenue) * 100).toFixed(1) : null;

  const trends        = analytics?.employeeTrends ?? [];
  const allPeriods    = Array.from(new Set(trends.flatMap(t => t.periods.map(p => p.period)))).sort();
  const recentPeriods = allPeriods.slice(-6);

  return (
    <>
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
          <div className="kpi-value" style={{ color: payrollToRevenue
            ? (parseFloat(payrollToRevenue) > 50 ? 'var(--red)' : parseFloat(payrollToRevenue) > 30 ? 'var(--amber)' : 'var(--emerald)')
            : 'var(--text)' }}>
            {payrollToRevenue ? `${payrollToRevenue}%` : '—'}
          </div>
          <div className="kpi-change" style={{ color: 'var(--text2)' }}>
            {payrollToRevenue ? `of ${fmt(totalRevenue)} revenue` : 'No paid invoices yet'}
          </div>
        </div>
      </div>

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
                    <td><span className="badge bg">{totalPayroll > 0 ? ((d.total / totalPayroll) * 100).toFixed(0) : 0}%</span></td>
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
              <DeptPayrollChart labels={depts.map(d => d.name)} data={depts.map(d => d.total)} />
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          Employee Salary Trends
          <span className="card-sub">Period-over-period from payroll history</span>
        </div>
        {!analyticsLoaded ? (
          <div style={{ fontSize: '12px', color: 'var(--text3)', padding: '12px 0' }}>Loading…</div>
        ) : trends.length === 0 ? (
          <div style={{ fontSize: '12px', color: 'var(--text3)', padding: '12px 0' }}>
            No payroll runs yet — generate payroll from the Monthly Payroll tab to see trends
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Employee</th><th>Department</th>
                  {recentPeriods.map(p => <th key={p}>{periodLabel(p)}</th>)}
                  <th>Avg</th>
                </tr>
              </thead>
              <tbody>
                {trends.map((trend: EmployeeTrend) => {
                  const col       = colorMap[trend.colorKey] || colorMap.emerald;
                  const periodMap = new Map(trend.periods.map(p => [p.period, p.finalSalary]));
                  const vals      = recentPeriods.map(p => periodMap.get(p) ?? null);
                  const known     = vals.filter((v): v is number => v !== null);
                  const avg       = known.length > 0 ? Math.round(known.reduce((s, v) => s + v, 0) / known.length) : 0;
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
                        const up   = v !== null && prev !== null && v > prev;
                        const dn   = v !== null && prev !== null && v < prev;
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
                      <td style={{ fontWeight: 700 }}>{known.length > 0 ? fmt(avg) : '—'}</td>
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
