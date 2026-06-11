const API = '/api';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export const api = {
  getClients: () => get('/clients'),
  createClient: (data: unknown) => post('/clients', data),
  updateClient: (id: string, data: unknown) => put(`/clients/${id}`, data),
  deleteClient: (id: string) => del(`/clients/${id}`),
  getInvoices: (status?: string) => get(`/invoices${status ? `?status=${status}` : ''}`),
  getInvoice: (id: string) => get(`/invoices/${id}`),
  getNextInvoiceNumber: () => get('/invoices/next-number'),
  createInvoice: (data: unknown) => post('/invoices', data),
  updateInvoice: (id: string, data: unknown) => put(`/invoices/${id}`, data),
  deleteInvoice: (id: string) => del(`/invoices/${id}`),
  getExpenses: (category?: string) => get(`/expenses${category ? `?category=${category}` : ''}`),
  createExpense: (data: unknown) => post('/expenses', data),
  updateExpense: (id: string, data: unknown) => put(`/expenses/${id}`, data),
  deleteExpense: (id: string) => del(`/expenses/${id}`),
  getEmployees: () => get('/employees'),
  createEmployee: (data: unknown) => post('/employees', data),
  updateEmployee: (id: string, data: unknown) => put(`/employees/${id}`, data),
  deleteEmployee: (id: string) => del(`/employees/${id}`),
  getSalaryPeriods: () => get('/salary-records/periods'),
  getSalaryRecords: (period: string) => get(`/salary-records?period=${encodeURIComponent(period)}`),
  runPayroll: (period: string) => post('/salary-records/run', { period }),
  processPeriod: (period: string) => put(`/salary-records/period/${encodeURIComponent(period)}/process`, {}),
  updateSalaryRecord: (id: string, data: unknown) => put(`/salary-records/${id}`, data),
  deleteSalaryPeriod: (period: string) => del(`/salary-records/period/${encodeURIComponent(period)}`),
  getSalaryAnalytics: () => get('/salary-records/analytics'),
  getClientBillingPeriods: () => get('/client-records/periods'),
  getClientYearlySummary: () => get('/client-records/yearly'),
  getClientRecords: (period: string) => get(`/client-records?period=${encodeURIComponent(period)}`),
  runClientBilling: (period: string, clients?: unknown[]) => post('/client-records/run', { period, ...(clients ? { clients } : {}) }),
  processClientPeriod: (period: string) => put(`/client-records/period/${encodeURIComponent(period)}/process`, {}),
  updateClientRecord: (id: string, data: unknown) => put(`/client-records/${id}`, data),
  deleteClientBillingPeriod: (period: string) => del(`/client-records/period/${encodeURIComponent(period)}`),
  getDashboardKPIs: () => get('/dashboard/kpis'),
  getSlipTemplate: () => get('/slip-template'),
  saveSlipTemplate: (data: unknown) => put('/slip-template', data),
  getGSTFilings: () => get('/gst-filings'),
  upsertGSTFiling: (data: unknown) => post('/gst-filings/upsert', data),
  markGSTFiled: (id: string, filedAt?: string) => post(`/gst-filings/${id}/mark-filed`, { filedAt }),
  markGSTDue: (id: string) => post(`/gst-filings/${id}/mark-due`, {}),
  sendGSTReminder: (id: string) => post(`/gst-filings/${id}/send-reminder`, {}),
  getSMTPConfig: () => get('/gst-filings/smtp'),
  saveSMTPConfig: (data: unknown) => put('/gst-filings/smtp', data),
  getTDSFilings: () => get('/tds-filings'),
  upsertTDSFiling: (data: unknown) => post('/tds-filings/upsert', data),
  markTDSReceived: (id: string, receivedAt?: string) => post(`/tds-filings/${id}/mark-received`, { receivedAt }),
  markTDSPending: (id: string) => post(`/tds-filings/${id}/mark-pending`, {}),
  sendTDSReminder: (id: string) => post(`/tds-filings/${id}/send-reminder`, {}),
};
