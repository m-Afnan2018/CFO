import mongoose, { Schema, Document } from 'mongoose';

export interface IClient extends Document {
  name: string;
  email: string;
  service: string;
  monthlyBilling: number;
  manager: string;
  renewal: string;
  status: 'Active' | 'Inactive' | 'Renewal Due';
  initials: string;
  colorKey: 'emerald' | 'indigo' | 'blue' | 'amber' | 'red';
}

const ClientSchema = new Schema<IClient>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    service: String,
    monthlyBilling: Number,
    manager: String,
    renewal: String,
    status: { type: String, enum: ['Active', 'Inactive', 'Renewal Due'], default: 'Active' },
    initials: String,
    colorKey: { type: String, enum: ['emerald', 'indigo', 'blue', 'amber', 'red'], default: 'emerald' },
  },
  { timestamps: true }
);

export default mongoose.model<IClient>('Client', ClientSchema);
