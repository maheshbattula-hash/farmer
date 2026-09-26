export async function sendEmailMessage(
  recipient: string,
  subject: string,
  body: string,
): Promise<void> {
  if (!recipient) {
    return;
  }

  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail =
    process.env.MAIL_FROM || 'maheshbattula444@gmail.com';
  const fromName = process.env.MAIL_FROM_NAME || 'Smart Farmer';

  if (!apiKey) {
    throw new Error('BREVO_API_KEY is not configured');
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: {
        name: fromName,
        email: fromEmail,
      },
      to: [
        {
          email: recipient,
        },
      ],
      subject,
      textContent: body,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Brevo email failed (${response.status}): ${errorText}`,
    );
  }
}