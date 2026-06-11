import { Router, Request, Response } from 'express';
import ClientRecord from '../models/ClientRecord';
import Client from '../models/Client';
import Invoice from '../models/Invoice';

function fmtDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function dueDate(from: Date) { const d = new Date(from); d.setDate(d.getDate() + 15); return d; }

async function makeInvoiceForRecord(record: { name: string; service: string; monthlyBilling: number; billingPeriod: string }, status: 'Paid' | 'Pending' | 'Partial') {
  const count = await Invoice.countDocuments();
  const today = new Date();
  const amount = record.monthlyBilling;
  const gst = Math.round(amount * 0.18);
  return Invoice.create({
    invoiceNumber: `INV-${String(count + 1).padStart(3, '0')}`,
    client: record.name,
    date: fmtDate(today),
    dueDate: fmtDate(dueDate(today)),
    lineItems: [{ description: record.service || '—', qty: 1, unitPrice: amount, amount }],
    amount,
    gst,
    gstRate: 18,
    total: amount + gst,
    notes: `Monthly billing — ${record.billingPeriod}`,
    status,
  });
}

const router = Router();

// GET /periods — all distinct billing periods with summary totals (newest first)
router.get('/periods', async (_req: Request, res: Response) => {
  try {
    const periods = await ClientRecord.aggregate([
      {
        $group: {
          _id: '$billingPeriod',
          total:    { $sum: '$monthlyBilling' },
          paid:     { $sum: { $cond: [{ $eq: ['$status', 'Paid'] },    '$monthlyBilling', 0] } },
          pending:  { $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, '$monthlyBilling', 0] } },
          count:    { $sum: 1 },
          paidCount: { $sum: { $cond: [{ $eq: ['$status', 'Paid'] }, 1, 0] } },
        },
      },
      { $sort: { _id: -1 } },
    ]);
    res.json(periods);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /?period=2026-06 — records for a specific billing period
router.get('/', async (req: Request, res: Response) => {
  try {
    const { period } = req.query;
    const filter = period ? { billingPeriod: period } : {};
    const records = await ClientRecord.find(filter).sort({ name: 1 });
    res.json(records);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

interface ClientOverride {
  clientId: string;
  name: string;
  service: string;
  monthlyBilling: number;
  manager: string;
  initials: string;
  colorKey: string;
}

// POST /run — snapshot clients into a new billing period.
// Body: { period, clients? }  — if clients[] is provided those entries are used directly;
// otherwise all active clients are fetched from the DB.
router.post('/run', async (req: Request, res: Response) => {
  try {
    const { period, clients: overrides } = req.body as { period: string; clients?: ClientOverride[] };
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return res.status(400).json({ error: 'period must be YYYY-MM' });
    }
    const existing = await ClientRecord.countDocuments({ billingPeriod: period });
    if (existing > 0) {
      return res.status(409).json({ error: `Billing for ${period} already exists` });
    }

    let records: object[];
    if (overrides && overrides.length > 0) {
      records = overrides.map(c => ({
        clientId: c.clientId,
        name: c.name,
        service: c.service || '—',
        monthlyBilling: Number(c.monthlyBilling) || 0,
        manager: c.manager || '',
        status: 'Pending' as const,
        billingPeriod: period,
        initials: c.initials,
        colorKey: c.colorKey || 'emerald',
      }));
    } else {
      const clients = await Client.find({ status: 'Active' });
      if (!clients.length) {
        return res.status(400).json({ error: 'No active clients to bill' });
      }
      records = clients.map(c => ({
        clientId: c._id,
        name: c.name,
        service: c.service || '—',
        monthlyBilling: c.monthlyBilling || 0,
        manager: c.manager || '',
        status: 'Pending' as const,
        billingPeriod: period,
        initials: c.initials,
        colorKey: c.colorKey,
      }));
    }

    const created = await ClientRecord.insertMany(records);
    res.status(201).json(created);
  } catch (err) {
    console.error('clientRecords POST /run:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /period/:period/process — mark all Pending records in a period as Paid (auto-creates invoices)
router.put('/period/:period/process', async (req: Request, res: Response) => {
  try {
    const period = req.params.period;
    const pending = await ClientRecord.find({ billingPeriod: period, status: 'Pending' });
    for (const record of pending) {
      if (record.invoiceId) {
        await Invoice.findByIdAndUpdate(record.invoiceId, { status: 'Paid' });
        await ClientRecord.findByIdAndUpdate(record._id, { status: 'Paid' });
      } else {
        const inv = await makeInvoiceForRecord(record, 'Paid');
        await ClientRecord.findByIdAndUpdate(record._id, { status: 'Paid', invoiceId: inv._id });
      }
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /:id — update a single record; auto-creates/updates invoice on status changes
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const existing = await ClientRecord.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const record = await ClientRecord.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    if (!record) return res.status(404).json({ error: 'Not found' });

    const newStatus = req.body.status as string | undefined;
    const isPaidOrPartial = newStatus === 'Paid' || newStatus === 'Partial';
    const wasNotPaidOrPartial = existing.status !== 'Paid' && existing.status !== 'Partial';

    if (isPaidOrPartial && wasNotPaidOrPartial) {
      const invStatus = newStatus as 'Paid' | 'Partial';
      if (existing.invoiceId) {
        await Invoice.findByIdAndUpdate(existing.invoiceId, { status: invStatus });
      } else {
        const inv = await makeInvoiceForRecord(record, invStatus);
        await ClientRecord.findByIdAndUpdate(req.params.id, { invoiceId: inv._id });
      }
    }

    if (newStatus === 'Pending' && (existing.status === 'Paid' || existing.status === 'Partial')) {
      if (existing.invoiceId) {
        await Invoice.findByIdAndUpdate(existing.invoiceId, { status: 'Pending' });
      }
      await ClientRecord.findByIdAndUpdate(req.params.id, { $set: { payments: [] } });
    }

    res.json(record);
  } catch {
    res.status(400).json({ error: 'Invalid data' });
  }
});

// DELETE /period/:period — remove all records for a billing period
router.delete('/period/:period', async (req: Request, res: Response) => {
  try {
    await ClientRecord.deleteMany({ billingPeriod: req.params.period });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
