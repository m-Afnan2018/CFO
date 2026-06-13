import mongoose, { Document, Schema } from 'mongoose';

export interface IService extends Document {
  name: string;
  slug: string;
  parentId: mongoose.Types.ObjectId | null;
  icon: string;
  color: string;
  order: number;
}

const ServiceSchema = new Schema<IService>(
  {
    name:     { type: String, required: true },
    slug:     { type: String, required: true, unique: true },
    parentId: { type: Schema.Types.ObjectId, ref: 'Service', default: null },
    icon:     { type: String, default: 'ti-briefcase' },
    color:    { type: String, default: 'indigo' },
    order:    { type: Number, default: 0 },
  },
  { timestamps: true },
);

export default mongoose.model<IService>('Service', ServiceSchema);
