import mongoose, { Schema, Document } from 'mongoose';

export interface IGSTFiling extends Document {
  period: string;        // "2026-06"
  dueDate: string;       // "2026-07-20"
  status: 'Due' | 'Filed';
  filedAt?: string;
  reminderDays: number;
  reminderEmail: string;
  reminderSent: boolean;
}

const GSTFilingSchema = new Schema<IGSTFiling>(
  {
    period:        { type: String, required: true, unique: true },
    dueDate:       { type: String, required: true },
    status:        { type: String, enum: ['Due', 'Filed'], default: 'Due' },
    filedAt:       String,
    reminderDays:  { type: Number, default: 3 },
    reminderEmail: { type: String, default: '' },
    reminderSent:  { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model<IGSTFiling>('GSTFiling', GSTFilingSchema);
