import request from "supertest";
import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

// Logs in with the seeded Administrator (`admin@example.com`, the only
// Administrator). Users that these tests create go through the system's own
// "create user" endpoint and are removed again in afterAll.
const PASSWORD = "ChangeMe123";
const NEW_PASSWORD = "Initial2026";

const prisma = getPrisma();

type Agent = ReturnType<typeof request.agent>;

async function loginAs(email: string, password = PASSWORD): Promise<Agent> {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/login").send({ email, password });
  expect(res.status).toBe(200);
  return agent;
}

const createdIds: number[] = [];
const uniqueEmail = () => `lab3.users.${randomUUID()}@example.test`;

let admin: Agent;
let adminId: number;

beforeAll(async () => {
  admin = await loginAs("admin@example.com");
  adminId = (
    await prisma.user.findUniqueOrThrow({ where: { email: "admin@example.com" } })
  ).id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: createdIds } } });
});

async function create(
  overrides: Record<string, unknown> = {}
): Promise<{ id: number; email: string; res: request.Response }> {
  const email = uniqueEmail();
  const res = await admin.post("/api/admin/users").send({
    name: "Test Person",
    email,
    role: "REQUESTER",
    isActive: true,
    initialPassword: NEW_PASSWORD,
    ...overrides,
  });

  if (res.status === 201) createdIds.push(res.body.id);

  return { id: res.body.id, email, res };
}

describe("GET /api/admin/users", () => {
  it("lists users with name, email, role, and status, ordered by name, without any hash", async () => {
    const res = await admin.get("/api/admin/users");

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThanOrEqual(10);
    expect(res.body.items[0]).toEqual(
      expect.objectContaining({
        id: expect.any(Number),
        name: expect.any(String),
        email: expect.any(String),
        role: expect.stringMatching(/REQUESTER|IT_STAFF|ADMIN/),
        isActive: expect.any(Boolean),
      })
    );
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2/);

    const names: string[] = res.body.items.map((user: { name: string }) => user.name);
    const sorted = [...names].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );
    expect(names.map((n) => n.toLowerCase())).toEqual(sorted.map((n) => n.toLowerCase()));

    // Not paginated: every user is returned.
    expect(res.body.items).toHaveLength(await prisma.user.count());
  });

  it("searches by name or email, ignoring case", async () => {
    const byName = await admin.get("/api/admin/users?search=ELENA");
    expect(byName.body.items.map((u: { email: string }) => u.email)).toEqual([
      "elena.rossi@example.com",
    ]);

    const byEmail = await admin.get("/api/admin/users?search=Marcus.Chen@");
    expect(byEmail.body.items.map((u: { name: string }) => u.name)).toEqual(["Marcus Chen"]);

    expect((await admin.get("/api/admin/users?search=nobody-zzz")).body.items).toEqual([]);
  });

  it("filters by role and combines the filter with a search", async () => {
    const staff = await admin.get("/api/admin/users?role=IT_STAFF");
    expect(staff.body.items.length).toBeGreaterThanOrEqual(4);
    expect(staff.body.items.every((u: { role: string }) => u.role === "IT_STAFF")).toBe(true);

    const both = await admin.get("/api/admin/users?role=IT_STAFF&search=priya");
    expect(both.body.items.map((u: { name: string }) => u.name)).toEqual(["Priya Nair"]);
  });

  it("rejects an invalid role or unknown parameter", async () => {
    expect((await admin.get("/api/admin/users?role=BOSS")).status).toBe(400);
    expect((await admin.get("/api/admin/users?page=2")).status).toBe(400);
  });
});

describe("POST /api/admin/users", () => {
  it("creates a user with one role, a hashed initial password, and a forced password change", async () => {
    const { id, email, res } = await create({
      name: "  New Colleague  ",
      role: "IT_STAFF",
    });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id,
      name: "New Colleague",
      email,
      role: "IT_STAFF",
      isActive: true,
      mustChangePassword: true,
    });
    expect(JSON.stringify(res.body)).not.toContain(NEW_PASSWORD);

    const record = await prisma.user.findUniqueOrThrow({ where: { id } });
    expect(record.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(record.passwordHash).not.toContain(NEW_PASSWORD);

    // The new user can log in with the initial password, but must change it first.
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email, password: NEW_PASSWORD });
    expect(login.status).toBe(200);
    expect(login.body.user).toMatchObject({ role: "IT_STAFF", mustChangePassword: true });

    const agent = await loginAs(email, NEW_PASSWORD);
    expect((await agent.get("/api/categories")).status).toBe(403);
  });

  it("saves the email in lower case and an inactive user cannot log in", async () => {
    const { email, res } = await create({ isActive: false });
    expect(res.status).toBe(201);
    expect(res.body.isActive).toBe(false);

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: email.toUpperCase(), password: NEW_PASSWORD });
    expect(login.status).toBe(403);
    expect(login.body.error.code).toBe("ACCOUNT_INACTIVE");
  });

  it("rejects invalid fields with a message for each", async () => {
    const res = await admin.post("/api/admin/users").send({
      name: "A",
      email: "not-an-email",
      role: "BOSS",
      isActive: "yes",
      initialPassword: "short1",
    });

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.fields).sort()).toEqual([
      "email",
      "initialPassword",
      "isActive",
      "name",
      "role",
    ]);

    const empty = await admin.post("/api/admin/users").send({});
    expect(empty.status).toBe(400);
  });

  it("rejects a duplicate email, including a different letter case", async () => {
    const first = await create();
    expect(first.res.status).toBe(201);

    const again = await create({ email: first.email.toUpperCase() });
    expect(again.res.status).toBe(409);
    expect(again.res.body.error.fields.email).toBeDefined();

    const seeded = await create({ email: "Priya.Nair@Example.com" });
    expect(seeded.res.status).toBe(409);
  });
});

describe("PATCH /api/admin/users/:id", () => {
  it("edits name, email, role, and active state", async () => {
    const { id } = await create();
    const newEmail = uniqueEmail();

    const res = await admin
      .patch(`/api/admin/users/${id}`)
      .send({ name: "Renamed Person", email: newEmail.toUpperCase(), role: "IT_STAFF", isActive: false });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id,
      name: "Renamed Person",
      email: newEmail,
      role: "IT_STAFF",
      isActive: false,
    });

    // Only the sent field changes.
    const again = await admin.patch(`/api/admin/users/${id}`).send({ isActive: true });
    expect(again.body).toMatchObject({ name: "Renamed Person", role: "IT_STAFF", isActive: true });
  });

  it("rejects an invalid role, empty body, unknown field, and duplicate email", async () => {
    const { id } = await create();

    expect((await admin.patch(`/api/admin/users/${id}`).send({ role: "BOSS" })).status).toBe(400);
    expect((await admin.patch(`/api/admin/users/${id}`).send({})).status).toBe(400);
    expect(
      (await admin.patch(`/api/admin/users/${id}`).send({ passwordHash: "x" })).status
    ).toBe(400);

    const taken = await admin
      .patch(`/api/admin/users/${id}`)
      .send({ email: "priya.nair@example.com" });
    expect(taken.status).toBe(409);
    expect(taken.body.error.fields.email).toBeDefined();
  });

  it("answers 404 for an unknown user", async () => {
    expect((await admin.patch("/api/admin/users/999999999").send({ name: "Nobody" })).status).toBe(404);
  });

  it("applies a role change and a deactivation on the user's next request", async () => {
    const { id, email } = await create({ role: "IT_STAFF" });

    // The new user must set their own password first (see the forced change).
    await prisma.user.update({ where: { id }, data: { mustChangePassword: false } });
    const agent = await loginAs(email, NEW_PASSWORD);

    expect((await agent.get("/api/staff/assignees")).status).toBe(200);

    await admin.patch(`/api/admin/users/${id}`).send({ role: "REQUESTER" });
    expect((await agent.get("/api/staff/assignees")).status).toBe(403);

    await admin.patch(`/api/admin/users/${id}`).send({ isActive: false });
    expect((await agent.get("/api/tickets")).status).toBe(401);
  });
});

describe("POST /api/admin/users/:id/initial-password", () => {
  it("sets a new initial password that must be changed at the next login", async () => {
    const { id, email } = await create();
    await prisma.user.update({ where: { id }, data: { mustChangePassword: false } });

    const res = await admin
      .post(`/api/admin/users/${id}/initial-password`)
      .send({ initialPassword: "Another2026" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id, mustChangePassword: true });
    expect(JSON.stringify(res.body)).not.toContain("Another2026");

    const oldLogin = await request(app).post("/api/auth/login").send({ email, password: NEW_PASSWORD });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app).post("/api/auth/login").send({ email, password: "Another2026" });
    expect(newLogin.status).toBe(200);
    expect(newLogin.body.user.mustChangePassword).toBe(true);
  });

  it("rejects a weak password and an unknown user", async () => {
    const { id } = await create();

    const weak = await admin.post(`/api/admin/users/${id}/initial-password`).send({ initialPassword: "short1" });
    expect(weak.status).toBe(400);
    expect(weak.body.error.fields.initialPassword).toBeDefined();

    expect(
      (await admin.post("/api/admin/users/999999999/initial-password").send({ initialPassword: "Another2026" })).status
    ).toBe(404);
  });
});

describe("Administrator safety rules", () => {
  it("does not let an Administrator deactivate their own account", async () => {
    const res = await admin.patch(`/api/admin/users/${adminId}`).send({ isActive: false });

    expect(res.status).toBe(409);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: adminId } })).isActive).toBe(true);
  });

  it("does not let the last active Administrator lose the role", async () => {
    // The seeded admin is the only Administrator.
    expect(await prisma.user.count({ where: { role: "ADMIN", isActive: true } })).toBe(1);

    const res = await admin.patch(`/api/admin/users/${adminId}`).send({ role: "IT_STAFF" });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/administrator/i);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: adminId } })).role).toBe("ADMIN");
  });

  it("allows an Administrator to step down when another active Administrator exists", async () => {
    const { id, email } = await create({ role: "ADMIN" });
    await prisma.user.update({ where: { id }, data: { mustChangePassword: false } });
    const second = await loginAs(email, NEW_PASSWORD);

    // Two active Administrators now exist, so the second may step down.
    const res = await second.patch(`/api/admin/users/${id}`).send({ role: "IT_STAFF" });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe("IT_STAFF");
  });

  it("keeps deactivated users in the list instead of deleting them", async () => {
    const { id } = await create();
    await admin.patch(`/api/admin/users/${id}`).send({ isActive: false });

    const list = await admin.get("/api/admin/users?search=Test%20Person");
    expect(list.body.items.some((u: { id: number; isActive: boolean }) => u.id === id && !u.isActive)).toBe(true);

    // There is no delete endpoint.
    expect((await admin.delete(`/api/admin/users/${id}`)).status).toBe(404);
    expect(await prisma.user.count({ where: { id } })).toBe(1);
  });
});

describe("Access to user management", () => {
  it("is refused for IT Staff and Requesters on every endpoint", async () => {
    for (const email of ["priya.nair@example.com", "jennifer.anderson@example.com"]) {
      const agent = await loginAs(email);

      expect((await agent.get("/api/admin/users")).status).toBe(403);
      expect((await agent.post("/api/admin/users").send({})).status).toBe(403);
      expect((await agent.patch(`/api/admin/users/${adminId}`).send({ name: "Hacked Admin" })).status).toBe(403);
      expect(
        (await agent.post(`/api/admin/users/${adminId}/initial-password`).send({ initialPassword: "Hacked2026" })).status
      ).toBe(403);
    }

    expect((await prisma.user.findUniqueOrThrow({ where: { id: adminId } })).name).toBe("Admin User");
  });

  it("requires a session", async () => {
    expect((await request(app).get("/api/admin/users")).status).toBe(401);
  });
});
