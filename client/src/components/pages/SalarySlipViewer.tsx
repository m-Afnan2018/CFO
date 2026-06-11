'use client';
import { useState } from 'react';
import type { SalaryRecord, SlipTemplate } from '@/types';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function periodLabel(p: string) {
  const [y, m] = p.split('-');
  return `${MONTHS[parseInt(m, 10) - 1]} ${y}`;
}

function fmtINR(n: number) {
  return '₹' + n.toLocaleString('en-IN');
}

interface Props {
  records: SalaryRecord[];
  initialIndex: number;
  period: string;
  template: SlipTemplate;
  onClose: () => void;
}

interface SlipNums {
  gross: number; net: number; totalDed: number;
  leaveDeduct: number;
  earnings: { label: string; amount: number; color?: string }[];
  deductions: { label: string; amount: number }[];
}

function computeSlip(rec: SalaryRecord): SlipNums {
  const hra     = rec.hra ?? 0;
  const special = rec.specialAllowance ?? 0;
  const bonus   = rec.bonus ?? 0;
  const pf      = rec.providentFund ?? 0;
  const esi     = rec.esi ?? 0;
  const pt      = rec.professionalTax ?? 0;
  const tds     = rec.tds ?? 0;
  const other   = rec.deductions ?? 0;
  const leaveDeduct = Math.round(rec.baseSalary / 26 * (rec.leaveDays ?? 0));

  const gross   = rec.baseSalary + hra + special + rec.incentives + bonus;
  const totalDed = pf + esi + pt + tds + other + leaveDeduct;
  const net = gross - totalDed;

  const earnings: { label: string; amount: number; color?: string }[] = [
    { label: 'Basic Salary', amount: rec.baseSalary },
  ];
  if (hra > 0)            earnings.push({ label: 'HRA', amount: hra, color: '#10b981' });
  if (special > 0)        earnings.push({ label: 'Special Allowance', amount: special, color: '#10b981' });
  if (rec.incentives > 0) earnings.push({ label: 'Incentives', amount: rec.incentives, color: '#10b981' });
  if (bonus > 0)          earnings.push({ label: 'Bonus', amount: bonus, color: '#10b981' });

  const deductions: { label: string; amount: number }[] = [];
  if (pf > 0)              deductions.push({ label: 'Provident Fund', amount: pf });
  if (esi > 0)             deductions.push({ label: 'ESI', amount: esi });
  if (pt > 0)              deductions.push({ label: 'Professional Tax', amount: pt });
  if (tds > 0)             deductions.push({ label: 'TDS / Income Tax', amount: tds });
  if (leaveDeduct > 0)     deductions.push({ label: `Leave (${rec.leaveDays}d)`, amount: leaveDeduct });
  if (other > 0)           deductions.push({ label: 'Other Deductions', amount: other });

  return { gross, net, totalDed, leaveDeduct, earnings, deductions };
}

function buildSlipHTML(rec: SalaryRecord, period: string, tpl: SlipTemplate): string {
  const { gross, net, totalDed, earnings, deductions } = computeSlip(rec);
  const pLabel = periodLabel(period);
  const contactLine = [tpl.companyPhone, tpl.companyEmail, tpl.website].filter(Boolean).join(' &middot; ');

  const earningRows = earnings.map(e =>
    `<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:13px;border-bottom:1px dashed #f1f5f9;">
      <span style="color:#475569;">${e.label}</span>
      <span style="font-weight:600;color:${e.color || '#0f172a'};">${fmtINR(e.amount)}</span>
    </div>`
  ).join('');

  const dedRows = deductions.length === 0
    ? `<div style="font-size:12px;color:#94a3b8;padding:5px 0;">No deductions</div>`
    : deductions.map(d =>
        `<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:13px;border-bottom:1px dashed #f1f5f9;">
          <span style="color:#475569;">${d.label}</span>
          <span style="font-weight:600;color:#ef4444;">&minus;${fmtINR(d.amount)}</span>
        </div>`
      ).join('');

  return `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:680px;margin:0 auto;background:#fff;color:#0f172a;padding:36px;border:1px solid #e2e8f0;border-radius:12px;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:18px;border-bottom:2px solid #e2e8f0;margin-bottom:20px;">
    <div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:7px;">
        <div style="width:36px;height:36px;border-radius:8px;background:linear-gradient(135deg,#10b981,#6366f1);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;color:#fff;flex-shrink:0;">G</div>
        <div style="font-size:18px;font-weight:800;">${tpl.companyName || 'Ganesyx Pvt Ltd'}</div>
      </div>
      ${tpl.companyAddress ? `<div style="font-size:12px;color:#64748b;margin-bottom:2px;">${tpl.companyAddress}</div>` : ''}
      ${contactLine ? `<div style="font-size:12px;color:#64748b;">${contactLine}</div>` : ''}
      ${tpl.panNumber ? `<div style="font-size:11px;color:#94a3b8;margin-top:3px;">PAN: ${tpl.panNumber}</div>` : ''}
    </div>
    <div style="text-align:right;">
      <div style="font-size:10px;font-weight:700;color:#94a3b8;letter-spacing:0.12em;text-transform:uppercase;">Salary Slip</div>
      <div style="font-size:20px;font-weight:800;color:#6366f1;margin-top:3px;">${pLabel}</div>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;background:#f8fafc;border-radius:8px;padding:14px 16px;margin-bottom:20px;">
    <div><div style="font-size:10px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:3px;">Employee</div><div style="font-size:14px;font-weight:700;">${rec.name}</div></div>
    <div><div style="font-size:10px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:3px;">Department</div><div style="font-size:14px;font-weight:700;">${rec.department}</div></div>
    <div style="margin-top:6px;"><div style="font-size:10px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:3px;">Pay Period</div><div style="font-size:14px;font-weight:700;">${pLabel}</div></div>
    <div style="margin-top:6px;"><div style="font-size:10px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:3px;">Status</div><div style="font-size:14px;font-weight:700;color:${rec.status === 'Paid' ? '#10b981' : '#f59e0b'};">${rec.status}</div></div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:18px;">
    <div>
      <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;padding-bottom:7px;border-bottom:1px solid #e2e8f0;margin-bottom:8px;">Earnings</div>
      ${earningRows}
      <div style="display:flex;justify-content:space-between;padding:7px 0;font-size:13px;font-weight:700;border-top:1px solid #e2e8f0;margin-top:2px;">
        <span>Gross Pay</span><span>${fmtINR(gross)}</span>
      </div>
    </div>
    <div>
      <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;padding-bottom:7px;border-bottom:1px solid #e2e8f0;margin-bottom:8px;">Deductions</div>
      ${dedRows}
      <div style="display:flex;justify-content:space-between;padding:7px 0;font-size:13px;font-weight:700;border-top:1px solid #e2e8f0;margin-top:2px;">
        <span>Total Deductions</span>
        <span style="color:${totalDed > 0 ? '#ef4444' : '#94a3b8'};">${totalDed > 0 ? '&minus;' + fmtINR(totalDed) : '&mdash;'}</span>
      </div>
    </div>
  </div>
  <div style="background:linear-gradient(135deg,rgba(99,102,241,0.07),rgba(16,185,129,0.07));border:1.5px solid rgba(99,102,241,0.18);border-radius:10px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
    <div>
      <div style="font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">Net Salary Payable</div>
      <div style="font-size:30px;font-weight:800;color:#6366f1;letter-spacing:-0.5px;">${fmtINR(net)}</div>
    </div>
    <div style="background:${rec.status === 'Paid' ? '#10b981' : '#f59e0b'};color:#fff;padding:7px 18px;border-radius:20px;font-size:12px;font-weight:700;letter-spacing:0.06em;">${rec.status === 'Paid' ? '&#10003; PAID' : 'PENDING'}</div>
  </div>
  <div style="font-size:11px;color:#94a3b8;text-align:center;padding-top:12px;border-top:1px solid #e2e8f0;">
    ${tpl.footerNote || 'This is a system generated payslip and does not require a signature.'}
  </div>
</div>`;
}

export default function SalarySlipViewer({ records, initialIndex, period, template, onClose }: Props) {
  const [idx, setIdx] = useState(initialIndex);
  const rec = records[idx];
  if (!rec) return null;

  const { gross, net, totalDed, earnings, deductions } = computeSlip(rec);
  const contactLine = [template.companyPhone, template.companyEmail, template.website].filter(Boolean).join(' · ');

  function doPrint(recs: SalaryRecord[]) {
    const slips = recs.map((r, i) =>
      `<div style="page-break-after:${i < recs.length - 1 ? 'always' : 'avoid'};padding:20px 0;">${buildSlipHTML(r, period, template)}</div>`
    ).join('');
    const w = window.open('', '_blank', 'width=860,height=700');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Salary Slips</title>
      <style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#f1f5f9}@media print{body{background:#fff;padding:0}}</style>
    </head><body>${slips}<script>window.onload=function(){window.print();setTimeout(function(){window.close();},500);};<\/script></body></html>`);
    w.document.close();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>

      {/* ── Top bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', height: '56px', flexShrink: 0, background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="modal-close" onClick={onClose}><i className="ti ti-x" /></button>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>
            Salary Slip &mdash; {periodLabel(period)}
          </div>
        </div>

        {records.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button className="btn" style={{ padding: '4px 10px' }} onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0}>
              <i className="ti ti-chevron-left" />
            </button>
            <span style={{ fontSize: '13px', color: 'var(--text2)', minWidth: '68px', textAlign: 'center' }}>
              {idx + 1} / {records.length}
            </span>
            <button className="btn" style={{ padding: '4px 10px' }} onClick={() => setIdx(i => Math.min(records.length - 1, i + 1))} disabled={idx === records.length - 1}>
              <i className="ti ti-chevron-right" />
            </button>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button className="btn" onClick={() => doPrint([rec])}>
            <i className="ti ti-printer" /> Print
          </button>
          {records.length > 1 && (
            <button className="btn btn-p" onClick={() => doPrint(records)}>
              <i className="ti ti-printer" /> All ({records.length})
            </button>
          )}
        </div>
      </div>

      {/* ── Slip preview ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px 20px', display: 'flex', justifyContent: 'center' }}>
        <div style={{
          width: '100%', maxWidth: '680px', background: '#ffffff', borderRadius: '14px',
          padding: '36px', border: '1px solid rgba(0,0,0,0.08)',
          boxShadow: '0 4px 32px rgba(0,0,0,0.12)', color: '#0f172a',
        }}>

          {/* Company header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '18px', borderBottom: '2px solid #e2e8f0', marginBottom: '20px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '7px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'linear-gradient(135deg,#10b981,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '16px', color: '#fff', flexShrink: 0 }}>G</div>
                <div style={{ fontSize: '18px', fontWeight: 800 }}>{template.companyName || 'Ganesyx Pvt Ltd'}</div>
              </div>
              {template.companyAddress && <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '2px' }}>{template.companyAddress}</div>}
              {contactLine && <div style={{ fontSize: '12px', color: '#64748b' }}>{contactLine}</div>}
              {template.panNumber && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px' }}>PAN: {template.panNumber}</div>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Salary Slip</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#6366f1', marginTop: '3px' }}>{periodLabel(period)}</div>
            </div>
          </div>

          {/* Employee info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: '#f8fafc', borderRadius: '8px', padding: '14px 16px', marginBottom: '20px' }}>
            {([['Employee', rec.name], ['Department', rec.department], ['Pay Period', periodLabel(period)], ['Status', rec.status]] as [string, string][]).map(([label, value]) => (
              <div key={label}>
                <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px' }}>{label}</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: label === 'Status' ? (rec.status === 'Paid' ? '#10b981' : '#f59e0b') : '#0f172a' }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Earnings & Deductions */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '18px' }}>
            <div>
              <SectionHead>Earnings</SectionHead>
              {earnings.map(e => (
                <SRow key={e.label} label={e.label} value={fmtINR(e.amount)} color={e.color} />
              ))}
              <STotalRow label="Gross Pay" value={fmtINR(gross)} />
            </div>
            <div>
              <SectionHead>Deductions</SectionHead>
              {deductions.length === 0 && <div style={{ fontSize: '12px', color: '#94a3b8', padding: '5px 0' }}>No deductions</div>}
              {deductions.map(d => (
                <SRow key={d.label} label={d.label} value={`−${fmtINR(d.amount)}`} color="#ef4444" />
              ))}
              <STotalRow
                label="Total Deductions"
                value={totalDed > 0 ? `−${fmtINR(totalDed)}` : '—'}
                color={totalDed > 0 ? '#ef4444' : '#94a3b8'}
              />
            </div>
          </div>

          {/* Net salary */}
          <div style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.07),rgba(16,185,129,0.07))', border: '1.5px solid rgba(99,102,241,0.18)', borderRadius: '10px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <div>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Net Salary Payable</div>
              <div style={{ fontSize: '30px', fontWeight: 800, color: '#6366f1', letterSpacing: '-0.5px' }}>{fmtINR(net)}</div>
            </div>
            <div style={{ background: rec.status === 'Paid' ? '#10b981' : '#f59e0b', color: '#fff', padding: '7px 18px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em' }}>
              {rec.status === 'Paid' ? '✓ PAID' : 'PENDING'}
            </div>
          </div>

          {/* Footer */}
          <div style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
            {template.footerNote || 'This is a system generated payslip and does not require a signature.'}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', paddingBottom: '7px', borderBottom: '1px solid #e2e8f0', marginBottom: '8px' }}>
      {children}
    </div>
  );
}

function SRow({ label, value, color = '#0f172a' }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '13px', borderBottom: '1px dashed #f1f5f9' }}>
      <span style={{ color: '#475569' }}>{label}</span>
      <span style={{ fontWeight: 600, color }}>{value}</span>
    </div>
  );
}

function STotalRow({ label, value, color = '#0f172a' }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontSize: '13px', fontWeight: 700, borderTop: '1px solid #e2e8f0', marginTop: '2px' }}>
      <span>{label}</span>
      <span style={{ color }}>{value}</span>
    </div>
  );
}
