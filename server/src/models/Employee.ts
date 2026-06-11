import mongoose, { Schema, Document } from 'mongoose';

export interface IEmployee extends Document {
  name: string;
  department: string;
  baseSalary: number;
  hra: number;
  specialAllowance: number;
  incentives: number;
  providentFund: number;
  esi: number;
  professionalTax: number;
  tds: number;
  deductions: number;
  finalSalary: number;
  status: 'Paid' | 'Pending';
  initials: string;
  colorKey: 'emerald' | 'indigo' | 'blue' | 'amber' | 'red';
}

const EmployeeSchema = new Schema<IEmployee>(
  {
    name: String,
    department: String,
    baseSalary: Number,
    hra:              { type: Number, default: 0 },
    specialAllowance: { type: Number, default: 0 },
    incentives: Number,
    providentFund:    { type: Number, default: 0 },
    esi:              { type: Number, default: 0 },
    professionalTax:  { type: Number, default: 0 },
    tds:              { type: Number, default: 0 },
    deductions: Number,
    finalSalary: Number,
    status: { type: String, enum: ['Paid', 'Pending'], default: 'Paid' },
    initials: String,
    colorKey: { type: String, enum: ['emerald', 'indigo', 'blue', 'amber', 'red'], default: 'emerald' },
  },
  { timestamps: true }
);

export default mongoose.model<IEmployee>('Employee', EmployeeSchema);
