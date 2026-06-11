import mongoose, { Schema, Document } from 'mongoose';

export interface ISalaryRecord extends Document {
  employeeId: mongoose.Types.ObjectId;
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
  leaveDays: number;
  leaveDeduction: number;
  bonus: number;
  finalSalary: number;
  status: 'Paid' | 'Pending';
  payPeriod: string;       // "2026-06"
  initials: string;
  colorKey: string;
}

const SalaryRecordSchema = new Schema<ISalaryRecord>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee' },
    name: { type: String, required: true },
    department: String,
    baseSalary: Number,
    hra:              { type: Number, default: 0 },
    specialAllowance: { type: Number, default: 0 },
    incentives: { type: Number, default: 0 },
    providentFund:    { type: Number, default: 0 },
    esi:              { type: Number, default: 0 },
    professionalTax:  { type: Number, default: 0 },
    tds:              { type: Number, default: 0 },
    deductions: { type: Number, default: 0 },
    leaveDays: { type: Number, default: 0 },
    leaveDeduction: { type: Number, default: 0 },
    bonus: { type: Number, default: 0 },
    finalSalary: Number,
    status: { type: String, enum: ['Paid', 'Pending'], default: 'Pending' },
    payPeriod: { type: String, required: true },
    initials: String,
    colorKey: { type: String, default: 'emerald' },
  },
  { timestamps: true }
);

SalaryRecordSchema.index({ payPeriod: 1 });

export default mongoose.model<ISalaryRecord>('SalaryRecord', SalaryRecordSchema);
