import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Privacy and token primitives.
 *
 * Raw visitor IP addresses are never written to the database. Everything that
 * needs a stable network identifier (audit trail, view deduplication, rate
 * limiting) uses a keyed HMAC. Without the server secret the value cannot be
 * reversed or matched against an address list.
 */

let cachedSecret: Buffer | null = null;
let cachedSecretSource = "";

function privacySecret(): Buffer {
  const dedicated = process.env.PRIVACY_HASH_SECRET?.trim();
  const fallback = process.env.MANUS_JWT_SECRET?.trim();
  const source = dedicated || fallback;
  if (!source) {
    // Development convenience only. Production validation requires a JWT
    // secret, so this branch can never be reached by a production deploy.
    if (process.env.NODE_ENV === "production") {
      throw new Error("PRIVACY_HASH_SECRET or MANUS_JWT_SECRET is required");
    }
    return Buffer.from("buddha-news-development-only-privacy-key");
  }
  if (!cachedSecret || cachedSecretSource !== source) {
    // Domain separation: the privacy key must not equal the session signing
    // key even when the deployer supplies only one secret.
    cachedSecret = createHmac("sha256", source).update("buddha-news:privacy:v1").digest();
    cachedSecretSource = source;
  }
  return cachedSecret;
}

/** Keyed, truncated hash for network identifiers. Never reversible. */
export function hashIdentifier(value: string): string {
  if (!value) return "";
  return createHmac("sha256", privacySecret()).update(value).digest("hex").slice(0, 48);
}

/** Stable daily identifier used for view deduplication. */
export function dailyVisitorHash(ip: string, userAgent: string, day: string): string {
  return hashIdentifier(`view:${day}:${ip}:${userAgent.slice(0, 160)}`);
}

/** 256-bit random token, URL safe. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Opaque session identifier. */
export function newSessionId(): string {
  return randomBytes(24).toString("base64url");
}

/** Tokens are stored only as SHA-256 digests. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** ISO calendar day in UTC, used for daily budgets and view dedupe. */
export function utcDay(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

const SAFE_IMAGE_PATH = /^\/[a-zA-Z0-9._~\-/]+$/;

/**
 * Accept only http(s) URLs or site-relative paths for content that ends up in
 * `src`/`href`. This blocks `javascript:`, `data:` and protocol-relative URLs
 * that could be used for script injection.
 */
export function isSafeMediaUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 2000) return false;
  if (SAFE_IMAGE_PATH.test(trimmed) && !trimmed.startsWith("//")) return true;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" || (url.protocol === "http:" && process.env.NODE_ENV !== "production");
  } catch {
    return false;
  }
}

/**
 * Storage keys are relative object paths. Reject traversal, schemes, control
 * characters and anything outside the allowed character set.
 */
export function normalizeStorageKey(raw: string): string | null {
  let key: string;
  try {
    key = decodeURIComponent(raw);
  } catch {
    return null;
  }
  key = key.replace(/^\/+/, "").trim();
  if (!key || key.length > 400) return null;
  if (key.includes("..") || key.includes("\\") || key.includes("//")) return null;
  if (/[\u0000-\u001f\u007f]/.test(key)) return null;
  if (!/^[A-Za-z0-9._~\-/]+$/.test(key)) return null;
  return key;
}

/**
 * Public storage prefixes that may be served without authentication.
 *
 * `news/` is the prefix used by the earliest uploads (before new uploads moved
 * to `public/news/`). Articles still reference those keys, so they must stay
 * publicly readable or every older story image answers 401. Nothing private is
 * ever written under `news/`: uploads go through `admin.media.upload`, which
 * only writes `public/news/...`.
 */
export const PUBLIC_STORAGE_PREFIXES = ["public/", "async-images/", "news/"];

export function isPublicStorageKey(key: string): boolean {
  return PUBLIC_STORAGE_PREFIXES.some(prefix => key.startsWith(prefix));
}

/** Escape `%` and `_` so user input cannot broaden a SQL LIKE pattern. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, match => `\\${match}`);
}

/** Strip control characters and cap length before logging user-controlled text. */
export function sanitizeLogValue(value: unknown, maxLength = 200): string {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .slice(0, maxLength);
}

/** Remove query strings and fragments so referrers never leak tokens. */
export function safePath(value: string): string {
  try {
    const url = new URL(value, "https://example.invalid");
    return url.pathname;
  } catch {
    return "/";
  }
}
