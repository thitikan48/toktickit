import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/lab-03",

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
      command: "npm --prefix server run dev",
      url: "http://localhost:3000/api/health",
      reuseExistingServer: true,
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
