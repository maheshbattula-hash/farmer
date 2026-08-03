import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

export type VehicleType = 'bike' | 'scooter' | 'bicycle' | 'car';

@Schema({
  collection: 'delivery_boys',
  versionKey: false,
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class DeliveryBoy {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, unique: true, trim: true })
  phone!: string;

  @Prop({ required: true })
  password_hash!: string;

  @Prop({ type: String, enum: ['bike', 'scooter', 'bicycle', 'car'], default: 'bike' })
  vehicleType!: VehicleType;

  @Prop({ type: Boolean, default: true })
  isOnline!: boolean;

  @Prop({ type: Boolean, default: true })
  isAvailable!: boolean;

  @Prop({
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      default: [0, 0], // [longitude, latitude]
    },
  })
  location!: {
    type: 'Point';
    coordinates: [number, number];
  };

  @Prop({ type: Date, default: () => new Date() })
  lastLocationUpdate!: Date;

  created_at?: Date;
  updated_at?: Date;
}

export type DeliveryBoyDocument = HydratedDocument<DeliveryBoy>;
export const DeliveryBoySchema = SchemaFactory.createForClass(DeliveryBoy);

DeliveryBoySchema.index({ location: '2dsphere' });
DeliveryBoySchema.index({ phone: 1 });
