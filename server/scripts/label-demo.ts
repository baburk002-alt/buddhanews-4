/**
 * One-off maintenance task for databases seeded before demonstration content
 * was labelled. It finds the stories that came from `server/seed.ts`, marks
 * them `isDemo`, replaces the invented bylines with the demo desk and strips
 * fabricated quotations from the copy. Idempotent: safe to run twice.
 *
 *   pnpm db:label-demo
 */
import { eq } from "drizzle-orm";
import { articleTranslations, articles } from "../../drizzle/schema";
import { getDb } from "../db";
import { DEMO_BYLINE, DEMO_NOTICE, SEED, stripQuotations } from "../seed";

const DEMO_SLUGS = new Set(SEED.map(item => item.slug));

async function main() {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");

  const rows = await db
    .select({ id: articles.id, slug: articles.slug, authorName: articles.authorName, isDemo: articles.isDemo })
    .from(articles);

  let labelled = 0;
  let translationsUpdated = 0;

  for (const row of rows) {
    const looksLikeDemo =
      row.isDemo || DEMO_SLUGS.has(row.slug) || row.authorName === DEMO_BYLINE;
    if (!looksLikeDemo) continue;

    await db
      .update(articles)
      .set({ isDemo: true, authorName: DEMO_BYLINE })
      .where(eq(articles.id, row.id));

    const copies = await db
      .select({
        id: articleTranslations.id,
        content: articleTranslations.content,
      })
      .from(articleTranslations)
      .where(eq(articleTranslations.articleId, row.id));

    for (const copy of copies) {
      let content = stripQuotations(copy.content ?? "");
      if (!content.startsWith(DEMO_NOTICE)) {
        content = `${DEMO_NOTICE}\n\n${content}`.trim();
      }
      await db
        .update(articleTranslations)
        .set({ content })
        .where(eq(articleTranslations.id, copy.id));
      translationsUpdated += 1;
    }
    labelled += 1;
  }

  console.log(`Labelled ${labelled} demonstration stories (${translationsUpdated} translations).`);
  process.exit(0);
}

main().catch(error => {
  console.error("Could not label demonstration content", error);
  process.exit(1);
});
