import {
  afterAll,
  describe,
  expect,
  it,
} from "vitest";

import request from "supertest";

import { app } from "../../src/app.js";

import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();

const createdTicketIds: number[] = [];

async function createTestTicket(data: {
  requesterId: number;
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  description: string;
  requestedPriority:
    | "LOW"
    | "MEDIUM"
    | "HIGH";
}) {
  const response =
    await request(app)
      .post("/api/tickets")
      .send(data);

  expect(response.status).toBe(201);

  createdTicketIds.push(
    response.body.id
  );

  return response;
}

afterAll(async () => {
  if (createdTicketIds.length === 0) {
    return;
  }

  await prisma.ticket.deleteMany({
    where: {
      id: {
        in: createdTicketIds,
      },
    },
  });
});

describe("GET /api/tickets", () => {
  it(
    "returns only tickets owned by the selected requester",
    async () => {
      await createTestTicket({
        requesterId: 1,
        categoryId: 2,
        relatedSystemId: 7,
        summary:
          "Requester one laptop issue",
        description:
          "Requester one reports a laptop hardware problem.",
        requestedPriority:
          "MEDIUM",
      });

      await createTestTicket({
        requesterId: 2,
        categoryId: 3,
        relatedSystemId: 4,
        summary:
          "Requester two software issue",
        description:
          "Requester two reports a software application problem.",
        requestedPriority:
          "LOW",
      });

      const res =
        await request(app).get(
          "/api/tickets?requesterId=1"
        );

      expect(res.status).toBe(200);

      expect(
        Array.isArray(res.body.items)
      ).toBe(true);

      expect(
        res.body.items.length
      ).toBeGreaterThan(0);

      expect(
        res.body.items.every(
          (ticket: {
            requesterId: number;
          }) =>
            ticket.requesterId === 1
        )
      ).toBe(true);
    }
  );

  it(
    "filters tickets by search term",
    async () => {
      await createTestTicket({
        requesterId: 1,
        categoryId: 2,
        relatedSystemId: 7,
        summary:
          "Wireless mouse is not working",
        description:
          "The wireless mouse is connected but does not respond.",
        requestedPriority:
          "LOW",
      });

      await createTestTicket({
        requesterId: 1,
        categoryId: 3,
        relatedSystemId: 4,
        summary:
          "LEB2 page loads slowly",
        description:
          "The LEB2 application takes a long time to load.",
        requestedPriority:
          "MEDIUM",
      });

      const res =
        await request(app).get(
          "/api/tickets?requesterId=1&search=wireless"
        );

      expect(res.status).toBe(200);

      expect(
        res.body.items.length
      ).toBeGreaterThan(0);

      expect(
        res.body.items.every(
          (ticket: {
            summary: string;
            ticketNumber: string;
          }) =>
            ticket.summary
              .toLowerCase()
              .includes("wireless") ||
            ticket.ticketNumber
              .toLowerCase()
              .includes("wireless")
        )
      ).toBe(true);
    }
  );

  it(
    "filters tickets by status, category, and requested priority",
    async () => {
      await createTestTicket({
        requesterId: 1,
        categoryId: 2,
        relatedSystemId: 7,
        summary:
          "High priority laptop issue",
        description:
          "The requester reports a serious laptop hardware problem.",
        requestedPriority:
          "HIGH",
      });

      await createTestTicket({
        requesterId: 1,
        categoryId: 3,
        relatedSystemId: 4,
        summary:
          "Low priority software issue",
        description:
          "The requester reports a minor software application problem.",
        requestedPriority:
          "LOW",
      });

      const res =
        await request(app).get(
          "/api/tickets?requesterId=1&status=NEW&categoryId=2&requestedPriority=HIGH"
        );

      expect(res.status).toBe(200);

      expect(
        res.body.items.length
      ).toBeGreaterThan(0);

      expect(
        res.body.items.every(
          (ticket: {
            currentStatus: string;
            categoryId: number;
            requestedPriority: string;
          }) =>
            ticket.currentStatus ===
              "NEW" &&
            ticket.categoryId === 2 &&
            ticket.requestedPriority ===
              "HIGH"
        )
      ).toBe(true);
    }
  );

  it(
    "sorts tickets by created date ascending",
    async () => {
      const first =
        await createTestTicket({
          requesterId: 1,
          categoryId: 2,
          relatedSystemId: 7,
          summary:
            "Older ticket for sorting",
          description:
            "This ticket is created first for sorting validation.",
          requestedPriority:
            "LOW",
        });

      const second =
        await createTestTicket({
          requesterId: 1,
          categoryId: 3,
          relatedSystemId: 4,
          summary:
            "Newer ticket for sorting",
          description:
            "This ticket is created second for sorting validation.",
          requestedPriority:
            "MEDIUM",
        });

      const res =
        await request(app).get(
          "/api/tickets?requesterId=1&sort=createdAt_asc&pageSize=100"
        );

      expect(res.status).toBe(200);

      const ids =
        res.body.items.map(
          (ticket: {
            id: number;
          }) => ticket.id
        );

      expect(
        ids.indexOf(first.body.id)
      ).toBeLessThan(
        ids.indexOf(second.body.id)
      );
    }
  );

  it(
    "returns paginated ticket results with metadata",
    async () => {
      for (
        let i = 1;
        i <= 3;
        i++
      ) {
        await createTestTicket({
          requesterId: 1,
          categoryId: 2,
          relatedSystemId: 7,
          summary:
            `Pagination ticket ${i}`,
          description:
            "This ticket is created for pagination testing.",
          requestedPriority:
            "LOW",
        });
      }

      const res =
        await request(app).get(
          "/api/tickets?requesterId=1&page=1&pageSize=2"
        );

      expect(res.status).toBe(200);

      expect(
        res.body.items.length
      ).toBeLessThanOrEqual(2);

      expect(
        res.body.page
      ).toBe(1);

      expect(
        res.body.pageSize
      ).toBe(2);

      expect(
        res.body.totalItems
      ).toBeGreaterThanOrEqual(3);

      expect(
        res.body.totalPages
      ).toBeGreaterThanOrEqual(2);
    }
  );
});