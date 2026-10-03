import { execFileSync } from "child_process";
import { readdirSync, readFileSync } from "fs";
import path from "path";
import { afterAll, describe, expect, it } from "vitest";
import bcrypt from "bcrypt";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();
const serverDir = process.cwd();
const migrationsDir = path.join(serverDir, "prisma", "migrations");
const LAB3_MIGRATION = "20261003000000_lab3_users_and_ticket_workflow";

function statements(file: string): string[] {
  const sql = readFileSync(file, "utf-8")
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");

  return sql
    .split(/;\s*(?:\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

function migrationFolders(): string[] {
  return readdirSync(migrationsDir)
    .filter((name) => /^\d{14}_/.test(name))
    .sort();
}

class RollBack extends Error {}

describe("Lab 2 to Lab 3 migration", () => {
  it("keeps Lab 2 users, tickets, and attachments valid", async () => {
    let checked = false;

    try {
      await prisma.$transaction(
        async (tx) => {
          // A scratch schema (rolled back at the end) keeps the real
          // database untouched: the Lab 2 database is rebuilt there, the
          // Lab 3 migration is applied to it, and the result is inspected.
          await tx.$executeRawUnsafe(`CREATE SCHEMA lab3_migration_test`);
          await tx.$executeRawUnsafe(`SET LOCAL search_path TO lab3_migration_test`);

          const folders = migrationFolders();
          const lab3Index = folders.indexOf(LAB3_MIGRATION);
          expect(lab3Index).toBeGreaterThan(0);

          for (const folder of folders.slice(0, lab3Index)) {
            for (const statement of statements(
              path.join(migrationsDir, folder, "migration.sql")
            )) {
              await tx.$executeRawUnsafe(statement);
            }
          }

          // Lab 2 data.
          await tx.$executeRawUnsafe(
            `INSERT INTO "RequesterUser" ("name","email","isActive","updatedAt")
             VALUES ('Old Requester','old.requester@example.test',true,now())`
          );
          await tx.$executeRawUnsafe(`INSERT INTO "Category" ("name") VALUES ('Hardware')`);
          await tx.$executeRawUnsafe(`INSERT INTO "RelatedSystem" ("name") VALUES ('Printer')`);
          await tx.$executeRawUnsafe(
            `INSERT INTO "Ticket"
               ("ticketNumber","requesterId","categoryId","relatedSystemId",
                "summary","description","requestedPriority","updatedAt")
             VALUES ('TKT-2026-000001',1,1,1,'Old ticket','A ticket from Lab 2.','HIGH',now())`
          );
          await tx.$executeRawUnsafe(
            `INSERT INTO "Attachment" ("ticketId","originalName","storedName","mimeType","sizeBytes")
             VALUES (1,'old.pdf','old-stored.pdf','application/pdf',10)`
          );

          for (const statement of statements(
            path.join(migrationsDir, LAB3_MIGRATION, "migration.sql")
          )) {
            await tx.$executeRawUnsafe(statement);
          }

          const users = await tx.$queryRawUnsafe<
            {
              id: number;
              role: string;
              passwordHash: string;
              mustChangePassword: boolean;
            }[]
          >(`SELECT "id","role","passwordHash","mustChangePassword" FROM "User"`);

          expect(users).toHaveLength(1);
          expect(users[0].id).toBe(1);
          expect(users[0].role).toBe("REQUESTER");
          // The placeholder is not a bcrypt hash, so the account cannot log
          // in until the seed sets the documented initial password.
          expect(users[0].passwordHash).toBe("!");
          expect(users[0].mustChangePassword).toBe(true);

          const tickets = await tx.$queryRawUnsafe<
            {
              requesterId: number;
              ownerId: number | null;
              requestedPriority: string;
              itPriority: string;
              currentStatus: string;
              requesterMarkedResolved: boolean;
            }[]
          >(
            `SELECT "requesterId","ownerId","requestedPriority","itPriority",
                    "currentStatus","requesterMarkedResolved" FROM "Ticket"`
          );

          expect(tickets).toEqual([
            {
              requesterId: 1,
              ownerId: null,
              requestedPriority: "HIGH",
              itPriority: "HIGH",
              currentStatus: "NEW",
              requesterMarkedResolved: false,
            },
          ]);

          const attachments = await tx.$queryRawUnsafe<{ count: bigint }[]>(
            `SELECT count(*) AS count FROM "Attachment" WHERE "ticketId" = 1`
          );
          expect(Number(attachments[0].count)).toBe(1);

          const reference = await tx.$queryRawUnsafe<{ count: bigint }[]>(
            `SELECT (SELECT count(*) FROM "Category") + (SELECT count(*) FROM "RelatedSystem") AS count`
          );
          expect(Number(reference[0].count)).toBe(2);

          checked = true;
          throw new RollBack();
        },
        { timeout: 60_000, maxWait: 60_000 }
      );
    } catch (error) {
      if (!(error instanceof RollBack)) throw error;
    }

    expect(checked).toBe(true);
  }, 90_000);
});

describe("Seed", () => {
  const tsxCli = path.join(serverDir, "node_modules", "tsx", "dist", "cli.mjs");

  function runSeed() {
    execFileSync(process.execPath, [tsxCli, "prisma/seed.ts"], {
      cwd: serverDir,
      stdio: "pipe",
    });
  }

  // The test below edits a seeded account; its original state is restored.
  let original: { passwordHash: string; mustChangePassword: boolean } | null =
    null;

  afterAll(async () => {
    if (original) {
      await prisma.user.update({
        where: { email: "marcus.chen@example.com" },
        data: original,
      });
    }
  });

  it("is idempotent, creates the required accounts, and keeps changed passwords", async () => {
    runSeed();
    const first = await prisma.user.count();

    const before = await prisma.user.findUniqueOrThrow({
      where: { email: "marcus.chen@example.com" },
    });
    original = {
      passwordHash: before.passwordHash,
      mustChangePassword: before.mustChangePassword,
    };

    // A user changes their password; the next seed run must not undo it.
    const changedHash = await bcrypt.hash("MyOwnPass123", 4);
    await prisma.user.update({
      where: { email: "marcus.chen@example.com" },
      data: { passwordHash: changedHash, mustChangePassword: false },
    });

    runSeed();

    expect(await prisma.user.count()).toBe(first);

    const marcus = await prisma.user.findUniqueOrThrow({
      where: { email: "marcus.chen@example.com" },
    });
    expect(marcus.passwordHash).toBe(changedHash);

    const count = (role: "REQUESTER" | "IT_STAFF" | "ADMIN", isActive: boolean) =>
      prisma.user.count({ where: { role, isActive } });

    expect(await count("REQUESTER", true)).toBeGreaterThanOrEqual(4);
    expect(await count("REQUESTER", false)).toBeGreaterThanOrEqual(1);
    expect(await count("IT_STAFF", true)).toBeGreaterThanOrEqual(3);
    expect(await count("IT_STAFF", false)).toBeGreaterThanOrEqual(1);
    expect(await count("ADMIN", true)).toBeGreaterThanOrEqual(1);

    expect(await prisma.user.count({ where: { passwordHash: "!" } })).toBe(0);
    expect(
      await prisma.ticket.count({
        where: { ticketNumber: { startsWith: "TKT-2026-9000" } },
      })
    ).toBe(13);
  }, 60_000);

  it("gives the seeded accounts the documented initial password", async () => {
    // Jennifer keeps the initial password unless someone changed it.
    const jennifer = await prisma.user.findUniqueOrThrow({
      where: { email: "jennifer.anderson@example.com" },
    });

    expect(jennifer.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(await bcrypt.compare("ChangeMe123", jennifer.passwordHash)).toBe(true);
    expect(jennifer.mustChangePassword).toBe(false);
  });
});
