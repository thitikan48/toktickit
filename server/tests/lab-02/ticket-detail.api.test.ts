import request from "supertest";
import {
    afterAll,
    beforeAll,
    describe,
    expect,
    it,
} from "vitest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();

let ticketId: number;

describe(
    "Requester Ticket Detail API",
    () => {
        beforeAll(async () => {
            const requester =
                await prisma.requesterUser.findFirst({
                    where: {
                        id: 1,
                        isActive: true,
                    },
                });

            const otherRequester =
                await prisma.requesterUser.findFirst({
                    where: {
                        id: 2,
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
                !otherRequester ||
                !category ||
                !relatedSystem
            ) {
                throw new Error(
                    "Required seeded data is missing."
                );
            }

            const ticket =
                await prisma.ticket.create({
                    data: {
                        ticketNumber:
                            `TEST-DETAIL-${Date.now()}`,

                        requesterId:
                            requester.id,

                        categoryId:
                            category.id,

                        relatedSystemId:
                            relatedSystem.id,

                        summary:
                            "Ticket detail test",

                        description:
                            "Ticket created for Requester Ticket Detail API testing.",

                        requestedPriority:
                            "MEDIUM",
                    },
                });

            ticketId = ticket.id;
        });

        afterAll(async () => {
            if (ticketId) {
                await prisma.ticket.deleteMany({
                    where: {
                        id: ticketId,
                    },
                });
            }
        });

        it(
            "returns an owned Ticket",
            async () => {
                const response =
                    await request(app).get(
                        `/api/tickets/${ticketId}?requesterId=1`
                    );

                expect(
                    response.status
                ).toBe(200);

                expect(
                    response.body.id
                ).toBe(ticketId);

                expect(
                    response.body.requesterId
                ).toBe(1);

                expect(
                    response.body.ticketNumber
                ).toBeDefined();

                expect(
                    response.body.category
                ).toBeDefined();

                expect(
                    response.body.relatedSystem
                ).toBeDefined();
            }
        );

        it(
            "prevents another Requester from accessing the Ticket",
            async () => {
                const response =
                    await request(app).get(
                        `/api/tickets/${ticketId}?requesterId=2`
                    );

                expect(
                    response.status
                ).toBe(403);
            }
        );

        it(
            "returns 404 when Ticket does not exist",
            async () => {
                const response =
                    await request(app).get(
                        `/api/tickets/999999999?requesterId=1`
                    );

                expect(
                    response.status
                ).toBe(404);
            }
        );

        it(
            "returns 400 when Requester is missing",
            async () => {
                const response =
                    await request(app).get(
                        `/api/tickets/${ticketId}`
                    );

                expect(
                    response.status
                ).toBe(400);
            }
        );
    }
);