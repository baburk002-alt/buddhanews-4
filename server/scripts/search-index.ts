/**
 * Adds the FULLTEXT index used by newsroom search. The index is optional at
 * runtime (the query layer falls back to LIKE), so this is a separate,
 * idempotent step that can run on an existing database without a table rebuild.
 *
 *   pnpm db:search-index
 */
import { sql } from "drizzle-orm";
import { getDb } from "../db";

async function main() {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  try {
    await db.execute(
      sql`ALTER TABLE article_translations ADD FULLTEXT INDEX ft_article_search (title, summary, content)`
    );
    console.log("FULLTEXT index ft_article_search created.");
  } catch (error) {
    const code = (error as { code?: string; errno?: number }).code;
    const errno = (error as { errno?: number }).errno;
    if (code === "ER_DUP_KEYNAME" || errno === 1061) {
      console.log("FULLTEXT index already present — nothing to do.");
    } else {
      throw error;
    }
  }
  process.exit(0);
}

main().catch(error => {
  console.error("Could not create the FULLTEXT index", error);
  process.exit(1);
});
