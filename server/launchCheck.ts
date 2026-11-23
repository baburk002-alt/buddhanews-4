/**
 * Pre-launch readiness checks.
 *
 * The project ships with demonstration content and demo settings so a fresh
 * install looks complete. Those values must not reach a real audience. This
 * module inspects configuration + Admin → Settings + content and reports what
 * still needs the owner's attention:
 *
 *   blocker  – going live like this would be wrong (fake contact address,
 *              confirmation emails that can never be sent, nobody able to log in…)
 *   warning  – works, but you probably want to fix it (no Turnstile, no social
 *              image, demo stories still published…)
 *
 * Surfaces:
 *   - boot log (production)               – always
 *   - refuse to start                     – only with ENFORCE_LAUNCH_CHECKS=true
 *   - `pnpm launch:check`                 – exits 1 on blockers (CI / deploy gate)
 *   - Admin → Dashboard checklist card    – admin.launch.status
 */
import {
  enforceLaunchChecks,
  getAdminEmails,
  getEmailConfig,
  getOwnerOpenId,
  getPublicSiteUrl,
  getTurnstileConfig,
  isProduction,
} from "./config";
import * as db from "./db";
import { DEMO_CONTACT_EMAILS, isPlaceholderEmail, isPlaceholderImage } from "../shared/demo";
import { sharedRateLimitConfigured } from "./rateLimit";

export type LaunchSeverity = "blocker" | "warning";
export type LaunchItem = {
  id: string;
  severity: LaunchSeverity;
  title: string;
  detail: string;
  /** Where the owner fixes it. */
  where: "admin-settings" | "environment" | "content" | "platform";
  /** Setting key or environment variable names involved. */
  keys: string[];
};
export type LaunchReport = {
  ready: boolean;
  blockers: number;
  warnings: number;
  items: LaunchItem[];
  checkedAt: string;
};

export async function evaluateLaunchReadiness(): Promise<LaunchReport> {
  const items: LaunchItem[] = [];
  const add = (item: LaunchItem) => items.push(item);

  let settings: Record<string, string> = {};
  let demoStories = 0;
  let dbOk = true;
  try {
    settings = await db.getSettings();
    demoStories = await db.countPublishedDemoArticles();
  } catch {
    dbOk = false;
  }
  if (!dbOk) {
    add({
      id: "database",
      severity: "blocker",
      title: "Database is not reachable",
      detail: "The readiness check could not read settings or stories.",
      where: "environment",
      keys: ["DATABASE_URL"],
    });
  }

  const contactEmail = (settings.contactEmail || process.env.CONTACT_EMAIL || "").trim();
  if (!contactEmail) {
    add({
      id: "contact-email-missing",
      severity: "blocker",
      title: "Newsroom email is not set",
      detail: "The Contact page, footer and Privacy page need a real address readers can write to.",
      where: "admin-settings",
      keys: ["contactEmail"],
    });
  } else if (isPlaceholderEmail(contactEmail)) {
    add({
      id: "contact-email-placeholder",
      severity: "blocker",
      title: "Newsroom email is still a demo value",
      detail: `"${contactEmail}" is a placeholder (${DEMO_CONTACT_EMAILS[0]} style). Replace it with a mailbox you monitor.`,
      where: "admin-settings",
      keys: ["contactEmail"],
    });
  }

  const ogImage = (settings.ogImage ?? "").trim();
  if (!ogImage) {
    add({
      id: "og-image-missing",
      severity: "warning",
      title: "No default social-sharing image",
      detail: "Links shared on social networks will have no preview picture unless a story has its own cover.",
      where: "admin-settings",
      keys: ["ogImage"],
    });
  } else if (isPlaceholderImage(ogImage)) {
    add({
      id: "og-image-placeholder",
      severity: "blocker",
      title: "Social-sharing image is a demo picture",
      detail: "The default Open Graph image is one of the stock demonstration images. Upload your own (1200×630) and set it.",
      where: "admin-settings",
      keys: ["ogImage"],
    });
  }

  const socials = ["youtubeUrl", "twitterUrl", "facebookUrl"].filter(key => !(settings[key] ?? "").trim());
  if (socials.length === 3) {
    add({
      id: "social-links",
      severity: "warning",
      title: "No social profile links",
      detail: "The footer shows no social icons until at least one profile URL is set.",
      where: "admin-settings",
      keys: ["youtubeUrl", "twitterUrl", "facebookUrl"],
    });
  }
  if (!(settings.tipSignal ?? "").trim()) {
    add({
      id: "tip-line",
      severity: "warning",
      title: "No secure tip line",
      detail: "The Contact page promotes a secure tip channel; add your Signal number or remove the promise.",
      where: "admin-settings",
      keys: ["tipSignal"],
    });
  }

  if (demoStories > 0) {
    add({
      id: "demo-stories",
      severity: "warning",
      title: `${demoStories} demonstration ${demoStories === 1 ? "story is" : "stories are"} still published`,
      detail: "Demo stories are labelled on the site and excluded from RSS, but real readers will see them. Archive or delete them when real coverage is ready.",
      where: "content",
      keys: [],
    });
  }

  const email = getEmailConfig();
  if (!email.deliveryConfigured) {
    add({
      id: "email-delivery",
      severity: "blocker",
      title: "Newsletter emails cannot be delivered",
      detail: "Confirmation emails are only queued. Set EMAIL_WEBHOOK_URL (+ EMAIL_WEBHOOK_TOKEN) or SMTP_URL / SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS.",
      where: "environment",
      keys: ["EMAIL_WEBHOOK_URL", "EMAIL_WEBHOOK_TOKEN", "SMTP_URL", "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"],
    });
  }
  if (!email.from || isPlaceholderEmail(email.from)) {
    add({
      id: "email-from",
      severity: email.deliveryConfigured ? "blocker" : "warning",
      title: "Newsletter sender address is missing or a demo value",
      detail: "Set NEWSLETTER_FROM_EMAIL to an address on a domain you have authenticated (SPF/DKIM).",
      where: "environment",
      keys: ["NEWSLETTER_FROM_EMAIL"],
    });
  }

  if (!getTurnstileConfig().widgetEnabled) {
    add({
      id: "turnstile",
      severity: "warning",
      title: "Cloudflare Turnstile is not configured",
      detail: "Contact and newsletter forms are protected by the honeypot and rate limits only. Set TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY.",
      where: "environment",
      keys: ["TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY"],
    });
  }

  if (!sharedRateLimitConfigured()) {
    add({
      id: "shared-rate-limit",
      severity: "warning",
      title: "Rate limits are per-process",
      detail: "Fine for one instance. With more than one instance set REDIS_URL, or enforce limits at your CDN/WAF.",
      where: "environment",
      keys: ["REDIS_URL"],
    });
  }

  const siteUrl = getPublicSiteUrl();
  if (!siteUrl || /localhost|127\.0\.0\.1|\.example\b/i.test(siteUrl)) {
    add({
      id: "public-site-url",
      severity: "blocker",
      title: "PUBLIC_SITE_URL is not a real public address",
      detail: "Canonical links, sitemap, RSS and emailed links are built from it.",
      where: "environment",
      keys: ["PUBLIC_SITE_URL"],
    });
  }

  if (getAdminEmails().length === 0 && !getOwnerOpenId()) {
    add({
      id: "admins",
      severity: "blocker",
      title: "Nobody is allowed to administer the site",
      detail: "Set ADMIN_EMAILS (comma-separated, lower-case) or OWNER_OPEN_ID.",
      where: "environment",
      keys: ["ADMIN_EMAILS", "OWNER_OPEN_ID"],
    });
  }

  if (process.env.SEED_ON_START === "true") {
    add({
      id: "seed-on-start",
      severity: "blocker",
      title: "SEED_ON_START=true would insert demonstration stories",
      detail: "Remove SEED_ON_START from the production environment.",
      where: "environment",
      keys: ["SEED_ON_START"],
    });
  }

  const blockers = items.filter(item => item.severity === "blocker").length;
  const warnings = items.length - blockers;
  return { ready: blockers === 0, blockers, warnings, items, checkedAt: new Date().toISOString() };
}

/** Human-readable report for logs and the CLI. */
export function formatLaunchReport(report: LaunchReport): string {
  if (report.items.length === 0) return "[Launch] All pre-launch checks passed.";
  const lines = [
    `[Launch] ${report.blockers} blocker(s), ${report.warnings} warning(s) before go-live:`,
  ];
  for (const item of report.items) {
    const tag = item.severity === "blocker" ? "BLOCKER" : "warning";
    lines.push(`  - [${tag}] ${item.title} — ${item.detail}${item.keys.length ? ` (${item.keys.join(", ")})` : ""}`);
  }
  return lines.join("\n");
}

/**
 * Called once at boot. Logs the report in production; with
 * ENFORCE_LAUNCH_CHECKS=true a report with blockers aborts startup so a demo
 * configuration can never serve real traffic by accident.
 */
export async function runBootLaunchChecks(): Promise<void> {
  if (!isProduction && !enforceLaunchChecks()) return;
  const report = await evaluateLaunchReadiness();
  const text = formatLaunchReport(report);
  if (report.blockers > 0) console.warn(text);
  else console.log(text);
  if (enforceLaunchChecks() && !report.ready) {
    throw new Error(
      `ENFORCE_LAUNCH_CHECKS is on and ${report.blockers} pre-launch blocker(s) remain. Fix them in Admin → Settings / the environment, or unset ENFORCE_LAUNCH_CHECKS.`
    );
  }
}
