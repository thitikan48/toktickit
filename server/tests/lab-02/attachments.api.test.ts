import request from "supertest";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";
import path from "path";
import { unlink } from "fs/promises";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();

const createdTicketIds: number[] = [];

async function createOwnedTicket(
  requesterId = 1
) {
  const category =
    await prisma.category.findFirst();

  const relatedSystem =
    await prisma.relatedSystem.findFirst({
      where: {
        isActive: true,
      },
    });

  if (!category || !relatedSystem) {
    throw new Error(
      "Required seeded data is missing."
    );
  }

  const uniquePart =
    `${Date.now()}-${Math.floor(
      Math.random() * 1_000_000
    )}`;

  const ticket =
    await prisma.ticket.create({
      data: {
        ticketNumber:
          `TEST-ATTACH-${uniquePart}`,

        requesterId,

        categoryId: category.id,

        relatedSystemId:
          relatedSystem.id,

        summary:
          "Attachment lifecycle test ticket",

        description:
          "Ticket created for attachment lifecycle API testing.",

        requestedPriority:
          "MEDIUM",
      },
    });

  createdTicketIds.push(ticket.id);

  return ticket;
}

describe(
  "Attachment Lifecycle API",
  () => {
    beforeAll(async () => {
      const requesterOne =
        await prisma.requesterUser.findFirst({
          where: {
            id: 1,
            isActive: true,
          },
        });

      const requesterTwo =
        await prisma.requesterUser.findFirst({
          where: {
            id: 2,
            isActive: true,
          },
        });

      if (!requesterOne || !requesterTwo) {
        throw new Error(
          "Active Requesters 1 and 2 are required for tests."
        );
      }
    });

    afterAll(async () => {
      if (
        createdTicketIds.length === 0
      ) {
        return;
      }

      const attachments =
        await prisma.attachment.findMany({
          where: {
            ticketId: {
              in: createdTicketIds,
            },
          },

          select: {
            storedName: true,
          },
        });

      await prisma.ticket.deleteMany({
        where: {
          id: {
            in: createdTicketIds,
          },
        },
      });

      await Promise.all(
        attachments.map(
          async ({ storedName }) => {
            try {
              await unlink(
                path.resolve(
                  process.cwd(),
                  "uploads",
                  storedName
                )
              );
            } catch {
              // Some test attachments
              // do not have physical files.
            }
          }
        )
      );
    });

    it(
      "uploads a valid permitted attachment",
      async () => {
        const ticket =
          await createOwnedTicket();

        const response =
          await request(app)
            .post(
              `/api/tickets/${ticket.id}/attachments`
            )
            .field(
              "requesterId",
              "1"
            )
            .attach(
              "file",
              Buffer.from(
                "valid png content"
              ),
              {
                filename:
                  "diagnostic.png",

                contentType:
                  "image/png",
              }
            );

        expect(
          response.status
        ).toBe(201);

        expect(
          response.body.ticketId
        ).toBe(ticket.id);

        expect(
          response.body.originalName
        ).toBe(
          "diagnostic.png"
        );

        expect(
          response.body.mimeType
        ).toBe("image/png");

        expect(
          response.body.isRemoved
        ).toBe(false);
      }
    );

    it(
      "rejects unsupported attachment types",
      async () => {
        const ticket =
          await createOwnedTicket();

        const response =
          await request(app)
            .post(
              `/api/tickets/${ticket.id}/attachments`
            )
            .field(
              "requesterId",
              "1"
            )
            .attach(
              "file",
              Buffer.from(
                "not allowed"
              ),
              {
                filename:
                  "malware.exe",

                contentType:
                  "application/octet-stream",
              }
            );

        expect(
          response.status
        ).toBe(415);
      }
    );

    it(
      "rejects an attachment larger than 5 MB",
      async () => {
        const ticket =
          await createOwnedTicket();

        const response =
          await request(app)
            .post(
              `/api/tickets/${ticket.id}/attachments`
            )
            .field(
              "requesterId",
              "1"
            )
            .attach(
              "file",
              Buffer.alloc(
                5_242_881
              ),
              {
                filename:
                  "too-large.pdf",

                contentType:
                  "application/pdf",
              }
            );

        expect(
          response.status
        ).toBe(413);
      }
    );

    it(
      "rejects a sixth active attachment",
      async () => {
        const ticket =
          await createOwnedTicket();

        await prisma.attachment.createMany({
          data: Array.from(
            { length: 5 },
            (_, index) => ({
              ticketId:
                ticket.id,

              originalName:
                `existing-${index + 1}.pdf`,

              storedName:
                `existing-${ticket.id}-${index + 1}-${Date.now()}.pdf`,

              mimeType:
                "application/pdf",

              sizeBytes: 100,
            })
          ),
        });

        const response =
          await request(app)
            .post(
              `/api/tickets/${ticket.id}/attachments`
            )
            .field(
              "requesterId",
              "1"
            )
            .attach(
              "file",
              Buffer.from(
                "sixth"
              ),
              {
                filename:
                  "sixth.pdf",

                contentType:
                  "application/pdf",
              }
            );

        expect(
          response.status
        ).toBe(400);
      }
    );

    it(
      "requires a removal reason",
      async () => {
        const ticket =
          await createOwnedTicket();

        const attachment =
          await prisma.attachment.create({
            data: {
              ticketId:
                ticket.id,

              originalName:
                "obsolete.pdf",

              storedName:
                `obsolete-${ticket.id}-${Date.now()}.pdf`,

              mimeType:
                "application/pdf",

              sizeBytes: 100,
            },
          });

        const response =
          await request(app)
            .delete(
              `/api/attachments/${attachment.id}`
            )
            .send({
              requesterId: 1,
              removalReason: "   ",
            });

        expect(
          response.status
        ).toBe(400);

        expect(
          response.body.error.message
        ).toBe(
          "Removal reason is required."
        );

        const stored =
          await prisma.attachment.findUnique({
            where: {
              id: attachment.id,
            },
          });

        expect(
          stored?.isRemoved
        ).toBe(false);
      }
    );

    it(
      "soft-removes an attachment with a non-empty reason",
      async () => {
        const ticket =
          await createOwnedTicket();

        const attachment =
          await prisma.attachment.create({
            data: {
              ticketId:
                ticket.id,

              originalName:
                "wrong-file.pdf",

              storedName:
                `wrong-file-${ticket.id}-${Date.now()}.pdf`,

              mimeType:
                "application/pdf",

              sizeBytes: 100,
            },
          });

        const response =
          await request(app)
            .delete(
              `/api/attachments/${attachment.id}`
            )
            .send({
              requesterId: 1,
              removalReason:
                "Wrong file",
            });

        expect(
          response.status
        ).toBe(200);

        expect(
          response.body.isRemoved
        ).toBe(true);

        expect(
          response.body.removalReason
        ).toBe("Wrong file");

        expect(
          response.body.removedAt
        ).toBeTruthy();
      }
    );

    it(
      "allows a short non-empty removal reason",
      async () => {
        const ticket =
          await createOwnedTicket();

        const attachment =
          await prisma.attachment.create({
            data: {
              ticketId:
                ticket.id,

              originalName:
                "old.pdf",

              storedName:
                `old-${ticket.id}-${Date.now()}.pdf`,

              mimeType:
                "application/pdf",

              sizeBytes: 100,
            },
          });

        const response =
          await request(app)
            .delete(
              `/api/attachments/${attachment.id}`
            )
            .send({
              requesterId: 1,
              removalReason: "bad",
            });

        expect(
          response.status
        ).toBe(200);

        expect(
          response.body.removalReason
        ).toBe("bad");
      }
    );

    it(
      "keeps removed metadata visible and blocks download",
      async () => {
        const ticket =
          await createOwnedTicket();

        const uploadResponse =
          await request(app)
            .post(
              `/api/tickets/${ticket.id}/attachments`
            )
            .field(
              "requesterId",
              "1"
            )
            .attach(
              "file",
              Buffer.from(
                "old image"
              ),
              {
                filename:
                  "old-image.webp",

                contentType:
                  "image/webp",
              }
            );

        const attachmentId =
          uploadResponse.body.id;

        await request(app)
          .delete(
            `/api/attachments/${attachmentId}`
          )
          .send({
            requesterId: 1,
            removalReason:
              "Wrong image",
          });

        const listResponse =
          await request(app).get(
            `/api/tickets/${ticket.id}/attachments?requesterId=1`
          );

        expect(
          listResponse.status
        ).toBe(200);

        expect(
          listResponse.body
        ).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: attachmentId,
              isRemoved: true,
              removalReason:
                "Wrong image",
            }),
          ])
        );

        const downloadResponse =
          await request(app).get(
            `/api/attachments/${attachmentId}/download?requesterId=1`
          );

        expect(
          downloadResponse.status
        ).toBe(410);
      }
    );

    it(
      "blocks another Requester from downloading or removing an attachment",
      async () => {
        const ticket =
          await createOwnedTicket(
            1
          );

        const attachment =
          await prisma.attachment.create({
            data: {
              ticketId:
                ticket.id,

              originalName:
                "private.pdf",

              storedName:
                `private-${ticket.id}-${Date.now()}.pdf`,

              mimeType:
                "application/pdf",

              sizeBytes: 100,
            },
          });

        const downloadResponse =
          await request(app).get(
            `/api/attachments/${attachment.id}/download?requesterId=2`
          );

        expect(
          downloadResponse.status
        ).toBe(403);

        const removeResponse =
          await request(app)
            .delete(
              `/api/attachments/${attachment.id}`
            )
            .send({
              requesterId: 2,
              removalReason:
                "Trying to remove another user's file",
            });

        expect(
          removeResponse.status
        ).toBe(403);
      }
    );
  }
);