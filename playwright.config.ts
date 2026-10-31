import path from "path";
import { defineConfig } from "@playwright/test";
import { readTestDatabaseUrl } from "./server/tests/test-database.js";

// E2E uses the test database (server/.env.test), never the development one.
// Setting it here covers both the API server below and the tests that use
// Prisma directly.
process.env.DATABASE_URL = readTestDatabaseUrl(path.resolve("server"));

export default defineConfig({
  testDir: "./e2e/lab-04",

  timeout: 60_000,

  expect: {
    timeout: 5_000,
  },

  // The tests share one database and one seeded set of accounts, so they
  // run one at a time.
  workers: 1,
  fullyParallel: false,

  use: {
    // "localhost" (not 127.0.0.1) so the login cookie is sent to the API.
    baseURL: "http://localhost:5173",
    headless: true,
  },

  webServer: [
    {
      // Bring the test database up to date, seed it, and start the API on it.
      command:
        "cd server && npx prisma migrate deploy && npm run prisma:seed && npm run dev",
      url: "http://localhost:3000/api/health",
      env: { DATABASE_URL: process.env.DATABASE_URL },
      // A server that is already running may use the development database,
      // so it is never reused.
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command:
        "npm --prefix client run dev -- --host localhost",
      url: "http://localhost:5173",
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],

  reporter: "list",
});
