import nodemailer, { type Transporter } from 'nodemailer';

// Email transport abstraction.
//
// - If SMTP_HOST/SMTP_USER/SMTP_PASS are set, we send real email via
//   nodemailer (works with SendGrid, Mailgun, Gmail SMTP, Mailtrap, etc. —
//   whichever SMTP-compatible provider you configure).
// - If they are not set, we run in "simulated" mode: the email is logged to
//   the console (and can be inspected via the admin Notifications screen)
//   instead of actually being delivered. This lets the whole booking /
//   reminder / cancellation flow be demoed end-to-end with zero external
//   accounts, while keeping the exact same code path for when real
//   credentials are added later.
//
// Set EMAIL_SIMULATE_FAILURE_RATE (0..1) to make simulated sends randomly
// throw, which is a convenient way to exercise the notification retry /
// backoff / failure-listing logic described in the system design write-up.

let transporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    transporter = null;
    return null;
  }
  transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass },
  });
  return transporter;
}

export interface SendMailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendMail(input: SendMailInput): Promise<{ simulated: boolean }> {
  const t = getTransporter();

  if (!t) {
    const failureRate = Number(process.env.EMAIL_SIMULATE_FAILURE_RATE || 0);
    if (failureRate > 0 && Math.random() < failureRate) {
      throw new Error('Simulated SMTP failure (EMAIL_SIMULATE_FAILURE_RATE)');
    }
    // eslint-disable-next-line no-console
    console.log(
      `\n[SIMULATED EMAIL] to=${input.to}\nsubject=${input.subject}\n${'-'.repeat(40)}\n${input.text}\n${'-'.repeat(40)}\n`
    );
    return { simulated: true };
  }

  await t.sendMail({
    from: process.env.SMTP_FROM || 'Healthcare Clinic <no-reply@clinic.example>',
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html || `<pre style="font-family: inherit; white-space: pre-wrap;">${escapeHtml(input.text)}</pre>`,
  });
  return { simulated: false };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
