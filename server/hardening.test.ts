/**
 * Tests for the 14-point hardening pass: storage prefixes, upload guard,
 * bot protection, mail delivery, retention scheduler, rate-limit stores, cache
 * invalidation, relational tags/categories, email-verification access rules,
 * launch checks and the per-language RSS link.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AddressInfo } from "node:net";
import { eq, sql } from "drizzle-orm";
import { articleTags, articles, emailOutbox, tags as tagsTable } from "../drizzle/schema";
import type { User } from "../drizzle/schema";
import { createApp } from "./_core/index";
import { appRouter } from "./routers";
import * as db from "./db";
import { resolveAccess } from "./access";
import { honeypotTripped, TURNSTILE_VERIFY_URL } from "./botProtection";
import { deliverMail, setSmtpTransportForTests } from "./mailDelivery";
import { processOutbox } from "./mailer";
import { LAST_CLEANUP_KEY, runRetentionIfDue } from "./maintenance";
import {
  checkRateLimitAsync,
  rateLimitBackend,
  resetRateLimits,
  setRateLimitStore,
  type RateLimitStore,
} from "./rateLimit";
import { invalidatePublicCache, publicCacheStats } from "./cache";
import { evaluateLaunchReadiness } from "./launchCheck";
import { isPlaceholderEmail, isPlaceholderImage } from "../shared/demo";
import { createUser, mockReq, sessionCookie } from "./test/helpers";

const ORIGIN = "https://news.example.com";
let base = "";
let server: Awaited<ReturnType<typeof createApp>>["server"];
let admin: User;
let editor: User;
let reader: User;

function caller(user: User | null, ip: string) {
  return appRouter.createCaller({
    req: mockReq({ ip }),
    res: {
      clearCookie: () => undefined,
      cookie: () => undefined,
      setHeader: () => undefined,
      status: () => undefined,
      json: () => undefined,
    },
    user,
    access: null,
    sessionId: undefined,
  } as never);
}

const translation = (slug: string, title: string) => ({
  locale: "en" as const,
  slug,
  title,
  summary: `${title} summary`,
  content: `${title} body text for the test article.`,
});

beforeAll(async () => {
  const created = await createApp();
  server = created.server;
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  admin = await createUser("admin@example.com", "admin", { name: "Admin" });
  editor = await createUser("editor@example.com", "editor", { name: "Editor" });
  reader = await createUser("reader2@example.com", "user", { name: "Reader" });
});

afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  setSmtpTransportForTests(null);
  setRateLimitStore(null);
});

describe("item 4: honeypot", () => {
  it("recognises a filled honeypot", () => {
    expect(honeypotTripped("http://spam.example")).toBe(true);
    expect(honeypotTripped("  x ")).toBe(true);
    expect(honeypotTripped("")).toBe(false);
    expect(honeypotTripped(undefined)).toBe(false);
  });

  it("newsletter: a filled honeypot looks successful but stores nothing and queues no email", async () => {
    const result = await caller(null, "198.51.100.51").newsletter.subscribe({
      email: "bot-newsletter@example.com",
      locale: "en",
      consent: true,
      company: "Acme Spam Ltd",
    });
    expect(result.status).toBe("pending");
    expect(await db.findSubscriberByEmail("bot-newsletter@example.com")).toBeFalsy();
    const mail = await db.listOutboxWithBodies(200);
    expect(mail.some(row => row.recipient === "bot-newsletter@example.com")).toBe(false);
  });

  it("contact: a filled honeypot stores no message", async () => {
    const before = (await db.listContactMessages(500)).length;
    await caller(null, "198.51.100.52").contact.submit({
      name: "Spam Bot",
      email: "bot-contact@example.com",
      subject: "Cheap watches",
      message: "Buy cheap watches now at the best price anywhere.",
      locale: "en",
      website: "https://spam.example",
    });
    expect((await db.listContactMessages(500)).length).toBe(before);
  });

  it("contact: a normal message is still stored", async () => {
    const before = (await db.listContactMessages(500)).length;
    await caller(null, "198.51.100.53").contact.submit({
      name: "Real Reader",
      email: "real@example.com",
      subject: "A correction",
      message: "There is a typo in the second paragraph of your story.",
      locale: "en",
    });
    expect((await db.listContactMessages(500)).length).toBe(before + 1);
  });
});

describe("item 4: Cloudflare Turnstile", () => {
  const subscribe = (ip: string, token?: string, email = `t-${Math.random().toString(36).slice(2)}@example.com`) =>
    caller(null, ip).newsletter.subscribe({ email, locale: "en", consent: true, turnstileToken: token });

  it("is skipped when no keys are configured", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(subscribe("198.51.100.61")).resolves.toBeTruthy();
    expect(fetchSpy.mock.calls.some(call => String(call[0]).includes("turnstile"))).toBe(false);
  });

  it("rejects a missing token without calling Cloudflare", async () => {
    vi.stubEnv("TURNSTILE_SITE_KEY", "site");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(subscribe("198.51.100.62")).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("verifies the token server-side with the secret key", async () => {
    vi.stubEnv("TURNSTILE_SITE_KEY", "site");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
    await expect(subscribe("198.51.100.63", "good-token")).resolves.toBeTruthy();
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toBe(TURNSTILE_VERIFY_URL);
    const body = String((init as RequestInit).body);
    expect(body).toContain("secret=secret");
    expect(body).toContain("response=good-token");
  });

  it("rejects a token Cloudflare refuses", async () => {
    vi.stubEnv("TURNSTILE_SITE_KEY", "site");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: false, "error-codes": ["invalid-input-response"] }), { status: 200 })
    );
    await expect(subscribe("198.51.100.64", "bad-token")).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("fails closed when Cloudflare is unreachable", async () => {
    vi.stubEnv("TURNSTILE_SITE_KEY", "site");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    await expect(subscribe("198.51.100.65", "any")).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
  });

  it("applies to the contact form too", async () => {
    vi.stubEnv("TURNSTILE_SITE_KEY", "site");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    await expect(
      caller(null, "198.51.100.66").contact.submit({
        name: "No Token",
        email: "notoken@example.com",
        subject: "Hello there",
        message: "A message that has no verification token attached.",
        locale: "en",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("item 5: upload route authenticates before parsing the body", () => {
  const url = () => `${base}/api/trpc/admin.media.upload`;
  const big = (bytes: number) => JSON.stringify({ json: { data: "A".repeat(bytes) } });

  it("returns 401 for anonymous callers even with a large body", async () => {
    const response = await fetch(url(), {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN },
      body: big(3 * 1024 * 1024),
    });
    expect(response.status).toBe(401);
  });

  it("returns 403 for signed-in readers", async () => {
    const response = await fetch(url(), {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN, cookie: await sessionCookie(reader) },
      body: big(1024),
    });
    expect(response.status).toBe(403);
  });

  it("rejects an oversized declared body with 413 before reading it", async () => {
    const response = await fetch(url(), {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN, cookie: await sessionCookie(editor) },
      body: big(9 * 1024 * 1024),
    });
    expect(response.status).toBe(413);
  });

  it("rejects a non-JSON content type", async () => {
    const response = await fetch(url(), {
      method: "POST",
      headers: { "content-type": "text/plain", origin: ORIGIN, cookie: await sessionCookie(editor) },
      body: "hello",
    });
    expect(response.status).toBe(415);
  });

  it("lets an editor through to the procedure (which then validates the payload)", async () => {
    const response = await fetch(url(), {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN, cookie: await sessionCookie(editor) },
      body: JSON.stringify({ json: { filename: "x" } }),
    });
    expect([401, 403, 411, 413, 415, 429]).not.toContain(response.status);
  });
});

describe("item 3: email delivery", () => {
  beforeEach(async () => {
    // Earlier tests (newsletter sign-ups) leave confirmation mail queued.
    await (await db.requireDb()).delete(emailOutbox);
  });
  async function queue(recipient: string) {
    return db.enqueueEmail({ recipient, subject: "Confirm", body: "Link: https://x.example/c?token=abc", kind: "newsletter_confirm" });
  }
  async function rowStatus(id: number) {
    const conn = await db.requireDb();
    const [row] = await conn.select().from(emailOutbox).where(eq(emailOutbox.id, id));
    return row!;
  }

  it("does nothing (rows stay queued) when no delivery channel is configured", async () => {
    const id = await queue("nochannel@example.com");
    const result = await processOutbox(50);
    expect(result.claimed).toBe(0);
    expect((await rowStatus(id)).status).toBe("queued");
  });

  it("delivers through the webhook with a bearer token and marks the row sent", async () => {
    vi.stubEnv("EMAIL_WEBHOOK_URL", "https://mail.test/send");
    vi.stubEnv("EMAIL_WEBHOOK_TOKEN", "hook-secret");
    vi.stubEnv("NEWSLETTER_FROM_EMAIL", "news@buddhanews.org");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok", { status: 200 }));
    const id = await queue("webhook@example.com");
    const result = await processOutbox(50);
    expect(result.sent).toBeGreaterThanOrEqual(1);
    const call = fetchSpy.mock.calls.find(
      ([target, init]) =>
        String(target) === "https://mail.test/send" && JSON.parse(String((init as RequestInit).body)).to === "webhook@example.com"
    )!;
    expect(call).toBeTruthy();
    const init = call[1] as RequestInit;
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer hook-secret");
    expect(JSON.parse(String(init.body)).to).toBe("webhook@example.com");
    const row = await rowStatus(id);
    expect(row.status).toBe("sent");
    expect(row.sentAt).toBeTruthy();
  });

  it("backs off and keeps the row queued when the provider fails", async () => {
    vi.stubEnv("EMAIL_WEBHOOK_URL", "https://mail.test/send");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("boom", { status: 502 }));
    const id = await queue("retry@example.com");
    const result = await processOutbox(50);
    expect(result.retried).toBeGreaterThanOrEqual(1);
    const row = await rowStatus(id);
    expect(row.status).toBe("queued");
    expect(row.attempts).toBe(1);
    expect(row.lastError).toContain("webhook");
    expect(row.nextAttemptAt!.getTime()).toBeGreaterThan(Date.now());
    // Not due again straight away.
    expect((await processOutbox(50)).claimed).toBe(0);
  });

  it("falls back to SMTP when the webhook fails", async () => {
    vi.stubEnv("EMAIL_WEBHOOK_URL", "https://mail.test/send");
    vi.stubEnv("SMTP_HOST", "smtp.test");
    vi.stubEnv("SMTP_PORT", "587");
    vi.stubEnv("NEWSLETTER_FROM_EMAIL", "news@buddhanews.org");
    const sendMail = vi.fn().mockResolvedValue({ messageId: "1" });
    setSmtpTransportForTests({ sendMail } as never);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("down", { status: 503 }));
    await expect(
      deliverMail({ to: "smtp@example.com", subject: "S", text: "T", kind: "test" })
    ).resolves.toBe("smtp");
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "smtp@example.com", from: "news@buddhanews.org", subject: "S" })
    );
  });

  it("marks a row failed once the attempt limit is reached", async () => {
    vi.stubEnv("EMAIL_WEBHOOK_URL", "https://mail.test/send");
    vi.stubEnv("EMAIL_MAX_ATTEMPTS", "1");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("no", { status: 500 }));
    const id = await queue("giveup@example.com");
    const result = await processOutbox(50);
    expect(result.failed).toBeGreaterThanOrEqual(1);
    expect((await rowStatus(id)).status).toBe("failed");
  });
});

describe("item 2: retention scheduler", () => {
  it("runs at most once per interval, even when called twice", async () => {
    await db.releaseMaintenanceSlot(LAST_CLEANUP_KEY);
    const first = await runRetentionIfDue(24 * 60 * 60 * 1000);
    const second = await runRetentionIfDue(24 * 60 * 60 * 1000);
    expect(first).not.toBeNull();
    expect(second).toBeNull();
    expect(await db.getMaintenanceTimestamp(LAST_CLEANUP_KEY)).toBeInstanceOf(Date);
  });

  it("two instances racing for the slot produce a single run", async () => {
    await db.releaseMaintenanceSlot(LAST_CLEANUP_KEY);
    const results = await Promise.all([runRetentionIfDue(60_000), runRetentionIfDue(60_000), runRetentionIfDue(60_000)]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("keeps internal maintenance keys out of the admin-visible settings", async () => {
    expect(Object.keys(await db.getSettings()).some(key => key.startsWith("_"))).toBe(false);
  });
});

describe("item 4: shared rate-limit store", () => {
  it("uses a pluggable (Redis-style) store when one is configured", async () => {
    const counts = new Map<string, number>();
    const store: RateLimitStore = {
      async hit(key, windowMs, cost) {
        const next = (counts.get(key) ?? 0) + cost;
        counts.set(key, next);
        return { count: next, ttlMs: windowMs };
      },
    };
    setRateLimitStore(store);
    expect(rateLimitBackend()).toBe("custom");
    expect((await checkRateLimitAsync("k", 2, 1000)).ok).toBe(true);
    expect((await checkRateLimitAsync("k", 2, 1000)).ok).toBe(true);
    const blocked = await checkRateLimitAsync("k", 2, 1000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(counts.get("k")).toBe(3);
  });

  it("falls back to the in-memory store without REDIS_URL", async () => {
    resetRateLimits();
    expect(rateLimitBackend()).toBe("memory");
    expect((await checkRateLimitAsync("mem", 1, 1000)).ok).toBe(true);
    expect((await checkRateLimitAsync("mem", 1, 1000)).ok).toBe(false);
  });
});

describe("item 10: short-lived public cache with invalidation", () => {
  it("serves repeat reads from the cache and drops it when a story is created", async () => {
    invalidatePublicCache();
    const first = await db.listArticles({ status: "published", limit: 50 });
    expect(publicCacheStats().entries).toBeGreaterThan(0);
    const generationBefore = publicCacheStats().generation;
    // A repeat read is served from memory: the very same array comes back.
    const again = await db.listArticles({ status: "published", limit: 50 });
    expect(again).toBe(first);

    await db.createArticle({
      slug: "cache-probe-story",
      status: "published",
      category: "world",
      publishedAt: new Date(),
      translations: [translation("cache-probe-story", "Cache probe story")],
    });
    expect(publicCacheStats().generation).toBeGreaterThan(generationBefore);
    const afterCreate = await db.listArticles({ status: "published", limit: 50 });
    expect(afterCreate.some(article => article.slug === "cache-probe-story")).toBe(true);
  });

  it("does not cache drafts", async () => {
    const id = await db.createArticle({
      slug: "cache-draft-probe",
      status: "draft",
      category: "world",
      translations: [translation("cache-draft-probe", "Draft probe")],
    });
    const published = await db.listArticles({ status: "published", limit: 100 });
    expect(published.some(article => article.id === id)).toBe(false);
  });
});

describe("item 13: relational categories and tags", () => {
  it("normalises tags into tags + article_tags and keeps them in sync on update", async () => {
    const id = await db.createArticle({
      slug: "tag-roundtrip",
      status: "draft",
      category: "business",
      tags: ["Economy", " economy ", "Trade", "", "Aid"],
      translations: [translation("tag-roundtrip", "Tag roundtrip")],
    });
    const conn = await db.requireDb();
    const linked = async () =>
      (
        await conn
          .select({ name: tagsTable.name })
          .from(articleTags)
          .innerJoin(tagsTable, eq(articleTags.tagId, tagsTable.id))
          .where(eq(articleTags.articleId, id))
      )
        .map(row => row.name)
        .sort();
    expect(await linked()).toEqual(["Aid", "Economy", "Trade"]);
    expect((await db.getArticleById(id))!.tags).toEqual(["Economy", "Trade", "Aid"]);

    await db.updateArticle(id, {
      slug: "tag-roundtrip",
      status: "draft",
      category: "business",
      tags: ["Trade", "Energy"],
      translations: [translation("tag-roundtrip", "Tag roundtrip")],
    });
    expect(await linked()).toEqual(["Energy", "Trade"]);
    // The tag dictionary is shared: "Trade" is not duplicated.
    const [{ n }] = (await conn.execute(sql`SELECT COUNT(*) AS n FROM tags WHERE name = 'Trade'`))[0] as unknown as Array<{ n: number }>;
    expect(Number(n)).toBe(1);
  });

  it("cascades article_tags and translations when an article row is removed", async () => {
    const id = await db.createArticle({
      slug: "cascade-probe",
      status: "draft",
      category: "culture",
      tags: ["Cascade"],
      translations: [translation("cascade-probe", "Cascade probe")],
    });
    const conn = await db.requireDb();
    await conn.delete(articles).where(eq(articles.id, id));
    const links = await conn.select().from(articleTags).where(eq(articleTags.articleId, id));
    expect(links).toHaveLength(0);
    const [rows] = (await conn.execute(sql`SELECT COUNT(*) AS n FROM article_translations WHERE articleId = ${id}`)) as unknown as [Array<{ n: number }>];
    expect(Number(rows[0]!.n)).toBe(0);
  });

  it("refuses an unknown category at the database level", async () => {
    await expect(
      db.createArticle({
        slug: "bad-category",
        status: "draft",
        category: "not-a-category",
        translations: [translation("bad-category", "Bad category")],
      })
    ).rejects.toThrow();
  });

  it("refuses an unknown category at the API level", async () => {
    await expect(
      caller(admin, "198.51.100.71").admin.articles.create({
        slug: "bad-category-api",
        status: "draft",
        category: "not-a-category",
        subcategory: null,
        coverImage: null,
        coverAlt: null,
        authorName: "Desk",
        featured: false,
        breaking: false,
        readMinutes: 3,
        tags: [],
        translations: [translation("bad-category-api", "Bad category api")],
      } as never)
    ).rejects.toThrow();
  });

  it("lists the eight seeded categories as active", async () => {
    const active = await db.listActiveCategories();
    for (const key of ["afghanistan", "world", "business", "sports", "culture", "opinion", "specials", "videos"]) {
      expect(active).toContain(key);
    }
  });
});

describe("item 14: email verification and per-language RSS", () => {
  const base = { openId: "x", email: "admin@example.com", role: "user" as const, roleSource: "default" as const };

  it("honours the ADMIN_EMAILS allow-list for verified or unknown verification state", () => {
    expect(resolveAccess({ ...base, emailVerified: true }).role).toBe("admin");
    expect(resolveAccess({ ...base, emailVerified: null }).role).toBe("admin");
  });

  it("ignores the allow-list when the provider says the email is unverified", () => {
    const access = resolveAccess({ ...base, emailVerified: false });
    expect(access.role).toBe("user");
    expect(access.reason).toBe("unverified-email");
  });

  it("REQUIRE_VERIFIED_EMAIL=true needs an explicit verified claim", () => {
    vi.stubEnv("REQUIRE_VERIFIED_EMAIL", "true");
    expect(resolveAccess({ ...base, emailVerified: null }).role).toBe("user");
    expect(resolveAccess({ ...base, emailVerified: true }).role).toBe("admin");
  });

  it("never blocks the configured owner", () => {
    expect(resolveAccess({ ...base, openId: "test-owner", emailVerified: false }).role).toBe("admin");
  });

  it("points the RSS <link> on /ps/ and /fa/ at their own feeds", async () => {
    for (const locale of ["en", "ps", "fa"]) {
      const html = await (await fetch(`${globalBase()}/${locale}/`)).text();
      const links = [...html.matchAll(/<link[^>]+application\/rss\+xml[^>]*>/g)].map(match => match[0]);
      expect(links.length).toBeGreaterThan(0);
      for (const link of links) {
        expect(link).toContain(`/${locale}/rss.xml`);
        if (locale !== "en") expect(link).not.toContain("/en/rss.xml");
      }
    }
  });
});

function globalBase() {
  return base;
}

describe("item 8: launch readiness", () => {
  it("recognises placeholder values", () => {
    expect(isPlaceholderEmail("newsroom@buddhanews.example")).toBe(true);
    expect(isPlaceholderEmail("newsroom@buddhans.example")).toBe(true);
    expect(isPlaceholderEmail("tips@something.test")).toBe(true);
    expect(isPlaceholderEmail("desk@buddhanews.org")).toBe(false);
    expect(isPlaceholderImage("/manus-storage/async-images/abc.png")).toBe(true);
    expect(isPlaceholderImage("https://cdn.buddhanews.org/og.jpg")).toBe(false);
  });

  it("blocks go-live while the demo contact address and image remain", async () => {
    await db.updateSettings({ contactEmail: "newsroom@buddhanews.example", ogImage: "/manus-storage/async-images/x.png" });
    const report = await evaluateLaunchReadiness();
    const ids = report.items.map(item => item.id);
    expect(report.ready).toBe(false);
    expect(ids).toContain("contact-email-placeholder");
    expect(ids).toContain("og-image-placeholder");
    expect(report.items.find(item => item.id === "contact-email-placeholder")!.severity).toBe("blocker");
  });

  it("clears those items once real values are saved", async () => {
    await db.updateSettings({ contactEmail: "desk@buddhanews.org", ogImage: "https://cdn.buddhanews.org/og.jpg" });
    const ids = (await evaluateLaunchReadiness()).items.map(item => item.id);
    expect(ids).not.toContain("contact-email-placeholder");
    expect(ids).not.toContain("contact-email-missing");
    expect(ids).not.toContain("og-image-placeholder");
    expect(ids).not.toContain("og-image-missing");
  });
});
describe("devtools audit: most-read ranking", () => {
  it("runs (no unknown-column 500) and ranks by recent distinct views of the right article", async () => {
    const quiet = await db.createArticle({
      slug: "mostread-quiet",
      status: "published",
      category: "world",
      publishedAt: new Date(Date.now() - 60_000),
      translations: [translation("mostread-quiet", "Quiet story")],
    });
    const busy = await db.createArticle({
      slug: "mostread-busy",
      status: "published",
      category: "world",
      publishedAt: new Date(Date.now() - 60_000),
      translations: [translation("mostread-busy", "Busy story")],
    });
    for (const visitor of ["a", "b", "c"]) await db.recordArticleView(busy, "en", `mr-${visitor}`);
    await db.recordArticleView(quiet, "en", "mr-a");
    invalidatePublicCache();
    const list = await db.getMostRead(5);
    const ids = list.map(article => article.id);
    expect(ids.indexOf(busy)).toBeGreaterThanOrEqual(0);
    expect(ids.indexOf(busy)).toBeLessThan(ids.indexOf(quiet));
  });
});
