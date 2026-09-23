import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmailMessage(
  recipient: string,
  subject: string,
  body: string,
): Promise<void> {
  if (!recipient) {
    return;
  }

  const from = process.env.MAIL_FROM || 'onboarding@resend.dev';

  const { error } = await resend.emails.send({
    from,
    to: [recipient],
    subject,
    text: body,
  });

  if (error) {
    throw new Error(`Resend email failed: ${error.message}`);
  }
}