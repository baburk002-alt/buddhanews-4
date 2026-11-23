import {
  boolean,
  date,
  foreignKey,
  index,
  int,
  longtext,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing the platform auth flow.
 *
 * `role` is application data, but it is only *effective* when the account is
 * still authorised by configuration (owner / ADMIN_EMAILS / EDITOR_EMAILS) or
 * when an owner granted the role explicitly (`roleSource = 'manual'`). See
 * `server/access.ts` — removing an address from ADMIN_EMAILS revokes access on
 * the account's very next request.
 */
export const users = mysqlTable(
  "users",
  {
    id: int("id").autoincrement().primaryKey(),
    openId: varchar("openId", { length: 64 }).notNull().unique(),
    name: text("name"),
    email: varchar("email", { length: 320 }),
    loginMethod: varchar("loginMethod", { length: 64 }),
    role: mysqlEnum("role", ["user", "editor", "admin"]).default("user").notNull(),
    roleSource: mysqlEnum("roleSource", ["default", "env", "manual"])
      .default("default")
      .notNull(),
    roleUpdatedAt: timestamp("roleUpdatedAt"),
    /** NULL = provider did not say; TRUE/FALSE = explicit provider claim. */
    emailVerified: boolean("emailVerified"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  },
  table => [index("users_email_idx").on(table.email)]
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Server-side session registry. A signed cookie is not enough on its own:
 * every token carries a `sid` that must exist here, be unexpired and not be
 * revoked. Logout, role removal and "sign out everywhere" delete/revoke rows,
 * which invalidates tokens immediately even though the JWT is still valid.
 */
export const sessions = mysqlTable(
  "sessions",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: int("userId").notNull(),
    openId: varchar("openId", { length: 64 }).notNull(),
    ipHash: varchar("ipHash", { length: 64 }),
    userAgent: varchar("userAgent", { length: 300 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    revokedAt: timestamp("revokedAt"),
  },
  table => [
    index("sessions_user_idx").on(table.userId),
    index("sessions_expires_idx").on(table.expiresAt),
    foreignKey({ name: "sessions_user_fk", columns: [table.userId], foreignColumns: [users.id] })
      .onDelete("cascade")
      .onUpdate("cascade"),
  ]
);

export type SessionRow = typeof sessions.$inferSelect;

/**
 * Lookup of valid story categories. articles.category references it, so the
 * database itself rejects unknown values. `active = false` keeps legacy values
 * readable without letting editors choose them for new stories.
 */
export const categories = mysqlTable("categories", {
  slug: varchar("slug", { length: 40 }).primaryKey(),
  active: boolean("active").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
/** Canonical story record. Language-specific copy lives in article_translations. */
export const articles = mysqlTable(
  "articles",
  {
    id: int("id").autoincrement().primaryKey(),
    slug: varchar("slug", { length: 180 }).notNull(),
    status: mysqlEnum("status", ["draft", "published", "archived"])
      .default("draft")
      .notNull(),
    category: varchar("category", { length: 40 }).notNull(),
    subcategory: varchar("subcategory", { length: 60 }),
    coverImage: text("coverImage"),
    coverAlt: text("coverAlt"),
    authorId: int("authorId"),
    authorName: varchar("authorName", { length: 160 })
      .default("BMG Newsroom")
      .notNull(),
    featured: boolean("featured").default(false).notNull(),
    breaking: boolean("breaking").default(false).notNull(),
    readMinutes: int("readMinutes").default(4).notNull(),
    /** @deprecated Legacy CSV copy kept for rollback; `article_tags` is the source of truth. */
    tags: text("tags"),
    /** Demonstration content is labelled in the UI and excluded from RSS. */
    isDemo: boolean("isDemo").default(false).notNull(),
    publishedAt: timestamp("publishedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    /** Soft delete keeps history and foreign rows instead of destroying them. */
    deletedAt: timestamp("deletedAt"),
    views: int("views").default(0).notNull(),
  },
  table => [
    uniqueIndex("articles_slug_unique").on(table.slug),
    index("articles_status_published_idx").on(table.status, table.publishedAt),
    index("articles_category_idx").on(table.category, table.subcategory),
    index("articles_views_idx").on(table.views),
    index("articles_deleted_idx").on(table.deletedAt),
    index("articles_author_idx").on(table.authorId),
    foreignKey({
      name: "articles_category_fk",
      columns: [table.category],
      foreignColumns: [categories.slug],
    })
      .onDelete("restrict")
      .onUpdate("cascade"),
    foreignKey({ name: "articles_author_fk", columns: [table.authorId], foreignColumns: [users.id] })
      .onDelete("set null")
      .onUpdate("cascade"),
  ]
);

export type Article = typeof articles.$inferSelect;
export type InsertArticle = typeof articles.$inferInsert;
/** Normalised tag vocabulary (case-insensitive unique name). */
export const tags = mysqlTable(
  "tags",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 60 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [uniqueIndex("tags_name_unique").on(table.name)]
);
/** Many-to-many join between stories and tags; `position` preserves editor order. */
export const articleTags = mysqlTable(
  "article_tags",
  {
    articleId: int("articleId").notNull(),
    tagId: int("tagId").notNull(),
    position: int("position").default(0).notNull(),
  },
  table => [
    primaryKey({ columns: [table.articleId, table.tagId], name: "article_tags_articleId_tagId" }),
    index("article_tags_tag_idx").on(table.tagId),
    foreignKey({
      name: "article_tags_article_fk",
      columns: [table.articleId],
      foreignColumns: [articles.id],
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    foreignKey({ name: "article_tags_tag_fk", columns: [table.tagId], foreignColumns: [tags.id] })
      .onDelete("cascade")
      .onUpdate("cascade"),
  ]
);

/** One row per language. Missing locales fall back to English on the public site. */
export const articleTranslations = mysqlTable(
  "article_translations",
  {
    id: int("id").autoincrement().primaryKey(),
    articleId: int("articleId").notNull(),
    locale: varchar("locale", { length: 8 }).notNull(),
    /** Search-engine-friendly slug for this language; falls back to articles.slug. */
    slug: varchar("slug", { length: 180 }),
    title: varchar("title", { length: 300 }).notNull(),
    summary: text("summary"),
    content: longtext("content"),
    seoTitle: varchar("seoTitle", { length: 200 }),
    seoDescription: varchar("seoDescription", { length: 320 }),
    aiSummary: text("aiSummary"),
    aiSummaryAt: timestamp("aiSummaryAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("article_locale_unique").on(table.articleId, table.locale),
    uniqueIndex("article_locale_slug_unique").on(table.locale, table.slug),
    index("article_translations_locale_idx").on(table.locale),
    foreignKey({
      name: "article_translations_article_fk",
      columns: [table.articleId],
      foreignColumns: [articles.id],
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
  ]
);

export type ArticleTranslation = typeof articleTranslations.$inferSelect;

/**
 * Durable redirect map. When a published slug changes (or a translation gets
 * a new localized slug) the old path keeps working with a 301.
 */
export const articleSlugRedirects = mysqlTable(
  "article_slug_redirects",
  {
    id: int("id").autoincrement().primaryKey(),
    articleId: int("articleId").notNull(),
    locale: varchar("locale", { length: 8 }).default("en").notNull(),
    oldSlug: varchar("oldSlug", { length: 180 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("slug_redirect_locale_slug_unique").on(table.locale, table.oldSlug),
    index("slug_redirect_article_idx").on(table.articleId),
    foreignKey({
      name: "slug_redirects_article_fk",
      columns: [table.articleId],
      foreignColumns: [articles.id],
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
  ]
);

/** Immutable snapshot of an article at every editorial change. */
export const articleRevisions = mysqlTable(
  "article_revisions",
  {
    id: int("id").autoincrement().primaryKey(),
    articleId: int("articleId").notNull(),
    editorId: int("editorId"),
    editorName: varchar("editorName", { length: 160 }),
    action: varchar("action", { length: 40 }).notNull(),
    summary: varchar("summary", { length: 300 }),
    snapshot: longtext("snapshot").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("article_revisions_article_idx").on(table.articleId, table.createdAt),
    index("article_revisions_editor_idx").on(table.editorId),
    foreignKey({
      name: "article_revisions_article_fk",
      columns: [table.articleId],
      foreignColumns: [articles.id],
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    foreignKey({
      name: "article_revisions_editor_fk",
      columns: [table.editorId],
      foreignColumns: [users.id],
    })
      .onDelete("set null")
      .onUpdate("cascade"),
  ]
);

/**
 * View rows are deduplicated per article, per visitor and per calendar day by
 * a unique index. `articles.views` is incremented only when a new row lands,
 * so a single reader cannot inflate the most-read ranking.
 */
export const articleViews = mysqlTable(
  "article_views",
  {
    id: int("id").autoincrement().primaryKey(),
    articleId: int("articleId").notNull(),
    locale: varchar("locale", { length: 8 }).default("en").notNull(),
    visitorHash: varchar("visitorHash", { length: 64 }).notNull(),
    viewedDay: date("viewedDay", { mode: "string" }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("article_views_dedupe_unique").on(
      table.articleId,
      table.visitorHash,
      table.viewedDay
    ),
    index("article_views_created_idx").on(table.createdAt),
    index("article_views_article_day_idx").on(table.articleId, table.viewedDay),
    foreignKey({
      name: "article_views_article_fk",
      columns: [table.articleId],
      foreignColumns: [articles.id],
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
  ]
);

/** Append-only record of every privileged action. Never rendered publicly. */
export const auditLogs = mysqlTable(
  "audit_logs",
  {
    id: int("id").autoincrement().primaryKey(),
    actorId: int("actorId"),
    actorName: varchar("actorName", { length: 160 }),
    action: varchar("action", { length: 80 }).notNull(),
    entityType: varchar("entityType", { length: 40 }),
    entityId: varchar("entityId", { length: 64 }),
    /** Keyed HMAC of the network address — never the raw address. */
    ipHash: varchar("ipHash", { length: 64 }),
    userAgent: varchar("userAgent", { length: 300 }),
    metadata: text("metadata"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("audit_logs_created_idx").on(table.createdAt),
    index("audit_logs_actor_idx").on(table.actorId),
    foreignKey({ name: "audit_logs_actor_fk", columns: [table.actorId], foreignColumns: [users.id] })
      .onDelete("set null")
      .onUpdate("cascade"),
  ]
);

export type AuditLog = typeof auditLogs.$inferSelect;

export const mediaAssets = mysqlTable(
  "media_assets",
  {
    id: int("id").autoincrement().primaryKey(),
    url: text("url").notNull(),
    storageKey: varchar("storageKey", { length: 512 }),
    filename: varchar("filename", { length: 255 }).notNull(),
    mime: varchar("mime", { length: 100 }).notNull(),
    size: int("size").default(0).notNull(),
    alt: text("alt"),
    /** Public assets may be served directly; private ones require ownership. */
    visibility: mysqlEnum("visibility", ["public", "private"])
      .default("public")
      .notNull(),
    uploadedBy: int("uploadedBy"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("media_storage_key_idx").on(table.storageKey),
    index("media_uploaded_by_idx").on(table.uploadedBy),
    foreignKey({
      name: "media_assets_uploader_fk",
      columns: [table.uploadedBy],
      foreignColumns: [users.id],
    })
      .onDelete("set null")
      .onUpdate("cascade"),
  ]
);

/**
 * Newsletter lifecycle: pending -> subscribed -> unsubscribed.
 * Only a holder of the emailed confirmation token can move a row to
 * `subscribed`, so nobody can subscribe an address they do not control.
 */
export const newsletterSubscribers = mysqlTable(
  "newsletter_subscribers",
  {
    id: int("id").autoincrement().primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    locale: varchar("locale", { length: 8 }).default("en").notNull(),
    status: mysqlEnum("status", ["pending", "subscribed", "unsubscribed"])
      .default("pending")
      .notNull(),
    confirmTokenHash: varchar("confirmTokenHash", { length: 64 }),
    confirmExpiresAt: timestamp("confirmExpiresAt"),
    unsubscribeTokenHash: varchar("unsubscribeTokenHash", { length: 64 }),
    confirmedAt: timestamp("confirmedAt"),
    unsubscribedAt: timestamp("unsubscribedAt"),
    ipHash: varchar("ipHash", { length: 64 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("newsletter_email_unique").on(table.email),
    index("newsletter_status_idx").on(table.status),
  ]
);

export const contactMessages = mysqlTable(
  "contact_messages",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    subject: varchar("subject", { length: 220 }).notNull(),
    message: text("message").notNull(),
    locale: varchar("locale", { length: 8 }).default("en").notNull(),
    status: mysqlEnum("status", ["new", "read", "replied"]).default("new").notNull(),
    ipHash: varchar("ipHash", { length: 64 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("contact_status_idx").on(table.status, table.createdAt)]
);

/** Daily AI ledger used for per-IP, per-user and global spend ceilings. */
export const aiUsage = mysqlTable(
  "ai_usage",
  {
    id: int("id").autoincrement().primaryKey(),
    day: date("day", { mode: "string" }).notNull(),
    scope: varchar("scope", { length: 16 }).notNull(),
    scopeKey: varchar("scopeKey", { length: 80 }).notNull(),
    calls: int("calls").default(0).notNull(),
    promptTokens: int("promptTokens").default(0).notNull(),
    completionTokens: int("completionTokens").default(0).notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("ai_usage_day_scope_unique").on(table.day, table.scope, table.scopeKey),
  ]
);

/**
 * Outbox for transactional mail (newsletter confirmation, unsubscribe links).
 * Rows are delivered by server/mailer.ts (EMAIL_WEBHOOK_URL and/or SMTP_*),
 * retried with exponential backoff, and purged after the retention window.
 */
export const emailOutbox = mysqlTable(
  "email_outbox",
  {
    id: int("id").autoincrement().primaryKey(),
    recipient: varchar("recipient", { length: 320 }).notNull(),
    subject: varchar("subject", { length: 300 }).notNull(),
    body: text("body").notNull(),
    kind: varchar("kind", { length: 40 }).notNull(),
    status: mysqlEnum("status", ["queued", "sent", "failed"]).default("queued").notNull(),
    attempts: int("attempts").default(0).notNull(),
    lastError: varchar("lastError", { length: 300 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    sentAt: timestamp("sentAt"),
    /** Earliest time the delivery worker may (re)try this row. */
    nextAttemptAt: timestamp("nextAttemptAt"),
  },
  table => [
    index("email_outbox_status_idx").on(table.status, table.createdAt),
    index("email_outbox_next_idx").on(table.status, table.nextAttemptAt),
  ]
);

export const siteSettings = mysqlTable("site_settings", {
  key: varchar("key", { length: 80 }).primaryKey(),
  value: text("value"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
