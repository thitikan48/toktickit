import { execFileSync } from "child_process";
import { existsSync, readdirSync, readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();
const serverDir = process.cwd();
const migrationsDir = path.join(serverDir, "prisma", "migrations");
const LAB4_MIGRATION = "20261101000000_lab4_actions_taken";

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

async function runFile(tx: Prisma.TransactionClient, file: string) {
  for (const statement of statements(file)) {
    await tx.$executeRawUnsafe(statement);
  }
}

async function count(tx: Prisma.TransactionClient, sql: string): Promise<number> {
  const rows = await tx.$queryRawUnsafe<{ count: bigint }[]>(sql);
  return Number(rows[0].count);
}

// Rows from Labs 1 to 3 that must survive the Lab 4 migration.
const COUNT_ALL = `SELECT
  (SELECT count(*) FROM "User") + (SELECT count(*) FROM "Ticket") +
  (SELECT count(*) FROM "Attachment") + (SELECT count(*) FROM "TicketComment") +
  (SELECT count(*) FROM "TicketInternalNote") AS count`;

class RollBack extends Error {}

/**
 * Builds a Lab 3 database with some data in a scratch schema, runs `check`,
 * and then rolls everything back, so the test database is not changed.
 */
async function withLab3Schema(
  schema: string,
  check: (tx: Prisma.TransactionClient) => Promise<void>
) {
  let checked = false;

  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(`CREATE SCHEMA ${schema}`);
        await tx.$executeRawUnsafe(`SET LOCAL search_path TO ${schema}`);

        const folders = migrationFolders();
        const lab4Index = folders.indexOf(LAB4_MIGRATION);
        expect(lab4Index).toBeGreaterThan(0);

        for (const folder of folders.slice(0, lab4Index)) {
          await runFile(tx, path.join(migrationsDir, folder, "migration.sql"));
        }

        // Lab 3 data: one user, one Ticket with an attachment, a comment, and a note.
        await tx.$executeRawUnsafe(
          `INSERT INTO "User" ("name","email","passwordHash","role","updatedAt")
           VALUES ('Old Staff','old.staff@example.test','!','IT_STAFF',now())`
        );
        await tx.$executeRawUnsafe(`INSERT INTO "Category" ("name") VALUES ('Hardware')`);
        await tx.$executeRawUnsafe(`INSERT INTO "RelatedSystem" ("name") VALUES ('Printer')`);
        await tx.$executeRawUnsafe(
          `INSERT INTO "Ticket"
             ("ticketNumber","requesterId","categoryId","relatedSystemId","summary",
              "description","requestedPriority","itPriority","currentStatus","ownerId","updatedAt")
           VALUES ('TKT-2026-000001',1,1,1,'Old ticket','A ticket from Lab 3.',
                   'HIGH','HIGH','RESOLVED',1,now())`
        );
        await tx.$executeRawUnsafe(
          `INSERT INTO "Attachment" ("ticketId","originalName","storedName","mimeType","sizeBytes")
           VALUES (1,'old.pdf','old-stored.pdf','application/pdf',10)`
        );
        await tx.$executeRawUnsafe(
          `INSERT INTO "TicketComment" ("ticketId","authorId","body") VALUES (1,1,'Old comment')`
        );
        await tx.$executeRawUnsafe(
          `INSERT INTO "TicketInternalNote" ("ticketId","authorId","body") VALUES (1,1,'Old note')`
        );

        await check(tx);

        checked = true;
        throw new RollBack();
      },
      { timeout: 60_000, maxWait: 60_000 }
    );
  } catch (error) {
    if (!(error instanceof RollBack)) throw error;
  }

  expect(checked).toBe(true);
}

const lab4Sql = () => path.join(migrationsDir, LAB4_MIGRATION, "migration.sql");
const downSql = () => path.join(migrationsDir, LAB4_MIGRATION, "down.sql");

describe("Lab 4 migration", () => {
  it("MIG-01 keeps Lab 3 data, and legacy Tickets have no actions, no history, no resolvedAt, version 0", async () => {
    await withLab3Schema("lab4_migration_test", async (tx) => {
      const before = await count(tx, COUNT_ALL);

      await runFile(tx, lab4Sql());

      expect(await count(tx, COUNT_ALL)).toBe(before);

      const tickets = await tx.$queryRawUnsafe<{ resolvedAt: Date | null; version: number }[]>(
        `SELECT "resolvedAt","version" FROM "Ticket"`
      );
      expect(tickets).toEqual([{ resolvedAt: null, version: 0 }]);

      expect(await count(tx, `SELECT count(*) AS count FROM "ActionTaken"`)).toBe(0);
      expect(await count(tx, `SELECT count(*) AS count FROM "TicketStatusHistory"`)).toBe(0);
    });
  }, 90_000);

  it("MIG-02 down-SQL removes only the Lab 4 objects, and the migration can be applied again", async () => {
    expect(existsSync(downSql())).toBe(true);

    await withLab3Schema("lab4_down_test", async (tx) => {
      const before = await count(tx, COUNT_ALL);
      await runFile(tx, lab4Sql());

      // A small stand-in for Prisma's migration table, so the down-SQL can
      // remove the Lab 4 row and keep the others.
      await tx.$executeRawUnsafe(`CREATE TABLE "_prisma_migrations" ("migration_name" TEXT)`);
      await tx.$executeRawUnsafe(
        `INSERT INTO "_prisma_migrations" VALUES ('20261003000000_lab3_users_and_ticket_workflow'), ('${LAB4_MIGRATION}')`
      );

      await runFile(tx, downSql());

      expect(await count(tx, `SELECT count(*) AS count FROM pg_tables WHERE schemaname = 'lab4_down_test' AND tablename IN ('ActionTaken','TicketStatusHistory')`)).toBe(0);
      expect(await count(tx, `SELECT count(*) AS count FROM information_schema.columns WHERE table_schema = 'lab4_down_test' AND table_name = 'Ticket' AND column_name IN ('resolvedAt','version')`)).toBe(0);
      expect(await count(tx, `SELECT count(*) AS count FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'lab4_down_test' AND t.typname = 'ActionStatus'`)).toBe(0);

      const rows = await tx.$queryRawUnsafe<{ migration_name: string }[]>(
        `SELECT "migration_name" FROM "_prisma_migrations"`
      );
      expect(rows.map((row) => row.migration_name)).toEqual([
        "20261003000000_lab3_users_and_ticket_workflow",
      ]);

      expect(await count(tx, COUNT_ALL)).toBe(before);

      // The migration works again after recovery.
      await runFile(tx, lab4Sql());
      expect(await count(tx, `SELECT count(*) AS count FROM "ActionTaken"`)).toBe(0);
    });
  }, 90_000);
});

describe("Lab 4 seed", () => {
  const tsxCli = path.join(serverDir, "node_modules", "tsx", "dist", "cli.mjs");

  function runSeed() {
    execFileSync(process.execPath, [tsxCli, "prisma/seed.ts"], {
      cwd: serverDir,
      stdio: "pipe",
    });
  }

  // Only seeded actions; tests in other files mark their own actions.
  const seeded = { NOT: { description: { startsWith: "[lab4-test]" } } };

  it("MIG-03 is idempotent and covers 0, 1, and several actions and every action status", async () => {
    runSeed();
    const first = await prisma.actionTaken.count({ where: seeded });

    runSeed();
    expect(await prisma.actionTaken.count({ where: seeded })).toBe(first);

    const perTicket: Record<string, number> = {};
    for (const number of ["900001", "900002", "900003", "900004", "900006", "900007", "900013"]) {
      perTicket[number] = await prisma.actionTaken.count({
        where: { ...seeded, ticket: { ticketNumber: `TKT-2026-${number}` } },
      });
    }
    expect(perTicket).toEqual({
      "900001": 0,
      "900002": 1,
      "900003": 3,
      "900004": 1,
      "900006": 2,
      "900007": 1,
      "900013": 1,
    });

    const statuses = await prisma.actionTaken.findMany({
      where: seeded,
      distinct: ["status"],
      select: { status: true },
    });
    expect(statuses.map((s) => s.status).sort()).toEqual(
      ["CANCELLED", "COMPLETED", "IN_PROGRESS", "PLANNED"]
    );

    // Completed actions have Performed By; open ones do not.
    expect(
      await prisma.actionTaken.count({ where: { ...seeded, status: "COMPLETED", performedById: null } })
    ).toBe(0);

    const openFor = async (email: string) =>
      prisma.actionTaken.count({
        where: {
          ...seeded,
          status: { in: ["PLANNED", "IN_PROGRESS"] },
          assignedTo: { email },
        },
      });
    expect(await openFor("priya.nair@example.com")).toBe(1);
    expect(await openFor("marcus.chen@example.com")).toBe(2);
    expect(await openFor("elena.rossi@example.com")).toBe(0);

    const resolved = await prisma.ticket.findUniqueOrThrow({
      where: { ticketNumber: "TKT-2026-900013" },
    });
    expect(resolved.resolvedAt).not.toBeNull();
  }, 90_000);
});
