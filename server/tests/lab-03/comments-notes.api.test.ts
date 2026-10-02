import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

// Uses the accounts and tickets created by `npm run prisma:seed`.
// Jennifer's seeded tickets: 900002 (Open, owned by Priya, has a Public
// Comment and an Internal Note) and 900013 (Resolved).
const PASSWORD = "ChangeMe123";

const prisma = getPrisma();

type Agent = ReturnType<typeof request.agent>;

async function loginAs(email: string): Promise<Agent> {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/login").send({ email, password: PASSWORD });
  expect(res.status).toBe(200);
  return agent;
}

let jennifer: Agent;
let priya: Agent;
let openTicket: { id: number; requesterMarkedResolved: boolean };
let resolvedTicket: { id: number };
let othersTicket: { id: number };

const createdCommentIds: number[] = [];

async function ticketByNumber(number: string) {
  return prisma.ticket.findUniqueOrThrow({
    where: { ticketNumber: number },
    select: { id: true, requesterMarkedResolved: true },
  });
}

beforeAll(async () => {
  jennifer = await loginAs("jennifer.anderson@example.com");
  priya = await loginAs("priya.nair@example.com");

  openTicket = await ticketByNumber("TKT-2026-900002");
  resolvedTicket = await ticketByNumber("TKT-2026-900013");
  othersTicket = await ticketByNumber("TKT-2026-900003"); // Michael's
});

afterAll(async () => {
  // Removes the comments created through the API and puts the flag that the
  // tests set back to its seeded value.
  await prisma.ticketComment.deleteMany({ where: { id: { in: createdCommentIds } } });
  await prisma.ticket.update({
    where: { id: openTicket.id },
    data: { requesterMarkedResolved: openTicket.requesterMarkedResolved },
  });
});

describe("Public Comments", () => {
  it("lets a Requester read the comments of an own ticket, oldest first, with the author", async () => {
    const res = await jennifer.get(`/api/tickets/${openTicket.id}/comments`);

    expect(res.status).toBe(200);
    expect(res.body.items[0]).toMatchObject({
      body: "Please try turning the printer off and on again.",
      author: { name: "Priya Nair", role: "IT_STAFF" },
    });
  });

  it("answers 404 for the comments of another Requester's ticket", async () => {
    const notOwned = await jennifer.get(`/api/tickets/${othersTicket.id}/comments`);
    const missing = await jennifer.get("/api/tickets/999999999/comments");

    expect(notOwned.status).toBe(404);
    expect(notOwned.body).toEqual(missing.body);
  });

  it("saves a Requester's comment with the author and time set by the server", async () => {
    const res = await jennifer
      .post(`/api/tickets/${openTicket.id}/comments`)
      .send({ body: "  Thank you, trying that now.  ", authorId: 1, createdAt: "2000-01-01" });

    expect(res.status).toBe(201);
    createdCommentIds.push(res.body.id);

    expect(res.body.body).toBe("Thank you, trying that now."); // trimmed
    expect(res.body.author).toMatchObject({ name: "Jennifer Anderson", role: "REQUESTER" });
    expect(new Date(res.body.createdAt).getFullYear()).toBeGreaterThan(2000);

    const list = await jennifer.get(`/api/tickets/${openTicket.id}/comments`);
    expect(list.body.items.at(-1).id).toBe(res.body.id);
  });

  it("rejects empty and over-long comments and accepts exactly 2000 characters", async () => {
    for (const body of ["", "   ", "x".repeat(2001)]) {
      const res = await jennifer
        .post(`/api/tickets/${openTicket.id}/comments`)
        .send({ body });

      expect(res.status).toBe(400);
      expect(res.body.error.fields.body).toBeDefined();
    }

    const ok = await jennifer
      .post(`/api/tickets/${openTicket.id}/comments`)
      .send({ body: "x".repeat(2000) });

    expect(ok.status).toBe(201);
    createdCommentIds.push(ok.body.id);
  });

  it("does not let a Requester comment on another Requester's ticket", async () => {
    const res = await jennifer
      .post(`/api/tickets/${othersTicket.id}/comments`)
      .send({ body: "Not my ticket" });

    expect(res.status).toBe(404);
    expect(await prisma.ticketComment.count({ where: { body: "Not my ticket" } })).toBe(0);
  });

  it("lets IT Staff read and post on any ticket, and the Requester sees the reply", async () => {
    const read = await priya.get(`/api/tickets/${othersTicket.id}/comments`);
    expect(read.status).toBe(200);

    const post = await priya
      .post(`/api/tickets/${openTicket.id}/comments`)
      .send({ body: "We will check the printer tomorrow." });

    expect(post.status).toBe(201);
    createdCommentIds.push(post.body.id);
    expect(post.body.author).toMatchObject({ name: "Priya Nair", role: "IT_STAFF" });

    const seenByRequester = await jennifer.get(`/api/tickets/${openTicket.id}/comments`);
    expect(
      seenByRequester.body.items.some(
        (comment: { id: number }) => comment.id === post.body.id
      )
    ).toBe(true);
  });

  it("offers no way to edit or delete a comment", async () => {
    const id = createdCommentIds[0];

    for (const method of ["put", "patch", "delete"] as const) {
      const res = await jennifer[method](`/api/tickets/${openTicket.id}/comments/${id}`);
      expect(res.status).toBe(404);
    }
  });

  it("requires a session", async () => {
    expect((await request(app).get(`/api/tickets/${openTicket.id}/comments`)).status).toBe(401);
    expect(
      (await request(app).post(`/api/tickets/${openTicket.id}/comments`).send({ body: "hi" })).status
    ).toBe(401);
  });
});

describe("Internal Notes stay hidden from the Requester", () => {
  it("never returns the Internal Note text from any Requester response", async () => {
    // Ticket 900002 has the Internal Note "Sensor may need cleaning if it happens again."
    const note = await prisma.ticketInternalNote.findFirstOrThrow({
      where: { ticketId: openTicket.id },
    });

    const responses = [
      await jennifer.get(`/api/tickets/${openTicket.id}`),
      await jennifer.get(`/api/tickets/${openTicket.id}/comments`),
      await jennifer.get("/api/tickets?pageSize=100"),
    ];

    for (const res of responses) {
      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).not.toContain(note.body);
      expect(JSON.stringify(res.body)).not.toMatch(/internalNote/i);
    }
  });
});

describe("POST /api/tickets/:id/appears-resolved", () => {
  it("sets the flag on an open own ticket without changing its status", async () => {
    const res = await jennifer.post(`/api/tickets/${openTicket.id}/appears-resolved`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: openTicket.id,
      requesterMarkedResolved: true,
      currentStatus: "OPEN",
    });

    // Repeating it is harmless.
    const again = await jennifer.post(`/api/tickets/${openTicket.id}/appears-resolved`);
    expect(again.status).toBe(200);

    const detail = await jennifer.get(`/api/tickets/${openTicket.id}`);
    expect(detail.body.requesterMarkedResolved).toBe(true);
    expect(detail.body.currentStatus).toBe("OPEN");
  });

  it("answers 409 for a ticket that is already resolved", async () => {
    const res = await jennifer.post(`/api/tickets/${resolvedTicket.id}/appears-resolved`);

    expect(res.status).toBe(409);
  });

  it("answers 404 for another Requester's ticket and does not change it", async () => {
    const res = await jennifer.post(`/api/tickets/${othersTicket.id}/appears-resolved`);
    expect(res.status).toBe(404);

    const record = await prisma.ticket.findUniqueOrThrow({ where: { id: othersTicket.id } });
    expect(record.requesterMarkedResolved).toBe(false);
  });

  it("is not available to IT Staff", async () => {
    const res = await priya.post(`/api/tickets/${openTicket.id}/appears-resolved`);

    expect(res.status).toBe(403);
  });

  it("requires a session", async () => {
    expect(
      (await request(app).post(`/api/tickets/${openTicket.id}/appears-resolved`)).status
    ).toBe(401);
  });
});

describe("Ticket status", () => {
  it("cannot be changed by a Requester through the ticket endpoints", async () => {
    const res = await jennifer
      .post(`/api/tickets/${openTicket.id}/comments`)
      .send({ body: "Please close this", currentStatus: "CLOSED" });

    expect(res.status).toBe(201);
    createdCommentIds.push(res.body.id);

    const record = await prisma.ticket.findUniqueOrThrow({ where: { id: openTicket.id } });
    expect(record.currentStatus).toBe("OPEN");
  });
});

describe("Internal Notes", () => {
  const createdNoteIds: number[] = [];

  afterAll(async () => {
    await prisma.ticketInternalNote.deleteMany({ where: { id: { in: createdNoteIds } } });
  });

  it("lets IT Staff and Administrators read the notes of any ticket", async () => {
    const res = await priya.get(`/api/tickets/${openTicket.id}/internal-notes`);

    expect(res.status).toBe(200);
    expect(res.body.items[0]).toMatchObject({
      body: "Sensor may need cleaning if it happens again.",
      author: { name: "Priya Nair", role: "IT_STAFF" },
    });

    const admin = await loginAs("admin@example.com");
    expect((await admin.get(`/api/tickets/${othersTicket.id}/internal-notes`)).status).toBe(200);
  });

  it("saves a note with the author set by the server and validates its length", async () => {
    const res = await priya
      .post(`/api/tickets/${openTicket.id}/internal-notes`)
      .send({ body: "  Checked the printer logs.  ", authorId: 1 });

    expect(res.status).toBe(201);
    createdNoteIds.push(res.body.id);
    expect(res.body.body).toBe("Checked the printer logs.");
    expect(res.body.author).toMatchObject({ name: "Priya Nair", role: "IT_STAFF" });

    for (const body of ["", "   ", "x".repeat(2001)]) {
      const bad = await priya
        .post(`/api/tickets/${openTicket.id}/internal-notes`)
        .send({ body });
      expect(bad.status).toBe(400);
    }

    const ok = await priya
      .post(`/api/tickets/${openTicket.id}/internal-notes`)
      .send({ body: "x".repeat(2000) });
    expect(ok.status).toBe(201);
    createdNoteIds.push(ok.body.id);

    expect(
      (await priya.post("/api/tickets/999999999/internal-notes").send({ body: "hi" })).status
    ).toBe(404);
  });

  it("rejects a Requester with 403 and returns no note content", async () => {
    const read = await jennifer.get(`/api/tickets/${openTicket.id}/internal-notes`);
    expect(read.status).toBe(403);
    expect(JSON.stringify(read.body)).not.toContain("Sensor may need cleaning");

    const write = await jennifer
      .post(`/api/tickets/${openTicket.id}/internal-notes`)
      .send({ body: "I should not be able to write this" });
    expect(write.status).toBe(403);
    expect(
      await prisma.ticketInternalNote.count({
        where: { body: "I should not be able to write this" },
      })
    ).toBe(0);

    // Also for another Requester's ticket: still 403, not 404.
    expect((await jennifer.get(`/api/tickets/${othersTicket.id}/internal-notes`)).status).toBe(403);
  });

  it("does not show a note in the Public Comments", async () => {
    const publicComments = await jennifer.get(`/api/tickets/${openTicket.id}/comments`);

    expect(JSON.stringify(publicComments.body)).not.toContain("Checked the printer logs.");
  });

  it("requires a session", async () => {
    expect(
      (await request(app).get(`/api/tickets/${openTicket.id}/internal-notes`)).status
    ).toBe(401);
  });
});
