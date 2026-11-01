import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { resetTestDatabase } from "../test-database.js";

// The expected values come from specification section 7.4, so the test
// database is reset and seeded first. Tickets and actions made here start
// with MARK and are deleted afterwards.
const PASSWORD = "ChangeMe123";
const MARK = "[lab4-staff-dashboard]";
const DAY = 24 * 60 * 60 * 1000;
const ACTIVE = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"] as const;
const STATUSES = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "CANCELLED",
] as const;
const KEYS = [
  "countsByStatus",
  "myOpenActions",
  "myOpenActionsList",
  "myOpenTickets",
  "recentlyUpdated",
  "unassigned",
];

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

// Marcus and Michael must change their initial password in the seed.
const notReady = ["marcus.chen@example.com", "michael.brown@example.com"];

beforeAll(async () => {
  resetTestDatabase(process.cwd());

  await prisma.user.updateMany({
    where: { email: { in: notReady } },
    data: { mustChangePassword: false },
  });

  for (const [key, email] of Object.entries({
    priya: "priya.nair@example.com",
    marcus: "marcus.chen@example.com",
    elena: "elena.rossi@example.com",
    admin: "admin@example.com",
    jennifer: "jennifer.anderson@example.com",
    michael: "michael.brown@example.com",
  })) {
    ids[key] = (await prisma.user.findUniqueOrThrow({ where: { email } })).id;
    agents[key] = await loginAs(email);
  }
}, 180_000);

afterAll(async () => {
  await prisma.user.updateMany({
    where: { email: { in: notReady } },
    data: { mustChangePassword: true },
  });
  await prisma.actionTaken.deleteMany({ where: { description: { startsWith: MARK } } });
  await prisma.ticket.deleteMany({ where: { summary: { startsWith: MARK } } });
});

// The same Prisma queries as api-spec section 8.
async function expectedFor(me: number) {
  const since = new Date(Date.now() - 7 * DAY);
  const openAction = { assignedToId: me, status: { in: ["PLANNED", "IN_PROGRESS"] as ("PLANNED" | "IN_PROGRESS")[] } };
  const groups = await prisma.ticket.groupBy({ by: ["currentStatus"], _count: true });

  return {
    unassigned: await prisma.ticket.count({
      where: { ownerId: null, currentStatus: { in: [...ACTIVE] } },
    }),
    myOpenTickets: await prisma.ticket.count({
      where: { ownerId: me, currentStatus: { in: [...ACTIVE] } },
    }),
    myOpenActions: await prisma.actionTaken.count({ where: openAction }),
    myOpenActionsList: (
      await prisma.actionTaken.findMany({
        where: openAction,
        orderBy: [{ actionAt: "asc" }, { id: "asc" }],
        take: 5,
      })
    ).map((action) => action.id),
    countsByStatus: Object.fromEntries(
      STATUSES.map((status) => [
        status,
        groups.find((group) => group.currentStatus === status)?._count ?? 0,
      ])
    ),
    recentlyUpdated: (
      await prisma.ticket.findMany({
        where: { updatedAt: { gte: since } },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: 5,
      })
    ).map((ticket) => ticket.ticketNumber),
  };
}

async function dashboard(agent: Agent) {
  const res = await agent.get("/api/staff/dashboard");
  expect(res.status).toBe(200);
  return res.body;
}

async function makeTicket(summary: string) {
  const category = await prisma.category.findFirstOrThrow();
  const system = await prisma.relatedSystem.findFirstOrThrow();

  return prisma.ticket.create({
    data: {
      ticketNumber: `TKT-2099-S${String(Date.now()).slice(-6)}`,
      requesterId: ids.jennifer,
      categoryId: category.id,
      relatedSystemId: system.id,
      summary: `${MARK} ${summary}`,
      description: "A Ticket made by the dashboard tests.",
      requestedPriority: "LOW",
      itPriority: "LOW",
      currentStatus: "CANCELLED",
      ownerId: ids.priya,
    },
  });
}

describe("IT Staff Dashboard", () => {
  it("API-13 gives Priya, Marcus, Elena, and Admin the section 7.4 values on a fresh seed", async () => {
    const expected = {
      priya: { myOpenTickets: 2, myOpenActions: 1 },
      marcus: { myOpenTickets: 2, myOpenActions: 2 },
      elena: { myOpenTickets: 2, myOpenActions: 0 },
      admin: { myOpenTickets: 0, myOpenActions: 0 },
    };
    const counts = {
      NEW: 2,
      OPEN: 3,
      IN_PROGRESS: 2,
      WAITING_FOR_REQUESTER: 1,
      RESOLVED: 2,
      CLOSED: 1,
      REOPENED: 1,
      CANCELLED: 1,
    };

    for (const [key, values] of Object.entries(expected)) {
      const body = await dashboard(agents[key]);

      expect(body.unassigned, key).toBe(3);
      expect(body.myOpenTickets, key).toBe(values.myOpenTickets);
      expect(body.myOpenActions, key).toBe(values.myOpenActions);
      expect(body.myOpenActionsList, key).toHaveLength(values.myOpenActions);
      expect(body.countsByStatus, key).toEqual(counts);
      expect(body.recentlyUpdated, key).toHaveLength(5);

      // And the same as the Prisma queries.
      const query = await expectedFor(ids[key]);
      expect(body.unassigned).toBe(query.unassigned);
      expect(body.myOpenTickets).toBe(query.myOpenTickets);
      expect(body.myOpenActions).toBe(query.myOpenActions);
      expect(body.myOpenActionsList.map((row: { actionId: number }) => row.actionId)).toEqual(
        query.myOpenActionsList
      );
      expect(body.countsByStatus).toEqual(query.countsByStatus);
      expect(body.recentlyUpdated.map((row: { ticketNumber: string }) => row.ticketNumber)).toEqual(
        query.recentlyUpdated
      );
    }

    // Elena has no open actions.
    expect((await dashboard(agents.elena)).myOpenActionsList).toEqual([]);

    const priya = await dashboard(agents.priya);
    expect(priya.myOpenActionsList[0]).toEqual({
      actionId: expect.any(Number),
      ticketId: expect.any(Number),
      ticketNumber: "TKT-2026-900002",
      description: "Clean the printer paper-path sensor.",
      status: "PLANNED",
      actionAt: expect.any(String),
    });
    expect(Object.keys(priya.recentlyUpdated[0]).sort()).toEqual(
      ["currentStatus", "id", "owner", "summary", "ticketNumber", "updatedAt"]
    );
  });

  it("API-14 lists at most 5 open actions, oldest first, and at most 5 recently updated Tickets, newest first", async () => {
    const ticket = await makeTicket("Open action list");
    const base = Date.now() - 30 * DAY;

    const created = [];
    for (let index = 0; index < 6; index += 1) {
      created.push(
        await prisma.actionTaken.create({
          data: {
            ticketId: ticket.id,
            actionAt: new Date(base + (5 - index) * DAY), // newest first, so order matters
            description: `${MARK} Open action ${index}`,
            status: index % 2 === 0 ? "PLANNED" : "IN_PROGRESS",
            assignedToId: ids.elena,
            createdById: ids.elena,
            updatedById: ids.elena,
          },
        })
      );
    }
    for (const status of ["COMPLETED", "CANCELLED"] as const) {
      await prisma.actionTaken.create({
        data: {
          ticketId: ticket.id,
          actionAt: new Date(base - DAY), // the oldest, but finished
          description: `${MARK} Finished action`,
          status,
          assignedToId: ids.elena,
          performedById: status === "COMPLETED" ? ids.elena : null,
          createdById: ids.elena,
          updatedById: ids.elena,
        },
      });
    }

    const body = await dashboard(agents.elena);
    expect(body.myOpenActions).toBe(6);
    expect(body.myOpenActionsList.map((row: { actionId: number }) => row.actionId)).toEqual(
      created.slice(1).reverse().map((action) => action.id)
    );

    const updatedAt = body.recentlyUpdated.map((row: { updatedAt: string }) => row.updatedAt);
    expect(body.recentlyUpdated).toHaveLength(5);
    expect([...updatedAt].sort().reverse()).toEqual(updatedAt);
    expect(body.recentlyUpdated[0].ticketNumber).toBe(ticket.ticketNumber);
  });

  it("API-15 gives Administrators and IT Staff the same keys, with no user counts and no full Ticket lists", async () => {
    const staff = await dashboard(agents.priya);
    const admin = await dashboard(agents.admin);

    expect(Object.keys(staff).sort()).toEqual(KEYS);
    expect(Object.keys(admin).sort()).toEqual(KEYS);
    expect(JSON.stringify(admin)).not.toMatch(/user|email|password/i);
    expect(admin.recentlyUpdated.length).toBeLessThanOrEqual(5);
    expect(admin.myOpenActionsList.length).toBeLessThanOrEqual(5);
  });

  it("AUTHZ-04 gives a Requester 403 on the IT Staff Dashboard, and no session 401", async () => {
    expect((await agents.jennifer.get("/api/staff/dashboard")).status).toBe(403);
    expect((await request(app).get("/api/staff/dashboard")).status).toBe(401);
  });
});

describe("Drill-down filters", () => {
  it("API-16 gives My Tickets and the Ticket Queue the same total as each card", async () => {
    const total = async (agent: Agent, url: string) => {
      const res = await agent.get(url);
      expect(res.status, url).toBe(200);
      return res.body.totalItems;
    };

    const priya = await dashboard(agents.priya);
    expect(await total(agents.priya, "/api/staff/tickets?ownerId=unassigned&statusGroup=active")).toBe(
      priya.unassigned
    );
    expect(
      await total(agents.priya, `/api/staff/tickets?ownerId=${ids.priya}&statusGroup=active`)
    ).toBe(priya.myOpenTickets);
    for (const status of STATUSES) {
      expect(await total(agents.priya, `/api/staff/tickets?status=${status}`), status).toBe(
        priya.countsByStatus[status]
      );
    }

    for (const key of ["jennifer", "michael"]) {
      const card = (await agents[key].get("/api/dashboard/requester")).body;
      expect(await total(agents[key], "/api/tickets?statusGroup=active")).toBe(card.openTickets);
      expect(await total(agents[key], "/api/tickets?status=WAITING_FOR_REQUESTER")).toBe(
        card.waitingForMe
      );
    }
  });

  it("API-17 filters statusGroup=active, rejects other values, combines with status, and leaves Lab 3 parameters unchanged", async () => {
    for (const [agent, url] of [
      [agents.priya, "/api/staff/tickets"],
      [agents.jennifer, "/api/tickets"],
    ] as const) {
      const all = await agent.get(url);
      const active = await agent.get(`${url}?statusGroup=active`);
      expect(active.status).toBe(200);
      expect(active.body.items.length).toBeGreaterThan(0);
      for (const ticket of active.body.items) {
        expect(ACTIVE).toContain(ticket.currentStatus);
      }

      const bad = await agent.get(`${url}?statusGroup=bad`);
      expect(bad.status).toBe(400);
      expect(bad.body.error.code).toBe("VALIDATION_ERROR");
      expect(bad.body.error.fields.statusGroup).toBeDefined();

      // Both must match.
      const resolved = await agent.get(`${url}?status=RESOLVED&statusGroup=active`);
      expect(resolved.body.totalItems).toBe(0);
      const open = await agent.get(`${url}?status=OPEN&statusGroup=active`);
      const openOnly = await agent.get(`${url}?status=OPEN`);
      expect(open.body.totalItems).toBe(openOnly.body.totalItems);

      // Without statusGroup, finished Tickets are still counted.
      expect(all.status).toBe(200);
      expect(all.body.totalItems).toBeGreaterThan(active.body.totalItems);
    }

    // Lab 3 Ticket Queue parameters give the same results as before.
    expect((await agents.priya.get("/api/staff/tickets?status=OPEN")).body.totalItems).toBe(3);
    expect((await agents.priya.get("/api/staff/tickets?ownerId=unassigned")).body.totalItems).toBe(
      await prisma.ticket.count({ where: { ownerId: null } })
    );
    expect((await agents.priya.get("/api/staff/tickets?unknown=1")).status).toBe(400);
  });
});
