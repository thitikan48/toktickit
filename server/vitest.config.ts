import { defineConfig } from "vitest/config";
import { readTestDatabaseUrl } from "./tests/test-database.js";

export default defineConfig({
  test: {
    environment: "node",
    // `npm test` runs the Lab 4 tests on the test database (server/.env.test).
    include: ["tests/lab-04/**/*.test.ts"],
    env: {
      DATABASE_URL: readTestDatabaseUrl(process.cwd()),
    },
    globalSetup: ["tests/global-setup.ts"],
    // The API tests share one PostgreSQL database, and Ticket Numbers are
    // derived from the latest ticket id, so test files run one at a time.
    fileParallelism: false,
    // Password hashing (bcrypt) is deliberately slow, and some tests log in
    // several times.
    testTimeout: 20_000,
    // beforeAll hooks log in several accounts, which can take longer than
    // the default 10 seconds on a slower machine.
    hookTimeout: 30_000,
  },
});
