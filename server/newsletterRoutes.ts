import type { Express, Request, Response } from "express";
import { DEFAULT_LOCALE, isLocale, type Locale } from "../shared/news";
import { buildWelcomeEmail, sendTransactionalEmail, verifyUnsubscribeToken } from "./mailer";
import * as db from "./db";
import { checkRateLimitAsync, ipKey } from "./rateLimit";
import { hashToken, sanitizeLogValue } from "./security";

/**
 * Email-link endpoints.
 *
 * Both links carry an unguessable token, are single-purpose and never expose
 * subscriber data. They answer with a redirect to a localized page that shows
 * the result, so the flow also works when JavaScript is disabled.
 */

function localeFromQuery(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

async function rateLimited(req: Request, res: Response, bucket: string): Promise<boolean> {
  const limit = await checkRateLimitAsync(`${bucket}:${ipKey(req)}`, 30, 60_000);
  if (limit.ok) return false;
  res.status(429).type("text/plain").send("Too many requests. Please try again shortly.");
  return true;
}

export function registerNewsletterRoutes(app: Express) {
  app.get("/api/newsletter/confirm", async (req, res) => {
    if (await rateLimited(req, res, "nl-confirm")) return;
    const token = typeof req.query.token === "string" ? req.query.token : "";
    if (!token || token.length < 20 || token.length > 200) {
      res.status(400).type("text/plain").send("This confirmation link is not valid.");
      return;
    }

    try {
      const result = await db.confirmSubscriptionByTokenHash(hashToken(token));
      if (!result.ok) {
        const locale = localeFromQuery(req.query.locale);
        const reason = result.reason === "expired" ? "expired" : "invalid";
        res.redirect(302, `/${locale}/?newsletter=${reason}`);
        return;
      }

      if (!result.already && "subscriber" in result && result.subscriber) {
        const subscriber = result.subscriber;
        const mail = buildWelcomeEmail(subscriber.email, subscriber.locale as Locale, subscriber.id);
        await sendTransactionalEmail({
          to: subscriber.email,
          ...mail,
          kind: "newsletter_welcome",
        });
        await db.writeAuditLog({
          actorName: "anonymous",
          action: "newsletter.confirmed",
          entityType: "newsletter",
          entityId: subscriber.id,
          ipHash: ipKey(req),
          metadata: { locale: subscriber.locale },
        });
      }

      const locale = localeFromQuery(req.query.locale);
      res.redirect(302, `/${locale}/?newsletter=confirmed`);
    } catch (error) {
      console.error("[Newsletter] Confirm failed:", sanitizeLogValue(error instanceof Error ? error.message : "unknown"));
      res.status(500).type("text/plain").send("We could not confirm this subscription. Please try again.");
    }
  });

  app.get("/api/newsletter/unsubscribe", async (req, res) => {
    if (await rateLimited(req, res, "nl-unsub")) return;
    const id = Number(req.query.id);
    const token = typeof req.query.token === "string" ? req.query.token : "";
    if (!Number.isInteger(id) || id <= 0 || !token) {
      res.status(400).type("text/plain").send("This unsubscribe link is not valid.");
      return;
    }
    if (!verifyUnsubscribeToken(id, token)) {
      res.status(403).type("text/plain").send("This unsubscribe link is not valid.");
      return;
    }

    try {
      const subscriber = await db.getSubscriberById(id);
      const locale = (subscriber?.locale as Locale) ?? DEFAULT_LOCALE;
      const removed = await db.unsubscribeById(id);
      if (removed) {
        await db.writeAuditLog({
          actorName: "anonymous",
          action: "newsletter.unsubscribed",
          entityType: "newsletter",
          entityId: id,
          ipHash: ipKey(req),
        });
      }
      res.redirect(302, `/${locale}/?newsletter=unsubscribed`);
    } catch (error) {
      console.error("[Newsletter] Unsubscribe failed:", sanitizeLogValue(error instanceof Error ? error.message : "unknown"));
      res.status(500).type("text/plain").send("We could not process this request. Please try again.");
    }
  });
}
