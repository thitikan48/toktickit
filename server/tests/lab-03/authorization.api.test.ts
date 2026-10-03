import request from "supertest";
import path from "path";
import { unlink } from "fs/promises";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
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

// ---- Lab 2 Requester behaviour, now under login (AC-08)

describe("My Tickets still works for the logged-in Requester", () => {
  const list = (query = "") => jenniferAgent.get(`/api/tickets${query}`);

  interface Row {
    ticketNumber: string;
    currentStatus: string;
    requestedPriority: string;
    categoryId: number;
    createdAt: string;
  }

  it("searches by ticket number or summary", async () => {
    const byNumber = await list("?search=900002");
    expect(byNumber.body.items.map((t: Row) => t.ticketNumber)).toEqual(["TKT-2026-900002"]);

    const bySummary = await list("?search=PAPER%20JAM");
    expect(bySummary.body.items.length).toBeGreaterThan(0);

    const none = await list("?search=nothing-matches-zzz");
    expect(none.status).toBe(200);
    expect(none.body.items).toEqual([]);
    expect(none.body.totalItems).toBe(0);
  });

  it("filters by category, status, and requested priority", async () => {
    const hardware = await prisma.category.findFirstOrThrow({ where: { name: "Hardware" } });

    const byCategory = await list(`?categoryId=${hardware.id}`);
    expect(byCategory.body.items.length).toBeGreaterThan(0);
    expect(byCategory.body.items.every((t: Row) => t.categoryId === hardware.id)).toBe(true);

    const byStatus = await list("?status=OPEN");
    expect(byStatus.body.items.every((t: Row) => t.currentStatus === "OPEN")).toBe(true);

    const byPriority = await list("?requestedPriority=LOW");
    expect(byPriority.body.items.length).toBeGreaterThan(0);
    expect(byPriority.body.items.every((t: Row) => t.requestedPriority === "LOW")).toBe(true);
  });

  it("sorts by created date and pages the results", async () => {
    const newest = await list("?sort=createdAt_desc&pageSize=100");
    const oldest = await list("?sort=createdAt_asc&pageSize=100");

    const times = (res: { body: { items: Row[] } }) =>
      res.body.items.map((t) => new Date(t.createdAt).getTime());
    expect(times(newest)).toEqual([...times(newest)].sort((a, b) => b - a));
    expect(times(oldest)).toEqual([...times(oldest)].sort((a, b) => a - b));

    const total = await prisma.ticket.count({ where: { requesterId: jennifer.id } });
    const second = await list("?page=2&pageSize=2");
    expect(second.body).toMatchObject({
      page: 2,
      pageSize: 2,
      totalItems: total,
      totalPages: Math.ceil(total / 2),
    });
    expect(second.body.items).toHaveLength(Math.min(2, Math.max(0, total - 2)));
  });
});

describe("Creating a ticket still works", () => {
  it("rejects invalid data with a message for each field", async () => {
    const res = await jenniferAgent.post("/api/tickets").send({
      categoryId: 2,
      relatedSystemId: 7,
      summary: "   ",
      description: "short",
      requestedPriority: "URGENT",
    });

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.fields).sort()).toEqual([
      "description",
      "requestedPriority",
      "summary",
    ]);
  });

  it("creates a New ticket with a generated number and shows it in My Tickets", async () => {
    const summary = `Regression ticket ${Date.now()}`;
    const res = await jenniferAgent.post("/api/tickets").send({ ...validTicket, summary });

    expect(res.status).toBe(201);
    createdTicketIds.push(res.body.id);
    expect(res.body.ticketNumber).toMatch(/^TKT-\d{4}-\d{6}$/);
    expect(res.body.currentStatus).toBe("NEW");

    const found = await jenniferAgent.get(`/api/tickets?search=${encodeURIComponent(summary)}`);
    expect(found.body.items.map((t: { id: number }) => t.id)).toEqual([res.body.id]);
  });
});

describe("The attachment lifecycle still works", () => {
  const storedFiles: string[] = [];
  let ticketId: number;

  const PNG = { filename: "evidence.png", contentType: "image/png" };
  const upload = (buffer: Buffer, file = PNG) =>
    jenniferAgent
      .post(`/api/tickets/${ticketId}/attachments`)
      .attach("file", buffer, file);

  beforeAll(async () => {
    const res = await jenniferAgent
      .post("/api/tickets")
      .send({ ...validTicket, summary: `Attachment regression ${Date.now()}` });

    expect(res.status).toBe(201);
    ticketId = res.body.id;
    createdTicketIds.push(ticketId);
  });

  afterAll(async () => {
    // Removes the files that the tests below stored on disk.
    const rows = await prisma.attachment.findMany({ where: { ticketId } });

    await Promise.all(
      rows.map((row) =>
        unlink(path.resolve(process.cwd(), "uploads", row.storedName)).catch(() => undefined)
      )
    );
  });

  it("accepts a valid file and rejects an unsupported type and an oversized file", async () => {
    const ok = await upload(Buffer.from("png bytes"));
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({ originalName: "evidence.png", isRemoved: false });
    storedFiles.push(ok.body.id);

    const wrongType = await upload(Buffer.from("text"), {
      filename: "notes.txt",
      contentType: "text/plain",
    });
    expect(wrongType.status).toBe(415);

    const tooBig = await upload(Buffer.alloc(5_242_881, 1));
    expect(tooBig.status).toBe(413);
  });

  it("allows at most five active attachments", async () => {
    // One file is already attached; fill up to five, then the sixth fails.
    for (let count = 1; count < 5; count++) {
      expect((await upload(Buffer.from(`file ${count}`))).status).toBe(201);
    }

    expect((await upload(Buffer.from("one too many"))).status).toBe(400);
  });

  it("soft-removes with a reason, keeps the details, and blocks the download", async () => {
    const attachments = await jenniferAgent.get(`/api/tickets/${ticketId}/attachments`);
    const target = attachments.body[0];

    // The file can be downloaded while it is active.
    expect((await jenniferAgent.get(`/api/attachments/${target.id}/download`)).status).toBe(200);

    const blank = await jenniferAgent
      .delete(`/api/attachments/${target.id}`)
      .send({ removalReason: "   " });
    expect(blank.status).toBe(400);

    const removed = await jenniferAgent
      .delete(`/api/attachments/${target.id}`)
      .send({ removalReason: "Uploaded by mistake" });
    expect(removed.status).toBe(200);
    expect(removed.body).toMatchObject({ isRemoved: true, removalReason: "Uploaded by mistake" });

    expect((await jenniferAgent.get(`/api/attachments/${target.id}/download`)).status).toBe(410);

    // The details stay visible in the list.
    const after = await jenniferAgent.get(`/api/tickets/${ticketId}/attachments`);
    const kept = after.body.find((a: { id: number }) => a.id === target.id);
    expect(kept).toMatchObject({ originalName: "evidence.png", isRemoved: true });
  });
});

// This test replaces a database call for one request, so it runs last.
describe("Unexpected server errors", () => {
  it("answers with a generic message, hides the cause, and logs it on the server", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const failure = new Error("boom: secret SQL detail at C:\server\file.ts");
    const broken = vi.spyOn(prisma.ticket, "findMany").mockRejectedValueOnce(failure);

    try {
      const res = await jenniferAgent.get("/api/tickets");

      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe("SERVER_ERROR");
      expect(JSON.stringify(res.body)).not.toMatch(/boom|secret|SQL|file\.ts|stack/i);

      // The real cause is available to the developer in the server terminal.
      expect(logged).toHaveBeenCalledWith(expect.stringContaining("Unexpected error"), failure);
    } finally {
      broken.mockRestore();
      logged.mockRestore();
    }
  });
});
