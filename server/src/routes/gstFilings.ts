import { Router, Request, Response } from 'express';
import GSTFiling from '../models/GSTFiling';
import AppSettings from '../models/AppSettings';
import Invoice from '../models/Invoice';
import { sendGSTReminder } from '../services/emailService';

const router = Router();

function gstSplit(gst: number, taxType?: string) {
  if (taxType === 'Interstate') return { cgst: 0, sgst: 0, igst: gst };
  const half = Math.floor(gst / 2);
  return { cgst: half, sgst: gst - half, igst: 0 };
}

// GET / — all filing records
router.get('/', async (_req: Request, res: Response) => {
  try {
    const filings = await GSTFiling.find().sort({ period: -1 });
    res.json(filings);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /smtp — SMTP config (password masked)
router.get('/smtp', async (_req: Request, res: Response) => {
  try {
    const s = await AppSettings.findOne();
    res.json({
      smtpHost:   s?.smtpHost  || '',
      smtpPort:   s?.smtpPort  || 587,
      smtpUser:   s?.smtpUser  || '',
      smtpPass:   s?.smtpPass  ? '••••••••' : '',
      configured: !!(s?.smtpHost && s?.smtpUser && s?.smtpPass),
    });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /smtp — save SMTP config
router.put('/smtp', async (req: Request, res: Response) => {
  try {
    const { smtpHost, smtpPort, smtpUser, smtpPass } = req.body as {
      smtpHost: string; smtpPort: number; smtpUser: string; smtpPass: string;
    };
    const update: Record<string, unknown> = { smtpHost, smtpPort, smtpUser };
    if (smtpPass && smtpPass !== '••••••••') update.smtpPass = smtpPass;
    await AppSettings.findOneAndUpdate({}, { $set: update }, { upsert: true, new: true });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /upsert — create or update a filing record for a period
router.post('/upsert', async (req: Request, res: Response) => {
  try {
    const { period, ...rest } = req.body as { period: string; [k: string]: unknown };
    if (!period) return res.status(400).json({ error: 'period required' });
    const filing = await GSTFiling.findOneAndUpdate(
      { period },
      { $set: { period, ...rest } },
      { upsert: true, new: true }
    );
    res.json(filing);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /:id/mark-filed — mark a period as filed
router.post('/:id/mark-filed', async (req: Request, res: Response) => {
  try {
    const { filedAt } = req.body as { filedAt?: string };
    const date = filedAt || new Date().toISOString().slice(0, 10);
    const filing = await GSTFiling.findByIdAndUpdate(
      req.params.id,
      { $set: { status: 'Filed', filedAt: date } },
      { new: true }
    );
    if (!filing) return res.status(404).json({ error: 'Not found' });
    res.json(filing);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /:id/mark-due — revert filing back to Due
router.post('/:id/mark-due', async (req: Request, res: Response) => {
  try {
    const filing = await GSTFiling.findByIdAndUpdate(
      req.params.id,
      { $set: { status: 'Due' }, $unset: { filedAt: '' } },
      { new: true }
    );
    if (!filing) return res.status(404).json({ error: 'Not found' });
    res.json(filing);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /:id/send-reminder — manually trigger reminder email
router.post('/:id/send-reminder', async (req: Request, res: Response) => {
  try {
    const filing = await GSTFiling.findById(req.params.id);
    if (!filing) return res.status(404).json({ error: 'Not found' });
    if (!filing.reminderEmail) return res.status(400).json({ error: 'No reminder email set on this filing' });

    const invoices = await Invoice.find({ date: { $regex: `^${filing.period}` } });
    let outputGST = 0, cgst = 0, sgst = 0, igst = 0;
    invoices.forEach(inv => {
      const split = gstSplit(inv.gst || 0, (inv as unknown as { taxType?: string }).taxType);
      outputGST += inv.gst || 0;
      cgst += split.cgst; sgst += split.sgst; igst += split.igst;
    });

    const result = await sendGSTReminder({ to: filing.reminderEmail, period: filing.period, dueDate: filing.dueDate, outputGST, cgst, sgst, igst });
    if (result.ok) {
      await GSTFiling.findByIdAndUpdate(filing._id, { reminderSent: true });
      res.json({ ok: true });
    } else {
      res.status(500).json({ error: result.error || 'Send failed' });
    }
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

// Called by daily cron in index.ts
export async function runGSTReminderCron() {
  try {
    const today = new Date();
    const filings = await GSTFiling.find({ status: 'Due', reminderSent: false, reminderEmail: { $ne: '' } });
    for (const filing of filings) {
      const daysUntil = Math.ceil((new Date(filing.dueDate).getTime() - today.getTime()) / 86400000);
      if (daysUntil <= filing.reminderDays && daysUntil >= 0) {
        const invoices = await Invoice.find({ date: { $regex: `^${filing.period}` } });
        let outputGST = 0, cgst = 0, sgst = 0, igst = 0;
        invoices.forEach(inv => {
          const split = gstSplit(inv.gst || 0, (inv as unknown as { taxType?: string }).taxType);
          outputGST += inv.gst || 0;
          cgst += split.cgst; sgst += split.sgst; igst += split.igst;
        });
        const result = await sendGSTReminder({ to: filing.reminderEmail, period: filing.period, dueDate: filing.dueDate, outputGST, cgst, sgst, igst });
        if (result.ok) {
          await GSTFiling.findByIdAndUpdate(filing._id, { reminderSent: true });
          console.log(`[GST Cron] Reminder sent: ${filing.period} → ${filing.reminderEmail}`);
        } else {
          console.error(`[GST Cron] Failed ${filing.period}: ${result.error}`);
        }
      }
    }
  } catch (err) {
    console.error('[GST Cron] Error:', err);
  }
}
