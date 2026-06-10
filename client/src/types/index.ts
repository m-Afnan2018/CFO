export type Page =
  | 'overview'
  | 'clients'
  | 'invoices'
  | 'payments'
  | 'expenses'
  | 'payroll'
  | 'cashflow'
  | 'profit'
  | 'gst'
  | 'alerts'
  | 'reports';

export type ColorKey = 'emerald' | 'indigo' | 'blue' | 'amber' | 'red';

export interface ServiceItem {
  name: string;
  amount: number;
}

export interface Client {
  _id: string;
  name: string;
  email: string;
  service: string;
  monthlyBilling: number;
  serviceBreakdown?: ServiceItem[];
  manager: string;
  renewal: string;
  status: 'Active' | 'Inactive' | 'Renewal Due';
  initials: string;
  colorKey: ColorKey;
}

export interface LineItem {
  description: string;
  qty: number;
  unitPrice: number;
  amount: number;
}

export interface Invoice {
  _id: string;
  invoiceNumber: string;
  client: string;
  clientEmail?: string;
  clientAddress?: string;
  date: string;
  dueDate: string;
  lineItems?: LineItem[];
  amount: number;
  gst: number;
  gstRate?: number;
  total: number;
  notes?: string;
  status: 'Paid' | 'Pending' | 'Overdue' | 'Partial';
}

export interface Expense {
  _id: string;
  date: string;
  category: string;
  vendor: string;
  description: string;
  amount: number;
  type: 'Fixed' | 'Variable';
}

export interface Employee {
  _id: string;
  name: string;
  department: string;
  baseSalary: number;
  incentives: number;
  deductions: number;
  finalSalary: number;
  status: 'Paid' | 'Pending';
  initials: string;
  colorKey: ColorKey;
}

export interface SalaryRecord {
  _id: string;
  employeeId: string;
  name: string;
  department: string;
  baseSalary: number;
  incentives: number;
  deductions: number;
  leaveDays?: number;
  leaveDeduction?: number;
  bonus?: number;
  finalSalary: number;
  status: 'Paid' | 'Pending';
  payPeriod: string;
  initials: string;
  colorKey: ColorKey;
}

export interface PayPeriodSummary {
  _id: string;      // "2026-06"
  total: number;
  paid: number;
  pending: number;
  count: number;
  paidCount: number;
}

export interface PeriodEntry {
  period: string;
  finalSalary: number;
  baseSalary: number;
  incentives: number;
  deductions: number;
  status: string;
}

export interface EmployeeTrend {
  _id: string;
  name: string;
  department: string;
  initials: string;
  colorKey: ColorKey;
  periods: PeriodEntry[];
}

export interface SalaryAnalytics {
  employeeTrends: EmployeeTrend[];
}

export interface DashboardKPIs {
  totalRevenue: number;
  netProfit: number;
  netProfitMargin: number;
  pendingReceivables: number;
  totalExpenses: number;
  cashInBank: number;
  monthlyBurn: number;
  activeClients: number;
  totalClients: number;
  overduePayments: number;
  overdueCount: number;
  pendingCount: number;
}
