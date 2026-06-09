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
  getDashboardKPIs: () => get('/dashboard/kpis'),
};
