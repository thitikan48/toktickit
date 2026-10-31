import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./tests/setup.ts",
    // `npm test` runs the Lab 4 component tests.
    include: ["tests/lab-04/**/*.test.tsx"],
    // Some component tests click through several screens; the 5 second
    // default is too short when many test files run at once.
    testTimeout: 20_000,
  },
});
