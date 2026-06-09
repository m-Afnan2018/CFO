import mongoose, { Schema, Document } from 'mongoose';

export interface ISalaryRecord extends Document {
  employeeId: mongoose.Types.ObjectId;
  name: string;
  department: string;
  baseSalary: number;
  incentives: number;
  deductions: number;
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
    incentives: { type: Number, default: 0 },
    deductions: { type: Number, default: 0 },
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
