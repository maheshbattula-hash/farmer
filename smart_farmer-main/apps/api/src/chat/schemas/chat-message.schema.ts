import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, type HydratedDocument, type Types } from 'mongoose';

@Schema({
  collection: 'chat_messages',
  versionKey: false,
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class ChatMessage {
  @Prop({ type: SchemaTypes.ObjectId, required: true, ref: 'ChatThread' })
  thread!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, required: true, ref: 'User' })
  sender!: Types.ObjectId;

  @Prop({ default: '' })
  body!: string;

  @Prop({ default: '' })
  attachment_name!: string;

  @Prop({ type: Date, default: null })
  read_at!: Date | null;

  created_at?: Date;
  updated_at?: Date;
}

export type ChatMessageDocument = HydratedDocument<ChatMessage>;
export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);
ChatMessageSchema.index({ thread: 1, created_at: 1 });
