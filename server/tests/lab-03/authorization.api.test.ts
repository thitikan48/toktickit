import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

// Uses the accounts created by `npm run prisma:seed`; no users are created.
const PASSWORD = "ChangeMe123";

const prisma = getPrisma();

let jennifer: { id: number };
let michael: { id: number };
let jenniferAgent: ReturnType<typeof request.agent>;

const createdTicketIds: number[] = [];

beforeAll(async () => {
  // Reads the seeded accounts.
  jennifer = await prisma.user.findUniqueOrThrow({
    where: { email: "jennifer.anderson@example.com" },
  });
  michael = await prisma.user.findUniqueOrThrow({
    where: { email: "michael.brown@example.com" },
  });

  jenniferAgent = request.agent(app);
  const res = await jenniferAgent
    .post("/api/auth/login")
    .send({ email: "jennifer.anderson@example.com", password: PASSWORD });
  expect(res.status).toBe(200);
});

afterAll(async () => {
  // Removes the tickets that the tests below created through the API.
  await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds } } });
});

const validTicket = {
  categoryId: 2,
  relatedSystemId: 7,
  summary: "Authorization test ticket",
  description: "Ticket created by the Lab 3 authorization tests.",
  requestedPriority: "HIGH",
};

describe("Requester identity comes from the session", () => {
  it("ignores a client-supplied requesterId when creating a ticket", async () => {
    const res = await jenniferAgent
      .post("/api/tickets")
      .send({ ...validTicket, requesterId: michael.id });

    expect(res.status).toBe(201);
    createdTicketIds.push(res.body.id);

    expect(res.body.requesterId).toBe(jennifer.id);
    expect(res.body.itPriority).toBe("HIGH");
    expect(res.body.ownerId).toBeNull();
  });

  it("ignores a client-supplied requesterId when listing tickets", async () => {
    const res = await jenniferAgent.get(
      `/api/tickets?requesterId=${michael.id}&pageSize=100`
    );

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(
      res.body.items.every(
        (ticket: { requesterId: number }) => ticket.requesterId === jennifer.id
      )
    ).toBe(true);
  });

  it("rejects a request without a session", async () => {
    const res = await request(app).post("/api/tickets").send(validTicket);

    expect(res.status).toBe(401);
  });
});

describe("Lab 2 selector endpoint", () => {
  it("removes GET /api/development-requesters", async () => {
    const res = await jenniferAgent.get("/api/development-requesters");

    expect(res.status).toBe(404);
  });
});

describe("Responses never expose password data", () => {
  it("does not return a password or hash from tickets or the current user", async () => {
    const tickets = await jenniferAgent.get("/api/tickets");
    const me = await jenniferAgent.get("/api/auth/me");

    for (const body of [tickets.body, me.body]) {
      expect(JSON.stringify(body)).not.toMatch(/"passwordHash"|"password"\s*:/);
    }

    const record = await prisma.user.findUniqueOrThrow({
      where: { id: jennifer.id },
    });
    expect(record.passwordHash).not.toBe(PASSWORD);
  });
});

describe("Another Requester's ticket and files answer like a missing one", () => {
  const MISSING = 999999999;

  async function ticketOf(email: string) {
    // Reads a seeded ticket that belongs to someone else.
    return prisma.ticket.findFirstOrThrow({
      where: { requester: { email } },
      select: { id: true },
    });
  }

  it("returns 404 for ticket detail, identical to a ticket that does not exist", async () => {
    const other = await ticketOf("michael.brown@example.com");

    const notOwned = await jenniferAgent.get(`/api/tickets/${other.id}`);
    const missing = await jenniferAgent.get(`/api/tickets/${MISSING}`);

    expect(notOwned.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(notOwned.body).toEqual(missing.body);
  });

  it("returns 404 for the attachment list and for uploading to it", async () => {
    const other = await ticketOf("michael.brown@example.com");

    const list = await jenniferAgent.get(`/api/tickets/${other.id}/attachments`);
    expect(list.status).toBe(404);

    const upload = await jenniferAgent
      .post(`/api/tickets/${other.id}/attachments`)
      .attach("file", Buffer.from("not really a png"), {
        filename: "x.png",
        contentType: "image/png",
      });
    expect(upload.status).toBe(404);

    // Nothing was added to the other Requester's ticket.
    expect(await prisma.attachment.count({ where: { ticketId: other.id } })).toBe(0);
  });

  it("returns 404 for downloading or removing another Requester's attachment", async () => {
    const attachment = await prisma.attachment.findFirstOrThrow({
      where: { isRemoved: false, ticket: { requesterId: { not: jennifer.id } } },
    });

    const download = await jenniferAgent.get(
      `/api/attachments/${attachment.id}/download`
    );
    expect(download.status).toBe(404);

    const remove = await jenniferAgent
      .delete(`/api/attachments/${attachment.id}`)
      .send({ removalReason: "Trying to remove someone else's file" });
    expect(remove.status).toBe(404);

    const after = await prisma.attachment.findUniqueOrThrow({
      where: { id: attachment.id },
    });
    expect(after.isRemoved).toBe(false);
  });
});

describe("Ticket endpoints are for Requesters only", () => {
  const STAFF_AND_ADMIN = [
    "priya.nair@example.com",
    "admin@example.com",
  ];

  async function agentFor(email: string) {
    const agent = request.agent(app);
    const res = await agent.post("/api/auth/login").send({ email, password: PASSWORD });
    expect(res.status).toBe(200);
    return agent;
  }

  it("answers 403 to IT Staff and Administrators for the Requester ticket endpoints", async () => {
    const someTicket = await prisma.ticket.findFirstOrThrow({ select: { id: true } });
    const before = await prisma.ticket.count();

    for (const email of STAFF_AND_ADMIN) {
      const agent = await agentFor(email);

      expect((await agent.get("/api/tickets")).status).toBe(403);
      expect((await agent.get(`/api/tickets/${someTicket.id}`)).status).toBe(403);
      expect((await agent.post("/api/tickets").send(validTicket)).status).toBe(403);
    }

    // Nothing was created.
    expect(await prisma.ticket.count()).toBe(before);
  });

  it("answers 403 to IT Staff and Administrators for uploading and removing attachments", async () => {
    const attachment = await prisma.attachment.findFirstOrThrow({
      where: { isRemoved: false },
    });

    for (const email of STAFF_AND_ADMIN) {
      const agent = await agentFor(email);

      const upload = await agent
        .post(`/api/tickets/${attachment.ticketId}/attachments`)
        .attach("file", Buffer.from("not really a png"), {
          filename: "x.png",
          contentType: "image/png",
        });
      expect(upload.status).toBe(403);

      const remove = await agent
        .delete(`/api/attachments/${attachment.id}`)
        .send({ removalReason: "Staff must not remove files" });
      expect(remove.status).toBe(403);
    }

    const after = await prisma.attachment.findUniqueOrThrow({
      where: { id: attachment.id },
    });
    expect(after.isRemoved).toBe(false);
  });

  it("still lets a Requester use the ticket endpoints", async () => {
    expect((await jenniferAgent.get("/api/tickets")).status).toBe(200);
  });
});
