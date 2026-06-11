import mongoose, { Schema, Document } from 'mongoose';

export interface IAppSettings extends Document {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
}

const AppSettingsSchema = new Schema<IAppSettings>(
  {
    smtpHost: { type: String, default: '' },
    smtpPort: { type: Number, default: 587 },
    smtpUser: { type: String, default: '' },
    smtpPass: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model<IAppSettings>('AppSettings', AppSettingsSchema);
