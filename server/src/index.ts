import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cron from 'node-cron';
import authRoutes from './routes/auth';
import clientRoutes from './routes/clients';
import invoiceRoutes from './routes/invoices';
import expenseRoutes from './routes/expenses';
import employeeRoutes from './routes/employees';
import salaryRecordRoutes from './routes/salaryRecords';
import dashboardRoutes from './routes/dashboard';
import slipTemplateRoutes from './routes/slipTemplate';
import clientRecordRoutes from './routes/clientRecords';
import gstFilingsRoutes, { runGSTReminderCron } from './routes/gstFilings';
import tdsFilingsRoutes, { runTDSReminderCron } from './routes/tdsFilings';
import { requireAuth } from './middleware/authMiddleware';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/cfo_dashboard';

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Auth routes are public — registered before requireAuth
app.use('/api/auth', authRoutes);
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// All other /api/* routes require a valid session
app.use('/api', requireAuth);

app.use('/api/clients', clientRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/salary-records', salaryRecordRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/slip-template', slipTemplateRoutes);
app.use('/api/client-records', clientRecordRoutes);
app.use('/api/gst-filings', gstFilingsRoutes);
app.use('/api/tds-filings', tdsFilingsRoutes);

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
    // Daily GST reminder check — 09:00 IST every day
    cron.schedule('0 9 * * *', () => { void runGSTReminderCron(); void runTDSReminderCron(); }, { timezone: 'Asia/Kolkata' });
  })
  .catch(err => {
    console.error('MongoDB connection failed:', err);
    process.exit(1);
  });
