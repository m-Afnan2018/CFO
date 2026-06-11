import mongoose, { Schema, Document } from 'mongoose';

interface ILineItem {
  description: string;
  qty: number;
  unitPrice: number;
  amount: number;
}

export interface IInvoice extends Document {
  invoiceNumber: string;
  client: string;
  clientEmail?: string;
  clientAddress?: string;
  date: string;
  dueDate: string;
  lineItems?: ILineItem[];
  amount: number;
  gst: number;
  gstRate?: number;
  total: number;
  notes?: string;
  status: 'Paid' | 'Pending' | 'Overdue' | 'Partial';
  taxType?: 'Intrastate' | 'Interstate';
  tdsSection?: string;
  tdsRate?: number;
  tdsAmount?: number;
}

const LineItemSchema = new Schema<ILineItem>(
  { description: String, qty: Number, unitPrice: Number, amount: Number },
  { _id: false }
);

const InvoiceSchema = new Schema<IInvoice>(
  {
    invoiceNumber: { type: String, required: true },
    client: String,
    clientEmail: String,
    clientAddress: String,
    date: String,
    dueDate: String,
    lineItems: [LineItemSchema],
    amount: { type: Number, default: 0 },
    gst: { type: Number, default: 0 },
    gstRate: { type: Number, default: 18 },
    total: { type: Number, default: 0 },
    notes: String,
    status:     { type: String, enum: ['Paid', 'Pending', 'Overdue', 'Partial'], default: 'Pending' },
    taxType:    { type: String, enum: ['Intrastate', 'Interstate'], default: 'Intrastate' },
    tdsSection: { type: String, default: 'None' },
    tdsRate:    { type: Number, default: 0 },
    tdsAmount:  { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model<IInvoice>('Invoice', InvoiceSchema);
