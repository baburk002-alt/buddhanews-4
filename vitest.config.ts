import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

// The suite runs against a disposable local schema. Override with
// TEST_DATABASE_URL when your MariaDB uses different credentials.
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? "mysql://bn:bnpass@127.0.0.1:3306/buddhanews_test";
process.env.DATABASE_URL = testDatabaseUrl;

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    include: ["server/**/*.test.ts"],
    globalSetup: ["server/test/globalSetup.ts"],
    // The integration suite shares one MariaDB schema; parallel files would
    // truncate each other's fixtures.
    fileParallelism: false,
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: testDatabaseUrl,
      MANUS_JWT_SECRET: "test-session-secret-0123456789abcdef0123456789abcdef",
      PRIVACY_HASH_SECRET: "test-privacy-secret-0123456789abcdef0123456789",
      PUBLIC_SITE_URL: "https://news.example.com",
      ADMIN_EMAILS: "owner@example.com,admin@example.com",
      EDITOR_EMAILS: "editor@example.com",
      OWNER_OPEN_ID: "test-owner",
      AI_DAILY_BUDGET_USD: "1",
      AI_GLOBAL_DAILY_BUDGET_USD: "2",
    },
  },
});
