import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, type HydratedDocument, type Types } from 'mongoose';

@Schema({
  collection: 'crops',
  versionKey: false,
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class Crop {
  @Prop({ type: SchemaTypes.ObjectId, required: true, ref: 'User' })
  farmer!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ default: '' })
  category!: string;

  @Prop({ type: Number, required: true, min: 0 })
  quantity!: number;

  @Prop({ type: Number, required: true, min: 0 })
  price!: number;

  @Prop({ type: Date, default: null })
  harvest_date!: Date | null;

  @Prop({ default: '' })
  state!: string;

  @Prop({ default: '' })
  district!: string;

  @Prop({ default: '' })
  village!: string;

  @Prop({ default: '' })
  pincode!: string;

  @Prop({ default: '' })
  description!: string;

  @Prop({ default: '' })
  image!: string;

  @Prop({ default: '' })
  quality!: string;

  @Prop({ default: '' })
  quality_proof!: string;

  @Prop({ default: 'kg' })
  unit!: string;

  @Prop({ type: Number, default: 1, min: 0 })
  min_order_quantity!: number;

  @Prop({ default: false })
  same_day_available!: boolean;

  @Prop({ default: false })
  organic!: boolean;

  @Prop({ type: Number, default: 50, min: 0 })
  demand_score!: number;

  @Prop({ default: 'Stable' })
  price_trend!: string;

  @Prop({ default: 'Available' })
  stock_status!: string;

  @Prop({ type: Number, default: null })
  latitude!: number | null;

  @Prop({ type: Number, default: null })
  longitude!: number | null;

  @Prop({ type: Number, default: 30 })
  delivery_radius_km!: number;

  @Prop({ type: [String], default: [] })
  tags!: string[];

  created_at?: Date;
  updated_at?: Date;
}

export type CropDocument = HydratedDocument<Crop>;
export const CropSchema = SchemaFactory.createForClass(Crop);
CropSchema.index({ farmer: 1, created_at: -1 });
CropSchema.index({ name: 1, category: 1, state: 1, district: 1 });
