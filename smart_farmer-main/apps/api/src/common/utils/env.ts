import fs from 'node:fs';
import path from 'node:path';

import dotenv from 'dotenv';

const workspaceRoot = process.cwd();
const repoRoot = path.resolve(workspaceRoot, '../..');
const rootEnvPath = path.join(repoRoot, '.env');
const localEnvPath = path.join(workspaceRoot, '.env');

if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath, override: false });
}
if (fs.existsSync(localEnvPath)) {
  dotenv.config({ path: localEnvPath, override: false });
}

function value(name: string, defaultValue = ''): string {
  const resolved = process.env[name];
  return resolved === undefined ? defaultValue : resolved;
}

function bool(name: string, defaultValue = false): boolean {
  const resolved = process.env[name];
  if (resolved === undefined) {
    return defaultValue;
  }
  return ['1', 'true', 'yes', 'on'].includes(resolved.trim().toLowerCase());
}

function int(name: string, defaultValue: number): number {
  const resolved = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(resolved) ? resolved : defaultValue;
}

function list(name: string, defaultValue: string[]): string[] {
  const resolved = process.env[name];
  if (!resolved) {
    return defaultValue;
  }
  return resolved
    .split(',')
    .map((item: string) => item.trim())
    .filter(Boolean);
}

export const env = {
  workspaceRoot,
  repoRoot,
  mediaRoot: path.join(workspaceRoot, 'media'),
  uploadsRoot: path.join(workspaceRoot, 'media', 'uploads'),
  apiPort: int('API_PORT', 8000),
  mongodbUri: value('MONGODB_URI', 'mongodb://127.0.0.1:27017'),
  mongodbName: value('MONGODB_NAME', 'smart_farmer'),
  corsAllowedOrigins: list('CORS_ALLOWED_ORIGINS', list('DJANGO_CORS_ALLOWED_ORIGINS', [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://0.0.0.0:3000',
  ])),
  mailHost: value('MAIL_HOST', value('MAIL_SERVER', 'smtp.gmail.com')),
  mailPort: int('MAIL_PORT', 587),
  mailUser: value('MAIL_USER', value('MAIL_USERNAME', '')),
  mailPassword: value('MAIL_PASSWORD', '').replace(/\s+/g, ''),
  mailFrom: value('MAIL_FROM', value('MAIL_DEFAULT_SENDER', '')),
  mailSecure: bool('MAIL_SECURE', bool('MAIL_USE_SSL', false)),
  mailUseTls: bool('MAIL_USE_TLS', true),
  mailSuppressSend: bool('MAIL_SUPPRESS_SEND', true),
  otpExpirySeconds: int('OTP_EXPIRY_SECONDS', 300),
  otpMaxPerHour: int('OTP_MAX_PER_HOUR', 3),
  exposeTestOtp: bool('EXPOSE_TEST_OTP', false),
  adminEmail: value('ADMIN_EMAIL', '').trim().toLowerCase(),
  adminPassword: value('ADMIN_PASSWORD', ''),
  adminUsername: value('ADMIN_USERNAME', 'admin').trim() || 'admin',
  adminFullName: value('ADMIN_FULL_NAME', 'System Administrator').trim() || 'System Administrator',
};

export function ensureRuntimeDirectories(): void {
  fs.mkdirSync(env.mediaRoot, { recursive: true });
  fs.mkdirSync(env.uploadsRoot, { recursive: true });
}
