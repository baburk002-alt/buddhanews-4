import { beforeEach, describe, expect, it } from "vitest";
import { resolveAccess, atLeast, canPublish, canDelete } from "./access";
import { checkRateLimit, resetRateLimits } from "./rateLimit";
import {
  dailyVisitorHash,
  hashIdentifier,
  hashToken,
  isPublicStorageKey,
  isSafeMediaUrl,
  normalizeStorageKey,
  randomToken,
  safeEqual,
  utcDay,
} from "./security";
import { localeFromAcceptLanguage, localizedSlug, slugify, splitLocalePath } from "@shared/news";

describe("privacy-preserving identifiers", () => {
  it("hashes addresses irreversibly and deterministically", () => {
    const hash = hashIdentifier("203.0.113.9");
    expect(hash).toMatch(/^[0-9a-f]{48}$/);
    expect(hash).not.toContain("203.0.113");
    expect(hashIdentifier("203.0.113.9")).toBe(hash);
    expect(hashIdentifier("203.0.113.10")).not.toBe(hash);
  });

  it("rotates the daily visitor hash every UTC day and by user agent", () => {
    const day = "2026-05-01";
    const first = dailyVisitorHash("203.0.113.9", "AgentA", day);
    expect(first).toBe(dailyVisitorHash("203.0.113.9", "AgentA", day));
    expect(first).not.toBe(dailyVisitorHash("203.0.113.9", "AgentA", "2026-05-02"));
    expect(first).not.toBe(dailyVisitorHash("203.0.113.9", "AgentB", day));
  });

  it("never derives the day from local time", () => {
    expect(utcDay(new Date("2026-05-01T23:59:59Z"))).toBe("2026-05-01");
    expect(utcDay(new Date("2026-05-02T00:00:01Z"))).toBe("2026-05-02");
  });
});

describe("tokens", () => {
  it("creates unpredictable tokens and stable hashes", () => {
    const token = randomToken(32);
    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(token).not.toBe(randomToken(32));
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).not.toBe(token);
    expect(safeEqual(hashToken(token), hashToken(token))).toBe(true);
    expect(safeEqual("a", "b")).toBe(false);
  });
});

describe("storage keys and media URLs", () => {
  it("separates public prefixes from private uploads", () => {
    expect(isPublicStorageKey("public/news/photo.webp")).toBe(true);
    expect(isPublicStorageKey("async-images/abc/photo.webp")).toBe(true);
    expect(isPublicStorageKey("private/contracts/scan.pdf")).toBe(false);
    // Legacy uploads written before the public/ prefix existed (item 1).
    expect(isPublicStorageKey("news/photo.webp")).toBe(true);
    expect(isPublicStorageKey("news/2025/photo.webp")).toBe(true);
    // The prefix is a path segment, not a string prefix.
    expect(isPublicStorageKey("newsletter/subscribers.csv")).toBe(false);
    expect(isPublicStorageKey("private/news/photo.webp")).toBe(false);
  });

  it("rejects traversal and absolute keys", () => {
    expect(normalizeStorageKey("../../etc/passwd")).toBeNull();
    expect(normalizeStorageKey("/etc/passwd")).toBe("etc/passwd");
    expect(normalizeStorageKey("https://evil.example/x.png")).toBeNull();
    expect(normalizeStorageKey("public/news/photo.webp")).toBe("public/news/photo.webp");
  });

  it("blocks script and data URLs in image fields", () => {
    expect(isSafeMediaUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeMediaUrl("data:image/svg+xml;base64,PHN2Zz4=")).toBe(false);
    expect(isSafeMediaUrl("https://cdn.example.com/a.webp")).toBe(true);
    expect(isSafeMediaUrl("/manus-storage/public/news/a.webp")).toBe(true);
  });
});

describe("role resolution and immediate revocation", () => {
  const base = { openId: "user-1", email: "someone@example.com", role: "user" as const, roleSource: "default" as const };

  it("promotes allow-listed editors and administrators", () => {
    expect(resolveAccess({ ...base, email: "editor@example.com" }).role).toBe("editor");
    const admin = resolveAccess({ ...base, email: "admin@example.com" });
    expect(admin.role).toBe("admin");
    expect(admin.changed).toBe(true);
  });

  it("demotes an administrator removed from the allow-list", () => {
    const revoked = resolveAccess({
      ...base,
      email: "former-admin@example.com",
      role: "admin",
      roleSource: "env",
    });
    expect(revoked.role).toBe("user");
    expect(revoked.changed).toBe(true);
  });

  it("keeps an explicit manual grant until it is removed", () => {
    const granted = resolveAccess({
      ...base,
      role: "editor",
      roleSource: "manual",
    });
    expect(granted.role).toBe("editor");
    expect(granted.changed).toBe(false);
  });

  it("treats the configured owner as administrator", () => {
    expect(resolveAccess({ ...base, openId: "test-owner" }).role).toBe("admin");
  });

  it("keeps publishing and deletion away from editors", () => {
    expect(atLeast("editor", "editor")).toBe(true);
    expect(canPublish("editor")).toBe(false);
    expect(canDelete("editor")).toBe(false);
    expect(canPublish("admin")).toBe(true);
  });
});

describe("rate limiting", () => {
  beforeEach(() => resetRateLimits());

  it("allows the configured budget and then blocks", () => {
    const key = `test:${Math.random()}`;
    expect(checkRateLimit(key, 2, 60_000).ok).toBe(true);
    expect(checkRateLimit(key, 2, 60_000).ok).toBe(true);
    const blocked = checkRateLimit(key, 2, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("keeps buckets independent", () => {
    const a = `a:${Math.random()}`;
    const b = `b:${Math.random()}`;
    checkRateLimit(a, 1, 60_000);
    expect(checkRateLimit(a, 1, 60_000).ok).toBe(false);
    expect(checkRateLimit(b, 1, 60_000).ok).toBe(true);
  });
});

describe("multilingual URLs", () => {
  it("splits a locale prefix from the rest of the path", () => {
    expect(splitLocalePath("/ps/article/xyz")).toEqual({
      locale: "ps",
      path: "/article/xyz",
      hadLocale: true,
    });
    expect(splitLocalePath("/article/xyz")).toEqual({
      locale: "en",
      path: "/article/xyz",
      hadLocale: false,
    });
    expect(splitLocalePath("/")).toEqual({ locale: "en", path: "/", hadLocale: false });
  });

  it("picks a supported language from Accept-Language", () => {
    expect(localeFromAcceptLanguage("ps-AF,ps;q=0.9,en;q=0.8")).toBe("ps");
    expect(localeFromAcceptLanguage("fa-IR,fa;q=0.9")).toBe("fa");
    expect(localeFromAcceptLanguage("de-DE,de;q=0.9")).toBe("en");
    expect(localeFromAcceptLanguage(undefined)).toBe("en");
  });

  it("transliterates Pashto and Dari headlines into readable slugs", () => {
    const pashto = localizedSlug("د پولې امنیت توافق");
    expect(pashto).toMatch(/^[a-z0-9-]+$/);
    expect(pashto.length).toBeGreaterThan(3);
    const dari = localizedSlug("توافق امنیتی مرز");
    expect(dari).toMatch(/^[a-z0-9-]+$/);
    expect(slugify("Hello, World!")).toBe("hello-world");
  });
});
