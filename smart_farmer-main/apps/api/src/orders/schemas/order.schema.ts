import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, type HydratedDocument, type Types } from 'mongoose';

@Schema({ collection: 'orders', versionKey: false })
export class Order {
  @Prop({ type: SchemaTypes.ObjectId, required: false, ref: 'User' })
  customer?: Types.ObjectId;

  @Prop({ type: String, default: '' })
  userId!: string;

  @Prop({ type: String, default: '' })
  restaurantId!: string;

  @Prop({ type: SchemaTypes.Mixed, default: [] })
  items!: Array<{ productId: string; quantity: number }>;

  @Prop({ type: SchemaTypes.ObjectId, required: false, ref: 'Crop' })
  crop?: Types.ObjectId;

  @Prop({ type: Number, required: false, default: 0, min: 0 })
  quantity!: number;

  @Prop({ type: Number, required: false, default: 0, min: 0 })
  total_price!: number;

  @Prop({ default: 'PENDING' })
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
  deliveryAddress!: string;

  @Prop({ type: SchemaTypes.Mixed, default: null })
  deliveryLocation!: { latitude: number; longitude: number } | null;

  @Prop({
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      default: [0, 0],
    },
  })
  deliveryLocationGeo!: {
    type: 'Point';
    coordinates: [number, number];
  };

  @Prop({ type: SchemaTypes.ObjectId, default: null, ref: 'DeliveryBoy' })
  deliveryBoyId!: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  assignedAt!: Date | null;

  @Prop({ type: [SchemaTypes.ObjectId], default: [] })
  rejectedDeliveryBoys!: Types.ObjectId[];

  @Prop({ default: '' })
  fulfillment_window!: string;

  @Prop({ default: '' })
  tracking_code!: string;
}

export type OrderDocument = HydratedDocument<Order>;
export const OrderSchema = SchemaFactory.createForClass(Order);
OrderSchema.index({ customer: 1, order_date: -1 });
OrderSchema.index({ crop: 1, order_date: -1 });
OrderSchema.index({ deliveryLocationGeo: '2dsphere' });
OrderSchema.index({ status: 1, deliveryBoyId: 1 });

