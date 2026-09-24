import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || 'smtp.gmail.com',
  port: Number(process.env.MAIL_PORT || 587),
  secure: process.env.MAIL_SECURE === 'true',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASSWORD,
  },
  requireTLS: process.env.MAIL_USE_TLS !== 'false',
});

export async function sendEmailMessage(
  recipient: string,
  subject: string,
  body: string,
): Promise<void> {
  if (!recipient) {
    return;
  }

  await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.MAIL_USER,
    to: recipient,
    subject,
    text: body,
  });
}