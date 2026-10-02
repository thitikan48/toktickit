import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

// Read-only tests on the tickets created by `npm run prisma:seed`.
const PASSWORD = "ChangeMe123";

const prisma = getPrisma();

type Agent = ReturnType<typeof request.agent>;

async function loginAs(email: string): Promise<Agent> {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/login").send({ email, password: PASSWORD });
  expect(res.status).toBe(200);
  return agent;
}

interface QueueItem {
  id: number;
  ticketNumber: string;
  summary: string;
  itPriority: string;
  currentStatus: string;
  createdAt: string;
  category: { id: number };
  requester: { id: number; name: string };
  owner: { id: number; name: string } | null;
}

let priya: Agent;
let admin: Agent;
let jennifer: Agent;
let priyaId: number;

beforeAll(async () => {
  priya = await loginAs("priya.nair@example.com");
  admin = await loginAs("admin@example.com");
  jennifer = await loginAs("jennifer.anderson@example.com");
  priyaId = (
    await prisma.user.findUniqueOrThrow({ where: { email: "priya.nair@example.com" } })
  ).id;
});

const queue = (agent: Agent, query = "") => agent.get(`/api/staff/tickets${query}`);

describe("Ticket Queue", () => {
  it("shows tickets of every Requester with pagination details", async () => {
    const res = await queue(priya);

    expect(res.status).toBe(200);

    const total = await prisma.ticket.count();
    expect(res.body.totalItems).toBe(total);
    expect(res.body.pageSize).toBe(10);
    expect(res.body.totalPages).toBe(Math.ceil(total / 10));
    expect(res.body.page).toBe(1);
    expect(res.body.items).toHaveLength(Math.min(10, total));

    const requesters = new Set(res.body.items.map((item: QueueItem) => item.requester.id));
    expect(requesters.size).toBeGreaterThan(1);

    expect(res.body.items[0]).toEqual(
      expect.objectContaining({
        ticketNumber: expect.any(String),
        summary: expect.any(String),
        itPriority: expect.any(String),
        currentStatus: expect.any(String),
        category: expect.objectContaining({ name: expect.any(String) }),
        requester: expect.objectContaining({ name: expect.any(String) }),
      })
    );
  });

  it("is also available to an Administrator", async () => {
    expect((await queue(admin)).status).toBe(200);
  });

  it("orders by IT Priority (high first) and then oldest first by default", async () => {
    const res = await queue(priya, "?page=1");
    const rank: Record<string, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };
    const items: QueueItem[] = res.body.items;

    for (let i = 1; i < items.length; i++) {
      const before = items[i - 1];
      const after = items[i];

      expect(rank[after.itPriority]).toBeLessThanOrEqual(rank[before.itPriority]);

      if (before.itPriority === after.itPriority) {
        expect(new Date(after.createdAt).getTime()).toBeGreaterThanOrEqual(
          new Date(before.createdAt).getTime()
        );
      }
    }
  });

  it("pages through the results and returns an empty page beyond the end", async () => {
    const first = await queue(priya, "?page=1");
    const second = await queue(priya, "?page=2");

    expect(second.status).toBe(200);
    expect(second.body.page).toBe(2);

    const firstIds = first.body.items.map((item: QueueItem) => item.id);
    for (const item of second.body.items as QueueItem[]) {
      expect(firstIds).not.toContain(item.id);
    }

    const beyond = await queue(priya, "?page=9999");
    expect(beyond.status).toBe(200);
    expect(beyond.body.items).toEqual([]);
  });

  it("searches by ticket number, summary, and requester name", async () => {
    const byNumber = await queue(priya, "?search=900002");
    expect(byNumber.body.items.map((i: QueueItem) => i.ticketNumber)).toEqual([
      "TKT-2026-900002",
    ]);

    const bySummary = await queue(priya, "?search=PAPER%20JAM");
    expect(bySummary.body.items.length).toBeGreaterThan(0);
    for (const item of bySummary.body.items as QueueItem[]) {
      expect(item.summary.toLowerCase()).toContain("paper jam");
    }

    const byRequester = await queue(priya, "?search=michael");
    expect(byRequester.body.items.length).toBeGreaterThan(0);
    for (const item of byRequester.body.items as QueueItem[]) {
      expect(item.requester.name).toBe("Michael Brown");
    }

    expect((await queue(priya, "?search=nothing-matches-this-zzz")).body.items).toEqual([]);
  });

  it("filters by status, IT Priority, category, and owner", async () => {
    const byStatus = await queue(priya, "?status=IN_PROGRESS");
    expect(byStatus.body.items.length).toBeGreaterThan(0);
    expect(byStatus.body.items.every((i: QueueItem) => i.currentStatus === "IN_PROGRESS")).toBe(true);

    const byPriority = await queue(priya, "?itPriority=HIGH");
    expect(byPriority.body.items.every((i: QueueItem) => i.itPriority === "HIGH")).toBe(true);

    const category = await prisma.category.findFirstOrThrow({ where: { name: "Network" } });
    const byCategory = await queue(priya, `?categoryId=${category.id}`);
    expect(byCategory.body.items.length).toBeGreaterThan(0);
    expect(byCategory.body.items.every((i: QueueItem) => i.category.id === category.id)).toBe(true);

    const unassigned = await queue(priya, "?ownerId=unassigned");
    expect(unassigned.body.items.length).toBeGreaterThan(0);
    expect(unassigned.body.items.every((i: QueueItem) => i.owner === null)).toBe(true);

    const mine = await queue(priya, `?ownerId=${priyaId}`);
    expect(mine.body.items.length).toBeGreaterThan(0);
    expect(mine.body.items.every((i: QueueItem) => i.owner?.id === priyaId)).toBe(true);
  });

  it("combines filters and reports the matching total", async () => {
    const res = await queue(priya, "?ownerId=unassigned&status=NEW&itPriority=HIGH");

    const expected = await prisma.ticket.count({
      where: { ownerId: null, currentStatus: "NEW", itPriority: "HIGH" },
    });

    expect(res.status).toBe(200);
    expect(res.body.totalItems).toBe(expected);
  });

  it("sorts by the requested field and direction", async () => {
    const newest = await queue(priya, "?sort=createdAt&direction=desc");
    const oldest = await queue(priya, "?sort=createdAt&direction=asc");

    const times = (res: { body: { items: QueueItem[] } }) =>
      res.body.items.map((i) => new Date(i.createdAt).getTime());

    expect(times(newest)).toEqual([...times(newest)].sort((a, b) => b - a));
    expect(times(oldest)).toEqual([...times(oldest)].sort((a, b) => a - b));

    const updated = await queue(priya, "?sort=updatedAt&direction=desc");
    expect(updated.status).toBe(200);
  });

  it("rejects invalid or unknown query values with 400", async () => {
    for (const query of [
      "?page=0",
      "?page=abc",
      "?sort=ticketNumber",
      "?direction=sideways",
      "?status=BAD",
      "?itPriority=URGENT",
      "?categoryId=abc",
      "?ownerId=abc",
      "?pageSize=7",
    ]) {
      const res = await queue(priya, query);

      expect(res.status, query).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.fields).toBeDefined();
    }
  });

  it("is not available to a Requester or without a session", async () => {
    expect((await queue(jennifer)).status).toBe(403);
    expect((await request(app).get("/api/staff/tickets")).status).toBe(401);
  });
});
