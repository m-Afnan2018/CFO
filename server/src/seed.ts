import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Client from './models/Client';
import Invoice from './models/Invoice';
import Expense from './models/Expense';
import Employee from './models/Employee';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/cfo_dashboard';

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  await Promise.all([
    Client.deleteMany({}),
    Invoice.deleteMany({}),
    Expense.deleteMany({}),
    Employee.deleteMany({}),
  ]);

  await Client.insertMany([
    { name: 'Nexus Brands', email: 'nexus@brand.com', service: 'Social Media + SEO', monthlyBilling: 72000, manager: 'Riya Sharma', renewal: 'Jun 2025', status: 'Active', initials: 'NB', colorKey: 'emerald' },
    { name: 'BluePeak Retail', email: 'info@bluepeak.in', service: 'Performance Mktg', monthlyBilling: 58000, manager: 'Arjun Mehta', renewal: 'Aug 2025', status: 'Active', initials: 'BP', colorKey: 'indigo' },
    { name: 'Orion Digital', email: 'contact@orion.co', service: 'Web Dev + SEO', monthlyBilling: 49000, manager: 'Priya Kapoor', renewal: 'Apr 2025', status: 'Renewal Due', initials: 'OD', colorKey: 'blue' },
    { name: 'Kratos Corp', email: 'hi@kratos.com', service: 'Content Creation', monthlyBilling: 38000, manager: 'Riya Sharma', renewal: 'Sep 2025', status: 'Active', initials: 'KC', colorKey: 'amber' },
    { name: 'SkyEdge Media', email: 'sky@edge.media', service: 'Social Media', monthlyBilling: 31000, manager: 'Arjun Mehta', renewal: 'Jul 2025', status: 'Inactive', initials: 'SE', colorKey: 'red' },
  ]);
  console.log('Clients seeded');

  await Invoice.insertMany([
    { invoiceNumber: '#INV-0089', client: 'Nexus Brands', date: '01 Mar', dueDate: '15 Mar', amount: 105932, gst: 19068, total: 125000, status: 'Paid' },
    { invoiceNumber: '#INV-0088', client: 'BluePeak Retail', date: '28 Feb', dueDate: '14 Mar', amount: 83051, gst: 14949, total: 98000, status: 'Paid' },
    { invoiceNumber: '#INV-0087', client: 'Kratos Corp', date: '25 Feb', dueDate: '11 Mar', amount: 63559, gst: 11441, total: 75000, status: 'Partial' },
    { invoiceNumber: '#INV-0086', client: 'Orion Digital', date: '20 Feb', dueDate: '07 Mar', amount: 118644, gst: 21356, total: 140000, status: 'Overdue' },
    { invoiceNumber: '#INV-0085', client: 'SkyEdge Media', date: '15 Feb', dueDate: '01 Mar', amount: 52966, gst: 9534, total: 62500, status: 'Pending' },
  ]);
  console.log('Invoices seeded');

  await Expense.insertMany([
    { date: '10 Mar 2025', category: 'Salaries', vendor: '—', description: 'March salary disbursement', amount: 1420000, type: 'Fixed' },
    { date: '08 Mar 2025', category: 'Software', vendor: 'Adobe Inc', description: 'Creative Cloud annual', amount: 32000, type: 'Fixed' },
    { date: '05 Mar 2025', category: 'Freelancers', vendor: 'Content Tribe', description: 'Video production — 3 clients', amount: 85000, type: 'Variable' },
    { date: '03 Mar 2025', category: 'Rent', vendor: 'PropSol Pvt', description: 'Office rent — March', amount: 95000, type: 'Fixed' },
  ]);
  console.log('Expenses seeded');

  await Employee.insertMany([
    { name: 'Riya Sharma', department: 'Account Mgmt', baseSalary: 85000, incentives: 12000, deductions: 8500, finalSalary: 88500, status: 'Paid', initials: 'RS', colorKey: 'emerald' },
    { name: 'Arjun Mehta', department: 'Performance', baseSalary: 75000, incentives: 18000, deductions: 7500, finalSalary: 85500, status: 'Paid', initials: 'AM', colorKey: 'indigo' },
    { name: 'Priya Kapoor', department: 'Web Dev', baseSalary: 95000, incentives: 5000, deductions: 9500, finalSalary: 90500, status: 'Paid', initials: 'PK', colorKey: 'blue' },
    { name: 'Vikram Nair', department: 'Content', baseSalary: 55000, incentives: 8000, deductions: 5500, finalSalary: 57500, status: 'Paid', initials: 'VN', colorKey: 'amber' },
    { name: 'Sneha Joshi', department: 'SEO', baseSalary: 60000, incentives: 10000, deductions: 6000, finalSalary: 64000, status: 'Paid', initials: 'SJ', colorKey: 'red' },
  ]);
  console.log('Employees seeded');

  console.log('\nDatabase seeded successfully!');
  await mongoose.disconnect();
}

seed().catch(console.error);
