/**
 * Outbound delivery channels for the email outbox.
 *
 *  1. Webhook  — POST JSON to `EMAIL_WEBHOOK_URL` (optionally with
 *     `Authorization: Bearer $EMAIL_WEBHOOK_TOKEN`). Suits transactional-mail
 *     APIs behind a small relay (SES/Postmark/Resend/Brevo/n8n/Zapier ...).
 *  2. SMTP     — nodemailer, configured with `SMTP_URL` or `SMTP_HOST`,
 *     `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`.
 *
 * When both are configured the webhook is tried first and SMTP is the
 * fallback. If neither is configured nothing is attempted and messages simply
 * wait in the outbox (see processOutbox in mailer.ts).
 */
import nodemailer, { type Transporter } from "nodemailer";
import { getEmailConfig, getSmtpConfig, type SmtpConfig } from "./config";
import { sanitizeLogValue } from "./security";

export type MailMessage = { to: string; subject: string; text: string; kind: string };

let cachedTransport: { key: string; transport: Transporter } | null = null;

function smtpTransport(config: SmtpConfig): Transporter {
  const key = JSON.stringify(config);
  if (cachedTransport?.key === key) return cachedTransport.transport;
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user ? { user: config.user, pass: config.pass } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  cachedTransport = { key, transport };
  return transport;
}

/** Test hook: lets tests inject a stub transport or reset the cache. */
export function setSmtpTransportForTests(transport: Transporter | null): void {
  cachedTransport = transport ? { key: JSON.stringify(getSmtpConfig()), transport } : null;
}

/** Address used as the sender. SMTP needs one; webhooks may apply their own. */
export function resolveFromAddress(): string | null {
  const { from } = getEmailConfig();
  if (from) return from;
  const smtp = getSmtpConfig();
  if (smtp?.user && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(smtp.user)) return smtp.user;
  return null;
}

async function viaWebhook(message: MailMessage): Promise<void> {
  const { webhookUrl, webhookToken } = getEmailConfig();
  const from = resolveFromAddress();
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(webhookToken ? { authorization: `Bearer ${webhookToken}` } : {}),
    },
    body: JSON.stringify({
      to: message.to,
      ...(from ? { from } : {}),
      subject: message.subject,
      text: message.text,
      kind: message.kind,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Webhook responded ${response.status}`);
}

async function viaSmtp(message: MailMessage, smtp: SmtpConfig): Promise<void> {
  const from = resolveFromAddress();
  if (!from) throw new Error("NEWSLETTER_FROM_EMAIL is not set (required for SMTP)");
  await smtpTransport(smtp).sendMail({
    from,
    to: message.to,
    subject: message.subject,
    text: message.text,
  });
}

/** Try each configured channel in order. Throws with every failure reason if all fail. */
export async function deliverMail(message: MailMessage): Promise<"webhook" | "smtp"> {
  const { webhookUrl } = getEmailConfig();
  const smtp = getSmtpConfig();
  const failures: string[] = [];
  if (webhookUrl) {
    try {
      await viaWebhook(message);
      return "webhook";
    } catch (error) {
      failures.push(`webhook: ${error instanceof Error ? error.message : "failed"}`);
    }
  }
  if (smtp) {
    try {
      await viaSmtp(message, smtp);
      return "smtp";
    } catch (error) {
      failures.push(`smtp: ${error instanceof Error ? error.message : "failed"}`);
    }
  }
  throw new Error(sanitizeLogValue(failures.join("; ") || "no delivery channel configured", 280));
}
