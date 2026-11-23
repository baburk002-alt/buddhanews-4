import { createHmac } from "node:crypto";
import type { Locale } from "../shared/news";
import { getEmailConfig, getPublicSiteUrl } from "./config";
import {
  claimDueEmails,
  enqueueEmail,
  expireStaleEmails,
  markEmailDelivered,
  markEmailFailed,
} from "./db";
import { deliverMail } from "./mailDelivery";
import { safeEqual } from "./security";

/**
 * Transactional mail.
 *
 * Every message is written to `email_outbox` first (so a confirmation link is
 * never lost), then delivered by `processOutbox` through the channels in
 * mailDelivery.ts: `EMAIL_WEBHOOK_URL` and/or SMTP. A failed attempt is retried
 * with exponential backoff up to `EMAIL_MAX_ATTEMPTS`. With no channel
 * configured messages just wait in the outbox (and expire after 72 hours).
 */
function appBaseUrl(): string {
  const configured = getPublicSiteUrl();
  if (configured) return configured;
  const port = process.env.PORT || "3000";
  return `http://localhost:${port}`;
}

function unsubscribeSecret(): string {
  return process.env.EMAIL_TOKEN_SECRET?.trim() || process.env.PRIVACY_HASH_SECRET?.trim() || process.env.MANUS_JWT_SECRET?.trim() || "development-mail-token";
}

/** Stable, tamper-proof unsubscribe token derived from the subscriber id. */
export function unsubscribeToken(subscriberId: number): string {
  return createHmac("sha256", unsubscribeSecret())
    .update(`unsubscribe:${subscriberId}`)
    .digest("base64url")
    .slice(0, 43);
}

export function verifyUnsubscribeToken(subscriberId: number, token: string): boolean {
  return safeEqual(unsubscribeToken(subscriberId), token);
}

export function confirmationUrl(rawToken: string): string {
  return `${appBaseUrl()}/api/newsletter/confirm?token=${encodeURIComponent(rawToken)}`;
}

export function unsubscribeUrl(subscriberId: number): string {
  return `${appBaseUrl()}/api/newsletter/unsubscribe?id=${subscriberId}&token=${encodeURIComponent(
    unsubscribeToken(subscriberId)
  )}`;
}

type Copy = {
  subject: string;
  confirmIntro: string;
  confirmAction: string;
  ignore: string;
  expiry: string;
  welcomeSubject: string;
  welcomeIntro: string;
  unsubscribeIntro: string;
  unsubscribeAction: string;
};

const COPY: Record<Locale, Copy> = {
  en: {
    subject: "Confirm your Buddha News briefing",
    confirmIntro:
      "Someone (hopefully you) asked to receive the BMG Brief at this address. Confirm below and we will add you to the list.",
    confirmAction: "Confirm subscription",
    ignore: "If this was not you, ignore this email. Nothing will be sent and the request expires in 48 hours.",
    expiry: "This link expires in 48 hours.",
    welcomeSubject: "You are on the list — Buddha News",
    welcomeIntro:
      "Your subscription to the BMG Brief is confirmed. One calm email each morning, in the language you chose.",
    unsubscribeIntro: "You can leave the list at any time:",
    unsubscribeAction: "Unsubscribe",
  },
  ps: {
    subject: "د بدھا نیوز خبرپاڼې تایید",
    confirmIntro:
      "یو چا (هیله ده چې تاسو یاست) غوښتنه کړې چې په دې پته د BMG لنډیز ترلاسه کړي. لاندې تایید کړئ.",
    confirmAction: "ګډون تایید کړئ",
    ignore: "که دا تاسو نه یاست، دا برېښنالیک له پامه غورځوئ. هېڅ نه لیږل کیږي او غوښتنه په ۴۸ ساعتونو کې پای ته رسېږي.",
    expiry: "دا لینک په ۴۸ ساعتونو کې پای ته رسېږي.",
    welcomeSubject: "تاسو په لړلیک کې یاست — بدھا نیوز",
    welcomeIntro: "ستاسو ګډون تایید شو. هره سهار یو آرام برېښنالیک، په هغه ژبه چې تاسو غوره کړې.",
    unsubscribeIntro: "تاسو هر وخت کولی شئ له لړلیک څخه ووځئ:",
    unsubscribeAction: "له لړلیک وتل",
  },
  fa: {
    subject: "تأیید اشتراک در خبرنامه بدھا نیوز",
    confirmIntro:
      "کسی (امیدواریم شما باشید) درخواست کرده است که خلاصه BMG را در این نشانی دریافت کند. لطفاً در زیر تأیید کنید.",
    confirmAction: "تأیید اشتراک",
    ignore: "اگر این شما نبودید، این ایمیل را نادیده بگیرید. چیزی ارسال نمی‌شود و درخواست پس از ۴۸ ساعت منقضی می‌شود.",
    expiry: "این پیوند پس از ۴۸ ساعت منقضی می‌شود.",
    welcomeSubject: "شما در فهرست هستید — بدھا نیوز",
    welcomeIntro: "اشتراک شما تأیید شد. هر صبح یک ایمیل آرام، به زبانی که انتخاب کرده‌اید.",
    unsubscribeIntro: "هر زمان می‌توانید از فهرست خارج شوید:",
    unsubscribeAction: "لغو اشتراک",
  },
};

function plainBody(lines: string[]): string {
  return lines.join("\n\n");
}

export function buildConfirmationEmail(email: string, locale: Locale, token: string) {
  const copy = COPY[locale];
  const link = confirmationUrl(token);
  return {
    subject: copy.subject,
    body: plainBody([
      copy.confirmIntro,
      `${copy.confirmAction}: ${link}`,
      copy.expiry,
      copy.ignore,
      `— Buddha News / ${email}`,
    ]),
  };
}

export function buildWelcomeEmail(email: string, locale: Locale, subscriberId: number) {
  const copy = COPY[locale];
  return {
    subject: copy.welcomeSubject,
    body: plainBody([
      copy.welcomeIntro,
      `${copy.unsubscribeIntro} ${unsubscribeUrl(subscriberId)}`,
      `— Buddha News / ${email}`,
    ]),
  };
}

export type OutboxRunResult = { claimed: number; sent: number; retried: number; failed: number; expired: number };

let draining: Promise<OutboxRunResult> | null = null;

/**
 * Deliver due outbox rows. Safe to call from several places and instances:
 * rows are claimed atomically in the database, and calls within one process
 * share a single run. Does nothing when no delivery channel is configured.
 */
export function processOutbox(limit = 20): Promise<OutboxRunResult> {
  if (draining) return draining;
  draining = (async () => {
    const result: OutboxRunResult = { claimed: 0, sent: 0, retried: 0, failed: 0, expired: 0 };
    const config = getEmailConfig();
    if (!config.deliveryConfigured) return result;
    result.expired = await expireStaleEmails(72);
    const messages = await claimDueEmails(limit);
    result.claimed = messages.length;
    for (const message of messages) {
      try {
        await deliverMail({
          to: message.recipient,
          subject: message.subject,
          text: message.body,
          kind: message.kind,
        });
        await markEmailDelivered(message.id);
        result.sent += 1;
      } catch (error) {
        const reason = error instanceof Error ? error.message : "unknown mail error";
        const outcome = await markEmailFailed(message.id, reason, config.maxAttempts);
        if (outcome === "failed") result.failed += 1;
        else result.retried += 1;
      }
    }
    return result;
  })().finally(() => {
    draining = null;
  });
  return draining;
}

/**
 * Queue a message and try to deliver it right away. A mail-provider outage
 * never fails the API call: the row stays queued and the scheduler retries.
 */
export async function sendTransactionalEmail(input: {
  to: string;
  subject: string;
  body: string;
  kind: string;
}): Promise<{ queued: true; delivered: boolean }> {
  await enqueueEmail({
    recipient: input.to,
    subject: input.subject,
    body: input.body,
    kind: input.kind,
  });
  if (!getEmailConfig().deliveryConfigured) return { queued: true, delivered: false };
  try {
    const result = await processOutbox(5);
    return { queued: true, delivered: result.sent > 0 };
  } catch (error) {
    console.error("[Mail] Immediate delivery failed; will retry", error instanceof Error ? error.message : error);
    return { queued: true, delivered: false };
  }
}
