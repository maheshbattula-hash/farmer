import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, type HydratedDocument, type Types } from 'mongoose';

import { CHALLENGE_PURPOSES, type ChallengePurpose } from '../../common/constants';

@Schema({
  collection: 'auth_challenges',
  versionKey: false,
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class AuthChallenge {
  @Prop({ type: SchemaTypes.ObjectId, required: false, ref: 'User', default: null })
  user!: Types.ObjectId | null;

  @Prop({ required: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ type: String, enum: CHALLENGE_PURPOSES, required: true })
  purpose!: ChallengePurpose;

  @Prop({ default: '' })
  otp_code!: string;

  @Prop({ type: Date, default: null })
  otp_requested_at!: Date | null;

  @Prop({ type: Date, default: null })
  otp_expires_at!: Date | null;

  @Prop({ type: Date, default: null })
  verified_at!: Date | null;

  @Prop({ default: false })
  credential_verified!: boolean;

  @Prop({ default: true })
  is_active!: boolean;

  @Prop({ type: Object, default: {} })
  metadata!: Record<string, unknown>;

  created_at?: Date;
  updated_at?: Date;
}

export type AuthChallengeDocument = HydratedDocument<AuthChallenge>;
export const AuthChallengeSchema = SchemaFactory.createForClass(AuthChallenge);
AuthChallengeSchema.index({ user: 1, purpose: 1, is_active: 1 });
AuthChallengeSchema.index({ email: 1, purpose: 1, is_active: 1 });
AuthChallengeSchema.index({ created_at: -1 });
