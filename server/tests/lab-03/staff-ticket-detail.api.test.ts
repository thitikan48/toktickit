import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

// Uses the accounts and tickets created by `npm run prisma:seed`.
// Ticket 900001 (New, unassigned, Jennifer's) is the working ticket. The
// tests change it, so its original state is put back in afterAll.
const PASSWORD = "ChangeMe123";

const prisma = getPrisma();

type Agent = ReturnType<typeof request.agent>;

async function loginAs(email: string): Promise<Agent> {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/login").send({ email, password: PASSWORD });
  expect(res.status).toBe(200);
  return agent;
}

let priya: Agent;
let elena: Agent;
let admin: Agent;
let jennifer: Agent;

let ticketId: number;
let original: {
  ownerId: number | null;
  itPriority: "LOW" | "MEDIUM" | "HIGH";
  currentStatus: "NEW";
  requesterMarkedResolved: boolean;
};

const ids: Record<string, number> = {};

beforeAll(async () => {
  priya = await loginAs("priya.nair@example.com");
  elena = await loginAs("elena.rossi@example.com");
  admin = await loginAs("admin@example.com");
  jennifer = await loginAs("jennifer.anderson@example.com");

  for (const [key, email] of Object.entries({
    priya: "priya.nair@example.com",
    elena: "elena.rossi@example.com",
    admin: "admin@example.com",
    tom: "tom.baker@example.com", // inactive IT Staff
    jennifer: "jennifer.anderson@example.com", // a Requester
  })) {
    ids[key] = (await prisma.user.findUniqueOrThrow({ where: { email } })).id;
  }

  const ticket = await prisma.ticket.findUniqueOrThrow({
    where: { ticketNumber: "TKT-2026-900001" },
  });
  ticketId = ticket.id;
  original = {
    ownerId: ticket.ownerId,
    itPriority: ticket.itPriority,
    currentStatus: ticket.currentStatus as "NEW",
    requesterMarkedResolved: ticket.requesterMarkedResolved,
  };
});

afterAll(async () => {
  await prisma.ticket.update({ where: { id: ticketId }, data: original });
});

const staff = (id = ticketId) => `/api/staff/tickets/${id}`;

describe("Staff Ticket Detail", () => {
  it("returns the ticket with the requester, category, system, and owner", async () => {
    const res = await priya.get(staff());

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: ticketId,
      ticketNumber: "TKT-2026-900001",
      requester: { name: "Jennifer Anderson", email: "jennifer.anderson@example.com" },
      category: { name: "Network" },
      relatedSystem: { name: "Campus Wi-Fi" },
      requestedPriority: "MEDIUM",
      itPriority: "MEDIUM",
      owner: null,
    });
  });

  it("answers 404 for an unknown ticket and is not available to a Requester", async () => {
    expect((await priya.get(staff(999999999))).status).toBe(404);
    expect((await jennifer.get(staff())).status).toBe(403);
    expect((await request(app).get(staff())).status).toBe(401);
  });

  it("lets IT Staff and Administrators list and download any ticket's files", async () => {
    const attachment = await prisma.attachment.findFirstOrThrow({
      where: { isRemoved: false, ticket: { requesterId: { not: ids.jennifer } } },
    });

    for (const agent of [priya, admin]) {
      const list = await agent.get(`/api/tickets/${attachment.ticketId}/attachments`);
      expect(list.status).toBe(200);
      expect(list.body.some((a: { id: number }) => a.id === attachment.id)).toBe(true);

      const download = await agent.get(`/api/attachments/${attachment.id}/download`);
      expect([401, 403, 404]).not.toContain(download.status);
    }
  });
});

describe("Owner", () => {
  it("claims an unassigned ticket by assigning it to yourself", async () => {
    const res = await priya.patch(staff()).send({ ownerId: ids.priya });

    expect(res.status).toBe(200);
    expect(res.body.owner).toEqual({ id: ids.priya, name: "Priya Nair" });
  });

  it("reassigns to another active IT Staff or Administrator and unassigns", async () => {
    const toElena = await priya.patch(staff()).send({ ownerId: ids.elena });
    expect(toElena.body.owner.id).toBe(ids.elena);

    const toAdmin = await elena.patch(staff()).send({ ownerId: ids.admin });
    expect(toAdmin.status).toBe(200);
    expect(toAdmin.body.owner.id).toBe(ids.admin);

    const none = await priya.patch(staff()).send({ ownerId: null });
    expect(none.status).toBe(200);
    expect(none.body.owner).toBeNull();
  });

  it("rejects an inactive user, a Requester, and an unknown user as owner", async () => {
    for (const ownerId of [ids.tom, ids.jennifer, 999999]) {
      const res = await priya.patch(staff()).send({ ownerId });
      expect(res.status).toBe(409);
    }

    const record = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
    expect(record.ownerId).toBeNull();
  });

  it("rejects an empty or invalid body", async () => {
    expect((await priya.patch(staff()).send({})).status).toBe(400);
    expect((await priya.patch(staff()).send({ ownerId: "abc" })).status).toBe(400);
  });
});

describe("IT Priority", () => {
  it("changes IT Priority without changing the Requested Priority", async () => {
    const res = await priya.patch(staff()).send({ itPriority: "HIGH" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ itPriority: "HIGH", requestedPriority: "MEDIUM" });
  });

  it("rejects an invalid priority and does not allow a Requester to change it", async () => {
    expect((await priya.patch(staff()).send({ itPriority: "URGENT" })).status).toBe(400);
    expect((await jennifer.patch(staff()).send({ itPriority: "LOW" })).status).toBe(403);

    const record = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
    expect(record.itPriority).toBe("HIGH");
  });
});

describe("Status workflow", () => {
  const change = (agent: Agent, status: string, confirm?: boolean) =>
    agent.post(`${staff()}/status`).send({ status, confirm });

  it("needs an owner before the status changes", async () => {
    const res = await change(priya, "OPEN");

    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/owner/i);
  });

  it("follows the permitted transitions and rejects the others", async () => {
    await priya.patch(staff()).send({ ownerId: ids.priya });

    const before = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });

    const open = await change(priya, "OPEN");
    expect(open.status).toBe(200);
    expect(open.body.currentStatus).toBe("OPEN");
    expect(new Date(open.body.updatedAt).getTime()).toBeGreaterThan(before.updatedAt.getTime());

    // Not allowed: the same status, a jump to Closed, and back to New.
    expect((await change(priya, "OPEN")).status).toBe(409);
    expect((await change(priya, "CLOSED", true)).status).toBe(409);
    expect((await change(priya, "NEW")).status).toBe(409);

    expect((await change(priya, "WAITING_FOR_REQUESTER")).status).toBe(200);
    expect((await change(priya, "IN_PROGRESS")).status).toBe(200);
  });

  it("rejects an unknown status", async () => {
    expect((await change(priya, "DONE")).status).toBe(400);
  });

  it("asks for confirmation to resolve, close, or cancel", async () => {
    for (const status of ["RESOLVED", "CLOSED", "CANCELLED"]) {
      const res = await change(priya, status);

      expect(res.status).toBe(400);
      expect(res.body.error.fields.confirm).toBeDefined();
    }

    const record = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
    expect(record.currentStatus).toBe("IN_PROGRESS");
  });

  it("resolves, closes, and reopens, and a reopen clears the Requester's flag", async () => {
    // The Requester says the problem appears resolved (ticket is In Progress).
    const flagged = await jennifer.post(`/api/tickets/${ticketId}/appears-resolved`);
    expect(flagged.status).toBe(200);

    const detail = await priya.get(staff());
    expect(detail.body.requesterMarkedResolved).toBe(true);

    expect((await change(priya, "RESOLVED", true)).body.currentStatus).toBe("RESOLVED");
    expect((await change(priya, "CLOSED", true)).body.currentStatus).toBe("CLOSED");

    // Nothing is allowed from a closed ticket except reopening.
    expect((await change(priya, "OPEN")).status).toBe(409);

    const reopened = await change(priya, "REOPENED");
    expect(reopened.status).toBe(200);

    const after = await priya.get(staff());
    expect(after.body.currentStatus).toBe("REOPENED");
    expect(after.body.requesterMarkedResolved).toBe(false);
  });

  it("does not allow any change out of Cancelled", async () => {
    const cancelled = await prisma.ticket.findUniqueOrThrow({
      where: { ticketNumber: "TKT-2026-900010" },
    });

    const res = await priya
      .post(`/api/staff/tickets/${cancelled.id}/status`)
      .send({ status: "OPEN" });

    expect(res.status).toBe(409);
  });

  it("is allowed for an Administrator and not for a Requester", async () => {
    expect((await change(admin, "WAITING_FOR_REQUESTER")).status).toBe(200);
    expect((await change(jennifer, "CLOSED", true)).status).toBe(403);

    const record = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
    expect(record.currentStatus).toBe("WAITING_FOR_REQUESTER");
  });
});

describe("Assignees", () => {
  it("lists active IT Staff and Administrators only", async () => {
    const res = await priya.get("/api/staff/assignees");

    expect(res.status).toBe(200);

    const names = res.body.items.map((person: { name: string }) => person.name);
    expect(names).toEqual(expect.arrayContaining(["Priya Nair", "Elena Rossi", "Admin User"]));
    expect(names).not.toContain("Tom Baker"); // inactive
    expect(names).not.toContain("Jennifer Anderson"); // a Requester
    expect(
      res.body.items.every((person: { role: string }) => person.role !== "REQUESTER")
    ).toBe(true);

    expect((await jennifer.get("/api/staff/assignees")).status).toBe(403);
  });
});
