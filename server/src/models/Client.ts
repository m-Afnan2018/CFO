import mongoose, { Schema, Document } from 'mongoose';

export interface IServiceItem {
  name: string;
  amount: number;
  type: 'Monthly' | 'One Time';
}

export interface IClient extends Document {
  name: string;
  email: string;
  service: string;
  monthlyBilling: number;
  serviceBreakdown: IServiceItem[];
  manager: string;
  renewal: string;
  status: 'Active' | 'Inactive' | 'Renewal Due';
  initials: string;
  colorKey: 'emerald' | 'indigo' | 'blue' | 'amber' | 'red';
}

const ServiceItemSchema = new Schema<IServiceItem>(
  {
    name:   { type: String, required: true },
    amount: { type: Number, required: true },
    type:   { type: String, enum: ['Monthly', 'One Time'], default: 'Monthly' },
  },
  { _id: false }
);

const ClientSchema = new Schema<IClient>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    service: String,
    monthlyBilling: Number,
    serviceBreakdown: { type: [ServiceItemSchema], default: [] },
    manager: String,
    renewal: String,
    status: { type: String, enum: ['Active', 'Inactive', 'Renewal Due'], default: 'Active' },
    initials: String,
    colorKey: { type: String, enum: ['emerald', 'indigo', 'blue', 'amber', 'red'], default: 'emerald' },
  },
  { timestamps: true }
);

export default mongoose.model<IClient>('Client', ClientSchema);
