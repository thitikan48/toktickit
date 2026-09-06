import request from "supertest";
import {
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();

describe("Requester Ticket Detail API", () => {
  let ownedTicketId: number;

  beforeAll(async () => {
    const requester =
      await prisma.requesterUser.findFirst({
        where: {
          id: 1,
          isActive: true,
        },
      });

    const category =
      await prisma.category.findFirst();

    const relatedSystem =
      await prisma.relatedSystem.findFirst({
        where: {
          isActive: true,
        },
      });

    if (
      !requester ||
      !category ||
      !relatedSystem
    ) {
      throw new Error(
        "Required seeded data is missing."
      );
    }

    const uniquePart = `${Date.now()}-${Math.floor(
      Math.random() * 100000
    )}`;

    const ticket =
      await prisma.ticket.create({
        data: {
          ticketNumber: `TEST-DETAIL-${uniquePart}`,
          requesterId:
            requester.id,
          categoryId:
            category.id,
          relatedSystemId:
            relatedSystem.id,
          summary:
            "Requester detail test ticket",
          description:
            "Ticket created for requester detail API testing.",
          requestedPriority:
            "MEDIUM",
        },
      });

    ownedTicketId = ticket.id;
  });

  it("returns an owned Ticket", async () => {
    const response =
      await request(app).get(
        `/api/tickets/${ownedTicketId}?requesterId=1`
      );

    expect(response.status).toBe(
      200
    );

    expect(response.body.id).toBe(
      ownedTicketId
    );

    expect(
      response.body.requesterId
    ).toBe(1);

    expect(
      response.body.summary
    ).toBe(
      "Requester detail test ticket"
    );

    expect(
      response.body.category
    ).toBeDefined();

    expect(
      response.body.relatedSystem
    ).toBeDefined();
  });

  it("prevents another Requester from accessing the Ticket", async () => {
    const response =
      await request(app).get(
        `/api/tickets/${ownedTicketId}?requesterId=2`
      );

    expect(response.status).toBe(
      404
    );

    expect(
      response.body.error.code
    ).toBe("NOT_FOUND");
  });

  it("returns 404 when Ticket does not exist", async () => {
    const response =
      await request(app).get(
        "/api/tickets/999999999?requesterId=1"
      );

    expect(response.status).toBe(
      404
    );

    expect(
      response.body.error.code
    ).toBe("NOT_FOUND");
  });

  it("returns 400 when Requester is missing", async () => {
    const response =
      await request(app).get(
        `/api/tickets/${ownedTicketId}`
      );

    expect(response.status).toBe(
      400
    );

    expect(
      response.body.error.code
    ).toBe("VALIDATION_ERROR");
  });
});