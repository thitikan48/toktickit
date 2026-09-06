import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/lab-02",

  timeout: 30_000,

  expect: {
    timeout: 5_000,
  },

  use: {
    baseURL: "http://127.0.0.1:5173",
    headless: true,
  },

  webServer: [
    {
      command: "npm --prefix server run dev",
      url: "http://127.0.0.1:3000/api/health",
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command:
        "npm --prefix client run dev -- --host 127.0.0.1",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],

  reporter: "list",
});