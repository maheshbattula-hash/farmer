import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

@Schema({ collection: 'otp_requests', versionKey: false })
export class OtpRequest {
  @Prop({ required: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ required: true, trim: true })
  scope!: string;

  @Prop({ type: Date, default: () => new Date() })
  requested_at!: Date;
}

export type OtpRequestDocument = HydratedDocument<OtpRequest>;
export const OtpRequestSchema = SchemaFactory.createForClass(OtpRequest);
OtpRequestSchema.index({ email: 1, scope: 1, requested_at: -1 });
