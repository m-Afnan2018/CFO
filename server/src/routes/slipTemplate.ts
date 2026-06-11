import { Router, Request, Response } from 'express';
import SlipTemplate from '../models/SlipTemplate';

const router = Router();

const DEFAULT = {
  companyName: 'Ganesyx Pvt Ltd',
  companyAddress: '',
  companyEmail: '',
  companyPhone: '',
  website: '',
  panNumber: '',
  footerNote: 'This is a system generated payslip and does not require a signature.',
};

router.get('/', async (_req: Request, res: Response) => {
  try {
    const tpl = await SlipTemplate.findOne();
    res.json(tpl || DEFAULT);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/', async (req: Request, res: Response) => {
  try {
    const tpl = await SlipTemplate.findOneAndUpdate(
      {},
      { $set: req.body },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json(tpl);
  } catch {
    res.status(400).json({ error: 'Invalid data' });
  }
});

export default router;
