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