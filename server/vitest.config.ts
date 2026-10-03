import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // The API tests share one PostgreSQL database, and Ticket Numbers are
    // derived from the latest ticket id, so test files run one at a time.
    fileParallelism: false,
    // Password hashing (bcrypt) is deliberately slow, and some tests log in
    // several times.
    testTimeout: 20_000,
  },
});
