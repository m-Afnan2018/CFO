import nodemailer from 'nodemailer';
import AppSettings from '../models/AppSettings';

export async function sendGSTReminder(opts: {
  to: string;
  period: string;
  dueDate: string;
  outputGST: number;
  cgst: number;
  sgst: number;
  igst: number;
}): Promise<{ ok: boolean; error?: string }> {
  const settings = await AppSettings.findOne();
  if (!settings?.smtpHost || !settings?.smtpUser || !settings?.smtpPass) {
    return { ok: false, error: 'SMTP not configured. Go to GST → Email Settings.' };
  }

  const transporter = nodemailer.createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort || 587,
    secure: settings.smtpPort === 465,
    auth: { user: settings.smtpUser, pass: settings.smtpPass },
  });

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const [y, m] = opts.period.split('-');
  const label = `${MONTHS[Number(m) - 1]} ${y}`;
  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
body{font-family:'Segoe UI',sans-serif;font-size:14px;color:#0f172a;background:#f8fafc;margin:0;padding:0}
.wrap{max-width:520px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
.hdr{background:linear-gradient(135deg,#6366f1,#10b981);padding:28px 32px;color:#fff}
.hdr h1{margin:0;font-size:20px;font-weight:800}.hdr p{margin:6px 0 0;opacity:.85;font-size:13px}
.body{padding:28px 32px}
.alert{background:#fef3c7;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:6px;font-size:13px;margin-bottom:20px}
.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px}
.row:last-child{border-bottom:none}.lbl{color:#64748b}.val{font-weight:700;color:#0f172a}
.total{background:#f0fdf4;border-radius:8px;padding:14px 16px;margin-top:16px;display:flex;justify-content:space-between;align-items:center}
.total .lbl{font-size:13px;color:#065f46;font-weight:600}.total .val{font-size:18px;color:#065f46;font-weight:800}
.foot{padding:20px 32px;background:#f8fafc;font-size:11px;color:#94a3b8;text-align:center}
</style></head>
<body><div class="wrap">
<div class="hdr"><h1>🔔 GST Filing Reminder</h1>
<p>Your GSTR-3B for <strong>${label}</strong> is due on <strong>${opts.dueDate}</strong></p></div>
<div class="body">
<div class="alert">⚠️ Please file your GST return before <strong>${opts.dueDate}</strong> to avoid late fees.</div>
<div class="row"><span class="lbl">Period</span><span class="val">${label}</span></div>
<div class="row"><span class="lbl">CGST (Central GST)</span><span class="val">${fmt(opts.cgst)}</span></div>
<div class="row"><span class="lbl">SGST (State GST)</span><span class="val">${fmt(opts.sgst)}</span></div>
<div class="row"><span class="lbl">IGST (Integrated GST)</span><span class="val">${fmt(opts.igst)}</span></div>
<div class="total"><span class="lbl">Total Output GST Payable</span><span class="val">${fmt(opts.outputGST)}</span></div>
</div>
<div class="foot">Ganesyx CFO Dashboard · Automated reminder</div>
</div></body></html>`;

  try {
    await transporter.sendMail({
      from: `"Ganesyx CFO" <${settings.smtpUser}>`,
      to: opts.to,
      subject: `GST Reminder: ${label} return due ${opts.dueDate}`,
      html,
    });
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function sendTDSReminder(opts: {
  to: string;
  quarter: string;
  dueDate: string;
  tdsTotal: number;
  tds194J: number;
  tds194C: number;
  tdsOther: number;
}): Promise<{ ok: boolean; error?: string }> {
  const settings = await AppSettings.findOne();
  if (!settings?.smtpHost || !settings?.smtpUser || !settings?.smtpPass) {
    return { ok: false, error: 'SMTP not configured. Go to TDS → Email Settings.' };
  }

  const transporter = nodemailer.createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort || 587,
    secure: settings.smtpPort === 465,
    auth: { user: settings.smtpUser, pass: settings.smtpPass },
  });

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
body{font-family:'Segoe UI',sans-serif;font-size:14px;color:#0f172a;background:#f8fafc;margin:0;padding:0}
.wrap{max-width:520px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
.hdr{background:linear-gradient(135deg,#f59e0b,#6366f1);padding:28px 32px;color:#fff}
.hdr h1{margin:0;font-size:20px;font-weight:800}.hdr p{margin:6px 0 0;opacity:.85;font-size:13px}
.body{padding:28px 32px}
.alert{background:#fef3c7;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:6px;font-size:13px;margin-bottom:20px}
.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px}
.row:last-child{border-bottom:none}.lbl{color:#64748b}.val{font-weight:700;color:#0f172a}
.total{background:#fffbeb;border-radius:8px;padding:14px 16px;margin-top:16px;display:flex;justify-content:space-between;align-items:center}
.total .lbl{font-size:13px;color:#92400e;font-weight:600}.total .val{font-size:18px;color:#92400e;font-weight:800}
.foot{padding:20px 32px;background:#f8fafc;font-size:11px;color:#94a3b8;text-align:center}
</style></head>
<body><div class="wrap">
<div class="hdr"><h1>📋 TDS Certificate Reminder</h1>
<p>Follow up for TDS certificates — <strong>${opts.quarter}</strong> due <strong>${opts.dueDate}</strong></p></div>
<div class="body">
<div class="alert">⚠️ Request Form 16A from your clients before <strong>${opts.dueDate}</strong> to reconcile TDS in 26AS.</div>
<div class="row"><span class="lbl">Quarter</span><span class="val">${opts.quarter}</span></div>
<div class="row"><span class="lbl">TDS u/s 194J (Professional)</span><span class="val">${fmt(opts.tds194J)}</span></div>
<div class="row"><span class="lbl">TDS u/s 194C (Contractor)</span><span class="val">${fmt(opts.tds194C)}</span></div>
<div class="row"><span class="lbl">TDS — Other Sections</span><span class="val">${fmt(opts.tdsOther)}</span></div>
<div class="total"><span class="lbl">Total TDS Receivable</span><span class="val">${fmt(opts.tdsTotal)}</span></div>
</div>
<div class="foot">Ganesyx CFO Dashboard · Automated reminder</div>
</div></body></html>`;

  try {
    await transporter.sendMail({
      from: `"Ganesyx CFO" <${settings.smtpUser}>`,
      to: opts.to,
      subject: `TDS Reminder: ${opts.quarter} certificates due ${opts.dueDate}`,
      html,
    });
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
