import request from "supertest";
import bcrypt from "bcrypt";
import { describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

// These tests log in with the accounts created by `npm run prisma:seed`
// (see the README). They never create users.
const PASSWORD = "ChangeMe123";

const REQUESTER = "jennifer.anderson@example.com";
const IT_STAFF = "priya.nair@example.com";
const IT_STAFF_2 = "elena.rossi@example.com";
const ADMIN = "admin@example.com";
const FIRST_LOGIN = [
  "michael.brown@example.com",
  "sarah.johnson@example.com",
  "david.lee@example.com",
  "marcus.chen@example.com",
];
const INACTIVE = ["alex.ford@example.com", "tom.baker@example.com"];

const prisma = getPrisma();

const login = (email: string, password: string = PASSWORD) =>
  request(app).post("/api/auth/login").send({ email, password });

async function loggedInAgent(email: string) {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/login").send({ email, password: PASSWORD });
  expect(res.status).toBe(200);
  return agent;
}

describe("POST /api/auth/login", () => {
  it("logs in each role with a seeded account and returns identity without a hash", async () => {
    const cases = [
      { email: REQUESTER, role: "REQUESTER" },
      { email: IT_STAFF, role: "IT_STAFF" },
      { email: ADMIN, role: "ADMIN" },
    ];

    for (const { email, role } of cases) {
      const seeded = await prisma.user.findUniqueOrThrow({ where: { email } });

      const res = await login(email);

      expect(res.status).toBe(200);
      expect(res.body.user).toEqual({
        id: seeded.id,
        name: seeded.name,
        email,
        role,
        mustChangePassword: false,
      });
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2/);

      const cookie = String(res.headers["set-cookie"]);
      expect(cookie).toContain("tokticit.sid");
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("SameSite=Lax");
    }
  });

  it("gives the same 401 for a wrong password and an unknown email", async () => {
    const wrongPassword = await login(REQUESTER, "WrongPass999");
    const unknownEmail = await login("nobody@example.com", "WrongPass999");

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
    expect(wrongPassword.body.error.code).toBe("INVALID_CREDENTIALS");
    expect(wrongPassword.headers["set-cookie"]).toBeUndefined();
  });

  it("rejects the inactive seeded accounts with the correct password", async () => {
    for (const email of INACTIVE) {
      const res = await login(email);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("ACCOUNT_INACTIVE");
      expect(res.headers["set-cookie"]).toBeUndefined();

      // A wrong password does not reveal that the account is inactive.
      expect((await login(email, "WrongPass999")).status).toBe(401);
    }
  });

  it("rejects missing fields", async () => {
    const res = await request(app).post("/api/auth/login").send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.fields.email).toBeDefined();
    expect(res.body.error.fields.password).toBeDefined();
  });

  it("matches the email case-insensitively", async () => {
    const res = await login(` ${REQUESTER.toUpperCase()} `);

    expect(res.status).toBe(200);
  });
});

describe("first-login password change", () => {
  it("lets the seeded first-login accounts log in but flags them", async () => {
    for (const email of FIRST_LOGIN) {
      const res = await login(email);

      expect(res.status).toBe(200);
      expect(res.body.user.mustChangePassword).toBe(true);
    }
  });

  it("blocks every other endpoint until the password is changed", async () => {
    const agent = await loggedInAgent("sarah.johnson@example.com");

    for (const path of ["/api/tickets", "/api/categories", "/api/related-systems"]) {
      const res = await agent.get(path);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");
    }

    expect((await agent.get("/api/auth/me")).status).toBe(200);
  });

  it("rejects a wrong current password, a weak password, and the same password", async () => {
    const agent = await loggedInAgent("sarah.johnson@example.com");

    const wrongCurrent = await agent
      .post("/api/auth/change-password")
      .send({ currentPassword: "WrongPass999", newPassword: "Sunrise2026" });
    expect(wrongCurrent.status).toBe(400);
    expect(wrongCurrent.body.error.fields.currentPassword).toBeDefined();

    const weak = await agent
      .post("/api/auth/change-password")
      .send({ currentPassword: PASSWORD, newPassword: "short1" });
    expect(weak.status).toBe(400);
    expect(weak.body.error.fields.newPassword).toBeDefined();

    const same = await agent
      .post("/api/auth/change-password")
      .send({ currentPassword: PASSWORD, newPassword: PASSWORD });
    expect(same.status).toBe(400);
    expect(same.body.error.fields.newPassword).toBeDefined();

    const record = await prisma.user.findUniqueOrThrow({
      where: { email: "sarah.johnson@example.com" },
    });
    expect(record.mustChangePassword).toBe(true);
  });

  it("saves a valid new password, clears the flag, and stores a bcrypt hash", async () => {
    // Changing the password edits a seeded account, so its original state
    // is put back at the end and the account stays usable for the next run.
    const email = "marcus.chen@example.com";
    const before = await prisma.user.findUniqueOrThrow({ where: { email } });

    try {
      const agent = await loggedInAgent(email);

      const res = await agent
        .post("/api/auth/change-password")
        .send({ currentPassword: PASSWORD, newPassword: "Sunrise2026" });

      expect(res.status).toBe(200);
      expect(res.body.user.mustChangePassword).toBe(false);

      const record = await prisma.user.findUniqueOrThrow({ where: { email } });
      expect(record.mustChangePassword).toBe(false);
      expect(record.passwordHash).toMatch(/^\$2[aby]\$/);
      expect(record.passwordHash).not.toContain("Sunrise2026");
      expect(await bcrypt.compare("Sunrise2026", record.passwordHash)).toBe(true);

      // The normal application opens now.
      expect((await agent.get("/api/categories")).status).toBe(200);

      expect((await login(email)).status).toBe(401);
      expect((await login(email, "Sunrise2026")).status).toBe(200);
    } finally {
      await prisma.user.update({
        where: { email },
        data: {
          passwordHash: before.passwordHash,
          mustChangePassword: before.mustChangePassword,
        },
      });
    }
  });
});

describe("sessions", () => {
  it("ends the session at logout", async () => {
    const agent = await loggedInAgent(REQUESTER);

    expect((await agent.get("/api/auth/me")).status).toBe(200);
    expect((await agent.post("/api/auth/logout")).status).toBe(204);
    expect((await agent.get("/api/auth/me")).status).toBe(401);
    expect((await agent.get("/api/tickets")).status).toBe(401);
  });

  it("requires a session for protected endpoints", async () => {
    for (const path of [
      "/api/auth/me",
      "/api/tickets",
      "/api/categories",
      "/api/related-systems",
    ]) {
      const res = await request(app).get(path);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHENTICATED");
    }
  });

  it("rejects the session of a user who is deactivated afterwards", async () => {
    const agent = await loggedInAgent(IT_STAFF_2);

    // Temporarily deactivates a seeded account; restored below.
    await prisma.user.update({
      where: { email: IT_STAFF_2 },
      data: { isActive: false },
    });

    try {
      expect((await agent.get("/api/categories")).status).toBe(401);
    } finally {
      await prisma.user.update({
        where: { email: IT_STAFF_2 },
        data: { isActive: true },
      });
    }
  });

  it("uses a new session id at every login", async () => {
    const first = await login(REQUESTER);
    const second = await login(REQUESTER);

    expect(String(first.headers["set-cookie"])).not.toEqual(
      String(second.headers["set-cookie"])
    );
  });
});
