import mongoose, { Schema, Document } from 'mongoose';

export interface IPaymentEntry {
  amount: number;
  method: 'Online' | 'Offline';
  mode?: string;         // Online: Bank Transfer / UPI / NEFT / RTGS / Cheque
  receivedFrom?: string; // Offline only
  date?: string;         // "YYYY-MM-DD"
}

export interface IClientRecord extends Document {
  clientId: mongoose.Types.ObjectId;
  name: string;
  service: string;
  monthlyBilling: number;
  manager: string;
  status: 'Pending' | 'Paid' | 'Partial';
  billingPeriod: string;   // "2026-06"
  initials: string;
  colorKey: string;
  invoiceId?: mongoose.Types.ObjectId;
  payments?: IPaymentEntry[];
}

const PaymentEntrySchema = new Schema<IPaymentEntry>(
  {
    amount:       { type: Number, required: true, min: 0 },
    method:       { type: String, enum: ['Online', 'Offline'], required: true },
    mode:         String,
    receivedFrom: String,
    date:         String,
  },
  { _id: false }
);

const ClientRecordSchema = new Schema<IClientRecord>(
  {
    clientId:      { type: Schema.Types.ObjectId, ref: 'Client' },
    name:          { type: String, required: true },
    service:       String,
    monthlyBilling: { type: Number, default: 0 },
    manager:       { type: String, default: '' },
    status:        { type: String, enum: ['Pending', 'Paid', 'Partial'], default: 'Pending' },
    billingPeriod: { type: String, required: true },
    initials:      String,
    colorKey:      { type: String, default: 'emerald' },
    invoiceId:     { type: Schema.Types.ObjectId, ref: 'Invoice' },
    payments:      { type: [PaymentEntrySchema], default: [] },
  },
  { timestamps: true }
);

ClientRecordSchema.index({ billingPeriod: 1 });

export default mongoose.model<IClientRecord>('ClientRecord', ClientRecordSchema);
