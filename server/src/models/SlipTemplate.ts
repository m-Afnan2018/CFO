import mongoose, { Schema, Document } from 'mongoose';

export interface ISlipTemplate extends Document {
  companyName: string;
  companyAddress: string;
  companyEmail: string;
  companyPhone: string;
  website: string;
  panNumber: string;
  footerNote: string;
}

const SlipTemplateSchema = new Schema<ISlipTemplate>({
  companyName:    { type: String, default: 'Ganesyx Pvt Ltd' },
  companyAddress: { type: String, default: '' },
  companyEmail:   { type: String, default: '' },
  companyPhone:   { type: String, default: '' },
  website:        { type: String, default: '' },
  panNumber:      { type: String, default: '' },
  footerNote:     { type: String, default: 'This is a system generated payslip and does not require a signature.' },
}, { timestamps: true });

export default mongoose.model<ISlipTemplate>('SlipTemplate', SlipTemplateSchema);
