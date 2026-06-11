import mongoose, { Schema, Document } from 'mongoose';

export interface ITDSFiling extends Document {
  quarter: string;       // "FY2026-Q1"  (Apr–Jun 2026)
  dueDate: string;       // "2026-07-31"
  status: 'Pending' | 'Received';   // TDS certificates (Form 16A) received
  receivedAt?: string;
  reminderDays: number;
  reminderEmail: string;
  reminderSent: boolean;
}

const TDSFilingSchema = new Schema<ITDSFiling>(
  {
    quarter:       { type: String, required: true, unique: true },
    dueDate:       { type: String, required: true },
    status:        { type: String, enum: ['Pending', 'Received'], default: 'Pending' },
    receivedAt:    String,
    reminderDays:  { type: Number, default: 3 },
    reminderEmail: { type: String, default: '' },
    reminderSent:  { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model<ITDSFiling>('TDSFiling', TDSFilingSchema);
