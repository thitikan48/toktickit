import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { resetTestDatabase } from "../test-database.js";

// The expected values come from specification section 7.4, so the test
// database is reset and seeded first. Users and Tickets made here start
// with MARK and are deleted afterwards.
const PASSWORD = "ChangeMe123";
const MARK = "[lab4-requester-dashboard]";
const DAY = 24 * 60 * 60 * 1000;
const ACTIVE = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"] as const;

const prisma = getPrisma();

type Agent = ReturnType<typeof request.agent>;

async function loginAs(email: string): Promise<Agent> {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/login").send({ email, password: PASSWORD });
  expect(res.status).toBe(200);
  return agent;
}

const ids: Record<string, number> = {};
const agents: Record<string, Agent> = {};

beforeAll(async () => {
  resetTestDatabase(process.cwd());

  // Michael must change his initial password in the seed; the seed puts the
  // flag back on the next reset.
  await prisma.user.update({
    where: { email: "michael.brown@example.com" },
    data: { mustChangePassword: false },
  });

  for (const [key, email] of Object.entries({
    jennifer: "jennifer.anderson@example.com",
    david: "david.lee@example.com",
    michael: "michael.brown@example.com",
    priya: "priya.nair@example.com",
    admin: "admin@example.com",
  })) {
    ids[key] = (await prisma.user.findUniqueOrThrow({ where: { email } })).id;
  }

  // David must change his password too; the dashboard needs him logged in.
  await prisma.user.update({ where: { id: ids.david }, data: { mustChangePassword: false } });

  for (const key of Object.keys(ids)) {
    const { email } = await prisma.user.findUniqueOrThrow({ where: { id: ids[key] } });
    agents[key] = await loginAs(email);
  }
}, 180_000);

afterAll(async () => {
  await prisma.user.updateMany({
    where: { email: { in: ["michael.brown@example.com", "david.lee@example.com"] } },
    data: { mustChangePassword: true },
  });
  await prisma.ticket.deleteMany({ where: { summary: { startsWith: MARK } } });
  await prisma.user.deleteMany({ where: { name: { startsWith: MARK } } });
});

// The same Prisma queries as api-spec section 8.
async function expectedFor(requesterId: number) {
  const since = new Date(Date.now() - 7 * DAY);

  return {
    openTickets: await prisma.ticket.count({
      where: { requesterId, currentStatus: { in: [...ACTIVE] } },
    }),
    waitingForMe: await prisma.ticket.count({
      where: { requesterId, currentStatus: "WAITING_FOR_REQUESTER" },
    }),
    recentlyUpdated: (
      await prisma.ticket.findMany({
        where: { requesterId, updatedAt: { gte: since } },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: 5,
      })
    ).map((ticket) => ticket.ticketNumber),
    recentlyResolved: (
      await prisma.ticket.findMany({
        where: { requesterId, resolvedAt: { gte: since } },
        orderBy: [{ resolvedAt: "desc" }, { id: "desc" }],
        take: 5,
      })
    ).map((ticket) => ticket.ticketNumber),
  };
}

const numbers = (rows: { ticketNumber: string }[]) => rows.map((row) => row.ticketNumber);

describe("unit", () => {
  // Loaded inside the test so the API tests still run before the module exists.
  const dashboards = () => import("../../src/dashboards.js");

  it("UNIT-04 counts now and exactly 7 days ago as recent, and 7 days plus 1 minute ago as not", async () => {
    const { isRecent } = await dashboards();
    const now = new Date("2026-11-08T05:00:00.000Z");

    expect(isRecent(now, now)).toBe(true);
    expect(isRecent(new Date(now.getTime() - 7 * DAY), now)).toBe(true);
    expect(isRecent(new Date(now.getTime() - 7 * DAY - 60_000), now)).toBe(false);
  });
});

describe("Requester Dashboard", () => {
  it("API-10 gives Jennifer, David, and Michael the section 7.4 values on a fresh seed", async () => {
    const expected = {
      jennifer: { openTickets: 3, waitingForMe: 0, updated: 4, resolved: ["TKT-2026-900013"] },
      david: { openTickets: 2, waitingForMe: 0, updated: 3, resolved: [] },
      michael: { openTickets: 2, waitingForMe: 1, updated: 3, resolved: [] },
    };

    for (const [key, values] of Object.entries(expected)) {
      const res = await agents[key].get("/api/dashboard/requester");
      expect(res.status, key).toBe(200);
      expect(Object.keys(res.body).sort()).toEqual(
        ["openTickets", "recentlyResolved", "recentlyUpdated", "waitingForMe"]
      );

      expect(res.body.openTickets, key).toBe(values.openTickets);
      expect(res.body.waitingForMe, key).toBe(values.waitingForMe);
      expect(res.body.recentlyUpdated, key).toHaveLength(values.updated);
      expect(numbers(res.body.recentlyResolved), key).toEqual(values.resolved);

      // And the same as the Prisma queries.
      const query = await expectedFor(ids[key]);
      expect(res.body.openTickets).toBe(query.openTickets);
      expect(res.body.waitingForMe).toBe(query.waitingForMe);
      expect(numbers(res.body.recentlyUpdated)).toEqual(query.recentlyUpdated);
      expect(numbers(res.body.recentlyResolved)).toEqual(query.recentlyResolved);
    }

    const row = (await agents.jennifer.get("/api/dashboard/requester")).body.recentlyResolved[0];
    expect(row).toEqual({
      id: expect.any(Number),
      ticketNumber: "TKT-2026-900013",
      summary: "Laptop keyboard key stuck",
      currentStatus: "RESOLVED",
      resolvedAt: expect.any(String),
    });
  });

  it("API-11 ignores a requesterId parameter and uses only the session user's Tickets", async () => {
    const plain = await agents.jennifer.get("/api/dashboard/requester");
    const other = await agents.jennifer.get(`/api/dashboard/requester?requesterId=${ids.michael}`);

    expect(other.status).toBe(200);
    expect(other.body).toEqual(plain.body);

    const mine = await prisma.ticket.findMany({ where: { requesterId: ids.jennifer } });
    const mineNumbers = mine.map((ticket) => ticket.ticketNumber);
    for (const ticket of [...other.body.recentlyUpdated, ...other.body.recentlyResolved]) {
      expect(mineNumbers).toContain(ticket.ticketNumber);
    }
  });

  it("API-12 keeps only the last 7 days, at most 5 rows newest first; a closed Ticket stays resolved, a reopened one does not", async () => {
    // A Requester with no Tickets.
    const user = await prisma.user.create({
      data: {
        name: `${MARK} Nina Park`,
        email: "nina.park.dashboard@example.test",
        passwordHash: await bcrypt.hash(PASSWORD, 4),
        role: "REQUESTER",
        mustChangePassword: false,
      },
    });
    const nina = await loginAs(user.email);

    const empty = await nina.get("/api/dashboard/requester");
    expect(empty.status).toBe(200);
    expect(empty.body).toEqual({
      openTickets: 0,
      waitingForMe: 0,
      recentlyUpdated: [],
      recentlyResolved: [],
    });

    const category = await prisma.category.findFirstOrThrow();
    const system = await prisma.relatedSystem.findFirstOrThrow();
    let counter = 0;

    const make = async (updatedAt: Date, status: (typeof ACTIVE)[number] = "OPEN") => {
      counter += 1;
      return prisma.ticket.create({
        data: {
          ticketNumber: `TKT-2099-R${String(Date.now()).slice(-5)}${counter}`,
          requesterId: user.id,
          categoryId: category.id,
          relatedSystemId: system.id,
          summary: `${MARK} Ticket ${counter}`,
          description: "A Ticket made by the dashboard tests.",
          requestedPriority: "LOW",
          itPriority: "LOW",
          currentStatus: status,
          ownerId: ids.priya,
          updatedAt,
        },
      });
    };

    const now = Date.now();
    const old = await make(new Date(now - 8 * DAY));
    const recent = [];
    for (let hours = 6; hours >= 1; hours -= 1) {
      recent.push(await make(new Date(now - hours * 60 * 60 * 1000)));
    }

    const res = await nina.get("/api/dashboard/requester");
    expect(res.body.openTickets).toBe(7);
    expect(numbers(res.body.recentlyUpdated)).toEqual(
      recent.slice(1).reverse().map((ticket) => ticket.ticketNumber)
    );
    expect(numbers(res.body.recentlyUpdated)).not.toContain(old.ticketNumber);

    // Resolved then closed: still "recently resolved". Resolved then reopened: not.
    const status = async (ticketId: number, to: string) => {
      const version = (await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })).version;
      const changed = await agents.priya
        .post(`/api/staff/tickets/${ticketId}/status`)
        .send({ status: to, confirm: true, expectedVersion: version });
      expect(changed.status).toBe(200);
    };

    const closed = await make(new Date());
    await status(closed.id, "RESOLVED");
    await status(closed.id, "CLOSED");

    const reopened = await make(new Date());
    await status(reopened.id, "RESOLVED");
    await status(reopened.id, "REOPENED");

    const after = await nina.get("/api/dashboard/requester");
    expect(numbers(after.body.recentlyResolved)).toEqual([closed.ticketNumber]);
    expect(after.body.recentlyResolved[0].currentStatus).toBe("CLOSED");
  });

  it("AUTHZ-04 gives IT Staff and Administrators 403 on the Requester Dashboard, and no session 401", async () => {
    expect((await agents.priya.get("/api/dashboard/requester")).status).toBe(403);
    expect((await agents.admin.get("/api/dashboard/requester")).status).toBe(403);
    expect((await request(app).get("/api/dashboard/requester")).status).toBe(401);
  });
});
