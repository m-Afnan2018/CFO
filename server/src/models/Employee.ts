import mongoose, { Schema, Document } from 'mongoose';

export interface IEmployee extends Document {
  name: string;
  department: string;
  baseSalary: number;
  incentives: number;
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
    incentives: Number,
    deductions: Number,
    finalSalary: Number,
    status: { type: String, enum: ['Paid', 'Pending'], default: 'Paid' },
    initials: String,
    colorKey: { type: String, enum: ['emerald', 'indigo', 'blue', 'amber', 'red'], default: 'emerald' },
  },
  { timestamps: true }
);

export default mongoose.model<IEmployee>('Employee', EmployeeSchema);
