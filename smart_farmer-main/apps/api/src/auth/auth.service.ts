import { randomBytes } from 'node:crypto';

import bcrypt from 'bcryptjs';
import { HttpStatus, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { Crop } from '../marketplace/schemas/crop.schema';
import { Order } from '../orders/schemas/order.schema';
import { OrderUpdate } from '../orders/schemas/order-update.schema';
import { Review } from '../reviews/schemas/review.schema';
import {
  BLOCKED_EMAIL_DOMAINS,
  CHALLENGE_PURPOSES,
  type ChallengePurpose,
} from '../common/constants';
import { ok, fail } from '../common/http-response';
import { serializeUser } from '../common/serializers';
import { env } from '../common/utils/env';
import { asIdString, isValidObjectId } from '../common/utils/ids';
import { sendEmailMessage } from '../common/utils/mailer';

import { AuthChallenge } from './schemas/auth-challenge.schema';
import { AuthToken } from './schemas/auth-token.schema';
import { OtpRequest } from './schemas/otp-request.schema';
import { User } from './schemas/user.schema';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(AuthChallenge.name) private readonly authChallengeModel: Model<AuthChallenge>,
    @InjectModel(OtpRequest.name) private readonly otpRequestModel: Model<OtpRequest>,
    @InjectModel(AuthToken.name) private readonly authTokenModel: Model<AuthToken>,
    @InjectModel(Crop.name) private readonly cropModel: Model<Crop>,
    @InjectModel(Order.name) private readonly orderModel: Model<Order>,
    @InjectModel(OrderUpdate.name) private readonly orderUpdateModel: Model<OrderUpdate>,
    @InjectModel(Review.name) private readonly reviewModel: Model<Review>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureAdminAccount();
  }

  async register(body: Record<string, unknown>) {
    const username = String(body.username || '').trim();
    const email = this.normalizeEmail(body.email);
    const password = String(body.password || '');
    const requestedRole = String(body.role || 'customer');
    const role = requestedRole === 'farmer' ? 'farmer' : 'customer';

    if (!username || !email || !password) {
      fail('Username, email, and password are required', 'required_fields');
    }
    if (this.isBlockedEmailDomain(email)) {
      fail('Use a real email inbox. Example or test domains are blocked for OTP delivery.', 'invalid_email_domain');
    }

    const existing = await this.userModel.findOne({ $or: [{ username }, { email }] });
    if (existing) {
      fail('Username or email already exists', 'already_exists', HttpStatus.CONFLICT);
    }

    const user = await this.userModel.create({
      username,
      email,
      password_hash: await bcrypt.hash(password, 10),
      role,
      full_name: String(body.full_name || ''),
      city: String(body.city || ''),
      state: String(body.state || ''),
      district: String(body.district || ''),
      pincode: String(body.pincode || ''),
    });

    return ok('Registration successful! Please login.', { user: serializeUser(user) });
  }

  async login(body: Record<string, unknown>) {
    const email = this.normalizeEmail(body.email);
    const password = String(body.password || '');
    const user: any = await this.userModel.findOne({ email });

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      fail('Invalid email or password', 'invalid_credentials', HttpStatus.UNAUTHORIZED);
    }

    const challenge = await this.createChallenge(user, 'login');
    return ok('Credentials verified. Continue to OTP.', {
      challenge_id: asIdString(challenge._id),
      email: challenge.email,
      purpose: challenge.purpose,
    });
  }

  async startEmailVerification(body: Record<string, unknown>) {
    const email = this.normalizeEmail(body.email);
    if (!email) {
      fail('Enter your email first.', 'email_required');
    }

    const purpose = this.parsePurpose(body.purpose, 'email_verification');
    if (purpose === 'signup_email_verification') {
      if (this.isBlockedEmailDomain(email)) {
        fail('Use a real email inbox. Example or test domains cannot receive OTP emails.', 'invalid_email_domain');
      }

      const existingUser = await this.userModel.findOne({ email });
      if (existingUser) {
        fail('An account already exists with this email.', 'already_exists', HttpStatus.CONFLICT);
      }

      const challenge = await this.createEmailChallenge(email, 'signup_email_verification');
      const extra = await this.issueOtp(challenge);

      return ok('Signup email verification code sent.', {
        challenge_id: asIdString(challenge._id),
        email: challenge.email,
        purpose: challenge.purpose,
        ...extra,
      });
    }

    const user: any = await this.userModel.findOne({ email });
    if (!user) {
      fail('No email found for this address.', 'email_not_found', HttpStatus.NOT_FOUND, { otp: null });
    }

    const challenge = await this.createChallenge(user, 'email_verification');
    const extra = await this.issueOtp(challenge);

    return ok('Email verification code sent.', {
      challenge_id: asIdString(challenge._id),
      email: challenge.email,
      purpose: challenge.purpose,
      ...extra,
    });
  }

  async loginAfterEmailVerification(body: Record<string, unknown>) {
    const email = this.normalizeEmail(body.email);
    const password = String(body.password || '');
    const challenge: any = await this.getChallenge(String(body.challenge_id || ''), 'email_verification');

    if (!challenge.verified_at) {
      fail('Verify your email before login.', 'email_not_verified');
    }
    if (email !== this.normalizeEmail(challenge.email)) {
      fail('Email verification is invalid. Please verify again.', 'email_verification_mismatch');
    }

    const user = challenge.user as any;
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      fail('Incorrect password.', 'invalid_credentials', HttpStatus.UNAUTHORIZED);
    }

    const token = await this.issueToken(user);
    challenge.is_active = false;
    await challenge.save();

    const redirect = user.role === 'farmer' ? '/farmer/dashboard' : user.role === 'admin' ? '/admin/dashboard' : '/my_orders';
    return ok('Login successful.', {
      token,
      user: serializeUser(user),
      redirect,
    });
  }

  async requestOtp(body: Record<string, unknown>) {
    const purpose = this.parsePurpose(body.purpose, 'login');
    const challenge: any = await this.getChallenge(String(body.challenge_id || ''), purpose);

    if (this.normalizeEmail(body.email) !== this.normalizeEmail(challenge.email)) {
      fail('This email is not registered', 'email_not_registered', HttpStatus.NOT_FOUND, { otp: null });
    }

    const extra = await this.issueOtp(challenge);
    return ok('OTP sent to your inbox. Check your email.', extra);
  }

  async verifyOtp(body: Record<string, unknown>) {
    const purpose = this.parsePurpose(body.purpose, 'login');
    const challenge: any = await this.getChallenge(String(body.challenge_id || ''), purpose);
    await this.verifyChallengeOtp(
      challenge,
      body.email,
      body.otp,
      purpose !== 'password_reset' && purpose !== 'email_verification',
    );

    if (purpose === 'password_reset') {
      return ok('OTP verified successfully.', {
        challenge_id: asIdString(challenge._id),
        verified: true,
        redirect: '/reset_password',
      });
    }

    if (purpose === 'email_verification' || purpose === 'signup_email_verification') {
      return ok('Email verified successfully.', {
        challenge_id: asIdString(challenge._id),
        email: challenge.email,
        verified: true,
      });
    }

    const user = challenge.user as any;
    const token = await this.issueToken(user);
    const redirect = user.role === 'farmer' ? '/farmer/dashboard' : user.role === 'admin' ? '/admin/dashboard' : '/my_orders';

    return ok('OTP verified successfully.', {
      token,
      user: serializeUser(user),
      redirect,
    });
  }

  async forgotPassword(body: Record<string, unknown>) {
    const email = this.normalizeEmail(body.email);
    if (!email) {
      fail('Enter your registered email to reset your password.', 'email_required');
    }

    const user: any = await this.userModel.findOne({ email });
    if (!user) {
      fail('No account was found for that email address.', 'email_not_found', HttpStatus.NOT_FOUND);
    }

    const challenge = await this.createChallenge(user, 'password_reset');
    return ok('Password reset flow started.', {
      challenge_id: asIdString(challenge._id),
      email: challenge.email,
      purpose: challenge.purpose,
    });
  }

  async resetPassword(body: Record<string, unknown>) {
    const password = String(body.password || '');
    const confirmPassword = String(body.confirm_password || '');

    if (!password || !confirmPassword) {
      fail('Both the new password and confirmation are required.', 'password_required');
    }
    if (password !== confirmPassword) {
      fail('The new password and confirmation must match.', 'password_mismatch');
    }
    if (password.length < 8) {
      fail('The new password must be at least 8 characters long.', 'password_too_short');
    }

    const challenge: any = await this.getChallenge(String(body.challenge_id || ''), 'password_reset');
    if (!challenge.verified_at) {
      fail('Complete OTP verification before setting a new password.', 'otp_not_verified');
    }

    const user = challenge.user as any;
    user.password_hash = await bcrypt.hash(password, 10);
    await user.save();
    challenge.is_active = false;
    await challenge.save();

    return ok('Password updated successfully. Login now with your new password.');
  }

  async adminLogin(body: Record<string, unknown>) {
    await this.ensureAdminAccount();

    const email = this.normalizeEmail(body.email);
    const password = String(body.password || '');
    const adminUser: any = await this.userModel.findOne({ role: 'admin', email });

    if (!adminUser || !(await bcrypt.compare(password, adminUser.password_hash))) {
      fail('Invalid admin credentials', 'invalid_credentials', HttpStatus.UNAUTHORIZED, { otp: null });
    }

    const challenge = await this.createChallenge(adminUser, 'admin');
    const extra = await this.issueOtp(challenge);

    return ok('OTP sent to your inbox. Check your email.', {
      challenge_id: asIdString(challenge._id),
      email: challenge.email,
      purpose: challenge.purpose,
      ...extra,
    });
  }

  me(user: any) {
    return ok('Current user', { user: serializeUser(user) });
  }

  async toggleVerification(userId: string) {
    if (!isValidObjectId(userId)) {
      fail('User not found', 'user_not_found', HttpStatus.NOT_FOUND);
    }
    const user: any = await this.userModel.findById(userId);
    if (!user) {
      fail('User not found', 'user_not_found', HttpStatus.NOT_FOUND);
    }
    user.is_verified = !user.is_verified;
    await user.save();
    return ok('Farmer verification status updated!', { user: serializeUser(user) });
  }

  async deleteUser(userId: string) {
    if (!isValidObjectId(userId)) {
      fail('User not found', 'user_not_found', HttpStatus.NOT_FOUND);
    }
    const user: any = await this.userModel.findById(userId);
    if (!user) {
      fail('User not found', 'user_not_found', HttpStatus.NOT_FOUND);
    }
    if (user.role === 'admin') {
      fail('Admin users are protected', 'protected_user');
    }

    const cropDocs = await this.cropModel.find({ farmer: user._id }).select('_id').lean();
    const cropIds = cropDocs.map((crop: any) => asIdString(crop._id));

    const cropOrderDocs = cropIds.length ? await this.orderModel.find({ crop: { $in: cropIds } }).select('_id').lean() : [];
    const customerOrderDocs = await this.orderModel.find({ customer: user._id }).select('_id').lean();
    const orderIds = [...new Set([...cropOrderDocs, ...customerOrderDocs].map((order: any) => asIdString(order._id)))];

    if (orderIds.length > 0) {
      await this.orderUpdateModel.deleteMany({ order: { $in: orderIds } });
      await this.reviewModel.deleteMany({ order: { $in: orderIds } });
      await this.orderModel.deleteMany({ _id: { $in: orderIds } });
    }

    if (cropIds.length > 0) {
      await this.cropModel.deleteMany({ _id: { $in: cropIds } });
    }

    await this.reviewModel.deleteMany({ $or: [{ customer: user._id }, { farmer: user._id }] });
    await this.authChallengeModel.deleteMany({ user: user._id });
    await this.authTokenModel.deleteMany({ user: user._id });
    await this.otpRequestModel.deleteMany({ email: user.email });
    await user.deleteOne();

    return ok('User deleted successfully');
  }

  private normalizeEmail(email: unknown): string {
    return String(email || '').trim().toLowerCase();
  }

  private getEmailDomain(email: string): string {
    const normalized = this.normalizeEmail(email);
    if (!normalized.includes('@')) {
      return '';
    }
    return normalized.split('@').pop() || '';
  }

  private isBlockedEmailDomain(email: string): boolean {
    if (this.allowsSimulatedOtpDelivery()) {
      return false;
    }
    const domain = this.getEmailDomain(email);
    return Boolean(domain) && (BLOCKED_EMAIL_DOMAINS.has(domain) || domain.endsWith('.invalid'));
  }

  private allowsSimulatedOtpDelivery(): boolean {
    return env.mailSuppressSend || env.exposeTestOtp;
  }

  private parsePurpose(rawPurpose: unknown, defaultPurpose: ChallengePurpose): ChallengePurpose {
    const purpose = String(rawPurpose || defaultPurpose) as ChallengePurpose;
    return CHALLENGE_PURPOSES.includes(purpose) ? purpose : defaultPurpose;
  }

  private async createChallenge(user: any, purpose: ChallengePurpose, metadata: Record<string, unknown> = {}) {
    await this.authChallengeModel.updateMany({ user: user._id, purpose, is_active: true }, { is_active: false });
    return this.authChallengeModel.create({
      user: user._id,
      email: this.normalizeEmail(user.email),
      purpose,
      credential_verified: true,
      metadata,
    });
  }

  private async createEmailChallenge(email: string, purpose: ChallengePurpose, metadata: Record<string, unknown> = {}) {
    const normalizedEmail = this.normalizeEmail(email);
    await this.authChallengeModel.updateMany({ email: normalizedEmail, purpose, is_active: true }, { is_active: false });
    return this.authChallengeModel.create({
      user: null,
      email: normalizedEmail,
      purpose,
      credential_verified: true,
      metadata,
    });
  }

  private async getChallenge(challengeId: string, purpose: ChallengePurpose) {
    if (!isValidObjectId(challengeId)) {
      fail('Challenge not found or expired.', 'challenge_not_found', HttpStatus.NOT_FOUND);
    }
    const challenge = await this.authChallengeModel.findOne({ _id: challengeId, purpose, is_active: true }).populate('user');
    if (!challenge) {
      fail('Challenge not found or expired.', 'challenge_not_found', HttpStatus.NOT_FOUND);
    }
    return challenge;
  }

  private async purgeOldOtpRequests(email: string, scope: string): Promise<void> {
    const cutoff = new Date(Date.now() - 60 * 60 * 1000);
    await this.otpRequestModel.deleteMany({ requested_at: { $lt: cutoff } });
    await this.otpRequestModel.deleteMany({ email, scope, requested_at: { $lt: cutoff } });
  }

  private async otpLimitRemaining(email: string, scope: string): Promise<number | null> {
    if (scope === 'admin') {
      return null;
    }
    await this.purgeOldOtpRequests(email, scope);
    const cutoff = new Date(Date.now() - 60 * 60 * 1000);
    const count = await this.otpRequestModel.countDocuments({ email, scope, requested_at: { $gte: cutoff } });
    return Math.max(env.otpMaxPerHour - count, 0);
  }

  private async issueOtp(challenge: any) {
    const email = this.normalizeEmail(challenge.email);
    if (this.isBlockedEmailDomain(email)) {
      fail('Use a real email inbox. Example or test domains cannot receive OTP emails.', 'invalid_email_domain');
    }

    const remaining = await this.otpLimitRemaining(email, challenge.purpose);
    if (challenge.purpose !== 'admin' && remaining !== null && remaining <= 0) {
      fail('OTP request limit reached. You can request up to 3 codes per hour.', 'otp_rate_limited', HttpStatus.TOO_MANY_REQUESTS, { otp: null, remaining_requests: 0 });
    }

    const otp = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + env.otpExpirySeconds * 1000);

    challenge.otp_code = otp;
    challenge.otp_requested_at = issuedAt;
    challenge.otp_expires_at = expiresAt;
    await challenge.save();

    const expiryMinutes = Math.max(Math.floor(env.otpExpirySeconds / 60), 1);
    const purposeLabel = this.purposeLabel(challenge.purpose);
    await sendEmailMessage(
      email,
      'Your Smart Farmer OTP',
      [
        `Your Smart Farmer ${purposeLabel} OTP is ${otp}.`,
        '',
        `It expires in ${expiryMinutes} minute(s). If you did not request this sign-in, ignore this email.`,
      ].join('\n'),
    );

    await this.otpRequestModel.create({ email, scope: challenge.purpose });
    const remainingAfter = await this.otpLimitRemaining(email, challenge.purpose);
    return { otp: env.exposeTestOtp ? otp : null, remaining_requests: remainingAfter };
  }

  private async verifyChallengeOtp(challenge: any, email: unknown, otp: unknown, deactivate: boolean): Promise<void> {
    const normalized = this.normalizeEmail(email);
    if (normalized !== this.normalizeEmail(challenge.email)) {
      fail('Invalid OTP or email', 'invalid_otp');
    }
    if (!challenge.otp_code || !challenge.otp_requested_at) {
      fail('Request a fresh OTP before verifying.', 'otp_not_requested');
    }
    if (!challenge.otp_expires_at || new Date() > challenge.otp_expires_at) {
      fail('OTP has expired. Request a new code.', 'otp_expired');
    }
    if (String(otp || '').trim().replace(/\s+/g, '') !== challenge.otp_code) {
      fail('Incorrect OTP. Enter the latest code from your inbox.', 'invalid_otp');
    }

    challenge.verified_at = new Date();
    challenge.is_active = !deactivate;
    await challenge.save();
  }

  private async issueToken(user: any): Promise<string> {
    const existing = await this.authTokenModel.findOne({ user: user._id });
    if (existing) {
      return existing.key;
    }
    const token = randomBytes(20).toString('hex');
    await this.authTokenModel.create({ user: user._id, key: token });
    return token;
  }

  private purposeLabel(purpose: ChallengePurpose): string {
    if (purpose === 'password_reset') {
      return 'password reset';
    }
    if (purpose === 'email_verification') {
      return 'email verification';
    }
    if (purpose === 'signup_email_verification') {
      return 'signup email verification';
    }
    if (purpose === 'admin') {
      return 'admin login';
    }
    return 'login';
  }

  private async ensureAdminAccount(): Promise<any | null> {
    if (!env.adminEmail || !env.adminPassword) {
      return null;
    }

    const passwordHash = await bcrypt.hash(env.adminPassword, 10);
    let adminUser: any = await this.userModel.findOne({ role: 'admin' }).sort({ created_at: 1 });

    if (adminUser) {
      adminUser.username = env.adminUsername;
      adminUser.email = env.adminEmail;
      adminUser.full_name = env.adminFullName;
      adminUser.role = 'admin';
      adminUser.is_verified = true;
      adminUser.is_staff = true;
      adminUser.is_superuser = true;
      adminUser.password_hash = passwordHash;
      await adminUser.save();
      return adminUser;
    }

    adminUser = await this.userModel.create({
      username: env.adminUsername,
      email: env.adminEmail,
      password_hash: passwordHash,
      role: 'admin',
      full_name: env.adminFullName,
      is_verified: true,
      is_staff: true,
      is_superuser: true,
    });
    return adminUser;
  }
}
