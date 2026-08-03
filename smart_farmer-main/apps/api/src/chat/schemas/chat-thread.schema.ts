import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, type HydratedDocument, type Types } from 'mongoose';

@Schema({
  collection: 'chat_threads',
  versionKey: false,
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class ChatThread {
  @Prop({ type: SchemaTypes.ObjectId, required: true, ref: 'Crop' })
  crop!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, required: true, ref: 'User' })
  farmer!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, required: true, ref: 'User' })
  buyer!: Types.ObjectId;

  @Prop({ default: '' })
  last_message!: string;

  @Prop({ type: Date, default: () => new Date() })
  last_message_at!: Date;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null })
  last_sender!: Types.ObjectId | null;

  created_at?: Date;
  updated_at?: Date;
}

export type ChatThreadDocument = HydratedDocument<ChatThread>;
export const ChatThreadSchema = SchemaFactory.createForClass(ChatThread);
ChatThreadSchema.index({ buyer: 1, last_message_at: -1 });
ChatThreadSchema.index({ farmer: 1, last_message_at: -1 });
ChatThreadSchema.index({ crop: 1, buyer: 1 }, { unique: true });
