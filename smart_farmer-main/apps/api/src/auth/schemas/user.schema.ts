import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

import { USER_ROLES, type UserRole } from '../../common/constants';

@Schema({
  collection: 'users',
  versionKey: false,
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class User {
  @Prop({ required: true, unique: true, trim: true })
  username!: string;

  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  email!: string;

  @Prop({ required: true })
  password_hash!: string;

  @Prop({ type: String, enum: USER_ROLES, default: 'customer' })
  role!: UserRole;

  @Prop({ default: '' })
  full_name!: string;

  @Prop({ default: '' })
  contact!: string;

  @Prop({ default: '' })
  city!: string;

  @Prop({ default: '' })
  state!: string;

  @Prop({ default: '' })
  district!: string;

  @Prop({ default: '' })
  pincode!: string;

  @Prop({ type: Number, default: null })
  latitude!: number | null;

  @Prop({ type: Number, default: null })
  longitude!: number | null;

  @Prop({ default: false })
  is_verified!: boolean;

  @Prop({ default: false })
  is_staff!: boolean;

  @Prop({ default: false })
  is_superuser!: boolean;

  @Prop({ default: 'en' })
  preferred_language!: string;

  @Prop({ default: false })
  voice_enabled!: boolean;

  @Prop({ default: '' })
  push_token!: string;

  @Prop({ default: '' })
  farm_size!: string;

  @Prop({ default: '' })
  primary_crop!: string;

  created_at?: Date;
  updated_at?: Date;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
