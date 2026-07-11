import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, type HydratedDocument, type Types } from 'mongoose';

@Schema({ collection: 'orders', versionKey: false })
export class Order {
  @Prop({ type: SchemaTypes.ObjectId, required: true, ref: 'User' })
  customer!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, required: true, ref: 'Crop' })
  crop!: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 0 })
  quantity!: number;

  @Prop({ type: Number, required: true, min: 0 })
  total_price!: number;

  @Prop({ default: 'Order Placed' })
  status!: string;

  @Prop({ type: Date, default: () => new Date() })
  order_date!: Date;

  @Prop({ default: '' })
  estimated_delivery!: string;

  @Prop({ default: '' })
  current_location!: string;

  @Prop({ default: 'pending' })
  payment_status!: string;

  @Prop({ default: '' })
  payment_method!: string;

  @Prop({ default: '' })
  payment_provider!: string;

  @Prop({ default: '' })
  payment_reference!: string;

  @Prop({ type: SchemaTypes.Mixed, default: {} })
  payment_gateway_details!: Record<string, unknown>;

  @Prop({ default: '' })
  invoice_number!: string;

  @Prop({ default: false })
  is_bulk_order!: boolean;

  @Prop({ default: '' })
  buyer_note!: string;

  @Prop({ default: '' })
  delivery_address!: string;

  @Prop({ default: '' })
  fulfillment_window!: string;

  @Prop({ default: '' })
  tracking_code!: string;
}

export type OrderDocument = HydratedDocument<Order>;
export const OrderSchema = SchemaFactory.createForClass(Order);
OrderSchema.index({ customer: 1, order_date: -1 });
OrderSchema.index({ crop: 1, order_date: -1 });
