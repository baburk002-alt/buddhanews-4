/**
 * Prepares the disposable `buddhanews_test` schema once per run: applies the
 * real migrations, then empties every table so each run starts clean. It never
 * touches the development or production database (the URL must end in _test).
 */
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import path from "path";

export default async function setup() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.includes("buddhanews_test")) {
    throw new Error(`Refusing to run tests against ${url || "an unset DATABASE_URL"}`);
  }
  const connection = await mysql.createConnection(url);
  try {
    await migrate(drizzle(connection), {
      migrationsFolder: path.resolve(import.meta.dirname, "../../drizzle"),
    });
    const [rawRows] = await connection.query(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'"
    );
    const rows = rawRows as Array<{ TABLE_NAME: string }>;
    await connection.query("SET FOREIGN_KEY_CHECKS = 0");
    for (const row of rows) {
      // Never truncate drizzle's own bookkeeping table: it records which
      // migrations already ran, and emptying it makes the next run try to
      // create tables that still exist.
      if (row.TABLE_NAME.startsWith("__drizzle")) continue;
      // `categories` is reference data seeded by migration 0004, not test data.
      if (row.TABLE_NAME === "categories") continue;
      await connection.query(`TRUNCATE TABLE \`${row.TABLE_NAME}\``);
    }
    await connection.query("SET FOREIGN_KEY_CHECKS = 1");
  } finally {
    await connection.end();
  }
}
