import { Router, Request, Response } from 'express';
import Expense from '../models/Expense';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const filter: Record<string, string> = {};
    if (req.query.category) filter.category = req.query.category as string;
    const expenses = await Expense.find(filter).sort({ createdAt: -1 });
    res.json(expenses);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const expense = await Expense.create(req.body);
    res.status(201).json(expense);
  } catch {
    res.status(400).json({ error: 'Invalid data' });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const expense = await Expense.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!expense) return res.status(404).json({ error: 'Not found' });
    res.json(expense);
  } catch {
    res.status(400).json({ error: 'Invalid data' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await Expense.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
