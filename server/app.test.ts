import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { AddressInfo } from "node:net";
import type { User } from "../drizzle/schema";
import { createApp } from "./_core/index";
import { appRouter } from "./routers";
import * as db from "./db";
import { sdk } from "./_core/sdk";
import { COOKIE_NAME } from "@shared/const";
import { createUser, mockReq, sessionCookie } from "./test/helpers";

let base = "";
let server: Awaited<ReturnType<typeof createApp>>["server"];

let owner: User;
let admin: User;
let editor: User;
let reader: User;

let articleId = 0;
let enSlug = "";
let psSlug = "";
let faSlug = "";
let demoId = 0;
let demoSlug = "";

async function trpcGet(path: string, cookie?: string) {
  const response = await fetch(`${base}/api/trpc/${path}`, {
    headers: cookie ? { cookie } : undefined,
    redirect: "manual",
  });
  return response;
}

async function trpcJson(response: Response) {
  const body = (await response.json()) as { result?: { data?: { json?: unknown } } };
  return body.result?.data?.json;
}

function caller(user: User | null, ip = "198.51.100.4") {
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

beforeAll(async () => {
  const created = await createApp();
  server = created.server;
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  base = `http://127.0.0.1:${address.port}`;

  owner = await createUser("owner@example.com", "admin", { openId: "test-owner", name: "Owner" });
  admin = await createUser("admin@example.com", "admin", { name: "Admin" });
  editor = await createUser("editor@example.com", "editor", { name: "Editor" });
  reader = await createUser("reader@example.com", "user", { name: "Reader" });

  articleId = await db.createArticle(
    {
      slug: "border-security-accord",
      status: "published",
      category: "afghanistan",
      subcategory: "politics",
      coverImage: "/manus-storage/public/news/summit.webp",
      coverAlt: "Delegates at a summit table",
      authorName: "Test Desk",
      featured: true,
      readMinutes: 4,
      tags: ["diplomacy", "borders"],
      translations: [
        {
          locale: "en",
          slug: "border-security-accord",
          title: "Regional summit ends with a border-security accord",
          summary: "Six states agree to share border data.",
          content: "Delegations agreed to a joint monitoring room.\n\n## What was agreed\n\n- A pilot room.",
        },
        {
          locale: "ps",
          slug: "پوله-امنیت-توافق",
          title: "سیمه‌ایزه غونډه د پولې امنیت توافق سره پای ته ورسېده",
          summary: "شپږ هېوادونه د پولې معلوماتو شریکولو ته موافق شول.",
          content: "استازي د ګډې څارنې خونې جوړولو ته سره یوځای شول.",
        },
        {
          locale: "fa",
          slug: "توافق-امنیتی-مرز",
          title: "نشست منطقه‌ای با توافق امنیتی مرز پایان یافت",
          summary: "شش کشور برای تبادل اطلاعات مرزی توافق کردند.",
          content: "هیئت‌ها برای ایجاد اتاق نظارت مشترک توافق کردند.",
        },
      ],
    },
    { id: admin.id, name: admin.name }
  );

  const article = await db.getArticleById(articleId);
  enSlug = article!.translations.find(item => item.locale === "en")!.slug;
  psSlug = article!.translations.find(item => item.locale === "ps")!.slug;
  faSlug = article!.translations.find(item => item.locale === "fa")!.slug;

  demoId = await db.createArticle(
    {
      slug: "demo-sample-story",
      status: "published",
      category: "culture",
      authorName: "Buddha News Demo Desk",
      isDemo: true,
      readMinutes: 2,
      translations: [
        {
          locale: "en",
          slug: "demo-sample-story",
          title: "Sample: a demonstration story used to show the layout",
          summary: "This is sample content.",
          content: "This story is sample content supplied with the newsroom template.",
        },
      ],
    },
    { id: admin.id, name: admin.name }
  );
  const demo = await db.getArticleById(demoId);
  demoSlug = demo!.translations[0]!.slug;
});

afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
});

describe("HTTP hardening", () => {
  it("serves the health endpoint with a database check", async () => {
    const response = await fetch(`${base}/api/health`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string; database: string };
    expect(body.status).toBe("ok");
    expect(body.database).toBe("up");
  });

  it("rejects unsafe API requests from a foreign origin", async () => {
    const response = await fetch(`${base}/api/trpc/newsletter.subscribe`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://evil.example" },
      body: JSON.stringify({ json: { email: "csrf@example.com", locale: "en", consent: true } }),
    });
    expect(response.status).toBe(403);
  });

  it("rejects unsafe API requests with no origin and no referer", async () => {
    const response = await fetch(`${base}/api/trpc/newsletter.subscribe`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ json: { email: "csrf2@example.com", locale: "en", consent: true } }),
    });
    expect(response.status).toBe(403);
  });

  it("accepts a same-origin request and enforces double opt-in", async () => {
    const response = await fetch(`${base}/api/trpc/newsletter.subscribe`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://news.example.com",
      },
      body: JSON.stringify({
        json: { email: "reader-sub@example.com", locale: "en", consent: true },
      }),
    });
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { result?: { data?: { json?: { status?: string } } } };
    expect(payload.result?.data?.json?.status).toBe("pending");
    const subscriber = await db.findSubscriberByEmail("reader-sub@example.com");
    expect(subscriber?.status).toBe("pending");
  });

  it("rejects request bodies above the JSON limit before parsing them", async () => {
    const response = await fetch(`${base}/api/trpc/newsletter.subscribe`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: base },
      body: JSON.stringify({ json: { email: "a@example.com", locale: "en", consent: true, padding: "x".repeat(300_000) } }),
    });
    expect(response.status).toBe(413);
  });

  it("starts OAuth with an HttpOnly state cookie and rejects a forged callback", async () => {
    vi.stubEnv("MANUS_OAUTH_PORTAL_URL", "https://portal.example");
    vi.stubEnv("MANUS_PROJECT_ID", "project-test");
    const start = await fetch(`${base}/api/oauth/start?returnTo=/admin`, { redirect: "manual" });
    expect(start.status).toBe(302);
    expect(start.headers.get("location")).toContain("https://portal.example/app-auth");
    const setCookie = start.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("bn_oauth_state=");
    expect(setCookie.toLowerCase()).toContain("httponly");
    expect(setCookie.toLowerCase()).toContain("samesite=lax");

    const forged = await fetch(
      `${base}/api/oauth/callback?code=attacker-code&state=${Buffer.from(
        JSON.stringify({ redirectUri: "https://news.example.com/api/oauth/callback", nonce: "guess" })
      ).toString("base64")}`,
      { redirect: "manual" }
    );
    expect(forged.status).toBe(403);
    vi.unstubAllEnvs();
  });

  it("requires authentication for private storage keys but not for public ones", async () => {
    const privateResponse = await fetch(`${base}/manus-storage/private/contracts/scan.png`, {
      redirect: "manual",
    });
    expect(privateResponse.status).toBe(401);

    const publicResponse = await fetch(`${base}/manus-storage/public/news/summit.webp`, {
      redirect: "manual",
    });
    expect(publicResponse.status).not.toBe(401);
  });

  it("refuses a private storage key to a signed-in non-owner", async () => {
    await db.createMediaAsset({
      url: "/manus-storage/private/contracts/scan.png",
      storageKey: "private/contracts/scan.png",
      filename: "scan.png",
      mime: "image/png",
      size: 10,
      visibility: "private",
      uploadedBy: editor.id,
    });
    const readerCookie = await sessionCookie(reader);
    const forbidden = await fetch(`${base}/manus-storage/private/contracts/scan.png`, {
      headers: { cookie: readerCookie },
      redirect: "manual",
    });
    expect(forbidden.status).toBe(403);

    const editorCookie = await sessionCookie(editor);
    const ownerResponse = await fetch(`${base}/manus-storage/private/contracts/scan.png`, {
      headers: { cookie: editorCookie },
      redirect: "manual",
    });
    // No storage provider is configured in tests, so an authorized request
    // fails closed at signing time rather than returning a signed URL.
    expect(ownerResponse.status).toBe(404);
  });

  it("does not serve API routes that do not exist", async () => {
    const response = await fetch(`${base}/api/does-not-exist`);
    expect(response.status).toBe(404);
  });
});

describe("sessions and revocation", () => {
  it("authenticates with the HttpOnly cookie only", async () => {
    const cookie = await sessionCookie(admin);
    const response = await trpcGet("auth.me", cookie);
    expect(response.status).toBe(200);
    const me = (await trpcJson(response)) as { email: string; role: string } | null;
    expect(me?.email).toBe("admin@example.com");
    expect(me?.role).toBe("admin");
  });

  it("ignores a Bearer token without a session cookie", async () => {
    const { token } = await sdk.issueSession(admin, mockReq());
    const response = await fetch(`${base}/api/trpc/auth.me`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(await trpcJson(response)).toBeNull();
  });

  it("invalidates a session immediately on logout", async () => {
    const { token, sid } = await sdk.issueSession(editor, mockReq());
    const cookie = `${COOKIE_NAME}=${token}`;
    expect(await trpcJson(await trpcGet("auth.me", cookie))).not.toBeNull();
    await db.revokeSession(sid);
    expect(await trpcJson(await trpcGet("auth.me", cookie))).toBeNull();
  });

  it("rejects an expired session row even when the JWT is valid", async () => {
    const { token, sid } = await sdk.issueSession(reader, mockReq());
    await db.requireDb().then(database =>
      database.execute(`UPDATE sessions SET expiresAt = '2020-01-01 00:00:00' WHERE id = '${sid}'`)
    );
    const response = await trpcGet("auth.me", `${COOKIE_NAME}=${token}`);
    expect(await trpcJson(response)).toBeNull();
  });

  it("revokes access as soon as a role is removed from configuration", async () => {
    const stale = await createUser("stale-admin@example.com", "admin", { roleSource: "env" });
    const { token, sid } = await sdk.issueSession(stale, mockReq());
    const cookie = `${COOKIE_NAME}=${token}`;
    const first = (await trpcJson(await trpcGet("auth.me", cookie))) as { role: string } | null;
    expect(first?.role).toBe("user");
    const session = await db.getActiveSession(sid);
    expect(session).toBeNull();
    expect(await trpcJson(await trpcGet("auth.me", cookie))).toBeNull();
  });
});

describe("newsroom authorisation", () => {
  const draft = {
    slug: "editor-draft-story",
    status: "draft" as const,
    category: "business",
    translations: [
      { locale: "en" as const, title: "An editor draft about trade", summary: "Draft", content: "Body" },
    ],
  };

  it("refuses anonymous and reader access to the newsroom", async () => {
    await expect(caller(null).admin.articles.list({ status: "all" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(caller(reader).admin.articles.list({ status: "all" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("lets an editor save a draft but not publish it", async () => {
    const created = await caller(editor).admin.articles.create(draft);
    expect(created.id).toBeGreaterThan(0);
    await expect(
      caller(editor).admin.articles.create({ ...draft, slug: "editor-publish-attempt", status: "published" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller(editor).admin.articles.publish({ id: created.id })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("lets an administrator publish and delete", async () => {
    const created = await caller(admin).admin.articles.create({
      ...draft,
      slug: "admin-publish-story",
      translations: [{ locale: "en", title: "An administrator publishes this", content: "Body" }],
    });
    await caller(admin).admin.articles.publish({ id: created.id });
    const published = await db.getArticleById(created.id);
    expect(published?.status).toBe("published");
    expect(published?.publishedAt).not.toBeNull();

    await caller(admin).admin.articles.delete({ id: created.id });
    const deleted = await db.getArticleById(created.id);
    expect(deleted?.deletedAt).not.toBeNull();
  });

  it("does not let an editor edit a published story", async () => {
    const created = await caller(admin).admin.articles.create({
      ...draft,
      slug: "editor-live-edit",
      translations: [{ locale: "en", title: "A live story", content: "Body" }],
    });
    await caller(admin).admin.articles.publish({ id: created.id });
    await expect(
      caller(editor).admin.articles.update({
        ...draft,
        id: created.id,
        slug: "editor-live-edit",
        status: "draft",
        translations: [{ locale: "en", title: "Changed by an editor", content: "Body" }],
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("refuses to change roles unless the caller is the owner", async () => {
    await expect(
      caller(admin).admin.users.setRole({ userId: reader.id, role: "editor" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const updated = await caller(owner).admin.users.setRole({ userId: reader.id, role: "editor" });
    expect(updated.ok).toBe(true);
    const reloaded = await db.getUserById(reader.id);
    expect(reloaded?.role).toBe("editor");
  });

  it("never exposes token hashes or IP-derived identifiers to admins", async () => {
    const cookie = await sessionCookie(admin);
    const subscribers = await trpcGet("admin.subscribers.list", cookie);
    expect(subscribers.status).toBe(200);
    const subscriberJson = JSON.stringify(await trpcJson(subscribers));
    expect(subscriberJson).not.toContain("confirmTokenHash");
    expect(subscriberJson).not.toContain("ipHash");
    const audit = await trpcGet("admin.audit.list", cookie);
    const auditJson = JSON.stringify(await trpcJson(audit));
    expect(auditJson).not.toContain("ipHash");
    expect(auditJson).not.toContain("userAgent");
  });

  it("rejects uploads that are not JPEG, PNG or WebP", async () => {
    await expect(
      caller(editor).admin.media.upload({
        filename: "payload.svg",
        mime: "image/svg+xml" as never,
        dataBase64: "PHN2Zz48L3N2Zz4=",
      })
    ).rejects.toBeTruthy();
  });
});

describe("articles, revisions and redirects", () => {
  it("records a revision on every update and restores as a draft", async () => {
    const created = await caller(admin).admin.articles.create({
      slug: "revision-story",
      status: "draft",
      category: "culture",
      translations: [{ locale: "en", title: "First headline", content: "First body" }],
    });
    await caller(admin).admin.articles.update({
      id: created.id,
      slug: "revision-story",
      status: "draft",
      category: "culture",
      translations: [{ locale: "en", title: "Second headline", content: "Second body" }],
    });
    const revisions = await caller(editor).admin.articles.revisions({ id: created.id });
    expect(revisions.length).toBeGreaterThanOrEqual(2);

    const restoreTarget = revisions.find(revision => revision.action === "create");
    expect(restoreTarget).toBeTruthy();
    await caller(admin).admin.articles.restoreRevision({ id: restoreTarget!.id });
    const restored = await db.getArticleById(created.id);
    expect(restored?.status).toBe("draft");
    expect(restored?.translations[0]?.title).toBe("First headline");
  });

  it("keeps the original publication date when a story is unpublished", async () => {
    const created = await caller(admin).admin.articles.create({
      slug: "dated-story",
      status: "draft",
      category: "culture",
      translations: [{ locale: "en", title: "A dated story", content: "Body" }],
    });
    await caller(admin).admin.articles.publish({ id: created.id });
    const published = await db.getArticleById(created.id);
    const original = published!.publishedAt;

    await caller(admin).admin.articles.update({
      id: created.id,
      slug: "dated-story",
      status: "draft",
      category: "culture",
      translations: [{ locale: "en", title: "A dated story", content: "Body" }],
    });
    const drafted = await db.getArticleById(created.id);
    expect(drafted!.publishedAt).toBe(original);
  });

  it("redirects an old slug to the new one after an address change", async () => {
    const created = await caller(admin).admin.articles.create({
      slug: "old-address-story",
      status: "published",
      category: "world",
      translations: [{ locale: "en", title: "A story that moves", content: "Body" }],
    });
    await caller(admin).admin.articles.update({
      id: created.id,
      slug: "new-address-story",
      status: "published",
      category: "world",
      translations: [{ locale: "en", title: "A story that moves", content: "Body" }],
    });
    const redirect = await db.resolveSlugRedirect("en", "old-address-story");
    expect(redirect?.slug).toBe("new-address-story");
    const response = await fetch(`${base}/en/article/old-address-story`, { redirect: "manual" });
    expect([301, 302]).toContain(response.status);
    expect(response.headers.get("location")).toContain("new-address-story");
  });

  it("counts one view per visitor per day", async () => {
    const before = (await db.getArticleById(articleId))!.views;
    const day = "2026-06-01";
    await db.recordArticleView(articleId, "en", "visitor-hash-a", day);
    await db.recordArticleView(articleId, "en", "visitor-hash-a", day);
    await db.recordArticleView(articleId, "en", "visitor-hash-b", day);
    const after = (await db.getArticleById(articleId))!.views;
    expect(after - before).toBe(2);
  });
});

describe("newsletter lifecycle", () => {
  it("confirms by token and unsubscribes by signed link", async () => {
    await caller(null, "198.51.100.9").newsletter.subscribe({
      email: "lifecycle@example.com",
      locale: "en",
      consent: true,
    });
    const pending = await db.findSubscriberByEmail("lifecycle@example.com");
    expect(pending?.status).toBe("pending");

    const outbox = await db.listOutboxWithBodies(10);
    const confirmation = outbox.find(
      mail => mail.recipient === "lifecycle@example.com" && mail.kind === "newsletter_confirm"
    );
    expect(confirmation).toBeTruthy();
    const token = /token=([A-Za-z0-9_-]+)/.exec(confirmation!.body)?.[1];
    expect(token).toBeTruthy();

    const confirm = await fetch(`${base}/api/newsletter/confirm?token=${token}`, {
      redirect: "manual",
    });
    expect(confirm.status).toBe(302);
    expect(confirm.headers.get("location")).toContain("newsletter=confirmed");
    const confirmed = await db.findSubscriberByEmail("lifecycle@example.com");
    expect(confirmed?.status).toBe("subscribed");

    const welcome = (await db.listOutboxWithBodies(10)).find(
      mail => mail.recipient === "lifecycle@example.com" && mail.kind === "newsletter_welcome"
    );
    expect(welcome).toBeTruthy();
    const unsubscribePath = /\/api\/newsletter\/unsubscribe\?[^"'\s<]+/.exec(welcome!.body)?.[0];
    expect(unsubscribePath).toBeTruthy();
    const unsubscribe = await fetch(`${base}${unsubscribePath}`, { redirect: "manual" });
    expect(unsubscribe.status).toBe(302);
    const removed = await db.findSubscriberByEmail("lifecycle@example.com");
    expect(removed?.status).toBe("unsubscribed");
  });

  it("rejects a confirmation token that was never issued", async () => {
    const response = await fetch(`${base}/api/newsletter/confirm?token=${"a".repeat(40)}`, {
      redirect: "manual",
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("newsletter=invalid");
  });
});

describe("SEO and multilingual routing", () => {
  it("serves each language under its own prefix with hreflang alternates", async () => {
    const english = await fetch(`${base}/en/`);
    expect(english.status).toBe(200);
    const html = await english.text();
    expect(html).toContain('lang="en"');
    expect(html).toContain('hreflang="ps"');
    expect(html).toContain('hreflang="fa-AF"');
    expect(html).toContain('hreflang="x-default"');
    expect(html).toContain("https://news.example.com/en/");

    const pashto = await fetch(`${base}/ps/`);
    expect(pashto.status).toBe(200);
    expect(await pashto.text()).toContain('lang="ps"');
  });

  it("uses the localized slug for a translated article", async () => {
    const response = await fetch(`${base}/ps/article/${encodeURIComponent(psSlug)}`);
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('lang="ps"');
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("hreflang=\"fa-AF\"");
  });

  it("redirects a story opened with another language's slug to its localized URL", async () => {
    const response = await fetch(`${base}/ps/article/${enSlug}`, { redirect: "manual" });
    expect(response.status).toBe(301);
    const location = response.headers.get("location") ?? "";
    expect(decodeURIComponent(location)).toBe(`/ps/article/${psSlug}`);
  });

  it("redirects legacy article URLs to the English prefix", async () => {
    const response = await fetch(`${base}/article/${enSlug}`, { redirect: "manual" });
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe(`/en/article/${enSlug}`);
  });

  it("returns a real 404 for a missing article", async () => {
    const response = await fetch(`${base}/en/article/this-story-does-not-exist`);
    expect(response.status).toBe(404);
    expect(await response.text()).toContain("404");
  });

  it("marks demonstration content noindex and labels it in the page", async () => {
    const response = await fetch(`${base}/en/article/${demoSlug}`);
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("noindex");
    expect(html.toLowerCase()).toContain("demonstration content");
  });

  it("publishes a sitemap index with per-language sitemaps and alternates", async () => {
    const index = await fetch(`${base}/sitemap.xml`);
    expect(index.status).toBe(200);
    const indexXml = await index.text();
    expect(indexXml).toContain("https://news.example.com/sitemap-en.xml");
    expect(indexXml).toContain("https://news.example.com/sitemap-ps.xml");

    const sitemap = await fetch(`${base}/sitemap-en.xml`);
    const sitemapXml = await sitemap.text();
    expect(sitemapXml).toContain("xhtml:link");
    expect(sitemapXml).toContain(`https://news.example.com/en/article/${enSlug}`);
    // Demonstration pages are noindex, so they must not be advertised here.
    expect(sitemapXml).not.toContain(demoSlug);

    const alias = await fetch(`${base}/en/sitemap.xml`);
    expect(alias.status).toBe(200);
    expect(await alias.text()).toBe(sitemapXml);
  });

  it("labels demonstration stories in RSS instead of passing them off as reporting", async () => {
    const rss = await fetch(`${base}/en/rss.xml`);
    expect(rss.status).toBe(200);
    const xml = await rss.text();
    expect(xml).toContain("[Demonstration]");
    expect(xml).toContain(demoSlug);
    expect(xml).toContain(enSlug);
    expect(xml).toContain("sample content, not reporting");
  });

  it("advertises the trusted public URL in robots.txt", async () => {
    const robots = await fetch(`${base}/robots.txt`);
    expect(await robots.text()).toContain("Sitemap: https://news.example.com/sitemap.xml");
  });
});
