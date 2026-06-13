'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type { Employee, ColorKey, SalaryRecord, EmployeeTrend, SalaryAnalytics, SlipTemplate } from '@/types';
import { api } from '@/lib/api';
import SalarySlipViewer from './SalarySlipViewer';
import styles from './Payroll.module.css';

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

function calcFinal(
  base: number, hra: number, special: number, incentives: number, bonus: number,
  pf: number, esi: number, pt: number, tds: number, otherDed: number, leaveDays: number
) {
  const gross = base + hra + special + incentives + bonus;
  const leaveDeduction = Math.round(base / 26 * leaveDays);
  return gross - pf - esi - pt - tds - otherDed - leaveDeduction;
}

function recCalcFinal(rec: SalaryRecord, bonus: number, leaveDays: number) {
  return calcFinal(
    rec.baseSalary, rec.hra ?? 0, rec.specialAllowance ?? 0, rec.incentives, bonus,
    rec.providentFund ?? 0, rec.esi ?? 0, rec.professionalTax ?? 0, rec.tds ?? 0,
    rec.deductions, leaveDays
  );
}

const emptyForm = {
  name: '', department: DEPARTMENTS[0],
  baseSalary: '', hra: '0', specialAllowance: '0', incentives: '0',
  providentFund: '0', esi: '0', professionalTax: '0', tds: '0', deductions: '0',
  colorKey: 'emerald' as ColorKey,
};

export default function Payroll() {
  const [tab, setTab] = useState<'employees' | 'payroll' | 'analytics' | 'template'>('payroll');

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

  // --- slip template ---
  const DEFAULT_TEMPLATE: SlipTemplate = {
    companyName: 'Ganesyx Pvt Ltd', companyAddress: '', companyEmail: '',
    companyPhone: '', website: '', panNumber: '',
    footerNote: 'This is a system generated payslip and does not require a signature.',
  };
  const [slipTemplate, setSlipTemplate]   = useState<SlipTemplate>(DEFAULT_TEMPLATE);
  const [templateForm, setTemplateForm]   = useState<SlipTemplate>(DEFAULT_TEMPLATE);
  const [templateSaving, setTemplateSaving] = useState(false);

  // --- slip viewer ---
  const [slipViewOpen, setSlipViewOpen] = useState(false);
  const [slipViewIdx, setSlipViewIdx]   = useState(0);

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
  useEffect(() => {
    api.getSlipTemplate()
      .then(d => { const t = d as SlipTemplate; setSlipTemplate(t); setTemplateForm(t); })
      .catch(() => {});
  }, []);

  const base    = Number(form.baseSalary) || 0;
  const hra     = Number(form.hra) || 0;
  const special = Number(form.specialAllowance) || 0;
  const inc     = Number(form.incentives) || 0;
  const pf      = Number(form.providentFund) || 0;
  const esiAmt  = Number(form.esi) || 0;
  const pt      = Number(form.professionalTax) || 0;
  const tdsAmt  = Number(form.tds) || 0;
  const ded     = Number(form.deductions) || 0;
  const grossPay      = base + hra + special + inc;
  const computedFinal = grossPay - pf - esiAmt - pt - tdsAmt - ded;

  function openAdd() {
    setEditing(null); setForm(emptyForm); setShowModal(true);
  }

  function openEdit(emp: Employee) {
    setEditing(emp);
    setForm({
      name: emp.name, department: emp.department,
      baseSalary: String(emp.baseSalary),
      hra: String(emp.hra ?? 0), specialAllowance: String(emp.specialAllowance ?? 0),
      incentives: String(emp.incentives),
      providentFund: String(emp.providentFund ?? 0), esi: String(emp.esi ?? 0),
      professionalTax: String(emp.professionalTax ?? 0), tds: String(emp.tds ?? 0),
      deductions: String(emp.deductions), colorKey: emp.colorKey,
    });
    setShowModal(true);
  }

  async function save() {
    if (!form.name.trim() || !form.baseSalary) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(), department: form.department,
      baseSalary: base, hra, specialAllowance: special, incentives: inc,
      providentFund: pf, esi: esiAmt, professionalTax: pt, tds: tdsAmt,
      deductions: ded, finalSalary: computedFinal,
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
    const nf = nb + (incrementEmp.hra ?? 0) + (incrementEmp.specialAllowance ?? 0) + incrementEmp.incentives
               - (incrementEmp.providentFund ?? 0) - (incrementEmp.esi ?? 0)
               - (incrementEmp.professionalTax ?? 0) - (incrementEmp.tds ?? 0)
               - incrementEmp.deductions;
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
    return recCalcFinal(rec, parseInt(e.bonus) || 0, parseInt(e.leaveDays) || 0);
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
    const leaveDeduction = Math.round(rec.baseSalary / 30 * leaveDays);
    const finalSalary    = recCalcFinal(rec, bonus, leaveDays);
    setSavingRecord(rec._id);
    const updated = await api.updateSalaryRecord(rec._id, { leaveDays, leaveDeduction, bonus, finalSalary }).catch(() => null);
    if (updated) setRecords(prev => prev.map(r => r._id === rec._id ? updated as SalaryRecord : r));
    setSavingRecord(null);
  }

  async function markPaid(rec: SalaryRecord) {
    const e              = getEdits(rec._id);
    const leaveDays      = Math.max(0, parseInt(e.leaveDays) || 0);
    const bonus          = Math.max(0, parseInt(e.bonus) || 0);
    const leaveDeduction = Math.round(rec.baseSalary / 30 * leaveDays);
    const finalSalary    = recCalcFinal(rec, bonus, leaveDays);
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

  async function saveTemplate() {
    setTemplateSaving(true);
    try {
      const saved = await api.saveSlipTemplate(templateForm) as SlipTemplate;
      setSlipTemplate(saved);
    } catch {} finally {
      setTemplateSaving(false);
    }
  }

  const totalPayroll    = employees.reduce((s, e) => s + e.finalSalary, 0);
  const avgSalary       = employees.length > 0 ? Math.round(totalPayroll / employees.length) : 0;
  const deptCount       = new Set(employees.map(e => e.department)).size;

  const paidRecords     = records.filter(r => r.status === 'Paid');
  const recTotal        = records.reduce((s, r) => s + getDisplayFinal(r), 0);
  const recPaid         = paidRecords.reduce((s, r) => s + getDisplayFinal(r), 0);
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
            {paidRecords.length > 0 && (
              <button className="btn" onClick={() => { setSlipViewIdx(0); setSlipViewOpen(true); }}>
                <i className="ti ti-file-text" />
                Generate Slips ({paidRecords.length})
              </button>
            )}
            <button className={`btn ${styles.btnDanger}`} onClick={deletePeriod} disabled={deletingPeriod}>
              <i className="ti ti-trash" />{deletingPeriod ? 'Deleting…' : 'Delete Period'}
            </button>
          </>)}
        </div>
      </div>

      <div className={styles.tabNav}>
        {([['employees', 'Employees'], ['payroll', 'Monthly Payroll'], ['analytics', 'Analytics'], ['template', 'Slip Template']] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} className={`${styles.tabBtn} ${tab === t ? styles.tabBtnActive : ''}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="content">

        {/* ── Employees Tab ── */}
        {tab === 'employees' && (<>
          <div className={`grid4 ${styles.gridMb}`}>
            <div className="kpi">
              <div className="kpi-label">Headcount</div>
              <div className="kpi-value">{employees.length}</div>
              <div className={`kpi-change ${styles.kpiSub}`}>{deptCount} dept{deptCount !== 1 ? 's' : ''}</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Monthly Payroll</div>
              <div className="kpi-value">{fmt(totalPayroll)}</div>
              <div className={`kpi-change ${styles.kpiSub}`}>Gross roster cost</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Avg Salary</div>
              <div className="kpi-value">{fmt(avgSalary)}</div>
              <div className={`kpi-change ${styles.kpiSub}`}>Per employee</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Total Incentives</div>
              <div className="kpi-value">{fmt(employees.reduce((s, e) => s + e.incentives, 0))}</div>
              <div className={`kpi-change ${styles.kpiSub}`}>Across all employees</div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Employee Roster</div>
            {!loaded ? (
              <div className={styles.loadingText}>Loading…</div>
            ) : employees.length === 0 ? (
              <div className={styles.emptyText}>
                No employees yet — click <strong>Add Employee</strong> to get started
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Employee</th><th>Department</th><th>Base Salary</th>
                    <th>Gross Pay</th><th>Deductions</th><th>Net Salary</th>
                    <th className={styles.thRight}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map(emp => {
                    const col = colorMap[emp.colorKey] || colorMap.emerald;
                    return (
                      <tr key={emp._id}>
                        <td>
                          <div className={styles.empCell}>
                            <div className={`avatar ${styles.avatarColored}`} style={{ '--avatar-bg': col.bg, '--avatar-fg': col.fg } as React.CSSProperties}>{emp.initials}</div>
                            <span className={styles.empName}>{emp.name}</span>
                          </div>
                        </td>
                        <td className={styles.deptCell}>{emp.department}</td>
                        <td>{fmt(emp.baseSalary)}</td>
                        <td className={styles.grossCell}>
                          {fmt(emp.baseSalary + (emp.hra ?? 0) + (emp.specialAllowance ?? 0) + emp.incentives)}
                        </td>
                        <td className={styles.deductCell}>
                          −{fmt((emp.providentFund ?? 0) + (emp.esi ?? 0) + (emp.professionalTax ?? 0) + (emp.tds ?? 0) + emp.deductions)}
                        </td>
                        <td className={styles.netCell}>{fmt(emp.finalSalary)}</td>
                        <td className={styles.actionsCell}>
                          <div className={styles.actionGroup}>
                            <button className={`btn ${styles.btnSm}`}
                              title="Salary Increment"
                              onClick={() => { setIncrementEmp(emp); setIncrType('pct'); setIncrVal(''); }}>
                              <i className={`ti ti-trending-up ${styles.iconSm}`} />
                            </button>
                            <button className={`btn ${styles.btnIcon}`} onClick={() => openEdit(emp)}>
                              <i className="ti ti-pencil" />
                            </button>
                            <button className={`btn ${styles.btnIconRed}`} onClick={() => setDeleteId(emp._id)}>
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
          <div className={styles.periodNav}>
            <button className={`btn ${styles.btnPeriodNav}`} onClick={() => shiftMonth(-1)}>
              <i className="ti ti-chevron-left" style={{ fontSize: '14px' }} />
            </button>
            <div className={styles.periodLabel}>
              {periodLabel(payPeriod)}
            </div>
            <button className={`btn ${styles.btnPeriodNav}`} onClick={() => shiftMonth(1)}>
              <i className="ti ti-chevron-right" style={{ fontSize: '14px' }} />
            </button>
            {payPeriod !== currentPeriod() && (
              <button className={`btn ${styles.btnThisMonth}`} onClick={() => setPayPeriod(currentPeriod())}>
                This Month
              </button>
            )}
          </div>

          {!recordsLoaded ? (
            <div className={styles.payrollLoading}>Loading…</div>
          ) : records.length === 0 ? (
            <div className={styles.payrollEmpty}>
              <div className={styles.payrollEmptyIcon}>📋</div>
              <div className={styles.payrollEmptyTitle}>
                No payroll for {periodLabel(payPeriod)}
              </div>
              <div className={styles.payrollEmptyMsg}>
                {employees.length > 0
                  ? `Snapshot ${employees.length} employee${employees.length !== 1 ? 's' : ''} from the current roster into this pay period.`
                  : 'Add employees from the Employees tab before generating payroll.'}
              </div>
              {generateError && (
                <div className={styles.generateError}>
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
            <div className={`grid4 ${styles.gridMb}`}>
              <div className="kpi">
                <div className="kpi-label">Total Payroll</div>
                <div className="kpi-value">{fmt(recTotal)}</div>
                <div className={`kpi-change ${styles.kpiSub}`}>{records.length} employees</div>
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
                <div className={`kpi-change ${styles.kpiSub}`}>{recPendingCount} pending</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Completion</div>
                <div className="kpi-value" style={{ color: recPendingCount === 0 ? 'var(--emerald)' : 'var(--amber)' }}>
                  {records.length > 0 ? Math.round(((records.length - recPendingCount) / records.length) * 100) : 0}%
                </div>
                <div className={`kpi-change ${styles.kpiSub}`}>
                  {recPendingCount === 0 ? 'Fully disbursed' : 'In progress'}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-title">
                {periodLabel(payPeriod)} — Salary Breakdown
                <span className="card-sub">Edit leave days &amp; bonus per row · auto-saves on blur</span>
              </div>
              <div className={styles.tableScroll}>
                <table>
                  <thead>
                    <tr>
                      <th>Employee</th><th>Department</th><th>Gross Pay</th>
                      <th className={styles.thCenter}>Leave Days</th>
                      <th>Leave Ded.</th>
                      <th className={styles.thCenter}>Bonus (₹)</th>
                      <th>Deductions</th><th>Net Salary</th><th />
                    </tr>
                  </thead>
                  <tbody>
                    {records.map(rec => {
                      const col         = colorMap[rec.colorKey] || colorMap.emerald;
                      const e           = getEdits(rec._id);
                      const leaveDays   = parseInt(e.leaveDays) || 0;
                      const bonus       = parseInt(e.bonus) || 0;
                      const leaveDeduct = Math.round(rec.baseSalary / 30 * leaveDays);
                      const grossPay    = rec.baseSalary + (rec.hra ?? 0) + (rec.specialAllowance ?? 0) + rec.incentives;
                      const statDed     = (rec.providentFund ?? 0) + (rec.esi ?? 0) + (rec.professionalTax ?? 0) + (rec.tds ?? 0) + rec.deductions;
                      const netSalary   = recCalcFinal(rec, bonus, leaveDays);
                      const isSaving    = savingRecord === rec._id;
                      const isPaid      = rec.status === 'Paid';
                      return (
                        <tr key={rec._id}>
                          <td>
                            <div className={styles.empCell}>
                              <div className={`avatar ${styles.avatarColored}`} style={{ '--avatar-bg': col.bg, '--avatar-fg': col.fg } as React.CSSProperties}>{rec.initials}</div>
                              <span className={styles.empName}>{rec.name}</span>
                            </div>
                          </td>
                          <td className={styles.deptCell}>{rec.department}</td>
                          <td>
                            <div className={styles.grossPayCell}>{fmt(grossPay)}</div>
                            <div className={styles.grossPayBase}>base {fmt(rec.baseSalary)}</div>
                          </td>
                          <td className={styles.tdCenter}>
                            <input
                              type="number" min="0" max="31"
                              value={e.leaveDays}
                              onChange={ev => handleInlineChange(rec._id, 'leaveDays', ev.target.value)}
                              onBlur={() => saveRecord(rec)}
                              style={{ ...inputSx, width: '60px' }}
                              disabled={isSaving || isPaid}
                            />
                          </td>
                          <td className={leaveDays > 0 ? styles.deductAmt : styles.deductNone}>
                            {leaveDays > 0 ? `−${fmt(leaveDeduct)}` : '—'}
                          </td>
                          <td className={styles.tdCenter}>
                            <input
                              type="number" min="0"
                              value={e.bonus}
                              onChange={ev => handleInlineChange(rec._id, 'bonus', ev.target.value)}
                              onBlur={() => saveRecord(rec)}
                              style={{ ...inputSx, width: '80px' }}
                              disabled={isSaving || isPaid}
                            />
                          </td>
                          <td className={styles.deductAmt}>−{fmt(statDed)}</td>
                          <td className={styles.netSalaryCell}>
                            {fmt(netSalary)}
                          </td>
                          <td className={styles.nowrap}>
                            {isPaid ? (
                              <div className={styles.paidCell}>
                                <span className="badge bg" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <i className={`ti ti-circle-check ${styles.paidBadgeIcon}`} /> Paid
                                </span>
                                <button
                                  className={`btn ${styles.btnSlip}`}
                                  title="View Salary Slip"
                                  onClick={() => {
                                    setSlipViewIdx(paidRecords.findIndex(r => r._id === rec._id));
                                    setSlipViewOpen(true);
                                  }}
                                >
                                  <i className={`ti ti-file-text ${styles.iconXsm}`} />
                                </button>
                              </div>
                            ) : (
                              <button
                                className={`btn ${styles.btnMarkPaid}`}
                                onClick={() => markPaid(rec)}
                                disabled={isSaving}
                              >
                                <i className={`ti ${isSaving ? 'ti-loader-2' : 'ti-circle-check'} ${styles.iconSm}`} />
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

        {/* ── Slip Template Tab ── */}
        {tab === 'template' && (
          <div>
            <div className={`card ${styles.templateCard}`}>
              <div className="card-title">
                Salary Slip Template
                <span className="card-sub">Company details printed on all salary slips</span>
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label className="form-label">Company Name</label>
                  <input className="form-input" placeholder="Ganesyx Pvt Ltd"
                    value={templateForm.companyName}
                    onChange={e => setTemplateForm(f => ({ ...f, companyName: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label className="form-label">PAN Number</label>
                  <input className="form-input" placeholder="AAACG1234C"
                    value={templateForm.panNumber}
                    onChange={e => setTemplateForm(f => ({ ...f, panNumber: e.target.value }))} />
                </div>
              </div>
              <div className="form-field">
                <label className="form-label">Company Address</label>
                <input className="form-input" placeholder="123 Business Park, Bengaluru, Karnataka 560001"
                  value={templateForm.companyAddress}
                  onChange={e => setTemplateForm(f => ({ ...f, companyAddress: e.target.value }))} />
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label className="form-label">Phone</label>
                  <input className="form-input" placeholder="+91 98765 43210"
                    value={templateForm.companyPhone}
                    onChange={e => setTemplateForm(f => ({ ...f, companyPhone: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label className="form-label">Email</label>
                  <input className="form-input" placeholder="hr@ganesyx.com"
                    value={templateForm.companyEmail}
                    onChange={e => setTemplateForm(f => ({ ...f, companyEmail: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label className="form-label">Website</label>
                  <input className="form-input" placeholder="ganesyx.com"
                    value={templateForm.website}
                    onChange={e => setTemplateForm(f => ({ ...f, website: e.target.value }))} />
                </div>
              </div>
              <div className="form-field">
                <label className="form-label">Footer Note</label>
                <input className="form-input" placeholder="This is a system generated payslip…"
                  value={templateForm.footerNote}
                  onChange={e => setTemplateForm(f => ({ ...f, footerNote: e.target.value }))} />
              </div>
              <div className={styles.templateActions}>
                <button className="btn" onClick={() => setTemplateForm(slipTemplate)}>Reset</button>
                <button className="btn btn-p" onClick={saveTemplate} disabled={templateSaving}>
                  <i className="ti ti-device-floppy" />
                  {templateSaving ? 'Saving…' : 'Save Template'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Salary Slip Viewer ── */}
      {slipViewOpen && paidRecords.length > 0 && (
        <SalarySlipViewer
          records={paidRecords}
          initialIndex={slipViewIdx}
          period={payPeriod}
          template={slipTemplate}
          onClose={() => setSlipViewOpen(false)}
        />
      )}

      {/* ── Add / Edit Employee ── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{editing ? 'Edit Employee' : 'Add Employee'}</span>
              <button className="modal-close" onClick={() => setShowModal(false)}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body">
              {/* Basic info */}
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

              {/* Earnings */}
              <div className={styles.sectionLabel}>Earnings</div>
              <div className={styles.earningsGrid}>
                <div className={`form-field ${styles.formFieldNoMb}`}>
                  <label className="form-label">Basic Salary (₹) *</label>
                  <input className="form-input" type="number" min="0" placeholder="50000" value={form.baseSalary}
                    onChange={e => setForm(f => ({ ...f, baseSalary: e.target.value }))} />
                </div>
                <div className={`form-field ${styles.formFieldNoMb}`}>
                  <label className="form-label">HRA (₹)</label>
                  <input className="form-input" type="number" min="0" placeholder="0" value={form.hra}
                    onChange={e => setForm(f => ({ ...f, hra: e.target.value }))} />
                  {base > 0 && <div className={styles.hintText}>40% = ₹{Math.round(base * 0.4).toLocaleString('en-IN')}</div>}
                </div>
                <div className={`form-field ${styles.formFieldNoMb}`}>
                  <label className="form-label">Special Allowance (₹)</label>
                  <input className="form-input" type="number" min="0" placeholder="0" value={form.specialAllowance}
                    onChange={e => setForm(f => ({ ...f, specialAllowance: e.target.value }))} />
                </div>
                <div className={`form-field ${styles.formFieldNoMb}`}>
                  <label className="form-label">Incentives (₹)</label>
                  <input className="form-input" type="number" min="0" placeholder="0" value={form.incentives}
                    onChange={e => setForm(f => ({ ...f, incentives: e.target.value }))} />
                </div>
              </div>

              {/* Deductions */}
              <div className={styles.sectionLabel}>Deductions</div>
              <div className={styles.deductionsGrid}>
                <div className={`form-field ${styles.formFieldNoMb}`}>
                  <label className="form-label">Provident Fund (₹)</label>
                  <input className="form-input" type="number" min="0" placeholder="0" value={form.providentFund}
                    onChange={e => setForm(f => ({ ...f, providentFund: e.target.value }))} />
                  {base > 0 && <div className={styles.hintText}>12% = ₹{Math.round(base * 0.12).toLocaleString('en-IN')}</div>}
                </div>
                <div className={`form-field ${styles.formFieldNoMb}`}>
                  <label className="form-label">ESI (₹)</label>
                  <input className="form-input" type="number" min="0" placeholder="0" value={form.esi}
                    onChange={e => setForm(f => ({ ...f, esi: e.target.value }))} />
                </div>
                <div className={`form-field ${styles.formFieldNoMb}`}>
                  <label className="form-label">Professional Tax (₹)</label>
                  <input className="form-input" type="number" min="0" placeholder="200" value={form.professionalTax}
                    onChange={e => setForm(f => ({ ...f, professionalTax: e.target.value }))} />
                </div>
                <div className={`form-field ${styles.formFieldNoMb}`}>
                  <label className="form-label">TDS / Income Tax (₹)</label>
                  <input className="form-input" type="number" min="0" placeholder="0" value={form.tds}
                    onChange={e => setForm(f => ({ ...f, tds: e.target.value }))} />
                </div>
                <div className={`form-field ${styles.formFieldNoMb}`}>
                  <label className="form-label">Other Deductions (₹)</label>
                  <input className="form-input" type="number" min="0" placeholder="0" value={form.deductions}
                    onChange={e => setForm(f => ({ ...f, deductions: e.target.value }))} />
                </div>
              </div>

              {/* Summary */}
              <div className={styles.summaryGrid}>
                <div className={styles.summaryBox}>
                  <div className={styles.summaryBoxLabel}>Gross Pay</div>
                  <div className={styles.summaryGross}>{fmt(grossPay)}</div>
                  <div className={styles.summaryBoxHint}>
                    {base > 0 ? `base ${fmt(base)} + HRA ${fmt(hra)} + special ${fmt(special)} + inc ${fmt(inc)}` : '—'}
                  </div>
                </div>
                <div className={styles.summaryBox}>
                  <div className={styles.summaryBoxLabel}>Net Salary</div>
                  <div style={{ fontSize: '17px', fontWeight: 800, color: computedFinal >= 0 ? 'var(--indigo)' : 'var(--red)' }}>{fmt(computedFinal)}</div>
                  <div className={styles.summaryBoxHint}>
                    {base > 0 ? `PF ${fmt(pf)} + ESI ${fmt(esiAmt)} + PT ${fmt(pt)} + TDS ${fmt(tdsAmt)} + other ${fmt(ded)}` : '—'}
                  </div>
                </div>
              </div>

              <div className={`form-field ${styles.formFieldNoMb}`}>
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
          <div className={`modal ${styles.incrModalWidth}`} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Salary Increment</span>
              <button className="modal-close" onClick={() => { setIncrementEmp(null); setIncrVal(''); }}>
                <i className="ti ti-x" />
              </button>
            </div>
            <div className="modal-body">
              <div className={styles.incrEmployeeInfo}>
                <div className={`avatar ${styles.avatarColored}`} style={{ '--avatar-bg': colorMap[incrementEmp.colorKey]?.bg, '--avatar-fg': colorMap[incrementEmp.colorKey]?.fg } as React.CSSProperties}>
                  {incrementEmp.initials}
                </div>
                <div>
                  <div className={styles.incrEmpName}>{incrementEmp.name}</div>
                  <div className={styles.incrEmpSub}>
                    {incrementEmp.department} &middot; Current base: <strong>{fmt(incrementEmp.baseSalary)}</strong>
                  </div>
                </div>
              </div>
              <div className="form-field">
                <label className="form-label">Increment Type</label>
                <div className={styles.incrTypeRow}>
                  {(['pct', 'fixed'] as const).map(t => (
                    <label
                      key={t}
                      className={styles.incrTypeLabel}
                      style={{
                        border: `2px solid ${incrType === t ? 'var(--indigo)' : 'var(--border)'}`,
                        background: incrType === t ? 'var(--indigo-dim)' : 'transparent',
                      }}
                    >
                      <input type="radio" name="incrType" value={t} checked={incrType === t}
                        onChange={() => setIncrType(t)} className={styles.incrRadio} />
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
                <div className={styles.incrResult}>
                  <div className={styles.incrResultLabel}>New Base Salary</div>
                  <div className={styles.incrResultValue}>{fmt(newBase())}</div>
                  <div className={styles.incrResultSub}>
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
          <div className={`modal ${styles.deleteModalWidth}`} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Remove Employee</span>
              <button className="modal-close" onClick={() => setDeleteId(null)}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body">
              <p className={styles.deleteConfirmText}>
                This will permanently remove the employee record. This cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className={`btn ${styles.btnDelete}`} onClick={confirmDelete}>
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
      <div className={`grid4 ${styles.gridMb}`}>
        <div className="kpi">
          <div className="kpi-label">Total Headcount</div>
          <div className="kpi-value">{employees.length}</div>
          <div className={`kpi-change ${styles.kpiSub}`}>{depts.length} department{depts.length === 1 ? '' : 's'}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Monthly Payroll</div>
          <div className="kpi-value">{fmt(totalPayroll)}</div>
          <div className={`kpi-change ${styles.kpiSub}`}>Current roster</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Avg Salary</div>
          <div className="kpi-value">{fmt(avgSalary)}</div>
          <div className={`kpi-change ${styles.kpiSub}`}>Per employee</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Payroll / Revenue</div>
          <div className="kpi-value" style={{ color: payrollToRevenue
            ? (parseFloat(payrollToRevenue) > 50 ? 'var(--red)' : parseFloat(payrollToRevenue) > 30 ? 'var(--amber)' : 'var(--emerald)')
            : 'var(--text)' }}>
            {payrollToRevenue ? `${payrollToRevenue}%` : '—'}
          </div>
          <div className={`kpi-change ${styles.kpiSub}`}>
            {payrollToRevenue ? `of ${fmt(totalRevenue)} revenue` : 'No paid invoices yet'}
          </div>
        </div>
      </div>

      <div className={`grid2 ${styles.gridMb}`}>
        <div className="card">
          <div className="card-title">Department Breakdown<span className="card-sub">From current employee roster</span></div>
          {employees.length === 0 ? (
            <div className={styles.chartNoData}>No employees yet</div>
          ) : (
            <table>
              <thead><tr><th>Department</th><th>Headcount</th><th>Avg Salary</th><th>Total Cost</th><th>Share</th></tr></thead>
              <tbody>
                {depts.map(d => (
                  <tr key={d.name}>
                    <td className={styles.deptNameCell}>{d.name}</td>
                    <td>{d.count}</td>
                    <td>{fmt(d.avg)}</td>
                    <td className={styles.deptTotalCell}>{fmt(d.total)}</td>
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
            <div className={styles.chartNoData}>No data yet</div>
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
          <div className={styles.loadingText}>Loading…</div>
        ) : trends.length === 0 ? (
          <div className={styles.loadingText}>
            No payroll runs yet — generate payroll from the Monthly Payroll tab to see trends
          </div>
        ) : (
          <div className={styles.tableScroll}>
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
                        <div className={styles.trendEmpCell}>
                          <div className={`avatar ${styles.avatarColored}`} style={{ '--avatar-bg': col.bg, '--avatar-fg': col.fg } as React.CSSProperties}>{trend.initials}</div>
                          <span className={styles.trendEmpName}>{trend.name}</span>
                        </div>
                      </td>
                      <td className={styles.trendDeptCell}>{trend.department}</td>
                      {vals.map((v, i) => {
                        const prev = i > 0 ? vals[i - 1] : null;
                        const up   = v !== null && prev !== null && v > prev;
                        const dn   = v !== null && prev !== null && v < prev;
                        return (
                          <td key={recentPeriods[i]} style={{ color: up ? 'var(--emerald)' : dn ? 'var(--red)' : 'var(--text)', fontWeight: v !== null ? 600 : 400 }}>
                            {v !== null ? (
                              <span>
                                {fmt(v)}
                                {up && <i className={`ti ti-arrow-up-right ${styles.trendIcon}`} />}
                                {dn && <i className={`ti ti-arrow-down-right ${styles.trendIcon}`} />}
                              </span>
                            ) : <span className={styles.trendMissing}>—</span>}
                          </td>
                        );
                      })}
                      <td className={styles.trendAvgCell}>{known.length > 0 ? fmt(avg) : '—'}</td>
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
