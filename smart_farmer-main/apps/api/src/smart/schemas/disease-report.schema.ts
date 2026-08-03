import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, type HydratedDocument, type Types } from 'mongoose';

@Schema({
  collection: 'disease_reports',
  versionKey: false,
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class DiseaseReport {
  @Prop({ type: SchemaTypes.ObjectId, required: true, ref: 'User' })
  user!: Types.ObjectId;

  @Prop({ default: '' })
  crop_name!: string;

  @Prop({ default: '' })
  symptoms!: string;

  @Prop({ default: '' })
  image_name!: string;

  @Prop({ default: '' })
  image_path!: string;

  @Prop({ default: 'Low' })
  risk_level!: string;

  @Prop({ default: 'Healthy' })
  predicted_disease!: string;

  @Prop({ default: '' })
  recommendation!: string;

  @Prop({ type: Number, default: 0 })
  confidence!: number;

  @Prop({ default: '' })
  region!: string;

  created_at?: Date;
  updated_at?: Date;
}

export type DiseaseReportDocument = HydratedDocument<DiseaseReport>;
export const DiseaseReportSchema = SchemaFactory.createForClass(DiseaseReport);
DiseaseReportSchema.index({ user: 1, created_at: -1 });
