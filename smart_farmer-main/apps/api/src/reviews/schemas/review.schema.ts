import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, type HydratedDocument, type Types } from 'mongoose';

@Schema({ collection: 'reviews', versionKey: false })
export class Review {
  @Prop({ type: String, default: null })
  order!: string | null;

  @Prop({ type: SchemaTypes.ObjectId, required: true, ref: 'User' })
  customer!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, required: true, ref: 'User' })
  farmer!: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 1, max: 5 })
  rating!: number;

  @Prop({ default: '' })
  comment!: string;

  @Prop({ type: Date, default: () => new Date() })
  created_at!: Date;
}

export type ReviewDocument = HydratedDocument<Review>;
export const ReviewSchema = SchemaFactory.createForClass(Review);
ReviewSchema.index({ farmer: 1, created_at: -1 });
ReviewSchema.index({ customer: 1, created_at: -1 });
