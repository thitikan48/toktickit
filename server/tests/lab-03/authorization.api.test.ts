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
