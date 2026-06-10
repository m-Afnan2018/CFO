import { Router, Request, Response } from 'express';
import Invoice from '../models/Invoice';

const router = Router();

router.get('/next-number', async (_req: Request, res: Response) => {
  try {
    const count = await Invoice.countDocuments();
    res.json({ number: `INV-${String(count + 1).padStart(3, '0')}` });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const filter: Record<string, string> = {};
    if (req.query.status) filter.status = req.query.status as string;
    const invoices = await Invoice.find(filter).sort({ createdAt: -1 });
    res.json(invoices);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Not found' });
    res.json(invoice);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const invoice = await Invoice.create(req.body);
    res.status(201).json(invoice);
  } catch {
    res.status(400).json({ error: 'Invalid data' });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const invoice = await Invoice.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    if (!invoice) return res.status(404).json({ error: 'Not found' });
    res.json(invoice);
  } catch {
    res.status(400).json({ error: 'Invalid data' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const invoice = await Invoice.findByIdAndDelete(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
