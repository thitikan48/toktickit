import { existsSync, readFileSync } from "fs";
import path from "path";

// Server tests use their own database (toktickit_test), set in
// server/.env.test, so they never change the development data.
export function readTestDatabaseUrl(serverDir: string): string {
  const file = path.join(serverDir, ".env.test");

  if (!existsSync(file)) {
    throw new Error(
      "server/.env.test is missing. Create it as described in the README (Test database)."
    );
  }

  const match = readFileSync(file, "utf-8").match(/^DATABASE_URL="?([^"\r\n]+)"?/m);

  if (!match) {
    throw new Error("server/.env.test has no DATABASE_URL.");
  }

  return match[1];
}
