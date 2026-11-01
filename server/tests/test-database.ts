import { execFileSync } from "child_process";
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

/**
 * Empties the test database, applies the migrations, and runs the seed, so
 * the dashboard tests start from the specification section 7.4 values.
 * It refuses to run on any database other than toktickit_test.
 */
export function resetTestDatabase(serverDir: string): void {
  const url = readTestDatabaseUrl(serverDir);

  if (!/\/toktickit_test(\?|$)/.test(url)) {
    throw new Error("resetTestDatabase only runs on the toktickit_test database.");
  }

  const env = { ...process.env, DATABASE_URL: url };
  const prismaCli = path.join(serverDir, "node_modules", "prisma", "build", "index.js");
  const tsxCli = path.join(serverDir, "node_modules", "tsx", "dist", "cli.mjs");

  execFileSync(
    process.execPath,
    [prismaCli, "migrate", "reset", "--force", "--skip-seed", "--skip-generate"],
    { cwd: serverDir, env, stdio: "ignore" }
  );
  execFileSync(process.execPath, [tsxCli, "prisma/seed.ts"], {
    cwd: serverDir,
    env,
    stdio: "ignore",
  });
}
