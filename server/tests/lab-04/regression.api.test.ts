import { unlink } from "fs/promises";
import path from "path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

// REG-07 makes the database fail on purpose. While `db.fail` is true, the
// Ticket, action, and history tables throw; users still work, so login and
// the session check keep working and each Lab 4 route must answer by itself.
const db = vi.hoisted(() => ({ fail: false }));

vi.mock("../../src/prisma.js", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../src/prisma.js")>();
  const FAILING = ["ticket", "actionTaken", "ticketStatusHistory"];

  return {
    ...real,
    getPrisma: () => {
      const client = real.getPrisma();
      if (!db.fail) return client;

      return new Proxy(client, {
        get(target, property, receiver) {
          if (typeof property === "string" && FAILING.includes(property)) {
            return new Proxy({}, {
              get: () => () => Promise.reject(new Error("forced database error: secret detail")),
            });
          }
          if (property === "$transaction") {
            return () => Promise.reject(new Error("forced database error: secret detail"));
          }
          return Reflect.get(target, property, receiver);
        },
      });
    },
  };
});

// Labs 1 to 3 features, with login, on the test database. Everything made
// here starts with MARK and is removed in afterAll; changed accounts are put back.
const PASSWORD = "ChangeMe123";
const MARK = "[lab4-regression]";

const prisma = getPrisma();

type Agent = ReturnType<typeof request.agent>;

async function loginAs(email: string, password = PASSWORD): Promise<Agent> {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/login").send({ email, password });
  expect(res.status, email).toBe(200);
  return agent;
}

const ids: Record<string, number> = {};
const agents: Record<string, Agent> = {};
let validTicket: Record<string, unknown> = {};

// Michael must change his password in the seed; REG-01 does that and puts
// his password and flag back afterwards.
let michaelBefore: { passwordHash: string; mustChangePassword: boolean } | null = null;

beforeAll(async () => {
  michaelBefore = await prisma.user.findUniqueOrThrow({
    where: { email: "michael.brown@example.com" },
    select: { passwordHash: true, mustChangePassword: true },
  });

  for (const [key, email] of Object.entries({
    jennifer: "jennifer.anderson@example.com",
    priya: "priya.nair@example.com",
    admin: "admin@example.com",
    sarah: "sarah.johnson@example.com",
  })) {
    ids[key] = (await prisma.user.findUniqueOrThrow({ where: { email } })).id;
    if (key !== "sarah") agents[key] = await loginAs(email);
  }

  const category = await prisma.category.findFirstOrThrow({ where: { name: "Hardware" } });
  const system = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } });
  validTicket = {
    categoryId: category.id,
    relatedSystemId: system.id,
    requestedPriority: "MEDIUM",
    description: "The monitor flickers every few minutes.",
  };
}, 60_000);

afterAll(async () => {
  db.fail = false;

  if (michaelBefore) {
    await prisma.user.update({ where: { email: "michael.brown@example.com" }, data: michaelBefore });
  }

  const files = await prisma.attachment.findMany({
    where: { ticket: { summary: { startsWith: MARK } } },
    select: { storedName: true },
  });
  await Promise.all(
    files.map((file) =>
      unlink(path.resolve(process.cwd(), "uploads", file.storedName)).catch(() => undefined)
    )
  );
  await prisma.ticket.deleteMany({ where: { summary: { startsWith: MARK } } });
  await prisma.user.deleteMany({ where: { name: { startsWith: MARK } } });
});

async function createTicket(summary: string) {
  const res = await agents.jennifer
    .post("/api/tickets")
    .send({ ...validTicket, summary: `${MARK} ${summary}` });
  expect(res.status).toBe(201);
  return res.body;
}

describe("Labs 1 to 3 regression", () => {
  it("REG-01 logs in each role, forces the first password change, and logs out", async () => {
    for (const [key, role] of [
      ["jennifer", "REQUESTER"],
      ["priya", "IT_STAFF"],
      ["admin", "ADMIN"],
    ] as const) {
      const me = await agents[key].get("/api/auth/me");
      expect(me.status).toBe(200);
      expect(me.body.user).toMatchObject({ id: ids[key], role, mustChangePassword: false });
      expect(me.body.user.passwordHash).toBeUndefined();
    }

    // Michael must choose a new password before anything else.
    const michael = request.agent(app);
    const login = await michael
      .post("/api/auth/login")
      .send({ email: "michael.brown@example.com", password: PASSWORD });
    expect(login.status).toBe(200);
    expect(login.body.user.mustChangePassword).toBe(true);

    const blocked = await michael.get("/api/tickets");
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");

    const changed = await michael
      .post("/api/auth/change-password")
      .send({ currentPassword: PASSWORD, newPassword: "Sunrise2026" });
    expect(changed.status).toBe(200);
    expect((await michael.get("/api/tickets")).status).toBe(200);

    // Logout removes access.
    expect((await michael.post("/api/auth/logout")).status).toBeLessThan(300);
    expect((await michael.get("/api/tickets")).status).toBe(401);
  });

  it("REG-02 keeps health, categories, related systems, Create Ticket, My Tickets, and Ticket ownership as before", async () => {
    const health = await request(app).get("/api/health");
    expect(health.status).toBe(200);

    const categories = await agents.jennifer.get("/api/categories");
    expect(categories.status).toBe(200);
    expect(categories.body.map((c: { name: string }) => c.name)).toEqual([
      "Account and Access",
      "Hardware",
      "Software",
      "Network",
    ]);

    const systems = await agents.jennifer.get("/api/related-systems");
    expect(systems.status).toBe(200);
    expect(systems.body.length).toBeGreaterThan(0);

    const ticket = await createTicket("Monitor flickers");
    expect(ticket.ticketNumber).toMatch(/^TKT-\d{4}-\d{6}$/);
    expect(ticket.currentStatus).toBe("NEW");

    const invalid = await agents.jennifer.post("/api/tickets").send({ summary: "x" });
    expect(invalid.status).toBe(400);
    expect(Object.keys(invalid.body.error.fields)).toEqual(
      expect.arrayContaining(["summary", "description", "requestedPriority", "categoryId", "relatedSystemId"])
    );

    // My Tickets: search, status filter, and only my own Tickets.
    const search = await agents.jennifer.get(`/api/tickets?search=${encodeURIComponent(MARK)}`);
    expect(search.body.items.map((t: { id: number }) => t.id)).toEqual([ticket.id]);
    const byStatus = await agents.jennifer.get("/api/tickets?status=NEW");
    for (const item of byStatus.body.items) {
      expect(item.currentStatus).toBe("NEW");
      expect(item.requesterId).toBe(ids.jennifer);
    }

    // Another Requester's Ticket answers like a missing one.
    const other = await prisma.ticket.findFirstOrThrow({ where: { requesterId: ids.sarah } });
    expect((await agents.jennifer.get(`/api/tickets/${other.id}`)).status).toBe(404);
    expect((await agents.jennifer.get(`/api/tickets/${ticket.id}`)).status).toBe(200);
  });

  it("REG-03 keeps the attachment type and size limits, download, and removal (410 afterwards)", async () => {
    const ticket = await createTicket("Attachment check");
    const upload = (buffer: Buffer, file = { filename: "evidence.png", contentType: "image/png" }) =>
      agents.jennifer.post(`/api/tickets/${ticket.id}/attachments`).attach("file", buffer, file);

    const ok = await upload(Buffer.from("png bytes"));
    expect(ok.status).toBe(201);
    expect((await upload(Buffer.from("text"), { filename: "notes.txt", contentType: "text/plain" })).status).toBe(415);
    expect((await upload(Buffer.alloc(5_242_881, 1))).status).toBe(413);

    expect((await agents.jennifer.get(`/api/attachments/${ok.body.id}/download`)).status).toBe(200);

    const removed = await agents.jennifer
      .delete(`/api/attachments/${ok.body.id}`)
      .send({ removalReason: "Uploaded by mistake" });
    expect(removed.status).toBe(200);
    expect(removed.body).toMatchObject({ isRemoved: true, removalReason: "Uploaded by mistake" });
    expect((await agents.jennifer.get(`/api/attachments/${ok.body.id}/download`)).status).toBe(410);
  });

  it("REG-04 keeps Public Comments for everyone and Internal Notes for staff only", async () => {
    const ticket = await createTicket("Comments check");

    const fromRequester = await agents.jennifer
      .post(`/api/tickets/${ticket.id}/comments`)
      .send({ body: "It happens after lunch." });
    expect(fromRequester.status).toBe(201);
    const fromStaff = await agents.priya
      .post(`/api/tickets/${ticket.id}/comments`)
      .send({ body: "Please check the cable." });
    expect(fromStaff.status).toBe(201);

    for (const agent of [agents.jennifer, agents.priya, agents.admin]) {
      const list = await agent.get(`/api/tickets/${ticket.id}/comments`);
      expect(list.status).toBe(200);
      expect(list.body.items).toHaveLength(2);
    }

    const note = await agents.priya
      .post(`/api/tickets/${ticket.id}/internal-notes`)
      .send({ body: "Staff only: cable is old." });
    expect(note.status).toBe(201);
    expect((await agents.admin.get(`/api/tickets/${ticket.id}/internal-notes`)).body.items).toHaveLength(1);

    expect((await agents.jennifer.get(`/api/tickets/${ticket.id}/internal-notes`)).status).toBe(403);
    expect(
      (await agents.jennifer.post(`/api/tickets/${ticket.id}/internal-notes`).send({ body: "Hi" })).status
    ).toBe(403);
  });

  it("REG-05 keeps the Ticket Queue filters, and owner and IT Priority updates work with expectedVersion", async () => {
    const open = await agents.priya.get("/api/staff/tickets?status=OPEN");
    expect(open.status).toBe(200);
    for (const item of open.body.items) expect(item.currentStatus).toBe("OPEN");

    const unassigned = await agents.priya.get("/api/staff/tickets?ownerId=unassigned");
    for (const item of unassigned.body.items) expect(item.owner).toBeNull();

    const high = await agents.priya.get("/api/staff/tickets?itPriority=HIGH&sort=updatedAt&direction=desc");
    expect(high.status).toBe(200);
    for (const item of high.body.items) expect(item.itPriority).toBe("HIGH");

    expect((await agents.priya.get("/api/staff/tickets?sort=bad")).status).toBe(400);

    const ticket = await createTicket("Queue check");
    const version = (await agents.priya.get(`/api/staff/tickets/${ticket.id}`)).body.version;
    const claimed = await agents.priya
      .patch(`/api/staff/tickets/${ticket.id}`)
      .send({ ownerId: ids.priya, itPriority: "HIGH", expectedVersion: version });
    expect(claimed.status).toBe(200);
    expect(claimed.body).toMatchObject({
      owner: { id: ids.priya, name: "Priya Nair" },
      itPriority: "HIGH",
      requestedPriority: "MEDIUM",
      version: version + 1,
    });
  });

  it("REG-06 keeps User Management: create, edit, and the last Administrator rule", async () => {
    const email = `regression.${Date.now()}@example.test`;
    const created = await agents.admin.post("/api/admin/users").send({
      name: `${MARK} Test Person`,
      email,
      role: "REQUESTER",
      isActive: true,
      initialPassword: "Initial2026",
    });
    expect(created.status).toBe(201);
    expect(created.body.passwordHash).toBeUndefined();

    const duplicate = await agents.admin.post("/api/admin/users").send({
      name: `${MARK} Again`,
      email,
      role: "REQUESTER",
      isActive: true,
      initialPassword: "Initial2026",
    });
    expect(duplicate.status).toBe(409);

    const edited = await agents.admin
      .patch(`/api/admin/users/${created.body.id}`)
      .send({ role: "IT_STAFF" });
    expect(edited.status).toBe(200);
    expect(edited.body.role).toBe("IT_STAFF");

    const list = await agents.admin.get("/api/admin/users");
    expect(list.status).toBe(200);
    expect((await agents.priya.get("/api/admin/users")).status).toBe(403);

    const lastAdmin = await agents.admin.patch(`/api/admin/users/${ids.admin}`).send({ role: "IT_STAFF" });
    expect(lastAdmin.status).toBe(409);
    expect(lastAdmin.body.error.message).toMatch(/administrator/i);
  });

  it("REG-07 answers a database error on every Lab 4 endpoint with 500 SERVER_ERROR and a generic message", async () => {
    const ticketId = (await prisma.ticket.findFirstOrThrow({ where: { ticketNumber: "TKT-2026-900002" } })).id;
    const actionId = (await prisma.actionTaken.findFirstOrThrow({ where: { ticketId } })).id;

    const calls: [string, () => request.Test][] = [
      ["GET staff actions", () => agents.priya.get(`/api/staff/tickets/${ticketId}/actions`)],
      [
        "POST staff action",
        () =>
          agents.priya
            .post(`/api/staff/tickets/${ticketId}/actions`)
            .send({ actionAt: new Date().toISOString(), description: `${MARK} x` }),
      ],
      [
        "PATCH staff action",
        () => agents.priya.patch(`/api/staff/tickets/${ticketId}/actions/${actionId}`).send({ result: "x" }),
      ],
      ["GET requester actions", () => agents.jennifer.get(`/api/tickets/${ticketId}/actions`)],
      ["GET staff history", () => agents.priya.get(`/api/staff/tickets/${ticketId}/history`)],
      ["GET requester history", () => agents.jennifer.get(`/api/tickets/${ticketId}/history`)],
      ["GET requester dashboard", () => agents.jennifer.get("/api/dashboard/requester")],
      ["GET staff dashboard", () => agents.priya.get("/api/staff/dashboard")],
      [
        "PATCH staff ticket",
        () => agents.priya.patch(`/api/staff/tickets/${ticketId}`).send({ itPriority: "LOW", expectedVersion: 0 }),
      ],
      [
        "POST status",
        () =>
          agents.priya
            .post(`/api/staff/tickets/${ticketId}/status`)
            .send({ status: "IN_PROGRESS", expectedVersion: 0 }),
      ],
      ["GET staff ticket", () => agents.priya.get(`/api/staff/tickets/${ticketId}`)],
      ["GET My Tickets with statusGroup", () => agents.jennifer.get("/api/tickets?statusGroup=active")],
      ["GET Ticket Queue with statusGroup", () => agents.priya.get("/api/staff/tickets?statusGroup=active")],
    ];

    db.fail = true;
    try {
      for (const [name, call] of calls) {
        const res = await call();
        expect(res.status, name).toBe(500);
        expect(res.body.error.code, name).toBe("SERVER_ERROR");
        expect(JSON.stringify(res.body), name).not.toMatch(/forced|secret|prisma|stack|select/i);
      }
    } finally {
      db.fail = false;
    }
  });

  it("REG-08 runs on the toktickit_test database, never the development one", async () => {
    expect(process.env.DATABASE_URL).toMatch(/\/toktickit_test(\?|$)/);

    const rows = await prisma.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
    expect(rows[0].name).toBe("toktickit_test");
  });
});
