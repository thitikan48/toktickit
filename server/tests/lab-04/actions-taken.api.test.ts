import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

// Uses the seeded accounts and Tickets on the test database. Every action
// created here starts with MARK and is deleted in afterAll.
const PASSWORD = "ChangeMe123";
const MARK = "[lab4-test]";

const prisma = getPrisma();

type Agent = ReturnType<typeof request.agent>;

async function loginAs(email: string): Promise<Agent> {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/login").send({ email, password: PASSWORD });
  expect(res.status).toBe(200);
  return agent;
}

const ids: Record<string, number> = {};
const tickets: Record<string, number> = {};
const agents: Record<string, Agent> = {};

// Marcus and Michael must change their initial password in the seed. The
// tests need them logged in, so the flag is cleared here and put back later.
const notReady = ["marcus.chen@example.com", "michael.brown@example.com"];
const originalFlags: Record<string, boolean> = {};

beforeAll(async () => {
  for (const email of notReady) {
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    originalFlags[email] = user.mustChangePassword;
    await prisma.user.update({ where: { email }, data: { mustChangePassword: false } });
  }

  for (const [key, email] of Object.entries({
    priya: "priya.nair@example.com",
    marcus: "marcus.chen@example.com",
    elena: "elena.rossi@example.com",
    admin: "admin@example.com",
    tom: "tom.baker@example.com", // inactive IT Staff
    jennifer: "jennifer.anderson@example.com",
    michael: "michael.brown@example.com",
  })) {
    ids[key] = (await prisma.user.findUniqueOrThrow({ where: { email } })).id;
  }

  for (const key of ["priya", "marcus", "elena", "admin", "jennifer", "michael"]) {
    agents[key] = await loginAs(
      (await prisma.user.findUniqueOrThrow({ where: { id: ids[key] } })).email
    );
  }

  for (const number of ["900002", "900003", "900007", "900013"]) {
    tickets[number] = (
      await prisma.ticket.findUniqueOrThrow({ where: { ticketNumber: `TKT-2026-${number}` } })
    ).id;
  }
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

  await prisma.actionTaken.deleteMany({ where: { description: { startsWith: MARK } } });
});

const staffActions = (ticketId: number) => `/api/staff/tickets/${ticketId}/actions`;

function validAction(extra: Record<string, unknown> = {}) {
  return {
    actionAt: new Date().toISOString(),
    description: `${MARK} Checked the device.`,
    ...extra,
  };
}

async function createAction(agent: Agent, ticketId: number, extra: Record<string, unknown> = {}) {
  const res = await agent.post(staffActions(ticketId)).send(validAction(extra));
  expect(res.status).toBe(201);
  return res.body;
}

describe("unit", () => {
  // Loaded inside the tests so the API tests still run before the module exists.
  const rules = () => import("../../src/action-rules.js");
  const STATUSES = ["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

  it("UNIT-01 allows only the BR-07 status changes and first statuses", async () => {
    const { canChangeActionStatus, isStartStatus } = await rules();

    const allowed = [
      "PLANNED>IN_PROGRESS",
      "PLANNED>COMPLETED",
      "PLANNED>CANCELLED",
      "IN_PROGRESS>COMPLETED",
      "IN_PROGRESS>CANCELLED",
    ];

    for (const from of STATUSES) {
      for (const to of STATUSES) {
        expect(canChangeActionStatus(from, to)).toBe(allowed.includes(`${from}>${to}`));
      }
    }

    expect(isStartStatus("PLANNED")).toBe(true);
    expect(isStartStatus("IN_PROGRESS")).toBe(true);
    expect(isStartStatus("COMPLETED")).toBe(true);
    expect(isStartStatus("CANCELLED")).toBe(false);
  });

  it("UNIT-02 checks description, Attachment Notes, and the follow-up note", async () => {
    const { checkActionFields } = await rules();
    const base = { actionAt: "2026-11-03T03:00:00.000Z" };

    expect(checkActionFields({ ...base, description: "" }, null).fields).toHaveProperty("description");
    expect(checkActionFields({ ...base, description: "x" }, null).fields).toEqual({});
    expect(checkActionFields({ ...base, description: "x".repeat(1000) }, null).fields).toEqual({});
    expect(checkActionFields({ ...base, description: "x".repeat(1001) }, null).fields).toHaveProperty("description");

    expect(
      checkActionFields({ ...base, description: "x", attachmentNotes: "a".repeat(500) }, null).fields
    ).toEqual({});
    expect(
      checkActionFields({ ...base, description: "x", attachmentNotes: "a".repeat(501) }, null).fields
    ).toHaveProperty("attachmentNotes");

    expect(
      checkActionFields({ ...base, description: "x", followUpRequired: true }, null).fields
    ).toHaveProperty("followUpNote");
    expect(
      checkActionFields(
        { ...base, description: "x", followUpRequired: true, followUpNote: "Check again." },
        null
      ).fields
    ).toEqual({});

    // When follow-up is not required, the note is saved as empty.
    expect(
      checkActionFields({ ...base, description: "x", followUpNote: "ignored" }, null).data.followUpNote
    ).toBeNull();
  });
});

describe("Actions Taken API", () => {
  it("API-01 creates a valid action under the Ticket with the caller as creator and assignee", async () => {
    const res = await agents.priya.post(staffActions(tickets["900002"])).send(
      validAction({
        description: `${MARK} Created by Priya.`,
        createdById: ids.admin,
        updatedById: ids.admin,
        performedById: ids.admin,
      })
    );

    expect(res.status).toBe(201);
    expect(res.body.ticketId).toBe(tickets["900002"]);
    expect(res.body.status).toBe("PLANNED");
    expect(res.body.assignedTo.id).toBe(ids.priya);
    expect(res.body.createdBy.id).toBe(ids.priya);
    expect(res.body.updatedBy.id).toBe(ids.priya);
    expect(res.body.performedBy).toBeNull();

    const saved = await prisma.actionTaken.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(saved.ticketId).toBe(tickets["900002"]);
  });

  it("API-02 assigns an action to a staff member who is not the Ticket Owner", async () => {
    const before = await prisma.ticket.findUniqueOrThrow({ where: { id: tickets["900007"] } });

    const action = await createAction(agents.priya, tickets["900007"], {
      assignedToId: ids.marcus,
    });

    expect(action.assignedTo.id).toBe(ids.marcus);

    const after = await prisma.ticket.findUniqueOrThrow({ where: { id: tickets["900007"] } });
    expect(after.ownerId).toBe(before.ownerId);
    expect(after.ownerId).toBe(ids.elena);
  });

  it("API-03 rejects missing and invalid fields together and saves nothing", async () => {
    const count = await prisma.actionTaken.count();

    const res = await agents.priya.post(staffActions(tickets["900002"])).send({
      description: "   ",
      result: "r".repeat(1001),
      followUpRequired: true,
      attachmentNotes: "a".repeat(501),
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(Object.keys(res.body.error.fields).sort()).toEqual(
      ["actionAt", "attachmentNotes", "description", "followUpNote", "result"].sort()
    );
    expect(await prisma.actionTaken.count()).toBe(count);
  });

  it("API-04 rejects an inactive, Requester, or unknown assignee on create and reassign", async () => {
    for (const assignedToId of [ids.tom, ids.jennifer, 999999]) {
      const res = await agents.priya
        .post(staffActions(tickets["900002"]))
        .send(validAction({ assignedToId }));
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("CONFLICT");
    }

    const action = await createAction(agents.priya, tickets["900002"]);

    for (const assignedToId of [ids.tom, ids.jennifer, 999999]) {
      const res = await agents.priya
        .patch(`${staffActions(tickets["900002"])}/${action.id}`)
        .send({ assignedToId });
      expect(res.status).toBe(409);
    }

    const saved = await prisma.actionTaken.findUniqueOrThrow({ where: { id: action.id } });
    expect(saved.assignedToId).toBe(ids.priya);
  });

  it("API-05 edits an open action and validates the edit", async () => {
    const action = await createAction(agents.priya, tickets["900002"]);
    const url = `${staffActions(tickets["900002"])}/${action.id}`;

    const res = await agents.priya.patch(url).send({
      description: `${MARK} Edited description.`,
      result: "Partly fixed.",
      followUpRequired: true,
      followUpNote: "Check again on Monday.",
    });

    expect(res.status).toBe(200);
    expect(res.body.description).toBe(`${MARK} Edited description.`);
    expect(res.body.result).toBe("Partly fixed.");
    expect(res.body.followUpRequired).toBe(true);
    expect(res.body.followUpNote).toBe("Check again on Monday.");

    const empty = await agents.priya.patch(url).send({ description: "  " });
    expect(empty.status).toBe(400);
    expect(empty.body.error.fields).toHaveProperty("description");
  });

  it("API-06 allows every BR-07 status change", async () => {
    const url = (id: number) => `${staffActions(tickets["900002"])}/${id}`;

    const a = await createAction(agents.priya, tickets["900002"]);
    for (const status of ["IN_PROGRESS", "COMPLETED"]) {
      const res = await agents.priya.patch(url(a.id)).send({ status });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe(status);
    }

    const b = await createAction(agents.priya, tickets["900002"]);
    expect((await agents.priya.patch(url(b.id)).send({ status: "COMPLETED" })).status).toBe(200);

    const c = await createAction(agents.priya, tickets["900002"]);
    expect((await agents.priya.patch(url(c.id)).send({ status: "CANCELLED" })).status).toBe(200);

    const d = await createAction(agents.priya, tickets["900002"], { status: "IN_PROGRESS" });
    expect((await agents.priya.patch(url(d.id)).send({ status: "CANCELLED" })).status).toBe(200);

    const e = await createAction(agents.priya, tickets["900002"], {
      status: "COMPLETED",
      result: "Done at once.",
    });
    expect(e.status).toBe("COMPLETED");
  });

  it("API-07 rejects other status changes and any change to a final action; there is no delete", async () => {
    const url = (id: number) => `${staffActions(tickets["900002"])}/${id}`;

    const inProgress = await createAction(agents.priya, tickets["900002"], { status: "IN_PROGRESS" });
    expect((await agents.priya.patch(url(inProgress.id)).send({ status: "PLANNED" })).status).toBe(409);
    expect((await agents.priya.patch(url(inProgress.id)).send({ status: "IN_PROGRESS" })).status).toBe(409);

    const completed = await createAction(agents.priya, tickets["900002"], { status: "COMPLETED" });
    const editCompleted = await agents.priya.patch(url(completed.id)).send({ description: `${MARK} x` });
    expect(editCompleted.status).toBe(409);
    expect(editCompleted.body.error.code).toBe("CONFLICT");

    const cancelled = await createAction(agents.priya, tickets["900002"]);
    expect((await agents.priya.patch(url(cancelled.id)).send({ status: "CANCELLED" })).status).toBe(200);
    expect((await agents.priya.patch(url(cancelled.id)).send({ status: "COMPLETED" })).status).toBe(409);

    expect((await agents.priya.delete(url(cancelled.id))).status).toBe(404);

    const list = await agents.priya.get(staffActions(tickets["900002"]));
    const listed = list.body.items.map((item: { id: number }) => item.id);
    expect(listed).toContain(cancelled.id);
  });

  it("API-08 sets Performed By to the user who completes the action", async () => {
    const action = await createAction(agents.priya, tickets["900002"], {
      assignedToId: ids.marcus,
    });
    expect(action.performedBy).toBeNull();

    const res = await agents.marcus
      .patch(`${staffActions(tickets["900002"])}/${action.id}`)
      .send({ status: "COMPLETED", performedById: ids.priya });

    expect(res.status).toBe(200);
    expect(res.body.performedBy.id).toBe(ids.marcus);
    expect(res.body.updatedBy.id).toBe(ids.marcus);
  });

  it("API-09 lists actions by Action Date/Time and then id, with assignee and performer", async () => {
    const sameTime = "2026-11-01T01:00:00.000Z";
    const first = await createAction(agents.elena, tickets["900013"], { actionAt: sameTime });
    const second = await createAction(agents.elena, tickets["900013"], { actionAt: sameTime });

    const res = await agents.elena.get(staffActions(tickets["900013"]));
    expect(res.status).toBe(200);

    const items: { id: number; actionAt: string }[] = res.body.items;
    for (let i = 1; i < items.length; i++) {
      const a = items[i - 1];
      const b = items[i];
      const ordered = a.actionAt < b.actionAt || (a.actionAt === b.actionAt && a.id < b.id);
      expect(ordered).toBe(true);
    }

    const ours = items.map((item) => item.id);
    expect(ours.indexOf(first.id)).toBeLessThan(ours.indexOf(second.id));
    expect(res.body.items[0]).toHaveProperty("assignedTo");
    expect(res.body.items[0]).toHaveProperty("performedBy");
  });
});

describe("Actions Taken authorization", () => {
  it("AUTHZ-01 lets the owning Requester read all fields; another Requester gets 404", async () => {
    const res = await agents.michael.get(`/api/tickets/${tickets["900003"]}/actions`);

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThanOrEqual(3);
    for (const key of [
      "actionAt",
      "description",
      "result",
      "status",
      "assignedTo",
      "performedBy",
      "followUpRequired",
      "followUpNote",
      "attachmentNotes",
    ]) {
      expect(res.body.items[0]).toHaveProperty(key);
    }

    const other = await agents.jennifer.get(`/api/tickets/${tickets["900003"]}/actions`);
    expect(other.status).toBe(404);
  });

  it("AUTHZ-02 blocks Requester writes, staff on the Requester route, and no session", async () => {
    const action = await createAction(agents.priya, tickets["900002"]);

    expect((await agents.jennifer.post(staffActions(tickets["900002"])).send(validAction())).status).toBe(403);
    expect(
      (await agents.jennifer
        .patch(`${staffActions(tickets["900002"])}/${action.id}`)
        .send({ status: "CANCELLED" })).status
    ).toBe(403);
    expect((await agents.priya.get(`/api/tickets/${tickets["900002"]}/actions`)).status).toBe(403);
    expect((await request(app).get(staffActions(tickets["900002"]))).status).toBe(401);
  });

  it("AUTHZ-03 lets an Administrator create and update an action", async () => {
    const created = await agents.admin.post(staffActions(tickets["900002"])).send(validAction());
    expect(created.status).toBe(201);

    const updated = await agents.admin
      .patch(`${staffActions(tickets["900002"])}/${created.body.id}`)
      .send({ status: "IN_PROGRESS" });
    expect(updated.status).toBe(200);
  });
});
