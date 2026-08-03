import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, type HydratedDocument, type Types } from 'mongoose';

@Schema({ collection: 'auth_tokens', versionKey: false })
export class AuthToken {
  @Prop({ type: SchemaTypes.ObjectId, required: true, ref: 'User', unique: true })
  user!: Types.ObjectId;

  @Prop({ required: true, unique: true, trim: true })
  key!: string;

  @Prop({ type: Date, default: () => new Date() })
  created_at!: Date;
}

export type AuthTokenDocument = HydratedDocument<AuthToken>;
export const AuthTokenSchema = SchemaFactory.createForClass(AuthToken);
