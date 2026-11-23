/**
 * Central, validated runtime configuration.
 *
 * Nothing here is read at import time except `NODE_ENV`; every other value is
 * resolved on access so tests and the platform can set environment variables
 * before the server starts. Production validation runs once at boot and
 * refuses to start with an unsafe or ambiguous configuration.
 */

export const isProduction = process.env.NODE_ENV === "production";
export const isTest = process.env.NODE_ENV === "test";

function env(name: string): string {
  return (process.env[name] ?? "").trim();
}

function csv(name: string): string[] {
  return env(name)
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);
}

/** Absolute session lifetime. Short enough that a stolen cookie ages out. */
export const SESSION_TTL_MS = (() => {
  const hours = Number(env("SESSION_TTL_HOURS") || "12");
  if (!Number.isFinite(hours) || hours <= 0) return 12 * 60 * 60 * 1000;
  return Math.min(Math.max(hours, 1), 24 * 30) * 60 * 60 * 1000;
})();

/** Idle lifetime: a session untouched for this long is refused and revoked. */
export const SESSION_IDLE_TTL_MS = (() => {
  const hours = Number(env("SESSION_IDLE_HOURS") || "4");
  if (!Number.isFinite(hours) || hours <= 0) return 4 * 60 * 60 * 1000;
  return Math.min(Math.max(hours, 1), SESSION_TTL_MS / (60 * 60 * 1000)) * 60 * 60 * 1000;
})();

export const COOKIE_DOMAIN = env("COOKIE_DOMAIN");

/**
 * Trusted public origin. In production this is mandatory: canonical URLs,
 * sitemaps, RSS and Open Graph images are built only from it, never from the
 * request's Host header.
 */
export function getPublicSiteUrl(): string {
  const raw = env("PUBLIC_SITE_URL").replace(/\/+$/, "");
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && !isProduction)) return "";
    if (url.pathname !== "/" || url.search || url.hash) return "";
    return `${url.protocol}//${url.host}`;
  } catch {
    return "";
  }
}

export function getTrustedHosts(): string[] {
  const hosts = new Set<string>();
  const site = getPublicSiteUrl();
  if (site) {
    try {
      hosts.add(new URL(site).host);
    } catch {
      // ignore
    }
  }
  for (const value of csv("ALLOWED_ORIGINS")) {
    try {
      hosts.add(new URL(value.includes("://") ? value : `https://${value}`).host);
    } catch {
      // ignore malformed values
    }
  }
  for (const value of csv("TRUSTED_HOSTS")) {
    hosts.add(value);
  }
  return Array.from(hosts);
}

export function getAllowedOrigins(): string[] {
  const origins = new Set<string>();
  const site = getPublicSiteUrl();
  if (site) origins.add(site);
  for (const value of csv("ALLOWED_ORIGINS")) {
    try {
      origins.add(new URL(value.includes("://") ? value : `https://${value}`).origin);
    } catch {
      // ignore malformed values
    }
  }
  return Array.from(origins);
}

export function getAdminEmails(): string[] {
  return csv("ADMIN_EMAILS").map(value => value.toLowerCase());
}

export function getEditorEmails(): string[] {
  return csv("EDITOR_EMAILS").map(value => value.toLowerCase());
}

export function getOwnerOpenId(): string {
  return env("OWNER_OPEN_ID");
}

/** Limits used by the AI budget guard. */
export function getAiBudget() {
  const dailyCalls = Number(env("AI_DAILY_CALL_LIMIT") || "500");
  const dailyTokens = Number(env("AI_DAILY_TOKEN_LIMIT") || "1500000");
  return {
    dailyCalls: Number.isFinite(dailyCalls) && dailyCalls > 0 ? dailyCalls : 500,
    dailyTokens: Number.isFinite(dailyTokens) && dailyTokens > 0 ? dailyTokens : 1_500_000,
  };
}

export function getRetentionPolicy() {
  const viewsDays = Number(env("ARTICLE_VIEW_RETENTION_DAYS") || "90");
  const auditDays = Number(env("AUDIT_RETENTION_DAYS") || "365");
  const pendingDays = Number(env("NEWSLETTER_PENDING_RETENTION_DAYS") || "14");
  const outboxDays = Number(env("EMAIL_OUTBOX_RETENTION_DAYS") || "30");
  return {
    outboxDays: Number.isFinite(outboxDays) && outboxDays > 0 ? outboxDays : 30,
    viewsDays: Number.isFinite(viewsDays) && viewsDays > 0 ? viewsDays : 90,
    auditDays: Number.isFinite(auditDays) && auditDays > 0 ? auditDays : 365,
    pendingDays: Number.isFinite(pendingDays) && pendingDays > 0 ? pendingDays : 14,
  };
}

/**
 * Number of reverse-proxy hops in front of the app (Express `trust proxy`).
 * Default 1 (one load balancer / platform proxy). Use 2 when Cloudflare sits in
 * front of a load balancer. A non-numeric value is passed through so Express
 * subnet names such as `loopback` keep working.
 */
export function getTrustProxy(): number | string {
  const raw = env("TRUST_PROXY");
  if (!raw) return 1;
  if (/^\d+$/.test(raw)) return Math.min(Number(raw), 10);
  return raw;
}

/* ------------------------------------------------------------------ */
/* Bot protection (Cloudflare Turnstile)                               */
/* ------------------------------------------------------------------ */

export function getTurnstileConfig() {
  const siteKey = env("TURNSTILE_SITE_KEY");
  const secretKey = env("TURNSTILE_SECRET_KEY");
  return {
    siteKey,
    secretKey,
    /** Verification is active only when the secret is configured. */
    enabled: Boolean(secretKey),
    /** The browser widget needs the public site key as well. */
    widgetEnabled: Boolean(siteKey && secretKey),
  };
}

/* ------------------------------------------------------------------ */
/* Outbound email                                                      */
/* ------------------------------------------------------------------ */

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
};

export function getSmtpConfig(): SmtpConfig | null {
  const url = env("SMTP_URL");
  if (url) {
    try {
      const parsed = new URL(url);
      const secure = parsed.protocol === "smtps:";
      return {
        host: parsed.hostname,
        port: parsed.port ? Number(parsed.port) : secure ? 465 : 587,
        secure,
        user: decodeURIComponent(parsed.username),
        pass: decodeURIComponent(parsed.password),
      };
    } catch {
      return null;
    }
  }
  const host = env("SMTP_HOST");
  if (!host) return null;
  const port = Number(env("SMTP_PORT") || "587");
  return {
    host,
    port: Number.isInteger(port) && port > 0 ? port : 587,
    secure: env("SMTP_SECURE") ? env("SMTP_SECURE") === "true" : port === 465,
    user: env("SMTP_USER"),
    pass: env("SMTP_PASS"),
  };
}

export function getEmailConfig() {
  const webhookUrl = env("EMAIL_WEBHOOK_URL");
  const smtp = getSmtpConfig();
  return {
    webhookUrl,
    webhookToken: env("EMAIL_WEBHOOK_TOKEN"),
    smtp,
    from: env("NEWSLETTER_FROM_EMAIL"),
    /** True when at least one real delivery channel is configured. */
    deliveryConfigured: Boolean(webhookUrl || smtp),
    maxAttempts: Math.min(Math.max(Number(env("EMAIL_MAX_ATTEMPTS") || "8") || 8, 1), 50),
  };
}

/* ------------------------------------------------------------------ */
/* Background jobs                                                     */
/* ------------------------------------------------------------------ */

export function getSchedulerConfig() {
  const cleanupHours = Number(env("CLEANUP_INTERVAL_HOURS") || "24");
  return {
    /**
     * Set `DISABLE_INTERNAL_SCHEDULER=true` when the platform runs
     * `pnpm db:cleanup` / `node dist/maintenance.js` from its own cron instead.
     */
    enabled: env("DISABLE_INTERNAL_SCHEDULER") !== "true",
    cleanupIntervalMs:
      Math.min(Math.max(Number.isFinite(cleanupHours) ? cleanupHours : 24, 1), 24 * 7) *
      60 *
      60 *
      1000,
    outboxIntervalMs: 60_000,
  };
}

/** TTL for cached public story lists. `0` disables the cache. */
export function getPublicCacheTtlMs(): number {
  const raw = env("PUBLIC_CACHE_TTL_SECONDS");
  if (!raw) return 30_000;
  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || seconds < 0) return 30_000;
  return Math.min(seconds, 600) * 1000;
}

/**
 * When true, an allow-listed address only receives its role if the identity
 * provider positively states the email is verified. Off by default because the
 * Manus OAuth user-info response does not (yet) carry an `email_verified`
 * claim; with it off, an explicit `false` is still honoured.
 */
export function requireVerifiedEmail(): boolean {
  return env("REQUIRE_VERIFIED_EMAIL") === "true";
}

/**
 * When true, a production boot with pre-launch blockers (demo contact email,
 * placeholder social image, no mail delivery ...) is refused. Off by default so
 * a first deploy can start and be configured through Admin → Settings.
 */
export function enforceLaunchChecks(): boolean {
  return env("ENFORCE_LAUNCH_CHECKS") === "true";
}

export type ConfigProblem = { key: string; message: string };

/**
 * Validate the production environment. Returns every problem so a deployer can
 * fix them in one pass instead of one restart at a time.
 */
export function validateConfig(): ConfigProblem[] {
  const problems: ConfigProblem[] = [];

  if (isProduction) {
    const site = getPublicSiteUrl();
    if (!site) {
      problems.push({
        key: "PUBLIC_SITE_URL",
        message:
          "Required in production. Set it to the exact https origin readers use (e.g. https://www.buddhanews.com).",
      });
    } else if (!site.startsWith("https://")) {
      problems.push({
        key: "PUBLIC_SITE_URL",
        message: "Must use https in production.",
      });
    }

    if (!process.env.MANUS_JWT_SECRET) {
      problems.push({ key: "MANUS_JWT_SECRET", message: "Required to sign sessions." });
    }

    if (!process.env.DATABASE_URL) {
      problems.push({ key: "DATABASE_URL", message: "Required to start the newsroom." });
    }

    const email = env("NEWSLETTER_FROM_EMAIL");
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      problems.push({ key: "NEWSLETTER_FROM_EMAIL", message: "Must be a valid email address." });
    }

    const turnstile = getTurnstileConfig();
    if (Boolean(turnstile.siteKey) !== Boolean(turnstile.secretKey)) {
      problems.push({
        key: turnstile.siteKey ? "TURNSTILE_SECRET_KEY" : "TURNSTILE_SITE_KEY",
        message:
          "TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY must be set together; one without the other would block every contact and newsletter submission.",
      });
    }
    if (env("SMTP_HOST") && !getSmtpConfig()) {
      problems.push({ key: "SMTP_HOST", message: "SMTP settings are not valid." });
    }
    if (env("SMTP_URL") && !getSmtpConfig()) {
      problems.push({ key: "SMTP_URL", message: "Must look like smtps://user:pass@host:465." });
    }
    for (const origin of csv("ALLOWED_ORIGINS")) {
      try {
        const parsed = new URL(origin);
        if (parsed.protocol !== "https:") {
          problems.push({
            key: "ALLOWED_ORIGINS",
            message: `${origin} must use https in production.`,
          });
        }
      } catch {
        problems.push({ key: "ALLOWED_ORIGINS", message: `${origin} is not a valid URL.` });
      }
    }
  }

  return problems;
}

/** Throwing variant used at boot. */
export function assertProductionConfig(): void {
  const problems = validateConfig();
  if (problems.length === 0) return;
  const detail = problems.map(problem => `  - ${problem.key}: ${problem.message}`).join("\n");
  throw new Error(`Invalid production configuration:\n${detail}`);
}
