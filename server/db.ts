import { and, desc, eq, gt, gte, inArray, isNull, like, lt, ne, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  aiUsage,
  articleRevisions,
  articleSlugRedirects,
  articleTranslations,
  articles,
  articleTags,
  articleViews,
  auditLogs,
  categories,
  contactMessages,
  emailOutbox,
  InsertUser,
  mediaAssets,
  newsletterSubscribers,
  sessions,
  siteSettings,
  tags,
  users,
} from "../drizzle/schema";
import type {
  AdminArticleDTO,
  ArticleDTO,
  ArticleTranslationDTO,
  Locale,
} from "../shared/news";
import { localizedSlug, slugify } from "../shared/news";
import { cached, invalidatePublicCache } from "./cache";
import { getRetentionPolicy } from "./config";
import { escapeLike, utcDay } from "./security";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db;
}

/* ------------------------------------------------------------------ */
/* Users and sessions                                                  */
/* ------------------------------------------------------------------ */

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");

  const db = await requireDb();
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    const value = user[field];
    if (value === undefined) continue;
    values[field] = value ?? null;
    updateSet[field] = value ?? null;
  }
  if (user.emailVerified !== undefined) {
    values.emailVerified = user.emailVerified;
    updateSet.emailVerified = user.emailVerified;
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await requireDb();
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getUserById(id: number) {
  const db = await requireDb();
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

/** Rewrite a stale role (revocation) or apply an allow-list promotion. */
export async function setUserRole(
  id: number,
  role: "user" | "editor" | "admin",
  source: "default" | "env" | "manual"
): Promise<void> {
  const db = await requireDb();
  await db
    .update(users)
    .set({ role, roleSource: source, roleUpdatedAt: new Date() })
    .where(eq(users.id, id));
}

export async function listNewsroomUsers() {
  const db = await requireDb();
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      roleSource: users.roleSource,
      lastSignedIn: users.lastSignedIn,
    })
    .from(users)
    .orderBy(desc(users.role), desc(users.lastSignedIn))
    .limit(200);
  return rows.map(row => ({
    ...row,
    lastSignedIn: row.lastSignedIn ? row.lastSignedIn.toISOString() : null,
  }));
}

export async function createSession(input: {
  id: string;
  userId: number;
  openId: string;
  ipHash: string | null;
  userAgent: string | null;
  expiresAt: Date;
}): Promise<void> {
  const db = await requireDb();
  await db.insert(sessions).values(input);
}

export async function getActiveSession(id: string) {
  const db = await requireDb();
  const [row] = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
  if (!row) return null;
  if (row.revokedAt) return null;
  if (row.expiresAt.getTime() <= Date.now()) return null;
  return row;
}

export async function touchSession(id: string, idleDeadline: Date): Promise<void> {
  const db = await requireDb();
  await db
    .update(sessions)
    .set({ lastSeenAt: new Date() })
    .where(and(eq(sessions.id, id), gt(sessions.lastSeenAt, idleDeadline)));
}

export async function revokeSession(id: string): Promise<void> {
  const db = await requireDb();
  await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, id));
}

export async function revokeUserSessions(userId: number): Promise<void> {
  const db = await requireDb();
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}

export async function pruneSessions(): Promise<number> {
  const db = await requireDb();
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [result] = await db
    .delete(sessions)
    .where(or(lt(sessions.expiresAt, cutoff), lt(sessions.revokedAt, cutoff)));
  return Number(result.affectedRows ?? 0);
}

/* ------------------------------------------------------------------ */
/* Articles                                                            */
/* ------------------------------------------------------------------ */

type ArticleRow = typeof articles.$inferSelect;
type TranslationRow = typeof articleTranslations.$inferSelect;

type Database = Awaited<ReturnType<typeof requireDb>>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

type TranslationListRow = Pick<
  TranslationRow,
  | "id"
  | "articleId"
  | "locale"
  | "slug"
  | "title"
  | "summary"
  | "seoTitle"
  | "seoDescription"
  | "aiSummary"
  | "aiSummaryAt"
>;

/** Columns returned for lists: never the full article body. */
const articleListSelection = {
  id: articles.id,
  slug: articles.slug,
  status: articles.status,
  category: articles.category,
  subcategory: articles.subcategory,
  coverImage: articles.coverImage,
  coverAlt: articles.coverAlt,
  authorName: articles.authorName,
  featured: articles.featured,
  breaking: articles.breaking,
  readMinutes: articles.readMinutes,
  tags: articles.tags,
  isDemo: articles.isDemo,
  publishedAt: articles.publishedAt,
  updatedAt: articles.updatedAt,
  views: articles.views,
  deletedAt: articles.deletedAt,
} as const;

const translationListSelection = {
  id: articleTranslations.id,
  articleId: articleTranslations.articleId,
  locale: articleTranslations.locale,
  slug: articleTranslations.slug,
  title: articleTranslations.title,
  summary: articleTranslations.summary,
  seoTitle: articleTranslations.seoTitle,
  seoDescription: articleTranslations.seoDescription,
  aiSummary: articleTranslations.aiSummary,
  aiSummaryAt: articleTranslations.aiSummaryAt,
} as const;

type ArticleListRow = {
  id: number;
  slug: string;
  status: "draft" | "published" | "archived";
  category: string;
  subcategory: string | null;
  coverImage: string | null;
  coverAlt: string | null;
  authorName: string;
  featured: boolean;
  breaking: boolean;
  readMinutes: number;
  tags: string | null;
  isDemo: boolean;
  publishedAt: Date | null;
  updatedAt: Date | null;
  views: number;
  deletedAt?: Date | null;
};

function toTranslationDTO(
  row: TranslationListRow | TranslationRow,
  content: string | null
): ArticleTranslationDTO {
  return {
    locale: row.locale as Locale,
    slug: row.slug ?? null,
    title: row.title,
    summary: row.summary,
    content,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    aiSummary: row.aiSummary,
    aiSummaryAt: row.aiSummaryAt ? row.aiSummaryAt.toISOString() : null,
  };
}

function toArticleDTO(
  row: ArticleListRow,
  translations: TranslationListRow[],
  contentByTranslationId: Map<number, string | null>,
  tagNames: string[]
): ArticleDTO {
  return {
    id: row.id,
    slug: row.slug,
    status: row.status,
    category: row.category,
    subcategory: row.subcategory,
    coverImage: row.coverImage,
    coverAlt: row.coverAlt,
    authorName: row.authorName,
    featured: Boolean(row.featured),
    breaking: Boolean(row.breaking),
    readMinutes: row.readMinutes,
    tags: tagNames,
    isDemo: Boolean(row.isDemo),
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
    views: row.views,
    translations: translations.map(translation =>
      toTranslationDTO(translation, contentByTranslationId.get(translation.id) ?? null)
    ),
  };
}

/**
 * Attach translations to article rows in one extra query (no N+1). Bodies are
 * fetched only when the caller explicitly asks for them.
 */
async function attachTranslations(
  rows: ArticleListRow[],
  includeContent: boolean
): Promise<ArticleDTO[]> {
  if (rows.length === 0) return [];
  const db = await requireDb();
  const ids = rows.map(row => row.id);

  const translations = (await db
    .select(translationListSelection)
    .from(articleTranslations)
    .where(inArray(articleTranslations.articleId, ids))) as TranslationListRow[];

  const contentByTranslationId = new Map<number, string | null>();
  if (includeContent && translations.length > 0) {
    const bodies = await db
      .select({ id: articleTranslations.id, content: articleTranslations.content })
      .from(articleTranslations)
      .where(
        inArray(
          articleTranslations.id,
          translations.map(item => item.id)
        )
      );
    for (const body of bodies) contentByTranslationId.set(body.id, body.content);
  }

  const byArticle = new Map<number, TranslationListRow[]>();
  for (const translation of translations) {
    const list = byArticle.get(translation.articleId) ?? [];
    list.push(translation);
    byArticle.set(translation.articleId, list);
  }
  const tagsByArticle = await loadTagsFor(ids);
  return rows.map(row =>
    toArticleDTO(row, byArticle.get(row.id) ?? [], contentByTranslationId, tagsByArticle.get(row.id) ?? [])
  );
}
/* ------------------------------------------------------------------ */
/* Tags (normalised: tags + article_tags)                              */
/* ------------------------------------------------------------------ */
const MAX_TAGS_PER_ARTICLE = 50;
const MAX_TAG_LENGTH = 60;
/** Trim, drop empties, cap length/count and de-duplicate case-insensitively (matches the unique index). */
export function normalizeTagNames(input: readonly string[] | null | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input ?? []) {
    const name = String(raw).replace(/[\r\n,]+/g, " ").trim().slice(0, MAX_TAG_LENGTH).trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= MAX_TAGS_PER_ARTICLE) break;
  }
  return out;
}
async function loadTagsFor(articleIds: number[]): Promise<Map<number, string[]>> {
  const result = new Map<number, string[]>();
  if (articleIds.length === 0) return result;
  const db = await requireDb();
  const rows = await db
    .select({ articleId: articleTags.articleId, name: tags.name })
    .from(articleTags)
    .innerJoin(tags, eq(tags.id, articleTags.tagId))
    .where(inArray(articleTags.articleId, articleIds))
    .orderBy(articleTags.articleId, articleTags.position, tags.id);
  for (const row of rows) {
    const list = result.get(row.articleId) ?? [];
    list.push(row.name);
    result.set(row.articleId, list);
  }
  return result;
}
/**
 * Replace a story's tags inside the caller's transaction. The legacy CSV column
 * is written too (from the same normalised list) so a rollback of migration
 * 0004 keeps working with old code.
 */
async function syncArticleTags(
  tx: Transaction,
  articleId: number,
  names: readonly string[] | null | undefined
): Promise<string[]> {
  const clean = normalizeTagNames(names);
  await tx.delete(articleTags).where(eq(articleTags.articleId, articleId));
  if (clean.length > 0) {
    await tx.insert(tags).ignore().values(clean.map(name => ({ name })));
    const found = await tx
      .select({ id: tags.id, name: tags.name })
      .from(tags)
      .where(inArray(tags.name, clean));
    const idByName = new Map(found.map(row => [row.name.toLowerCase(), row.id]));
    const links = clean.flatMap((name, position) => {
      const tagId = idByName.get(name.toLowerCase());
      return tagId ? [{ articleId, tagId, position }] : [];
    });
    if (links.length > 0) await tx.insert(articleTags).ignore().values(links);
  }
  await tx
    .update(articles)
    .set({ tags: clean.length ? clean.join(",") : null })
    .where(eq(articles.id, articleId));
  return clean;
}
/** Categories editors may assign to new or edited stories. */
export async function listActiveCategories(): Promise<string[]> {
  const db = await requireDb();
  const rows = await db
    .select({ slug: categories.slug })
    .from(categories)
    .where(eq(categories.active, true))
    .orderBy(categories.sortOrder);
  return rows.map(row => row.slug);
}
export async function isActiveCategory(slug: string): Promise<boolean> {
  const db = await requireDb();
  const [row] = await db
    .select({ slug: categories.slug })
    .from(categories)
    .where(and(eq(categories.slug, slug), eq(categories.active, true)))
    .limit(1);
  return Boolean(row);
}
/** Most-used tags, for editor autocompletion. */
export async function listPopularTags(limit = 40): Promise<Array<{ name: string; count: number }>> {
  const db = await requireDb();
  const rows = await db
    .select({ name: tags.name, count: sql<number>`count(*)` })
    .from(articleTags)
    .innerJoin(tags, eq(tags.id, articleTags.tagId))
    .groupBy(tags.id, tags.name)
    .orderBy(desc(sql`count(*)`), tags.name)
    .limit(Math.min(Math.max(limit, 1), 200));
  return rows.map(row => ({ name: row.name, count: Number(row.count) }));
}

export type ListArticlesOptions = {
  category?: string | null;
  subcategory?: string | null;
  search?: string | null;
  limit?: number;
  offset?: number;
  featured?: boolean;
  breaking?: boolean;
  includeContent?: boolean;
  includeDrafts?: boolean;
  includeDeleted?: boolean;
  locale?: Locale | null;
  orderBy?: "published" | "views" | "updated";
};

/** Strip boolean-mode operators so a reader cannot craft a malformed MATCH. */
function searchTerm(raw: string): string {
  return raw
    .replace(/[+\-><()~*"@]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

/**
 * Public story lists are the hottest read path, so they are served from a
 * short-lived cache that every editorial mutation invalidates (server/cache.ts).
 * Drafts, deleted rows and free-text searches are never cached.
 */
export async function listArticles(options: ListArticlesOptions = {}): Promise<ArticleDTO[]> {
  if (options.includeDrafts || options.includeDeleted || options.search) {
    return listArticlesUncached(options);
  }
  return cached(`list:${JSON.stringify(options)}`, () => listArticlesUncached(options));
}
async function listArticlesUncached(options: ListArticlesOptions): Promise<ArticleDTO[]> {
  const db = await requireDb();
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);
  const filters = [];

  if (!options.includeDeleted) filters.push(isNull(articles.deletedAt));
  if (!options.includeDrafts) {
    filters.push(eq(articles.status, "published"));
    filters.push(sql`${articles.publishedAt} <= NOW()`);
  }
  if (options.category) filters.push(eq(articles.category, options.category));
  if (options.subcategory) filters.push(eq(articles.subcategory, options.subcategory));
  if (options.featured) filters.push(eq(articles.featured, true));
  if (options.breaking) filters.push(eq(articles.breaking, true));

  const term = options.search ? searchTerm(options.search) : "";
  if (term) {
    // FULLTEXT is fast but only exists once `pnpm db:search-index` has run. On
    // a fresh database the MATCH below throws, so fall back to a bounded LIKE
    // scan instead of failing the whole search request.
    const likeSearch = () =>
      db
        .select({ articleId: articleTranslations.articleId })
        .from(articleTranslations)
        .where(
          or(
            like(articleTranslations.title, `%${escapeLike(term)}%`),
            like(articleTranslations.summary, `%${escapeLike(term)}%`)
          )
        )
        .limit(400);
    let rows: Array<{ articleId: number }>;
    if (term.length >= 3) {
      try {
        const [fulltextRows] = (await db.execute(sql`
          SELECT DISTINCT articleId FROM article_translations
          WHERE MATCH(title, summary, content) AGAINST (${term} IN BOOLEAN MODE)
          LIMIT 400
        `)) as unknown as [Array<{ articleId: number }>, unknown];
        rows = fulltextRows;
      } catch {
        rows = await likeSearch();
      }
    } else {
      rows = await likeSearch();
    }
    const matchingIds = Array.from(new Set(rows.map(match => Number(match.articleId))));
    if (matchingIds.length === 0) return [];
    filters.push(inArray(articles.id, matchingIds));
  }

  const order =
    options.orderBy === "views"
      ? [desc(articles.views), desc(articles.publishedAt)]
      : options.orderBy === "updated"
        ? [desc(articles.updatedAt)]
        : [desc(articles.publishedAt), desc(articles.id)];

  const rows = (await db
    .select(articleListSelection)
    .from(articles)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(...order)
    .limit(limit)
    .offset(offset)) as ArticleListRow[];

  return attachTranslations(rows, options.includeContent ?? false);
}

export async function countPublishedDemoArticles(): Promise<number> {
  const db = await requireDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(articles)
    .where(
      and(eq(articles.isDemo, true), eq(articles.status, "published"), isNull(articles.deletedAt))
    );
  return Number(row?.count ?? 0);
}
export async function countArticles(
  options: { status?: string; includeDeleted?: boolean } = {}
): Promise<number> {
  const db = await requireDb();
  const filters = [];
  if (!options.includeDeleted) filters.push(isNull(articles.deletedAt));
  if (options.status) filters.push(eq(articles.status, options.status as "draft"));
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(articles)
    .where(filters.length ? and(...filters) : undefined);
  return Number(row?.count ?? 0);
}

export async function getArticleBySlug(
  slug: string,
  includeDrafts = false
): Promise<ArticleDTO | null> {
  const db = await requireDb();
  const filters = [eq(articles.slug, slug), isNull(articles.deletedAt)];
  if (!includeDrafts) {
    filters.push(eq(articles.status, "published"));
    filters.push(sql`${articles.publishedAt} <= NOW()`);
  }
  const rows = (await db
    .select(articleListSelection)
    .from(articles)
    .where(and(...filters))
    .limit(1)) as ArticleListRow[];
  if (rows.length === 0) return null;
  const [article] = await attachTranslations(rows, true);
  return article ?? null;
}

/**
 * Resolve `/<locale>/article/<slug>` where the slug may be the localized
 * translation slug or the canonical article slug (legacy/shared links).
 */
export async function getArticleByLocalizedSlug(
  locale: Locale,
  slug: string
): Promise<ArticleDTO | null> {
  const db = await requireDb();
  const [translation] = await db
    .select({ articleId: articleTranslations.articleId })
    .from(articleTranslations)
    .where(and(eq(articleTranslations.locale, locale), eq(articleTranslations.slug, slug)))
    .limit(1);
  if (translation) {
    const article = await getArticleById(Number(translation.articleId), true);
    if (article && article.status === "published") return article;
  }
  // A reader may arrive with another language's slug (shared link, language
  // switch, old bookmark). Resolve it across all locales so the page can
  // redirect to the canonical localized address instead of showing a 404.
  const [crossLocale] = await db
    .select({ articleId: articleTranslations.articleId })
    .from(articleTranslations)
    .where(eq(articleTranslations.slug, slug))
    .limit(1);
  if (crossLocale) {
    const article = await getArticleById(Number(crossLocale.articleId), true);
    if (article && article.status === "published") return article;
  }
  return getArticleBySlug(slug);
}

export async function getArticleById(id: number, publicOnly = false): Promise<AdminArticleDTO | null> {
  const db = await requireDb();
  const filters = [eq(articles.id, id), isNull(articles.deletedAt)];
  if (publicOnly) {
    filters.push(eq(articles.status, "published"));
    filters.push(sql`${articles.publishedAt} <= NOW()`);
  }
  const rows = (await db
    .select({ ...articleListSelection, createdAt: articles.createdAt })
    .from(articles)
    .where(and(...filters))
    .limit(1)) as Array<ArticleListRow & { createdAt: Date | null }>;
  if (rows.length === 0) return null;
  const [article] = await attachTranslations(rows, true);
  if (!article) return null;
  return {
    ...article,
    createdAt: rows[0]!.createdAt ? rows[0]!.createdAt.toISOString() : null,
    deletedAt: rows[0]!.deletedAt ? rows[0]!.deletedAt.toISOString() : null,
  };
}

export type TranslationInput = {
  locale: Locale;
  slug?: string | null;
  title: string;
  summary?: string | null;
  content?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
};

export type ArticleInput = {
  slug: string;
  status: "draft" | "published" | "archived";
  category: string;
  subcategory?: string | null;
  coverImage?: string | null;
  coverAlt?: string | null;
  authorName?: string;
  featured?: boolean;
  breaking?: boolean;
  readMinutes?: number;
  tags?: string[];
  isDemo?: boolean;
  publishedAt?: Date | null;
  translations: TranslationInput[];
};

export async function uniqueSlug(
  base: string,
  ignoreId?: number,
  locale?: Locale
): Promise<string> {
  const db = await requireDb();
  const root = slugify(base) || `story-${Date.now()}`;
  let candidate = root;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const filters = [eq(articles.slug, candidate)];
    if (ignoreId) filters.push(ne(articles.id, ignoreId));
    const existing = await db
      .select({ id: articles.id })
      .from(articles)
      .where(and(...filters))
      .limit(1);
    const translationClash = locale
      ? await db
          .select({ id: articleTranslations.id })
          .from(articleTranslations)
          .where(
            and(
              eq(articleTranslations.locale, locale),
              eq(articleTranslations.slug, candidate),
              ignoreId ? ne(articleTranslations.articleId, ignoreId) : undefined
            )
          )
          .limit(1)
      : [];
    if (existing.length === 0 && translationClash.length === 0) return candidate;
    candidate = `${root}-${attempt + 2}`;
  }
  return `${root}-${Date.now()}`;
}

/** Localized slug: explicit editor value, else transliterated title. */
async function localizedSlugFor(
  translation: TranslationInput,
  articleSlug: string,
  ignoreId?: number
): Promise<string> {
  if (translation.locale === "en") {
    const explicit = translation.slug ? slugify(translation.slug) : "";
    return uniqueSlug(explicit || articleSlug, ignoreId, "en");
  }
  const base = translation.slug ? slugify(translation.slug) : localizedSlug(translation.title);
  return uniqueSlug(base || `${articleSlug}-${translation.locale}`, ignoreId, translation.locale);
}

async function recordRevision(
  tx: Transaction,
  input: {
    articleId: number;
    editorId?: number | null;
    editorName?: string | null;
    action: string;
    summary?: string | null;
    snapshot: unknown;
  }
): Promise<void> {
  await tx.insert(articleRevisions).values({
    articleId: input.articleId,
    editorId: input.editorId ?? null,
    editorName: input.editorName?.slice(0, 160) ?? null,
    action: input.action.slice(0, 40),
    summary: input.summary?.slice(0, 300) ?? null,
    snapshot: JSON.stringify(input.snapshot).slice(0, 16_000_000),
  });
}

export type EditorIdentity = { id?: number | null; name?: string | null };

export async function createArticle(
  input: ArticleInput,
  editor?: EditorIdentity
): Promise<number> {
  const db = await requireDb();
  const slug = await uniqueSlug(input.slug);
  const now = new Date();
  const publishedAt =
    input.status === "published" ? input.publishedAt ?? now : input.publishedAt ?? null;

  const articleId = await db.transaction(async tx => {
    const [inserted] = await tx.insert(articles).values({
      slug,
      status: input.status,
      category: input.category,
      subcategory: input.subcategory ?? null,
      coverImage: input.coverImage ?? null,
      coverAlt: input.coverAlt ?? null,
      authorName: input.authorName || "BMG Newsroom",
      featured: input.featured ?? false,
      breaking: input.breaking ?? false,
      readMinutes: input.readMinutes ?? 4,
      tags: null,
      isDemo: input.isDemo ?? false,
      publishedAt,
    });
    const id = Number(inserted.insertId);
    await syncArticleTags(tx, id, input.tags);
    for (const translation of input.translations) {
      const localized = await localizedSlugFor(translation, slug, id);
      await tx.insert(articleTranslations).values({
        articleId: id,
        locale: translation.locale,
        slug: localized,
        title: translation.title,
        summary: translation.summary ?? null,
        content: translation.content ?? null,
        seoTitle: translation.seoTitle ?? null,
        seoDescription: translation.seoDescription ?? null,
      });
    }
    await recordRevision(tx, {
      articleId: id,
      editorId: editor?.id,
      editorName: editor?.name,
      action: "create",
      summary: `Created ${input.status} story`,
      snapshot: { ...input, slug },
    });
    return id;
  });
  invalidatePublicCache();
  return articleId;
}

export async function updateArticle(
  id: number,
  input: ArticleInput,
  editor?: EditorIdentity
): Promise<void> {
  const db = await requireDb();
  const existing = await getArticleById(id);
  if (!existing) throw new Error("Article not found");

  const slug = await uniqueSlug(input.slug, id);
  // Never erase the original publication date: unpublishing or re-drafting a
  // story keeps the date readers and search engines already saw.
  const publishedAt =
    input.status === "published"
      ? input.publishedAt ?? (existing.publishedAt ? new Date(existing.publishedAt) : new Date())
      : existing.publishedAt
        ? new Date(existing.publishedAt)
        : null;

  const action =
    existing.status !== "published" && input.status === "published"
      ? "publish"
      : existing.status === "published" && input.status !== "published"
        ? "unpublish"
        : "update";

  await db.transaction(async tx => {
    await tx
      .update(articles)
      .set({
        slug,
        status: input.status,
        category: input.category,
        subcategory: input.subcategory ?? null,
        coverImage: input.coverImage ?? null,
        coverAlt: input.coverAlt ?? null,
        authorName: input.authorName || "BMG Newsroom",
        featured: input.featured ?? false,
        breaking: input.breaking ?? false,
        readMinutes: input.readMinutes ?? 4,
        isDemo: input.isDemo ?? existing.isDemo,
        publishedAt,
      })
      .where(eq(articles.id, id));
    await syncArticleTags(tx, id, input.tags);

    // Preserve old URLs. Only published articles need a public redirect, but
    // recording drafts costs nothing and protects the eventual publish.
    if (existing.slug !== slug) {
      await tx
        .insert(articleSlugRedirects)
        .values({ articleId: id, locale: "en", oldSlug: existing.slug })
        .onDuplicateKeyUpdate({ set: { articleId: id } });
    }

    for (const translation of input.translations) {
      const previous = existing.translations.find(item => item.locale === translation.locale);
      const localized = await localizedSlugFor(translation, slug, id);
      if (previous?.slug && previous.slug !== localized) {
        await tx
          .insert(articleSlugRedirects)
          .values({ articleId: id, locale: translation.locale, oldSlug: previous.slug })
          .onDuplicateKeyUpdate({ set: { articleId: id } });
      }
      await tx
        .insert(articleTranslations)
        .values({
          articleId: id,
          locale: translation.locale,
          slug: localized,
          title: translation.title,
          summary: translation.summary ?? null,
          content: translation.content ?? null,
          seoTitle: translation.seoTitle ?? null,
          seoDescription: translation.seoDescription ?? null,
        })
        .onDuplicateKeyUpdate({
          set: {
            slug: localized,
            title: translation.title,
            summary: translation.summary ?? null,
            content: translation.content ?? null,
            seoTitle: translation.seoTitle ?? null,
            seoDescription: translation.seoDescription ?? null,
          },
        });
    }

    await recordRevision(tx, {
      articleId: id,
      editorId: editor?.id,
      editorName: editor?.name,
      action,
      summary: `${action} — ${input.translations.find(t => t.locale === "en")?.title ?? ""}`,
      snapshot: { before: existing, after: { ...input, slug } },
    });
  });
  invalidatePublicCache();
}

export async function deleteArticle(id: number, editor?: EditorIdentity): Promise<void> {
  const db = await requireDb();
  const existing = await getArticleById(id);
  if (!existing) throw new Error("Article not found");
  await db.transaction(async tx => {
    await tx
      .update(articles)
      .set({ status: "archived", deletedAt: new Date() })
      .where(eq(articles.id, id));
    await recordRevision(tx, {
      articleId: id,
      editorId: editor?.id,
      editorName: editor?.name,
      action: "delete",
      summary: "Soft-deleted (archived) story",
      snapshot: existing,
    });
  });
  invalidatePublicCache();
}

export async function restoreArticle(id: number, editor?: EditorIdentity): Promise<void> {
  const db = await requireDb();
  await db.transaction(async tx => {
    await tx
      .update(articles)
      .set({ deletedAt: null, status: "draft" })
      .where(eq(articles.id, id));
    await recordRevision(tx, {
      articleId: id,
      editorId: editor?.id,
      editorName: editor?.name,
      action: "restore",
      summary: "Restored story as a draft",
      snapshot: { restoredAt: new Date().toISOString() },
    });
  });
  invalidatePublicCache();
}

export async function saveAiSummary(
  articleId: number,
  locale: Locale,
  summary: string
): Promise<void> {
  const db = await requireDb();
  await db
    .update(articleTranslations)
    .set({ aiSummary: summary.slice(0, 8000), aiSummaryAt: new Date() })
    .where(
      and(eq(articleTranslations.articleId, articleId), eq(articleTranslations.locale, locale))
    );
  invalidatePublicCache();
}

export async function getRelatedArticles(article: ArticleDTO, limit = 3): Promise<ArticleDTO[]> {
  const db = await requireDb();
  const rows = (await db
    .select(articleListSelection)
    .from(articles)
    .where(
      and(
        eq(articles.status, "published"),
        isNull(articles.deletedAt),
        sql`${articles.publishedAt} <= NOW()`,
        ne(articles.id, article.id),
        or(eq(articles.category, article.category), eq(articles.featured, true))
      )
    )
    .orderBy(desc(articles.publishedAt))
    .limit(Math.min(Math.max(limit, 1), 6))) as ArticleListRow[];
  return attachTranslations(rows, false);
}

/**
 * Record a view once per visitor per article per UTC day. The unique index is
 * the source of truth: a duplicate insert affects zero rows and the public
 * counter is not incremented, so refreshing or scripting cannot inflate it.
 */
export async function recordArticleView(
  articleId: number,
  locale: Locale,
  visitorHash: string,
  day = utcDay()
): Promise<boolean> {
  const db = await requireDb();
  // INSERT IGNORE makes the unique index authoritative: a duplicate affects
  // zero rows regardless of the driver's CLIENT_FOUND_ROWS setting, so a
  // refresh (or a script) cannot inflate the public counter.
  const result = await db
    .insert(articleViews)
    .ignore()
    .values({ articleId, locale, visitorHash, viewedDay: day });
  const header = Array.isArray(result) ? result[0] : result;
  const affected = Number((header as { affectedRows?: number } | undefined)?.affectedRows ?? 0);
  const isNew = affected === 1;
  if (isNew) {
    await db
      .update(articles)
      .set({ views: sql`${articles.views} + 1` })
      .where(eq(articles.id, articleId));
  }
  return isNew;
}

export async function getMostRead(limit = 5, days = 30): Promise<ArticleDTO[]> {
  return cached(`most-read:${limit}:${days}`, () => getMostReadUncached(limit, days));
}
async function getMostReadUncached(limit: number, days: number): Promise<ArticleDTO[]> {
  const db = await requireDb();
  const since = utcDay(new Date(Date.now() - days * 24 * 60 * 60 * 1000));
  const rows = (await db
    .select({
      ...articleListSelection,
      // Alias is required: drizzle does not emit `AS recentViews` for raw sql
      // fields, so ORDER BY recentViews failed with "Unknown column" (HTTP 500).
      // `articles.id` is qualified explicitly because drizzle renders it as a bare
      // `id` in a single-table select, which would bind to article_views.id inside
      // the correlated subquery instead of the outer article.
      recentViews: sql<number>`(
        SELECT COUNT(*) FROM article_views v
        WHERE v.articleId = \`articles\`.\`id\` AND v.viewedDay >= ${since}
      )`.as("recentViews"),
    })
    .from(articles)
    .where(
      and(
        eq(articles.status, "published"),
        isNull(articles.deletedAt),
        sql`${articles.publishedAt} <= NOW()`
      )
    )
    .orderBy(desc(sql`recentViews`), desc(articles.views))
    .limit(Math.min(Math.max(limit, 1), 20))) as Array<ArticleListRow & { recentViews: number }>;
  return attachTranslations(rows, false);
}

export async function listSitemapArticles(): Promise<
  Array<{ slug: string; updatedAt: Date | null; publishedAt: Date | null; translations: Array<{ locale: Locale; slug: string | null }> }>
> {
  const db = await requireDb();
  const rows = await db
    .select({
      id: articles.id,
      slug: articles.slug,
      updatedAt: articles.updatedAt,
      publishedAt: articles.publishedAt,
    })
    .from(articles)
    .where(
      and(
        eq(articles.status, "published"),
        eq(articles.isDemo, false),
        isNull(articles.deletedAt),
        sql`${articles.publishedAt} <= NOW()`
      )
    )
    .orderBy(desc(articles.publishedAt))
    .limit(5000);

  if (rows.length === 0) return [];
  const translations = await db
    .select({
      articleId: articleTranslations.articleId,
      locale: articleTranslations.locale,
      slug: articleTranslations.slug,
    })
    .from(articleTranslations)
    .where(
      inArray(
        articleTranslations.articleId,
        rows.map(row => row.id)
      )
    );

  const byArticle = new Map<number, Array<{ locale: Locale; slug: string | null }>>();
  for (const translation of translations) {
    const list = byArticle.get(translation.articleId) ?? [];
    list.push({ locale: translation.locale as Locale, slug: translation.slug });
    byArticle.set(translation.articleId, list);
  }

  return rows.map(row => ({
    slug: row.slug,
    updatedAt: row.updatedAt,
    publishedAt: row.publishedAt,
    translations: byArticle.get(row.id) ?? [],
  }));
}

export async function resolveSlugRedirect(
  locale: Locale,
  oldSlug: string
): Promise<{ articleId: number; slug: string; locale: Locale } | null> {
  const db = await requireDb();
  const [redirect] = await db
    .select({ articleId: articleSlugRedirects.articleId })
    .from(articleSlugRedirects)
    .where(and(eq(articleSlugRedirects.locale, locale), eq(articleSlugRedirects.oldSlug, oldSlug)))
    .limit(1);
  if (!redirect) return null;
  const [translation] = await db
    .select({ slug: articleTranslations.slug })
    .from(articleTranslations)
    .where(
      and(
        eq(articleTranslations.articleId, redirect.articleId),
        eq(articleTranslations.locale, locale)
      )
    )
    .limit(1);
  const [article] = await db
    .select({ slug: articles.slug })
    .from(articles)
    .where(and(eq(articles.id, redirect.articleId), isNull(articles.deletedAt)))
    .limit(1);
  if (!article) return null;
  return {
    articleId: redirect.articleId,
    slug: translation?.slug || article.slug,
    locale,
  };
}

export async function listRevisions(articleId: number, limit = 30) {
  const db = await requireDb();
  const rows = await db
    .select({
      id: articleRevisions.id,
      articleId: articleRevisions.articleId,
      editorId: articleRevisions.editorId,
      editorName: articleRevisions.editorName,
      action: articleRevisions.action,
      summary: articleRevisions.summary,
      createdAt: articleRevisions.createdAt,
    })
    .from(articleRevisions)
    .where(eq(articleRevisions.articleId, articleId))
    .orderBy(desc(articleRevisions.createdAt))
    .limit(Math.min(Math.max(limit, 1), 100));
  return rows.map(row => ({ ...row, createdAt: row.createdAt.toISOString() }));
}

export async function getRevision(id: number) {
  const db = await requireDb();
  const [row] = await db
    .select()
    .from(articleRevisions)
    .where(eq(articleRevisions.id, id))
    .limit(1);
  if (!row) return null;
  return { ...row, createdAt: row.createdAt.toISOString() };
}

/**
 * Restore a stored revision. The snapshot is untrusted JSON from the database,
 * so every field is re-validated by the caller's schema before it reaches this
 * function; here we only normalise the shape and always restore as a draft so a
 * restore can never silently republish an old story.
 */
export async function restoreRevision(
  revisionId: number,
  editor?: EditorIdentity
): Promise<{ articleId: number } | null> {
  const revision = await getRevision(revisionId);
  if (!revision) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(revision.snapshot);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const record = parsed as Record<string, unknown>;
  const payload = (record.after && typeof record.after === "object"
    ? record.after
    : record) as Record<string, unknown>;
  const translations = Array.isArray(payload.translations) ? payload.translations : [];
  if (translations.length === 0) return null;
  const input: ArticleInput = {
    slug: typeof payload.slug === "string" ? payload.slug : `story-${revision.articleId}`,
    status: "draft",
    category: typeof payload.category === "string" ? payload.category : "afghanistan",
    subcategory: typeof payload.subcategory === "string" ? payload.subcategory : null,
    coverImage: typeof payload.coverImage === "string" ? payload.coverImage : null,
    coverAlt: typeof payload.coverAlt === "string" ? payload.coverAlt : null,
    authorName: typeof payload.authorName === "string" ? payload.authorName : undefined,
    featured: Boolean(payload.featured),
    breaking: Boolean(payload.breaking),
    readMinutes: typeof payload.readMinutes === "number" ? payload.readMinutes : 4,
    tags: Array.isArray(payload.tags) ? payload.tags.filter((tag): tag is string => typeof tag === "string") : [],
    translations: translations.map(item => {
      const entry = item as Record<string, unknown>;
      return {
        locale: (entry.locale === "ps" || entry.locale === "fa" ? entry.locale : "en") as Locale,
        slug: typeof entry.slug === "string" ? entry.slug : null,
        title: typeof entry.title === "string" ? entry.title : "",
        summary: typeof entry.summary === "string" ? entry.summary : null,
        content: typeof entry.content === "string" ? entry.content : null,
        seoTitle: typeof entry.seoTitle === "string" ? entry.seoTitle : null,
        seoDescription: typeof entry.seoDescription === "string" ? entry.seoDescription : null,
      };
    }),
  };
  // The snapshot may predate the categories lookup; fall back to an existing
  // row so the foreign key cannot reject a legitimate rollback.
  const db = await requireDb();
  const [known] = await db
    .select({ slug: categories.slug })
    .from(categories)
    .where(eq(categories.slug, input.category))
    .limit(1);
  if (!known) input.category = "afghanistan";
  await updateArticle(revision.articleId, input, editor);
  return { articleId: revision.articleId };
}

/** Retention: raw view rows are aggregated for the dashboard, then pruned. */
export async function cleanupArticleViews(days = getRetentionPolicy().viewsDays): Promise<number> {
  const db = await requireDb();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const result = await db.delete(articleViews).where(lt(articleViews.createdAt, cutoff));
  return Number((result as unknown as Array<{ affectedRows?: number }>)[0]?.affectedRows ?? 0);
}

export async function cleanupAuditLogs(days = getRetentionPolicy().auditDays): Promise<number> {
  const db = await requireDb();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const result = await db.delete(auditLogs).where(lt(auditLogs.createdAt, cutoff));
  return Number((result as unknown as Array<{ affectedRows?: number }>)[0]?.affectedRows ?? 0);
}

/* ------------------------------------------------------------------ */
/* Dashboard analytics                                                 */
/* ------------------------------------------------------------------ */

export async function getDashboardStats() {
  const db = await requireDb();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [published, drafts, subscribers, messages, totalViews] = await Promise.all([
    countArticles({ status: "published" }),
    countArticles({ status: "draft" }),
    db
      .select({ count: sql<number>`count(*)` })
      .from(newsletterSubscribers)
      .where(eq(newsletterSubscribers.status, "subscribed")),
    db
      .select({ count: sql<number>`count(*)` })
      .from(contactMessages)
      .where(eq(contactMessages.status, "new")),
    db
      .select({ count: sql<number>`coalesce(sum(${articles.views}), 0)` })
      .from(articles)
      .where(isNull(articles.deletedAt)),
  ]);

  // MySQL's ONLY_FULL_GROUP_BY mode treats the selected and grouped
  // DATE_FORMAT expressions as different when one side is table-qualified.
  // Group by the selected alias instead.
  const [viewRows] = (await db.execute(sql`
    SELECT DATE_FORMAT(\`createdAt\`, '%Y-%m-%d') AS day, COUNT(*) AS count
    FROM article_views
    WHERE \`createdAt\` >= ${since}
    GROUP BY day
    ORDER BY day
  `)) as unknown as [Array<{ day: string; count: number | string }>, unknown];
  const viewsByDay = viewRows.map(row => ({ day: row.day, count: Number(row.count) }));

  const topRows = (await db
    .select(articleListSelection)
    .from(articles)
    .where(and(eq(articles.status, "published"), isNull(articles.deletedAt)))
    .orderBy(desc(articles.views))
    .limit(5)) as ArticleListRow[];
  const topArticles = (await attachTranslations(topRows, false)).map(article => ({
    id: article.id,
    slug: article.slug,
    views: article.views,
    category: article.category,
    title: article.translations.find(item => item.locale === "en")?.title ?? "Untitled",
  }));

  return {
    published,
    drafts,
    subscribers: Number(subscribers[0]?.count ?? 0),
    newMessages: Number(messages[0]?.count ?? 0),
    totalViews: Number(totalViews[0]?.count ?? 0),
    viewsByDay,
    topArticles,
  };
}

/* ------------------------------------------------------------------ */
/* Audit log                                                           */
/* ------------------------------------------------------------------ */

export async function writeAuditLog(entry: {
  actorId?: number | null;
  actorName?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | number | null;
  ipHash?: string | null;
  userAgent?: string | null;
  metadata?: unknown;
}): Promise<void> {
  const db = await requireDb();
  await db.insert(auditLogs).values({
    actorId: entry.actorId ?? null,
    actorName: entry.actorName?.slice(0, 160) ?? null,
    action: entry.action.slice(0, 80),
    entityType: entry.entityType?.slice(0, 40) ?? null,
    entityId: entry.entityId != null ? String(entry.entityId).slice(0, 64) : null,
    ipHash: entry.ipHash?.slice(0, 64) ?? null,
    userAgent: entry.userAgent?.slice(0, 300) ?? null,
    metadata: entry.metadata ? JSON.stringify(entry.metadata).slice(0, 8000) : null,
  });
}

export async function listAuditLogs(limit = 100, action?: string) {
  const db = await requireDb();
  const rows = await db
    .select({
      id: auditLogs.id,
      actorId: auditLogs.actorId,
      actorName: auditLogs.actorName,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      metadata: auditLogs.metadata,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .where(action ? like(auditLogs.action, `${escapeLike(action)}%`) : undefined)
    .orderBy(desc(auditLogs.createdAt))
    .limit(Math.min(Math.max(limit, 1), 300));
  return rows.map(row => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
  }));
}

/* ------------------------------------------------------------------ */
/* Media                                                               */
/* ------------------------------------------------------------------ */

export async function createMediaAsset(input: {
  url: string;
  storageKey?: string | null;
  filename: string;
  mime: string;
  size: number;
  alt?: string | null;
  visibility?: "public" | "private";
  uploadedBy?: number | null;
}) {
  const db = await requireDb();
  const [result] = await db.insert(mediaAssets).values(input);
  return Number(result.insertId);
}

export async function listMediaAssets(limit = 60) {
  const db = await requireDb();
  return db
    .select()
    .from(mediaAssets)
    .orderBy(desc(mediaAssets.createdAt))
    .limit(Math.min(Math.max(limit, 1), 200));
}

export async function findMediaByStorageKey(storageKey: string) {
  const db = await requireDb();
  const [row] = await db
    .select()
    .from(mediaAssets)
    .where(eq(mediaAssets.storageKey, storageKey))
    .limit(1);
  return row ?? null;
}

export async function deleteMediaAsset(id: number) {
  const db = await requireDb();
  await db.delete(mediaAssets).where(eq(mediaAssets.id, id));
}

/* ------------------------------------------------------------------ */
/* Newsletter                                                          */
/* ------------------------------------------------------------------ */

export type SubscriptionState = "pending" | "subscribed" | "unsubscribed";

export async function findSubscriberByEmail(email: string) {
  const db = await requireDb();
  const [row] = await db
    .select()
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.email, email.toLowerCase()))
    .limit(1);
  return row ?? null;
}

export async function upsertPendingSubscription(input: {
  email: string;
  locale: Locale;
  confirmTokenHash: string;
  confirmExpiresAt: Date;
  ipHash: string | null;
}): Promise<void> {
  const db = await requireDb();
  await db
    .insert(newsletterSubscribers)
    .values({
      email: input.email.toLowerCase(),
      locale: input.locale,
      status: "pending",
      confirmTokenHash: input.confirmTokenHash,
      confirmExpiresAt: input.confirmExpiresAt,
      ipHash: input.ipHash,
      confirmedAt: null,
      unsubscribedAt: null,
    })
    .onDuplicateKeyUpdate({
      set: {
        locale: input.locale,
        status: "pending",
        confirmTokenHash: input.confirmTokenHash,
        confirmExpiresAt: input.confirmExpiresAt,
        unsubscribedAt: null,
        ipHash: input.ipHash,
      },
    });
}

export async function confirmSubscriptionByTokenHash(hash: string) {
  const db = await requireDb();
  const [row] = await db
    .select()
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.confirmTokenHash, hash))
    .limit(1);
  if (!row) return { ok: false as const, reason: "invalid" as const };
  if (row.status === "subscribed") return { ok: true as const, already: true };
  if (!row.confirmExpiresAt || row.confirmExpiresAt.getTime() < Date.now()) {
    return { ok: false as const, reason: "expired" as const };
  }
  await db
    .update(newsletterSubscribers)
    .set({
      status: "subscribed",
      confirmedAt: new Date(),
      confirmTokenHash: null,
      confirmExpiresAt: null,
    })
    .where(eq(newsletterSubscribers.id, row.id));
  return { ok: true as const, already: false, subscriber: row };
}

export async function unsubscribeById(id: number): Promise<boolean> {
  const db = await requireDb();
  const [row] = await db
    .select({ status: newsletterSubscribers.status })
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.id, id))
    .limit(1);
  if (!row) return false;
  await db
    .update(newsletterSubscribers)
    .set({ status: "unsubscribed", unsubscribedAt: new Date(), confirmTokenHash: null })
    .where(eq(newsletterSubscribers.id, id));
  return true;
}

export async function getSubscriberById(id: number) {
  const db = await requireDb();
  const [row] = await db
    .select()
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.id, id))
    .limit(1);
  return row ?? null;
}

export async function listSubscribers(limit = 200) {
  const db = await requireDb();
  // Token hashes and the privacy-preserving IP hash never leave the server.
  return db
    .select({
      id: newsletterSubscribers.id,
      email: newsletterSubscribers.email,
      locale: newsletterSubscribers.locale,
      status: newsletterSubscribers.status,
      createdAt: newsletterSubscribers.createdAt,
      confirmedAt: newsletterSubscribers.confirmedAt,
      unsubscribedAt: newsletterSubscribers.unsubscribedAt,
    })
    .from(newsletterSubscribers)
    .orderBy(desc(newsletterSubscribers.createdAt))
    .limit(Math.min(Math.max(limit, 1), 500));
}

export async function cleanupPendingSubscriptions(days: number): Promise<number> {
  const db = await requireDb();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const result = await db
    .delete(newsletterSubscribers)
    .where(
      and(
        eq(newsletterSubscribers.status, "pending"),
        lt(newsletterSubscribers.createdAt, cutoff)
      )
    );
  return Number((result as unknown as Array<{ affectedRows?: number }>)[0]?.affectedRows ?? 0);
}

/* ------------------------------------------------------------------ */
/* Contact                                                             */
/* ------------------------------------------------------------------ */

export async function createContactMessage(input: {
  name: string;
  email: string;
  subject: string;
  message: string;
  locale: Locale;
  ipHash?: string | null;
}) {
  const db = await requireDb();
  await db.insert(contactMessages).values(input);
}

export async function listContactMessages(limit = 100) {
  const db = await requireDb();
  return db
    .select({
      id: contactMessages.id,
      name: contactMessages.name,
      email: contactMessages.email,
      subject: contactMessages.subject,
      message: contactMessages.message,
      locale: contactMessages.locale,
      status: contactMessages.status,
      createdAt: contactMessages.createdAt,
    })
    .from(contactMessages)
    .orderBy(desc(contactMessages.createdAt))
    .limit(Math.min(Math.max(limit, 1), 300));
}

export async function updateContactStatus(
  id: number,
  status: "new" | "read" | "replied"
): Promise<void> {
  const db = await requireDb();
  await db.update(contactMessages).set({ status }).where(eq(contactMessages.id, id));
}

/* ------------------------------------------------------------------ */
/* Settings (short TTL cache)                                          */
/* ------------------------------------------------------------------ */

let settingsCache: { value: Record<string, string>; expiresAt: number } | null = null;

export async function getSettings(): Promise<Record<string, string>> {
  if (settingsCache && settingsCache.expiresAt > Date.now()) return settingsCache.value;
  const db = await requireDb();
  const rows = await db.select().from(siteSettings);
  // Keys starting with "_" are internal bookkeeping (e.g. the maintenance
  // lock) and never leave the database layer.
  const value = Object.fromEntries(
    rows.filter(row => !row.key.startsWith("_")).map(row => [row.key, row.value ?? ""])
  );
  settingsCache = { value, expiresAt: Date.now() + 30_000 };
  return value;
}

/**
 * Cross-instance "run at most once per interval" lock stored in site_settings.
 * The UPDATE is a compare-and-swap on the stored timestamp, so exactly one
 * caller wins per interval even when several instances start together.
 */
export async function claimMaintenanceSlot(key: string, intervalMs: number): Promise<boolean> {
  if (!key.startsWith("_")) throw new Error("Maintenance keys must start with an underscore");
  const db = await requireDb();
  await db.insert(siteSettings).ignore().values({ key, value: "0" });
  const now = Date.now();
  const [header] = await db
    .update(siteSettings)
    .set({ value: String(now) })
    .where(
      and(
        eq(siteSettings.key, key),
        sql`CAST(${siteSettings.value} AS UNSIGNED) <= ${now - intervalMs}`
      )
    );
  return Number((header as { affectedRows?: number }).affectedRows ?? 0) === 1;
}
export async function releaseMaintenanceSlot(key: string): Promise<void> {
  const db = await requireDb();
  await db.update(siteSettings).set({ value: "0" }).where(eq(siteSettings.key, key));
}
export async function getMaintenanceTimestamp(key: string): Promise<Date | null> {
  const db = await requireDb();
  const [row] = await db.select().from(siteSettings).where(eq(siteSettings.key, key)).limit(1);
  const ms = Number(row?.value ?? 0);
  return ms > 0 ? new Date(ms) : null;
}
export async function updateSettings(values: Record<string, string>): Promise<void> {
  const db = await requireDb();
  for (const [key, value] of Object.entries(values)) {
    if (key.startsWith("_")) continue;
    await db
      .insert(siteSettings)
      .values({ key, value })
      .onDuplicateKeyUpdate({ set: { value } });
  }
  settingsCache = null;
}

/* ------------------------------------------------------------------ */
/* AI budget                                                           */
/* ------------------------------------------------------------------ */

export async function getAiUsage(day: string, scope: string, scopeKey: string) {
  const db = await requireDb();
  const [row] = await db
    .select()
    .from(aiUsage)
    .where(
      and(eq(aiUsage.day, day), eq(aiUsage.scope, scope), eq(aiUsage.scopeKey, scopeKey))
    )
    .limit(1);
  return row ?? null;
}

export async function addAiUsage(input: {
  day: string;
  scope: string;
  scopeKey: string;
  calls?: number;
  promptTokens?: number;
  completionTokens?: number;
}): Promise<void> {
  const db = await requireDb();
  await db
    .insert(aiUsage)
    .values({
      day: input.day,
      scope: input.scope,
      scopeKey: input.scopeKey.slice(0, 80),
      calls: input.calls ?? 0,
      promptTokens: input.promptTokens ?? 0,
      completionTokens: input.completionTokens ?? 0,
    })
    .onDuplicateKeyUpdate({
      set: {
        calls: sql`${aiUsage.calls} + ${input.calls ?? 0}`,
        promptTokens: sql`${aiUsage.promptTokens} + ${input.promptTokens ?? 0}`,
        completionTokens: sql`${aiUsage.completionTokens} + ${input.completionTokens ?? 0}`,
      },
    });
}

export async function getGlobalAiUsage(day: string) {
  const row = await getAiUsage(day, "global", "all");
  return {
    calls: Number(row?.calls ?? 0),
    tokens: Number(row?.promptTokens ?? 0) + Number(row?.completionTokens ?? 0),
  };
}

/* ------------------------------------------------------------------ */
/* Email outbox                                                        */
/* ------------------------------------------------------------------ */

export async function enqueueEmail(input: {
  recipient: string;
  subject: string;
  body: string;
  kind: string;
}) {
  const db = await requireDb();
  const [result] = await db.insert(emailOutbox).values(input);
  return Number(result.insertId);
}

export type OutboxMessage = {
  id: number;
  recipient: string;
  subject: string;
  body: string;
  kind: string;
  attempts: number;
};
/**
 * Claim up to `limit` due messages for delivery. Each row is claimed with a
 * compare-and-swap on `nextAttemptAt` (pushed 5 minutes ahead), so two app
 * instances draining the same outbox never send the same message twice, and a
 * crashed worker's rows become due again automatically.
 */
export async function claimDueEmails(limit = 20): Promise<OutboxMessage[]> {
  const db = await requireDb();
  const due = await db
    .select({ id: emailOutbox.id })
    .from(emailOutbox)
    .where(
      and(
        eq(emailOutbox.status, "queued"),
        or(isNull(emailOutbox.nextAttemptAt), sql`${emailOutbox.nextAttemptAt} <= NOW()`)
      )
    )
    .orderBy(emailOutbox.id)
    .limit(Math.min(Math.max(limit, 1), 100));
  const claimed: OutboxMessage[] = [];
  for (const { id } of due) {
    const [header] = await db
      .update(emailOutbox)
      .set({ nextAttemptAt: sql`DATE_ADD(NOW(), INTERVAL 5 MINUTE)` })
      .where(
        and(
          eq(emailOutbox.id, id),
          eq(emailOutbox.status, "queued"),
          or(isNull(emailOutbox.nextAttemptAt), sql`${emailOutbox.nextAttemptAt} <= NOW()`)
        )
      );
    if (Number((header as { affectedRows?: number }).affectedRows ?? 0) !== 1) continue;
    const [row] = await db
      .select({
        id: emailOutbox.id,
        recipient: emailOutbox.recipient,
        subject: emailOutbox.subject,
        body: emailOutbox.body,
        kind: emailOutbox.kind,
        attempts: emailOutbox.attempts,
      })
      .from(emailOutbox)
      .where(eq(emailOutbox.id, id))
      .limit(1);
    if (row) claimed.push(row);
  }
  return claimed;
}
export async function markEmailDelivered(id: number): Promise<void> {
  const db = await requireDb();
  await db
    .update(emailOutbox)
    .set({
      status: "sent",
      sentAt: new Date(),
      lastError: null,
      nextAttemptAt: null,
      attempts: sql`${emailOutbox.attempts} + 1`,
    })
    .where(eq(emailOutbox.id, id));
}
/** Record a failed attempt: retry with exponential backoff, or give up at `maxAttempts`. */
export async function markEmailFailed(
  id: number,
  error: string,
  maxAttempts: number
): Promise<"retry" | "failed"> {
  const db = await requireDb();
  const [row] = await db
    .select({ attempts: emailOutbox.attempts })
    .from(emailOutbox)
    .where(eq(emailOutbox.id, id))
    .limit(1);
  const attempts = (row?.attempts ?? 0) + 1;
  if (attempts >= maxAttempts) {
    await db
      .update(emailOutbox)
      .set({ status: "failed", attempts, lastError: error.slice(0, 300), nextAttemptAt: null })
      .where(eq(emailOutbox.id, id));
    return "failed";
  }
  // 2, 4, 8 ... minutes, capped at 6 hours.
  const delayMinutes = Math.min(2 ** attempts, 360);
  await db
    .update(emailOutbox)
    .set({
      status: "queued",
      attempts,
      lastError: error.slice(0, 300),
      nextAttemptAt: sql`DATE_ADD(NOW(), INTERVAL ${delayMinutes} MINUTE)`,
    })
    .where(eq(emailOutbox.id, id));
  return "retry";
}
/**
 * Messages that waited longer than `hours` without a delivery channel are
 * stale (confirmation links expire), so they are failed instead of being sent
 * days late the moment mail is finally configured.
 */
export async function expireStaleEmails(hours = 72): Promise<number> {
  const db = await requireDb();
  const [header] = await db
    .update(emailOutbox)
    .set({ status: "failed", lastError: "Expired before delivery", nextAttemptAt: null })
    .where(
      and(
        eq(emailOutbox.status, "queued"),
        sql`${emailOutbox.createdAt} < DATE_SUB(NOW(), INTERVAL ${hours} HOUR)`
      )
    );
  return Number((header as { affectedRows?: number }).affectedRows ?? 0);
}
/** Retention for delivered/failed mail: bodies contain one-time links and addresses. */
export async function cleanupEmailOutbox(days = 30): Promise<number> {
  const db = await requireDb();
  const [header] = await db
    .delete(emailOutbox)
    .where(
      and(
        ne(emailOutbox.status, "queued"),
        sql`${emailOutbox.createdAt} < DATE_SUB(NOW(), INTERVAL ${days} DAY)`
      )
    );
  return Number((header as { affectedRows?: number }).affectedRows ?? 0);
}
export async function countOutboxByStatus(): Promise<Record<string, number>> {
  const db = await requireDb();
  const rows = await db
    .select({ status: emailOutbox.status, count: sql<number>`count(*)` })
    .from(emailOutbox)
    .groupBy(emailOutbox.status);
  return Object.fromEntries(rows.map(row => [row.status, Number(row.count)]));
}
export async function markEmailSent(id: number, error?: string) {
  const db = await requireDb();
  await db
    .update(emailOutbox)
    .set(
      error
        ? { status: "failed", lastError: error.slice(0, 300), attempts: sql`${emailOutbox.attempts} + 1` }
        : { status: "sent", sentAt: new Date(), attempts: sql`${emailOutbox.attempts} + 1` }
    )
    .where(eq(emailOutbox.id, id));
}

/**
 * Server-internal view of the outbox, including message bodies. Never expose
 * this through the API: bodies contain one-time confirmation and unsubscribe
 * links. It exists for delivery tests and operational tooling.
 */
export async function listOutboxWithBodies(limit = 50) {
  const db = await requireDb();
  return db
    .select()
    .from(emailOutbox)
    .orderBy(desc(emailOutbox.createdAt))
    .limit(Math.min(Math.max(limit, 1), 200));
}

export async function listOutbox(limit = 50) {
  const db = await requireDb();
  // Bodies contain one-time confirmation and unsubscribe links; expose only
  // delivery metadata so an admin screen cannot leak working tokens.
  return db
    .select({
      id: emailOutbox.id,
      recipient: emailOutbox.recipient,
      subject: emailOutbox.subject,
      kind: emailOutbox.kind,
      status: emailOutbox.status,
      attempts: emailOutbox.attempts,
      createdAt: emailOutbox.createdAt,
      sentAt: emailOutbox.sentAt,
    })
    .from(emailOutbox)
    .orderBy(desc(emailOutbox.createdAt))
    .limit(Math.min(Math.max(limit, 1), 200));
}

/* ------------------------------------------------------------------ */
/* Health                                                              */
/* ------------------------------------------------------------------ */

export async function databaseHealthy(): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) return false;
    await db.execute(sql`SELECT 1`);
    return true;
  } catch {
    return false;
  }
}

export { gte, lt };
