import { Router, Request, Response } from 'express';
import TDSFiling from '../models/TDSFiling';
import Invoice from '../models/Invoice';
import { sendTDSReminder } from '../services/emailService';

const router = Router();

type InvWithTDS = { tdsAmount?: number; tdsSection?: string };

function tdsSplit(inv: InvWithTDS) {
  const amt = inv.tdsAmount || 0;
  const sec = inv.tdsSection || 'None';
  return {
    tds194J:  sec === '194J'                                            ? amt : 0,
    tds194C:  sec === '194C'                                            ? amt : 0,
    tdsOther: sec !== '194J' && sec !== '194C' && sec !== 'None' ? amt : 0,
  };
}

async function getQuarterTotals(quarter: string) {
  const fy    = parseInt(quarter.slice(2, 6));
  const qPart = quarter.split('-')[1];
  let startDate: string, endDate: string;
  if      (qPart === 'Q1') { startDate = `${fy}-04-01`;     endDate = `${fy}-06-30`; }
  else if (qPart === 'Q2') { startDate = `${fy}-07-01`;     endDate = `${fy}-09-30`; }
  else if (qPart === 'Q3') { startDate = `${fy}-10-01`;     endDate = `${fy}-12-31`; }
  else                      { startDate = `${fy+1}-01-01`;  endDate = `${fy+1}-03-31`; }

  const invoices = (await Invoice.find({ date: { $gte: startDate, $lte: endDate } })) as unknown as InvWithTDS[];
  let tdsTotal = 0, tds194J = 0, tds194C = 0, tdsOther = 0;
  invoices.forEach(inv => {
    tdsTotal += inv.tdsAmount || 0;
    const s = tdsSplit(inv);
    tds194J += s.tds194J; tds194C += s.tds194C; tdsOther += s.tdsOther;
  });
  return { tdsTotal, tds194J, tds194C, tdsOther };
}

// GET /
router.get('/', async (_req: Request, res: Response) => {
  try {
    res.json(await TDSFiling.find().sort({ quarter: -1 }));
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// POST /upsert
router.post('/upsert', async (req: Request, res: Response) => {
  try {
    const { quarter, ...rest } = req.body as { quarter: string; [k: string]: unknown };
    if (!quarter) return res.status(400).json({ error: 'quarter required' });
    const filing = await TDSFiling.findOneAndUpdate({ quarter }, { $set: { quarter, ...rest } }, { upsert: true, new: true });
    res.json(filing);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// POST /:id/mark-received
router.post('/:id/mark-received', async (req: Request, res: Response) => {
  try {
    const date = (req.body as { receivedAt?: string }).receivedAt || new Date().toISOString().slice(0, 10);
    const filing = await TDSFiling.findByIdAndUpdate(req.params.id, { $set: { status: 'Received', receivedAt: date } }, { new: true });
    if (!filing) return res.status(404).json({ error: 'Not found' });
    res.json(filing);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// POST /:id/mark-pending
router.post('/:id/mark-pending', async (req: Request, res: Response) => {
  try {
    const filing = await TDSFiling.findByIdAndUpdate(req.params.id, { $set: { status: 'Pending' }, $unset: { receivedAt: '' } }, { new: true });
    if (!filing) return res.status(404).json({ error: 'Not found' });
    res.json(filing);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// POST /:id/send-reminder
router.post('/:id/send-reminder', async (req: Request, res: Response) => {
  try {
    const filing = await TDSFiling.findById(req.params.id);
    if (!filing) return res.status(404).json({ error: 'Not found' });
    if (!filing.reminderEmail) return res.status(400).json({ error: 'No reminder email set' });
    const totals = await getQuarterTotals(filing.quarter);
    const result = await sendTDSReminder({ to: filing.reminderEmail, quarter: filing.quarter, dueDate: filing.dueDate, ...totals });
    if (result.ok) {
      await TDSFiling.findByIdAndUpdate(filing._id, { reminderSent: true });
      res.json({ ok: true });
    } else {
      res.status(500).json({ error: result.error || 'Send failed' });
    }
  } catch { res.status(500).json({ error: 'Server error' }); }
});

export default router;

export async function runTDSReminderCron() {
  try {
    const today = new Date();
    const filings = await TDSFiling.find({ status: 'Pending', reminderSent: false, reminderEmail: { $ne: '' } });
    for (const filing of filings) {
      const daysUntil = Math.ceil((new Date(filing.dueDate).getTime() - today.getTime()) / 86400000);
      if (daysUntil <= filing.reminderDays && daysUntil >= 0) {
        const totals = await getQuarterTotals(filing.quarter);
        const result = await sendTDSReminder({ to: filing.reminderEmail, quarter: filing.quarter, dueDate: filing.dueDate, ...totals });
        if (result.ok) {
          await TDSFiling.findByIdAndUpdate(filing._id, { reminderSent: true });
          console.log(`[TDS Cron] Reminder sent: ${filing.quarter} → ${filing.reminderEmail}`);
        } else {
          console.error(`[TDS Cron] Failed ${filing.quarter}: ${result.error}`);
        }
      }
    }
  } catch (err) {
    console.error('[TDS Cron] Error:', err);
  }
}
