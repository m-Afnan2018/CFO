'use client';
import { useEffect, useState } from 'react';
import type { Invoice, LineItem, ServiceItem } from '@/types';
import { api } from '@/lib/api';

const COMPANY = {
  name: 'Ganesyx Pvt Ltd',
  tagline: 'Digital Marketing Agency',
  address: 'Koramangala, Bengaluru — 560034',
  gst: '29AABCG1234A1Z5',
  email: 'accounts@ganesyx.com',
  phone: '+91 98765 43210',
};

const GST_RATES = ['0', '5', '12', '18', '28'];

interface LI { description: string; qty: string; unitPrice: string; }
const emptyLI = (): LI => ({ description: '', qty: '1', unitPrice: '' });

interface Props {
  invoice?: Invoice;
  onSave: (inv: Invoice) => void;
  onClose: () => void;
}

function esc(s: string) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtRs(n: number) {
  return `₹${n.toLocaleString('en-IN')}`;
}

function statusColors(s: string): React.CSSProperties {
  const map: Record<string, React.CSSProperties> = {
    Paid:    { background: '#d1fae5', color: '#065f46' },
    Pending: { background: '#dbeafe', color: '#1e40af' },
    Overdue: { background: '#fee2e2', color: '#991b1b' },
    Partial: { background: '#fef3c7', color: '#92400e' },
  };
  return {
    display: 'inline-block', padding: '3px 12px', borderRadius: '20px',
    fontSize: '11px', fontWeight: 700, ...(map[s] ?? map.Pending),
  };
}

export default function InvoiceDesigner({ invoice, onSave, onClose }: Props) {
  const isEdit = !!invoice?._id;

  const [invNum, setInvNum]           = useState(invoice?.invoiceNumber ?? `#INV-${Date.now()}`);
  const [client, setClient]           = useState(invoice?.client ?? '');
  const [clientEmail, setClientEmail] = useState(invoice?.clientEmail ?? '');
  const [clientAddr, setClientAddr]   = useState(invoice?.clientAddress ?? '');
  const [date, setDate]               = useState(invoice?.date ?? new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate]         = useState(invoice?.dueDate ?? '');
  const [gstRate, setGstRate]         = useState(String(invoice?.gstRate ?? 18));
  const [notes, setNotes]             = useState(
    invoice?.notes ?? 'Payment due within 14 days. Thank you for your business!'
  );
  const [status, setStatus] = useState<Invoice['status']>(invoice?.status ?? 'Pending');
  const [items, setItems]   = useState<LI[]>(() => {
    const li = invoice?.lineItems;
    if (li?.length) {
      return li.map(l => ({ description: l.description, qty: String(l.qty), unitPrice: String(l.unitPrice) }));
    }
    return [emptyLI()];
  });

  const [taxType, setTaxType]       = useState<'Intrastate' | 'Interstate'>(invoice?.taxType ?? 'Intrastate');
  const [tdsSection, setTdsSection] = useState(invoice?.tdsSection ?? 'None');
  const [tdsRate, setTdsRate]       = useState(invoice?.tdsRate ?? 0);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const [clientList, setClientList] = useState<string[]>([]);
  const [clientData, setClientData] = useState<{ name: string; email: string; serviceBreakdown: ServiceItem[] }[]>([]);

  useEffect(() => {
    api.getClients()
      .then(d => {
        const clients = d as { name: string; email: string; serviceBreakdown: ServiceItem[] }[];
        setClientData(clients);
        setClientList(clients.map(c => c.name));
      })
      .catch(() => {});
    if (!isEdit) {
      api.getNextInvoiceNumber()
        .then(d => setInvNum((d as { number: string }).number))
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── derived ───────────────────────────────────────────────────────────────

  const activeClient      = clientData.find(c => c.name === client);
  const activeServices    = activeClient?.serviceBreakdown ?? [];
  const checkedServiceSet = new Set(items.map(it => it.description));

  function toggleService(svc: ServiceItem) {
    if (checkedServiceSet.has(svc.name)) {
      setItems(prev => prev.filter(it => it.description !== svc.name));
    } else {
      setItems(prev => {
        const withoutEmptyPlaceholder = prev.filter(it => it.description || it.unitPrice);
        return [...withoutEmptyPlaceholder, { description: svc.name, qty: '1', unitPrice: String(svc.amount) }];
      });
    }
  }

  // ── computed ──────────────────────────────────────────────────────────────

  const parsed = items.map(it => {
    const q = Math.max(0, parseFloat(it.qty) || 0);
    const p = Math.max(0, parseFloat(it.unitPrice) || 0);
    return { ...it, q, p, amt: q * p };
  });
  const subtotal  = parsed.reduce((s, i) => s + i.amt, 0);
  const gstPct    = parseFloat(gstRate) || 0;
  const gstAmt    = Math.round(subtotal * gstPct / 100);
  const total     = subtotal + gstAmt;
  const tdsAmount = tdsSection !== 'None' ? Math.round(subtotal * tdsRate / 100) : 0;
  const netAfterTds = total - tdsAmount;

  // ── handlers ──────────────────────────────────────────────────────────────

  function updItem(idx: number, k: keyof LI, v: string) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [k]: v } : it));
  }
  function addItem() { setItems(p => [...p, emptyLI()]); }
  function delItem(idx: number) {
    if (items.length > 1) setItems(p => p.filter((_, i) => i !== idx));
  }

  async function save() {
    if (!client.trim()) { setError('Client name is required'); return; }
    setSaving(true); setError('');
    try {
      const lineItems: LineItem[] = parsed.map(it => ({
        description: it.description, qty: it.q, unitPrice: it.p, amount: it.amt,
      }));
      const payload = {
        invoiceNumber: invNum, client, clientEmail, clientAddress: clientAddr,
        date, dueDate, gstRate: gstPct, lineItems,
        amount: subtotal, gst: gstAmt, total, notes, status, taxType,
        tdsSection, tdsRate, tdsAmount,
      };
      const saved = isEdit
        ? await api.updateInvoice(invoice!._id, payload)
        : await api.createInvoice(payload);
      onSave(saved as Invoice);
    } catch {
      setError('Failed to save. Please try again.');
      setSaving(false);
    }
  }

  function printInvoice() {
    const filledRows = parsed.filter(it => it.description);
    const rows = filledRows.map((it, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${esc(it.description)}</td>
        <td style="text-align:right">${it.q}</td>
        <td style="text-align:right">${fmtRs(it.p)}</td>
        <td style="text-align:right;font-weight:600">${fmtRs(it.amt)}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>${esc(invNum)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',system-ui,sans-serif;font-size:13px;color:#0f172a;background:#fff;padding:40px;max-width:800px;margin:0 auto}
  .hd{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px}
  .logo{width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,#10b981,#6366f1);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#fff;flex-shrink:0}
  .co-name{font-size:18px;font-weight:800;color:#0f172a}
  .co-sub{font-size:11px;color:#64748b;margin-top:2px}
  .it{font-size:30px;font-weight:900;color:#6366f1;letter-spacing:-1px}
  .in{font-size:14px;font-weight:700;color:#0f172a;margin-top:4px}
  .id{font-size:12px;color:#64748b;margin-top:8px;line-height:1.8}
  hr{border:none;border-top:2px solid #e2e8f0;margin:24px 0}
  .lbl{font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px}
  .bn{font-size:15px;font-weight:700;color:#0f172a}
  .bd{font-size:12px;color:#64748b;margin-top:3px}
  .st{display:inline-block;padding:3px 12px;border-radius:20px;font-size:11px;font-weight:700;margin-top:12px}
  .s-Paid{background:#d1fae5;color:#065f46}.s-Pending{background:#dbeafe;color:#1e40af}
  .s-Overdue{background:#fee2e2;color:#991b1b}.s-Partial{background:#fef3c7;color:#92400e}
  table{width:100%;border-collapse:collapse;margin-top:24px}
  th{padding:10px;text-align:left;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em;border-bottom:2px solid #e2e8f0;background:#f8fafc}
  td{padding:11px 10px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#334155}
  tr:last-child td{border-bottom:none}
  .tots{max-width:240px;margin-left:auto;margin-top:20px}
  .tr{display:flex;justify-content:space-between;padding:5px 0;font-size:13px}
  .tg{border-top:2px solid #0f172a;padding-top:10px;margin-top:8px;font-size:16px;font-weight:800}
  .notes-box{margin-top:28px;padding:14px 16px;background:#f8fafc;border-radius:8px}
  .nl{font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px}
  .nt{font-size:12px;color:#64748b;line-height:1.6;white-space:pre-line}
  .ft{margin-top:40px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:16px}
  @media print{body{padding:20px}}
</style>
</head><body>
<div class="hd">
  <div style="display:flex;align-items:center;gap:14px">
    <div class="logo">G</div>
    <div>
      <div class="co-name">${esc(COMPANY.name)}</div>
      <div class="co-sub">${esc(COMPANY.tagline)}</div>
      <div class="co-sub">${esc(COMPANY.address)}</div>
      <div class="co-sub">GST: ${esc(COMPANY.gst)}</div>
    </div>
  </div>
  <div style="text-align:right">
    <div class="it">INVOICE</div>
    <div class="in">${esc(invNum)}</div>
    <div class="id">
      ${date ? `Date: ${esc(date)}<br>` : ''}
      ${dueDate ? `Due: ${esc(dueDate)}<br>` : ''}
    </div>
  </div>
</div>
<hr>
<div class="lbl">Bill To</div>
<div class="bn">${esc(client) || '—'}</div>
${clientEmail ? `<div class="bd">${esc(clientEmail)}</div>` : ''}
${clientAddr  ? `<div class="bd">${esc(clientAddr)}</div>`  : ''}
<div><span class="st s-${status}">${status}</span></div>
<table>
  <thead>
    <tr>
      <th style="width:32px">#</th>
      <th>Description</th>
      <th style="text-align:right;width:48px">Qty</th>
      <th style="text-align:right;width:100px">Rate</th>
      <th style="text-align:right;width:100px">Amount</th>
    </tr>
  </thead>
  <tbody>
    ${rows || '<tr><td colspan="5" style="text-align:center;padding:20px;color:#94a3b8;font-style:italic">No items</td></tr>'}
  </tbody>
</table>
<div class="tots">
  <div class="tr"><span style="color:#64748b">Subtotal</span><span>${fmtRs(subtotal)}</span></div>
  ${gstPct > 0 ? `<div class="tr"><span style="color:#64748b">GST (${gstPct}%)</span><span>${fmtRs(gstAmt)}</span></div>` : ''}
  <div class="tr tg"><span>Total</span><span style="color:#6366f1">${fmtRs(total)}</span></div>
</div>
${notes ? `<div class="notes-box"><div class="nl">Notes</div><div class="nt">${esc(notes)}</div></div>` : ''}
<div class="ft">${esc(COMPANY.name)} · ${esc(COMPANY.email)} · Thank you for your business!</div>
</body></html>`;

    const w = window.open('', '_blank', 'width=900,height=720');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.onload = () => { w.focus(); w.print(); };
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="designer-overlay">
      {/* Top bar */}
      <div className="designer-bar">
        <div className="designer-bar-left">
          <button className="btn" style={{ padding: '6px 10px' }} onClick={onClose}>
            <i className="ti ti-arrow-left" />
          </button>
          <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>
            {isEdit ? 'Edit Invoice' : 'Invoice Designer'}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text3)', fontFamily: 'monospace' }}>{invNum}</span>
        </div>
        <div className="designer-bar-right">
          {error && <span style={{ fontSize: '12px', color: 'var(--red)' }}>{error}</span>}
          <button className="btn" onClick={printInvoice}>
            <i className="ti ti-printer" />Print / PDF
          </button>
          <button className="btn btn-p" onClick={save} disabled={saving}>
            <i className={saving ? 'ti ti-loader' : 'ti ti-device-floppy'} />
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Save Invoice'}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="designer-body">

        {/* Left: Form */}
        <div className="designer-form">
          <datalist id="inv-clients">
            {clientList.map(n => <option key={n} value={n} />)}
          </datalist>

          <div className="ds-section">
            <div className="ds-header">Invoice Details</div>
            <div className="form-row">
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-label">Invoice Number</label>
                <input className="form-input" value={invNum} onChange={e => setInvNum(e.target.value)} />
              </div>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-label">Status</label>
                <select className="form-input" value={status}
                  onChange={e => setStatus(e.target.value as Invoice['status'])}>
                  <option>Pending</option>
                  <option>Paid</option>
                  <option>Partial</option>
                  <option>Overdue</option>
                </select>
              </div>
            </div>
            <div className="form-row" style={{ marginTop: '12px', marginBottom: 0 }}>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-label">Invoice Date</label>
                <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-label">Due Date</label>
                <input type="date" className="form-input" value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="ds-section">
            <div className="ds-header">Bill To</div>
            <div className="form-field">
              <label className="form-label">Client Name *</label>
              <input className="form-input" list="inv-clients" placeholder="e.g. Nexus Brands"
                value={client} onChange={e => {
                  const name = e.target.value;
                  setClient(name);
                  setError('');
                  const found = clientData.find(c => c.name === name);
                  if (found?.email && !clientEmail) setClientEmail(found.email);
                }} />
            </div>
            {activeServices.length > 0 && (
              <div className="form-field">
                <label className="form-label">Services</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '4px' }}>
                  {activeServices.map(svc => (
                    <label
                      key={svc.name}
                      style={{ display: 'flex', alignItems: 'center', gap: '9px', cursor: 'pointer',
                        padding: '6px 10px', borderRadius: '6px',
                        background: checkedServiceSet.has(svc.name) ? 'var(--indigo-dim)' : 'var(--surface)',
                        border: `1px solid ${checkedServiceSet.has(svc.name) ? 'var(--indigo)' : 'var(--border)'}`,
                        transition: 'all 0.1s',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checkedServiceSet.has(svc.name)}
                        onChange={() => toggleService(svc)}
                        style={{ accentColor: 'var(--indigo)', width: '14px', height: '14px', flexShrink: 0 }}
                      />
                      <span style={{ flex: 1, fontSize: '12px', color: 'var(--text)' }}>{svc.name}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text3)', fontFamily: 'monospace' }}>
                        ₹{svc.amount.toLocaleString('en-IN')}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="form-field">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" placeholder="billing@client.com"
                value={clientEmail} onChange={e => setClientEmail(e.target.value)} />
            </div>
            <div className="form-field" style={{ marginBottom: 0 }}>
              <label className="form-label">Address</label>
              <textarea className="form-input" rows={2}
                placeholder="123 MG Road, Bengaluru 560001"
                value={clientAddr} onChange={e => setClientAddr(e.target.value)} />
            </div>
          </div>

          <div className="ds-section">
            <div className="ds-header">Line Items</div>
            <div className="li-cols">
              <span>Description</span>
              <span style={{ textAlign: 'center' }}>Qty</span>
              <span style={{ textAlign: 'right' }}>Rate (₹)</span>
              <span style={{ textAlign: 'right' }}>Amt</span>
              <span />
            </div>
            {items.map((it, idx) => (
              <div key={idx} className="li-row">
                <input className="form-input" placeholder="Service / item"
                  value={it.description} onChange={e => updItem(idx, 'description', e.target.value)} />
                <input className="form-input" type="number" min="1" style={{ textAlign: 'center' }}
                  value={it.qty} onChange={e => updItem(idx, 'qty', e.target.value)} />
                <input className="form-input" type="number" min="0" placeholder="0"
                  value={it.unitPrice} onChange={e => updItem(idx, 'unitPrice', e.target.value)} />
                <div className="li-amt">{parsed[idx].amt > 0 ? fmtRs(parsed[idx].amt) : '—'}</div>
                <button className="li-del" onClick={() => delItem(idx)}>
                  <i className="ti ti-x" style={{ fontSize: '13px' }} />
                </button>
              </div>
            ))}
            <button className="btn" style={{ marginTop: '10px' }} onClick={addItem}>
              <i className="ti ti-plus" />Add Line Item
            </button>
          </div>

          <div className="ds-section">
            <div className="ds-header">Tax</div>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
              <div className="form-field" style={{ maxWidth: '140px', marginBottom: 0 }}>
                <label className="form-label">GST Rate</label>
                <select className="form-input" value={gstRate} onChange={e => setGstRate(e.target.value)}>
                  {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                </select>
              </div>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-label">Transaction Type</label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {(['Intrastate', 'Interstate'] as const).map(t => (
                    <button key={t} type="button" onClick={() => setTaxType(t)}
                      style={{
                        padding: '5px 12px', fontSize: '11px', borderRadius: '6px', cursor: 'pointer',
                        border: `1px solid ${taxType === t ? 'var(--indigo)' : 'var(--border)'}`,
                        background: taxType === t ? 'var(--indigo-dim)' : 'transparent',
                        color: taxType === t ? 'var(--indigo)' : 'var(--text2)',
                        fontWeight: taxType === t ? 700 : 400,
                      }}>
                      {t === 'Intrastate' ? 'Intrastate (CGST+SGST)' : 'Interstate (IGST)'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="ds-section">
            <div className="ds-header">TDS Deduction</div>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
              <div className="form-field" style={{ maxWidth: '180px', marginBottom: 0 }}>
                <label className="form-label">TDS Section</label>
                <select className="form-input" value={tdsSection} onChange={e => {
                  const sec = e.target.value;
                  setTdsSection(sec);
                  const rates: Record<string, number> = { '194J': 10, '194C': 1, '194H': 5, '194I': 10, 'None': 0 };
                  setTdsRate(rates[sec] ?? 0);
                }}>
                  <option value="None">None</option>
                  <option value="194J">194J — Professional / Technical (10%)</option>
                  <option value="194C">194C — Contractor (1%)</option>
                  <option value="194H">194H — Commission (5%)</option>
                  <option value="194I">194I — Rent (10%)</option>
                </select>
              </div>
              {tdsSection !== 'None' && (
                <div className="form-field" style={{ maxWidth: '100px', marginBottom: 0 }}>
                  <label className="form-label">TDS Rate %</label>
                  <input type="number" className="form-input" min={0} max={30} step={0.5}
                    value={tdsRate} onChange={e => setTdsRate(parseFloat(e.target.value) || 0)} />
                </div>
              )}
              {tdsSection !== 'None' && (
                <div style={{ fontSize: '12px', color: 'var(--amber)', paddingBottom: '4px' }}>
                  TDS deducted: <strong>{fmtRs(tdsAmount)}</strong>
                  <div style={{ color: 'var(--text2)', fontSize: '11px' }}>Net receivable: {fmtRs(netAfterTds)}</div>
                </div>
              )}
            </div>
          </div>

          <div className="ds-section">
            <div className="ds-header">Notes</div>
            <textarea className="form-input" rows={3} value={notes}
              onChange={e => setNotes(e.target.value)} />
          </div>
        </div>

        {/* Right: Live preview */}
        <div className="designer-preview">
          <div className="inv-card">

            {/* Header: company + invoice meta */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                  background: 'linear-gradient(135deg, #10b981, #6366f1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, fontWeight: 800, color: '#fff',
                }}>G</div>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>{COMPANY.name}</div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{COMPANY.tagline}</div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{COMPANY.address}</div>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>GST: {COMPANY.gst}</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '28px', fontWeight: 900, color: '#6366f1', letterSpacing: '-1px' }}>INVOICE</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>{invNum}</div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '8px', lineHeight: 1.8 }}>
                  {date    && <div>Date: {date}</div>}
                  {dueDate && <div>Due: {dueDate}</div>}
                </div>
              </div>
            </div>

            <hr className="inv-divider" />

            {/* Bill to */}
            <div style={{ marginBottom: '24px' }}>
              <div className="inv-section-label">Bill To</div>
              {client
                ? <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>{client}</div>
                : <div style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '14px' }}>Client name</div>}
              {clientEmail && <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>{clientEmail}</div>}
              {clientAddr  && <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px', whiteSpace: 'pre-line' }}>{clientAddr}</div>}
              <div style={{ marginTop: '10px' }}>
                <span style={statusColors(status)}>{status}</span>
              </div>
            </div>

            {/* Line items */}
            <table>
              <thead>
                <tr>
                  <th style={{ width: 32 }}>#</th>
                  <th>Description</th>
                  <th style={{ textAlign: 'right', width: 48 }}>Qty</th>
                  <th style={{ textAlign: 'right', width: 96 }}>Rate</th>
                  <th style={{ textAlign: 'right', width: 96 }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {parsed.filter(it => it.description || it.amt > 0).length > 0
                  ? parsed.filter(it => it.description || it.amt > 0).map((it, i) => (
                    <tr key={i}>
                      <td style={{ color: '#94a3b8' }}>{i + 1}</td>
                      <td>{it.description || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>—</span>}</td>
                      <td style={{ textAlign: 'right' }}>{it.q || '—'}</td>
                      <td style={{ textAlign: 'right' }}>{it.p > 0 ? fmtRs(it.p) : '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>
                        {it.amt > 0 ? fmtRs(it.amt) : '—'}
                      </td>
                    </tr>
                  ))
                  : (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontStyle: 'italic' }}>
                        Add line items on the left
                      </td>
                    </tr>
                  )}
              </tbody>
            </table>

            {/* Totals */}
            <div style={{ borderTop: '2px solid #e2e8f0', paddingTop: '16px', marginTop: '4px' }}>
              <div style={{ maxWidth: '240px', marginLeft: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '13px' }}>
                  <span style={{ color: '#64748b' }}>Subtotal</span>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{fmtRs(subtotal)}</span>
                </div>
                {gstPct > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '13px' }}>
                    <span style={{ color: '#64748b' }}>GST ({gstPct}%)</span>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{fmtRs(gstAmt)}</span>
                  </div>
                )}
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  borderTop: '2px solid #0f172a', paddingTop: '10px', marginTop: '8px',
                  fontSize: '17px', fontWeight: 800,
                }}>
                  <span style={{ color: '#0f172a' }}>Total</span>
                  <span style={{ color: '#6366f1' }}>{fmtRs(total)}</span>
                </div>
                {tdsSection !== 'None' && tdsAmount > 0 && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '12px', color: '#64748b', marginTop: '8px' }}>
                      <span>TDS u/s {tdsSection} ({tdsRate}%)</span>
                      <span style={{ color: '#b45309' }}>− {fmtRs(tdsAmount)}</span>
                    </div>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      borderTop: '1px dashed #e2e8f0', paddingTop: '8px', marginTop: '4px',
                      fontSize: '13px', fontWeight: 700,
                    }}>
                      <span style={{ color: '#64748b' }}>Net Receivable</span>
                      <span style={{ color: '#059669' }}>{fmtRs(netAfterTds)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Notes */}
            {notes && (
              <div style={{ marginTop: '28px', padding: '14px 16px', background: '#f8fafc', borderRadius: '8px' }}>
                <div className="inv-section-label">Notes</div>
                <div style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{notes}</div>
              </div>
            )}

            {/* Footer */}
            <div style={{ marginTop: '32px', paddingTop: '16px', borderTop: '1px solid #e2e8f0', textAlign: 'center', fontSize: '11px', color: '#94a3b8' }}>
              {COMPANY.name} · {COMPANY.email} · {COMPANY.phone}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
