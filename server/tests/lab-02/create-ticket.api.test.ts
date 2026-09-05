import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

describe("GET /api/development-requesters", () => {
    it("returns only active development requesters", async () => {
        const res = await request(app).get("/api/development-requesters");

        expect(res.status).toBe(200);

        expect(res.body).toEqual([
            {
                id: 1,
                name: "Jennifer Anderson",
                email: "jennifer.anderson@example.com",
            },
            {
                id: 2,
                name: "Michael Brown",
                email: "michael.brown@example.com",
            },
            {
                id: 3,
                name: "Sarah Johnson",
                email: "sarah.johnson@example.com",
            },
            {
                id: 4,
                name: "David Lee",
                email: "david.lee@example.com",
            },
        ]);
    });
});

describe("POST /api/tickets", () => {
    it("creates a valid ticket with generated ticket number and NEW status", async () => {
        const res = await request(app)
            .post("/api/tickets")
            .send({
                requesterId: 1,
                categoryId: 2,
                relatedSystemId: 7,
                summary: "Laptop battery drains quickly",
                description:
                    "The laptop battery loses charge within 90 minutes even under light workload.",
                requestedPriority: "MEDIUM",
            });

        expect(res.status).toBe(201);

        expect(res.body).toMatchObject({
            requesterId: 1,
            categoryId: 2,
            relatedSystemId: 7,
            summary: "Laptop battery drains quickly",
            description:
                "The laptop battery loses charge within 90 minutes even under light workload.",
            requestedPriority: "MEDIUM",
            currentStatus: "NEW",
        });

        expect(res.body.ticketNumber).toMatch(/^TKT-\d{4}-\d{6}$/);
    });

    it("rejects invalid ticket data with validation errors", async () => {
        const res = await request(app)
            .post("/api/tickets")
            .send({
                requesterId: 1,
                categoryId: 2,
                relatedSystemId: 7,
                summary: "   ",
                description: "short",
                requestedPriority: "URGENT",
            });

        expect(res.status).toBe(400);

        expect(res.body).toMatchObject({
            error: {
                code: "VALIDATION_ERROR",
            },
        });

        expect(res.body.error.fields.summary).toBeDefined();
        expect(res.body.error.fields.description).toBeDefined();
        expect(res.body.error.fields.requestedPriority).toBeDefined();
    });
});