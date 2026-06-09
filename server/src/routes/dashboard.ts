import { Router, Request, Response } from 'express';
import Invoice from '../models/Invoice';
import Expense from '../models/Expense';
import Client from '../models/Client';

const router = Router();

router.get('/kpis', async (_req: Request, res: Response) => {
  try {
    const [invoices, expenses, clients] = await Promise.all([
      Invoice.find(),
      Expense.find(),
      Client.find(),
    ]);

    const totalRevenue = invoices.reduce((s, i) => s + (i.total || 0), 0);
    const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    const netProfit = totalRevenue - totalExpenses;
    const pendingReceivables = invoices
      .filter(i => ['Pending', 'Partial'].includes(i.status))
      .reduce((s, i) => s + (i.total || 0), 0);
    const overduePayments = invoices
      .filter(i => i.status === 'Overdue')
      .reduce((s, i) => s + (i.total || 0), 0);
    const overdueCount = invoices.filter(i => i.status === 'Overdue').length;
    const pendingCount = invoices.filter(i => i.status === 'Pending' || i.status === 'Partial').length;
    const activeClients = clients.filter(c => c.status === 'Active').length;

    res.json({
      totalRevenue,
      netProfit,
      netProfitMargin: totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0,
      pendingReceivables,
      totalExpenses,
      cashInBank: 2210000,
      monthlyBurn: 940000,
      activeClients,
      totalClients: clients.length,
      overduePayments,
      overdueCount,
      pendingCount,
    });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
