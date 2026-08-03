import nodemailer from 'nodemailer';

import { env } from './env';

let transporter: any = null;

function getTransporter(): any {
  if (transporter) {
    return transporter;
  }
  transporter = nodemailer.createTransport({
    host: env.mailHost,
    port: env.mailPort,
    secure: env.mailSecure || env.mailPort === 465,
    requireTLS: env.mailUseTls && !(env.mailSecure || env.mailPort === 465),
    auth: env.mailUser
      ? {
          user: env.mailUser,
          pass: env.mailPassword,
        }
      : undefined,
  });
  return transporter;
}

export async function sendEmailMessage(recipient: string, subject: string, body: string): Promise<void> {
  if (env.mailSuppressSend || !recipient) {
    return;
  }

  const from = env.mailFrom || env.mailUser || 'noreply@smartfarmer.local';
  await getTransporter().sendMail({
    from,
    to: recipient,
    subject,
    text: body,
  });
}
