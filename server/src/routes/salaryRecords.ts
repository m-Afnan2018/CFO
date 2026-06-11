import { Router, Request, Response } from 'express';
import SalaryRecord from '../models/SalaryRecord';
import Employee from '../models/Employee';

const router = Router();

// GET /periods — all distinct pay periods with summary totals (newest first)
router.get('/periods', async (_req: Request, res: Response) => {
  try {
    const periods = await SalaryRecord.aggregate([
      {
        $group: {
          _id: '$payPeriod',
          total: { $sum: '$finalSalary' },
          paid: { $sum: { $cond: [{ $eq: ['$status', 'Paid'] }, '$finalSalary', 0] } },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, '$finalSalary', 0] } },
          count: { $sum: 1 },
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

// GET /analytics — per-employee salary history across all periods
router.get('/analytics', async (_req: Request, res: Response) => {
  try {
    const employeeTrends = await SalaryRecord.aggregate([
      { $sort: { payPeriod: 1 } },
      {
        $group: {
          _id: '$employeeId',
          name: { $last: '$name' },
          department: { $last: '$department' },
          initials: { $last: '$initials' },
          colorKey: { $last: '$colorKey' },
          periods: {
            $push: {
              period: '$payPeriod',
              finalSalary: '$finalSalary',
              baseSalary: '$baseSalary',
              incentives: '$incentives',
              deductions: '$deductions',
              status: '$status',
            },
          },
        },
      },
      { $sort: { name: 1 } },
    ]);
    res.json({ employeeTrends });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /?period=2026-06 — records for a specific pay period
router.get('/', async (req: Request, res: Response) => {
  try {
    const { period } = req.query;
    const filter = period ? { payPeriod: period } : {};
    const records = await SalaryRecord.find(filter).sort({ name: 1 });
    res.json(records);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /run — snapshot all employees into a new pay period
router.post('/run', async (req: Request, res: Response) => {
  try {
    const { period } = req.body as { period: string };
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return res.status(400).json({ error: 'period must be YYYY-MM' });
    }

    const existing = await SalaryRecord.countDocuments({ payPeriod: period });
    if (existing > 0) {
      return res.status(409).json({ error: `Payroll for ${period} already exists` });
    }

    const employees = await Employee.find();
    if (!employees.length) {
      return res.status(400).json({ error: 'No employees to process' });
    }

    const records = employees.map(emp => ({
      employeeId: emp._id,
      name: emp.name,
      department: emp.department,
      baseSalary: emp.baseSalary,
      hra: emp.hra ?? 0,
      specialAllowance: emp.specialAllowance ?? 0,
      incentives: emp.incentives,
      providentFund: emp.providentFund ?? 0,
      esi: emp.esi ?? 0,
      professionalTax: emp.professionalTax ?? 0,
      tds: emp.tds ?? 0,
      deductions: emp.deductions,
      leaveDays: 0,
      leaveDeduction: 0,
      bonus: 0,
      finalSalary: emp.finalSalary,
      status: 'Pending' as const,
      payPeriod: period,
      initials: emp.initials,
      colorKey: emp.colorKey,
    }));

    const created = await SalaryRecord.insertMany(records);
    res.status(201).json(created);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /period/:period/process — mark all records in a period as Paid
router.put('/period/:period/process', async (req: Request, res: Response) => {
  try {
    const { period } = req.params;
    await SalaryRecord.updateMany({ payPeriod: period }, { status: 'Paid' });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /:id — update a single record (partial update)
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const record = await SalaryRecord.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    if (!record) return res.status(404).json({ error: 'Not found' });
    res.json(record);
  } catch {
    res.status(400).json({ error: 'Invalid data' });
  }
});

// DELETE /period/:period — remove all records for a period
router.delete('/period/:period', async (req: Request, res: Response) => {
  try {
    await SalaryRecord.deleteMany({ payPeriod: req.params.period });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
