import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

// A smoke check only (tests.md section 7): each call on the seeded test
// database must answer in under 1000 ms. Nothing is changed here.
const PASSWORD = "ChangeMe123";
const LIMIT_MS = 1000;

const prisma = getPrisma();

type Agent = ReturnType<typeof request.agent>;

async function loginAs(email: string): Promise<Agent> {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/login").send({ email, password: PASSWORD });
  expect(res.status).toBe(200);
  return agent;
}

async function timed(agent: Agent, url: string): Promise<number> {
  const start = performance.now();
  const res = await agent.get(url);
  const ms = performance.now() - start;
  expect(res.status, url).toBe(200);
  return ms;
}

let jennifer: Agent;
let priya: Agent;

beforeAll(async () => {
  jennifer = await loginAs("jennifer.anderson@example.com");
  priya = await loginAs("priya.nair@example.com");
}, 60_000);

describe("Performance smoke", () => {
  it("PERF-01 answers both dashboard endpoints in under 1000 ms", async () => {
    expect(await timed(jennifer, "/api/dashboard/requester")).toBeLessThan(LIMIT_MS);
    expect(await timed(priya, "/api/staff/dashboard")).toBeLessThan(LIMIT_MS);
  });

  it("PERF-02 lists the actions of TKT-2026-900003 in under 1000 ms", async () => {
    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { ticketNumber: "TKT-2026-900003" } });
    expect(await timed(priya, `/api/staff/tickets/${ticket.id}/actions`)).toBeLessThan(LIMIT_MS);
  });
});
