/**
 * Applies the SQL migrations in ./drizzle using drizzle-orm's migrator. Used by
 * the container entrypoint when RUN_MIGRATIONS=1, so a deployment can migrate
 * and start in one step. Locally `pnpm db:migrate` (drizzle-kit) is equivalent.
 */
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required to run migrations");
  const connection = await mysql.createConnection(url);
  try {
    await migrate(drizzle(connection), { migrationsFolder: "./drizzle" });
    console.log("Migrations applied.");
  } finally {
    await connection.end();
  }
}

main().catch(error => {
  console.error("Migration failed", error);
  process.exit(1);
});
