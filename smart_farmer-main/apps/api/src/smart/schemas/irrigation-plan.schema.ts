import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, type HydratedDocument, type Types } from 'mongoose';

@Schema({
  collection: 'irrigation_plans',
  versionKey: false,
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class IrrigationPlan {
  @Prop({ type: SchemaTypes.ObjectId, required: true, ref: 'User' })
  user!: Types.ObjectId;

  @Prop({ default: '' })
  crop_name!: string;

  @Prop({ type: Number, default: 0 })
  soil_moisture!: number;

  @Prop({ type: Number, default: 0 })
  rainfall_mm!: number;

  @Prop({ type: Number, default: 0 })
  temperature_c!: number;

  @Prop({ default: '' })
  recommendation!: string;

  @Prop({ default: '' })
  next_watering_window!: string;

  @Prop({ type: Number, default: 0 })
  water_saving_percent!: number;

  @Prop({ default: false })
  automation_ready!: boolean;

  created_at?: Date;
  updated_at?: Date;
}

export type IrrigationPlanDocument = HydratedDocument<IrrigationPlan>;
export const IrrigationPlanSchema = SchemaFactory.createForClass(IrrigationPlan);
IrrigationPlanSchema.index({ user: 1, created_at: -1 });
