import { execFileSync } from "child_process";
import path from "path";
import { readTestDatabaseUrl } from "./test-database.js";

// Runs once before the test files: bring the test database up to date and
// seed it. Both steps are safe to repeat.
export default function setup() {
  const serverDir = process.cwd();
  const env = { ...process.env, DATABASE_URL: readTestDatabaseUrl(serverDir) };

  const prismaCli = path.join(serverDir, "node_modules", "prisma", "build", "index.js");
  const tsxCli = path.join(serverDir, "node_modules", "tsx", "dist", "cli.mjs");

  execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: serverDir,
    env,
    stdio: "inherit",
  });

  execFileSync(process.execPath, [tsxCli, "prisma/seed.ts"], {
    cwd: serverDir,
    env,
    stdio: "inherit",
  });
}
