import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, type HydratedDocument, type Types } from 'mongoose';

@Schema({
  collection: 'notifications',
  versionKey: false,
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class Notification {
  @Prop({ type: SchemaTypes.ObjectId, required: true, ref: 'User' })
  user!: Types.ObjectId;

  @Prop({ default: '' })
  title!: string;

  @Prop({ default: '' })
  body!: string;

  @Prop({ default: 'info' })
  category!: string;

  @Prop({ type: SchemaTypes.Mixed, default: {} })
  meta!: Record<string, unknown>;

  @Prop({ type: Date, default: null })
  read_at!: Date | null;

  created_at?: Date;
  updated_at?: Date;
}

export type NotificationDocument = HydratedDocument<Notification>;
export const NotificationSchema = SchemaFactory.createForClass(Notification);
NotificationSchema.index({ user: 1, created_at: -1 });
