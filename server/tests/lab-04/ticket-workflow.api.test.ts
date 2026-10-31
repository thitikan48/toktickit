import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { TICKET_STATUSES, canTransition } from "../../src/rules.js";

// Uses the seeded accounts. Every Ticket here is created by the test with
// MARK in its summary and deleted in afterAll (its actions and history go
// with it), so the seeded Tickets are not changed.
const PASSWORD = "ChangeMe123";
const MARK = "[lab4-workflow]";

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
let categoryId = 0;
let relatedSystemId = 0;
let counter = 0;

// Michael must change his initial password in the seed. The flag is cleared
// for these tests and put back afterwards.
const notReady = ["michael.brown@example.com"];
const originalFlags: Record<string, boolean> = {};

beforeAll(async () => {
  for (const email of notReady) {
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    originalFlags[email] = user.mustChangePassword;
    await prisma.user.update({ where: { email }, data: { mustChangePassword: false } });
  }

  const emails = {
    priya: "priya.nair@example.com",
    elena: "elena.rossi@example.com",
    admin: "admin@example.com",
    jennifer: "jennifer.anderson@example.com",
    michael: "michael.brown@example.com",
  };

  for (const [key, email] of Object.entries(emails)) {
    ids[key] = (await prisma.user.findUniqueOrThrow({ where: { email } })).id;
    agents[key] = await loginAs(email);
  }

  categoryId = (await prisma.category.findFirstOrThrow()).id;
  relatedSystemId = (await prisma.relatedSystem.findFirstOrThrow()).id;
});

afterAll(async () => {
  // Put the accounts back first, so they are restored even if the cleanup fails.
  for (const email of notReady) {
    if (originalFlags[email] !== undefined) {
      await prisma.user.update({
        where: { email },
        data: { mustChangePassword: originalFlags[email] },
      });
    }
  }

  await prisma.ticket.deleteMany({ where: { summary: { startsWith: MARK } } });
});

type Status = (typeof TICKET_STATUSES)[number];

// A Ticket of Michael's, owned by Priya unless `owner` says otherwise.
async function makeTicket(status: Status, owner: number | null = ids.priya) {
  counter += 1;
  return prisma.ticket.create({
    data: {
      ticketNumber: `TKT-2099-${String(Date.now()).slice(-6)}${counter}`,
      requesterId: ids.michael,
      categoryId,
      relatedSystemId,
      summary: `${MARK} Workflow test ${counter}`,
      description: "A Ticket made by the workflow tests.",
      requestedPriority: "MEDIUM",
      itPriority: "MEDIUM",
      currentStatus: status,
      ownerId: owner,
    },
  });
}

async function addAction(ticketId: number, status: "PLANNED" | "IN_PROGRESS" | "COMPLETED") {
  const res = await agents.priya.post(`/api/staff/tickets/${ticketId}/actions`).send({
    actionAt: new Date().toISOString(),
    description: `${MARK} Check the device.`,
    status,
  });
  expect(res.status).toBe(201);
  return res.body;
}

async function versionOf(ticketId: number): Promise<number> {
  const res = await agents.priya.get(`/api/staff/tickets/${ticketId}`);
  expect(res.status).toBe(200);
  return res.body.version;
}

const statusUrl = (ticketId: number) => `/api/staff/tickets/${ticketId}/status`;

async function changeStatus(ticketId: number, status: Status, agent = agents.priya) {
  return agent
    .post(statusUrl(ticketId))
    .send({ status, confirm: true, expectedVersion: await versionOf(ticketId) });
}

const historyCount = (ticketId: number) =>
  prisma.ticketStatusHistory.count({ where: { ticketId } });

const GATE_MESSAGE = "Complete or cancel all open actions before resolving or closing.";
const STALE_MESSAGE = "This ticket was changed by someone else. Reload to see the latest version.";

describe("unit", () => {
  // Loaded inside the test so the API tests still run before the rule exists.
  const rules = () => import("../../src/rules.js");

  it("UNIT-03 allows only the section 5.4 pairs, and the gate blocks only with an open action", async () => {
    const { blockedByOpenActions } = await rules();

    const allowed: Record<Status, Status[]> = {
      NEW: ["OPEN", "IN_PROGRESS", "CANCELLED"],
      OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
      IN_PROGRESS: ["OPEN", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
      WAITING_FOR_REQUESTER: ["OPEN", "IN_PROGRESS", "RESOLVED", "CANCELLED"],
      RESOLVED: ["CLOSED", "REOPENED"],
      CLOSED: ["REOPENED"],
      REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
      CANCELLED: [],
    };

    for (const from of TICKET_STATUSES) {
      for (const to of TICKET_STATUSES) {
        expect(canTransition(from, to)).toBe(allowed[from].includes(to));
      }
    }

    const open = ["COMPLETED", "PLANNED"];
    const inProgress = ["IN_PROGRESS"];
    const finished = ["COMPLETED", "CANCELLED"];

    for (const [from, to] of [["OPEN", "RESOLVED"], ["REOPENED", "RESOLVED"], ["RESOLVED", "CLOSED"]] as const) {
      expect(blockedByOpenActions(from, to, [])).toBe(false);
      expect(blockedByOpenActions(from, to, open)).toBe(true);
      expect(blockedByOpenActions(from, to, inProgress)).toBe(true);
      expect(blockedByOpenActions(from, to, finished)).toBe(false);
    }

    // Other changes are never gated.
    expect(blockedByOpenActions("OPEN", "CANCELLED", open)).toBe(false);
    expect(blockedByOpenActions("RESOLVED", "REOPENED", open)).toBe(false);
    expect(blockedByOpenActions("CLOSED", "REOPENED", open)).toBe(false);
  });
});

describe("Ticket workflow", () => {
  it("FLOW-01 allows only the section 5.4 pairs, needs an owner except for Cancelled, and needs confirmation", async () => {
    const ticket = await makeTicket("NEW");

    for (const from of TICKET_STATUSES) {
      for (const to of TICKET_STATUSES) {
        await prisma.ticket.update({
          where: { id: ticket.id },
          data: { currentStatus: from, ownerId: ids.priya },
        });

        const res = await changeStatus(ticket.id, to);
        expect(res.status, `${from} to ${to}`).toBe(canTransition(from, to) ? 200 : 409);
        if (res.status === 409) expect(res.body.error.code).toBe("CONFLICT");
      }
    }

    // No owner: only Cancelled works.
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { currentStatus: "OPEN", ownerId: null },
    });
    const noOwner = await changeStatus(ticket.id, "IN_PROGRESS");
    expect(noOwner.status).toBe(409);
    expect(noOwner.body.error.code).toBe("CONFLICT");
    expect((await changeStatus(ticket.id, "CANCELLED")).status).toBe(200);

    // No confirmation for Resolved, Closed, and Cancelled.
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { currentStatus: "OPEN", ownerId: ids.priya },
    });
    for (const status of ["RESOLVED", "CANCELLED"] as const) {
      const res = await agents.priya
        .post(statusUrl(ticket.id))
        .send({ status, expectedVersion: await versionOf(ticket.id) });
      expect(res.status).toBe(400);
      expect(res.body.error.fields.confirm).toBeDefined();
    }
  });

  it("FLOW-02 blocks Resolved while a Planned action exists, then allows it; a Ticket with zero actions resolves and closes", async () => {
    const ticket = await makeTicket("IN_PROGRESS");
    const planned = await addAction(ticket.id, "PLANNED");
    const version = await versionOf(ticket.id);

    const blocked = await changeStatus(ticket.id, "RESOLVED");
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toEqual({ code: "OPEN_ACTIONS_EXIST", message: GATE_MESSAGE });

    const unchanged = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(unchanged.currentStatus).toBe("IN_PROGRESS");
    expect(unchanged.resolvedAt).toBeNull();
    expect(unchanged.version).toBe(version);
    expect(await historyCount(ticket.id)).toBe(0);

    const done = await agents.priya
      .patch(`/api/staff/tickets/${ticket.id}/actions/${planned.id}`)
      .send({ status: "COMPLETED" });
    expect(done.status).toBe(200);

    const resolved = await changeStatus(ticket.id, "RESOLVED");
    expect(resolved.status).toBe(200);
    expect(resolved.body.currentStatus).toBe("RESOLVED");

    const empty = await makeTicket("OPEN");
    expect((await changeStatus(empty.id, "RESOLVED")).status).toBe(200);
    expect((await changeStatus(empty.id, "CLOSED")).status).toBe(200);
  });

  it("FLOW-03 blocks Resolved to Closed while a Planned action exists, then allows it after the action is cancelled", async () => {
    const ticket = await makeTicket("RESOLVED");
    const planned = await addAction(ticket.id, "PLANNED");

    const blocked = await changeStatus(ticket.id, "CLOSED");
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe("OPEN_ACTIONS_EXIST");
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).currentStatus).toBe(
      "RESOLVED"
    );

    const cancelled = await agents.priya
      .patch(`/api/staff/tickets/${ticket.id}/actions/${planned.id}`)
      .send({ status: "CANCELLED" });
    expect(cancelled.status).toBe(200);

    const closed = await changeStatus(ticket.id, "CLOSED");
    expect(closed.status).toBe(200);
    expect(closed.body.currentStatus).toBe("CLOSED");
  });

  it("FLOW-04 sets resolvedAt on Resolved, keeps it on Closed, and clears it on Reopened", async () => {
    const ticket = await makeTicket("IN_PROGRESS");

    const resolved = await changeStatus(ticket.id, "RESOLVED");
    expect(resolved.status).toBe(200);
    expect(resolved.body.resolvedAt).toEqual(expect.any(String));
    const resolvedAt = resolved.body.resolvedAt;

    const closed = await changeStatus(ticket.id, "CLOSED");
    expect(closed.status).toBe(200);
    expect(closed.body.resolvedAt).toBe(resolvedAt);

    // Both Ticket Details show it.
    expect((await agents.priya.get(`/api/staff/tickets/${ticket.id}`)).body.resolvedAt).toBe(resolvedAt);
    expect((await agents.michael.get(`/api/tickets/${ticket.id}`)).body.resolvedAt).toBe(resolvedAt);

    const reopened = await changeStatus(ticket.id, "REOPENED");
    expect(reopened.status).toBe(200);
    expect(reopened.body.resolvedAt).toBeNull();
  });

  it("FLOW-05 writes one history row per successful change, shows it to staff and the owner, and has no edit or delete", async () => {
    const ticket = await makeTicket("NEW");

    expect((await changeStatus(ticket.id, "OPEN")).status).toBe(200);
    expect((await changeStatus(ticket.id, "IN_PROGRESS", agents.admin)).status).toBe(200);
    expect((await changeStatus(ticket.id, "CLOSED")).status).toBe(409); // rejected
    expect((await changeStatus(ticket.id, "WAITING_FOR_REQUESTER")).status).toBe(200);

    const staff = await agents.priya.get(`/api/staff/tickets/${ticket.id}/history`);
    expect(staff.status).toBe(200);
    expect(staff.body.items).toHaveLength(3);
    expect(
      staff.body.items.map((row: { fromStatus: string; toStatus: string; changedBy: { name: string; role: string } }) => [
        row.fromStatus,
        row.toStatus,
        row.changedBy.name,
        row.changedBy.role,
      ])
    ).toEqual([
      ["NEW", "OPEN", "Priya Nair", "IT_STAFF"],
      ["OPEN", "IN_PROGRESS", "Admin User", "ADMIN"],
      ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "Priya Nair", "IT_STAFF"],
    ]);
    for (const row of staff.body.items) {
      expect(row.changedAt).toEqual(expect.any(String));
    }

    const owner = await agents.michael.get(`/api/tickets/${ticket.id}/history`);
    expect(owner.status).toBe(200);
    expect(owner.body.items).toEqual(staff.body.items);

    expect((await agents.jennifer.get(`/api/tickets/${ticket.id}/history`)).status).toBe(404);
    expect((await agents.michael.get(`/api/staff/tickets/${ticket.id}/history`)).status).toBe(403);
    expect((await agents.priya.get(`/api/tickets/${ticket.id}/history`)).status).toBe(403);
    expect((await request(app).get(`/api/staff/tickets/${ticket.id}/history`)).status).toBe(401);
    expect((await agents.priya.get(`/api/staff/tickets/999999/history`)).status).toBe(404);

    // No edit or delete routes.
    const rowId = staff.body.items[0].id;
    expect((await agents.admin.patch(`/api/staff/tickets/${ticket.id}/history/${rowId}`).send({ toStatus: "CLOSED" })).status).toBe(404);
    expect((await agents.admin.delete(`/api/staff/tickets/${ticket.id}/history/${rowId}`)).status).toBe(404);
    expect(await historyCount(ticket.id)).toBe(3);

    // A Ticket with no changes has an empty history.
    const quiet = await makeTicket("NEW");
    expect((await agents.priya.get(`/api/staff/tickets/${quiet.id}/history`)).body).toEqual({ items: [] });
  });

  it("FLOW-06 a Requester cannot change status, and Problem Appears Resolved only sets the flag", async () => {
    const ticket = await makeTicket("IN_PROGRESS");
    const version = await versionOf(ticket.id);

    const res = await agents.michael
      .post(statusUrl(ticket.id))
      .send({ status: "RESOLVED", confirm: true, expectedVersion: version });
    expect(res.status).toBe(403);

    const flag = await agents.michael.post(`/api/tickets/${ticket.id}/appears-resolved`).send({});
    expect(flag.status).toBe(200);

    const after = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(after.requesterMarkedResolved).toBe(true);
    expect(after.currentStatus).toBe("IN_PROGRESS");
    expect(after.version).toBe(version);
    expect(await historyCount(ticket.id)).toBe(0);
  });

  it("FLOW-07 detects stale updates, needs expectedVersion, and is not changed by comments or actions", async () => {
    const ticket = await makeTicket("OPEN");
    const version = await versionOf(ticket.id);
    expect(version).toBe(0);

    // Two users read the same version and both save.
    const first = await agents.priya
      .patch(`/api/staff/tickets/${ticket.id}`)
      .send({ itPriority: "HIGH", expectedVersion: version });
    expect(first.status).toBe(200);
    expect(first.body.version).toBe(version + 1);
    expect(first.body.itPriority).toBe("HIGH");

    const second = await agents.elena
      .patch(`/api/staff/tickets/${ticket.id}`)
      .send({ itPriority: "LOW", ownerId: ids.elena, expectedVersion: version });
    expect(second.status).toBe(409);
    expect(second.body).toEqual({ error: { code: "STALE_UPDATE", message: STALE_MESSAGE } });

    let saved = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(saved.itPriority).toBe("HIGH");
    expect(saved.ownerId).toBe(ids.priya);
    expect(saved.version).toBe(version + 1);

    // A status change with the old version.
    const oldStatus = await agents.elena
      .post(statusUrl(ticket.id))
      .send({ status: "IN_PROGRESS", expectedVersion: version });
    expect(oldStatus.status).toBe(409);
    expect(oldStatus.body).toEqual({ error: { code: "STALE_UPDATE", message: STALE_MESSAGE } });
    saved = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(saved.currentStatus).toBe("OPEN");
    expect(await historyCount(ticket.id)).toBe(0);

    // No expectedVersion.
    const noVersionPatch = await agents.priya
      .patch(`/api/staff/tickets/${ticket.id}`)
      .send({ itPriority: "LOW" });
    expect(noVersionPatch.status).toBe(400);
    expect(noVersionPatch.body.error.fields.expectedVersion).toBeDefined();

    const noVersionStatus = await agents.priya
      .post(statusUrl(ticket.id))
      .send({ status: "IN_PROGRESS" });
    expect(noVersionStatus.status).toBe(400);
    expect(noVersionStatus.body.error.fields.expectedVersion).toBeDefined();

    // A status change with the current version increases it by 1.
    const moved = await agents.priya
      .post(statusUrl(ticket.id))
      .send({ status: "IN_PROGRESS", expectedVersion: version + 1 });
    expect(moved.status).toBe(200);
    expect(moved.body.version).toBe(version + 2);

    // A comment and an action between two reads do not change the version.
    const before = await versionOf(ticket.id);
    expect(
      (await agents.priya.post(`/api/tickets/${ticket.id}/comments`).send({ body: `${MARK} A comment.` })).status
    ).toBe(201);
    await addAction(ticket.id, "COMPLETED");
    expect(await versionOf(ticket.id)).toBe(before);
  });
});
