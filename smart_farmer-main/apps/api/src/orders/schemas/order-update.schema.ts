import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, type HydratedDocument, type Types } from 'mongoose';

@Schema({ collection: 'order_updates', versionKey: false })
export class OrderUpdate {
  @Prop({ type: SchemaTypes.ObjectId, required: true, ref: 'Order' })
  order!: Types.ObjectId;

  @Prop({ required: true })
  status!: string;

  @Prop({ type: Date, default: () => new Date() })
  update_date!: Date;

  @Prop({ default: '' })
  location!: string;
}

export type OrderUpdateDocument = HydratedDocument<OrderUpdate>;
export const OrderUpdateSchema = SchemaFactory.createForClass(OrderUpdate);
OrderUpdateSchema.index({ order: 1, update_date: 1 });
