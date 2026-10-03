import { expect, test, type Page } from "@playwright/test";
import { getPrisma } from "../../server/src/prisma.js";

// The Administrator creates and manages a user through the screen. The seeded
// Administrator (`admin@example.com`) is the only Administrator, so the
// "last active Administrator" rule can be seen directly. The user created
// here is removed afterwards.
const prisma = getPrisma();
const PASSWORD = "ChangeMe123";
const API = "http://localhost:3000";

const EMAIL = `e2e.user.${Date.now()}@example.test`;
const INITIAL = "Initial2026";
const CHANGED = "Another2026";

async function loginAs(page: Page, email: string, password = PASSWORD) {
  await page.goto("/");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/^password/i).fill(password);
  await page.getByRole("button", { name: /^log in$/i }).click();
  await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();
}

test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: EMAIL } });
});

test("an Administrator manages users, the safety rules hold, and others are kept out", async ({ browser }) => {
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();

  await test.step("User Management lists the users with search and a role filter", async () => {
    await loginAs(admin, "admin@example.com");
    await admin.getByRole("button", { name: "User Management" }).click();

    await expect(admin.getByRole("heading", { name: "User Management" })).toBeVisible();
    const headers = await admin.locator("thead").innerText();
    for (const column of ["Name", "Email", "Role", "Status"]) expect(headers).toContain(column);
    expect(await admin.locator("tbody tr").count()).toBeGreaterThanOrEqual(10);

    await admin.getByLabel("Search").fill("elena");
    await expect(admin.locator("tbody tr")).toHaveCount(1);
    await admin.getByLabel("Search").fill("");

    await admin.getByLabel("Role").selectOption("ADMIN");
    await expect(admin.locator("tbody tr")).toHaveCount(1);
    await admin.getByRole("button", { name: "Clear Filters" }).first().click();
  });

  await test.step("Creating a user validates the form and refuses a duplicate email", async () => {
    await admin.getByRole("button", { name: "+ Create User" }).click();
    const dialog = admin.getByRole("dialog", { name: "Create User" });

    await dialog.getByRole("button", { name: "Create User" }).click();
    await expect(dialog.getByText("Choose a role.")).toBeVisible();
    await expect(dialog.getByText("Enter a valid email address.")).toBeVisible();

    await dialog.getByLabel(/^Name/).fill("E2E Colleague");
    await dialog.getByLabel(/^Email/).fill("priya.nair@example.com");
    await dialog.getByLabel(/^Role/).selectOption("IT_STAFF");
    await dialog.getByLabel(/^Initial Password/).fill(INITIAL);
    await dialog.getByRole("button", { name: "Create User" }).click();
    await expect(dialog.getByText("This email is already in use.").first()).toBeVisible();

    await dialog.getByLabel(/^Email/).fill(EMAIL);
    await dialog.getByRole("button", { name: "Create User" }).click();

    await expect(admin.getByText("User created.")).toBeVisible();
    await expect(admin.getByRole("row").filter({ hasText: EMAIL })).toContainText("IT Staff");
  });

  await test.step("Editing the user and setting a new initial password", async () => {
    await admin.getByRole("row").filter({ hasText: EMAIL }).getByRole("button", { name: "Edit" }).click();
    const edit = admin.getByRole("dialog", { name: "Edit User" });

    await edit.getByLabel(/^Name/).fill("E2E Colleague Renamed");
    await edit.getByRole("button", { name: "Save Changes" }).click();
    await expect(admin.getByText("User updated.")).toBeVisible();
    await expect(admin.getByRole("row").filter({ hasText: EMAIL })).toContainText("E2E Colleague Renamed");

    await admin.getByRole("row").filter({ hasText: EMAIL }).getByRole("button", { name: "Edit" }).click();
    await admin.getByRole("button", { name: "Set New Initial Password" }).click();
    const password = admin.getByRole("dialog", { name: "Set New Initial Password" });
    await password.getByLabel(/^New Initial Password/).fill("short1");
    await password.getByRole("button", { name: "Set Password" }).click();
    await expect(password.getByText("Password must be 8-72 characters.")).toBeVisible();
    await password.getByLabel(/^New Initial Password/).fill(CHANGED);
    await password.getByRole("button", { name: "Set Password" }).click();
    await expect(admin.getByText(/must change it at the next login/)).toBeVisible();
  });

  await test.step("The new user logs in with the initial password and must change it first", async () => {
    const context = await browser.newContext();
    const person = await context.newPage();

    // The first password no longer works; the new initial password does.
    await person.goto("/");
    await person.getByLabel(/email/i).fill(EMAIL);
    await person.getByLabel(/^password/i).fill(INITIAL);
    await person.getByRole("button", { name: /^log in$/i }).click();
    await expect(person.getByRole("alert")).toHaveText("Invalid email or password.");

    await person.getByLabel(/^password/i).fill(CHANGED);
    await person.getByRole("button", { name: /^log in$/i }).click();
    await expect(person.getByRole("heading", { name: "Choose a new password" })).toBeVisible();

    await person.getByLabel(/current password/i).fill(CHANGED);
    await person.getByLabel(/^new password/i).fill("Sunrise2026");
    await person.getByLabel(/confirm new password/i).fill("Sunrise2026");
    await person.getByRole("button", { name: "Save Password" }).click();

    await expect(person.getByRole("heading", { name: "Ticket Queue" })).toBeVisible();
    await expect(person.getByRole("button", { name: "User Management" })).toHaveCount(0);
    await context.close();
  });

  await test.step("A deactivated user cannot log in, and is kept in the list", async () => {
    await admin.getByRole("row").filter({ hasText: EMAIL }).getByRole("button", { name: "Edit" }).click();
    const edit = admin.getByRole("dialog", { name: "Edit User" });
    await edit.getByLabel("Active").uncheck();
    await edit.getByRole("button", { name: "Save Changes" }).click();
    await expect(admin.getByText("User updated.")).toBeVisible();
    await expect(admin.getByRole("row").filter({ hasText: EMAIL })).toContainText("Inactive");

    const context = await browser.newContext();
    const person = await context.newPage();
    await person.goto("/");
    await person.getByLabel(/email/i).fill(EMAIL);
    await person.getByLabel(/^password/i).fill("Sunrise2026");
    await person.getByRole("button", { name: /^log in$/i }).click();
    await expect(person.getByRole("alert")).toHaveText("This account is inactive. Contact an administrator.");
    await context.close();

    // There is no delete action anywhere on the screen.
    await expect(admin.getByRole("button", { name: /delete/i })).toHaveCount(0);
  });

  await test.step("An Administrator cannot deactivate themselves or remove the last Administrator", async () => {
    await admin.getByRole("row").filter({ hasText: "admin@example.com" }).getByRole("button", { name: "Edit" }).click();
    const own = admin.getByRole("dialog", { name: "Edit User" });

    await expect(own.getByLabel("Active")).toBeDisabled();
    await expect(own.getByText("You cannot deactivate your own account.")).toBeVisible();

    await own.getByLabel(/^Role/).selectOption("IT_STAFF");
    await own.getByRole("button", { name: "Save Changes" }).click();
    await expect(own.getByText("At least one active Administrator is required.")).toBeVisible();

    await admin.keyboard.press("Escape");
    await expect(admin.getByRole("dialog")).toHaveCount(0);

    // Still an Administrator after the refused change.
    const me = await admin.request.get(`${API}/api/auth/me`);
    expect((await me.json()).user.role).toBe("ADMIN");
  });

  await test.step("IT Staff and Requesters are kept out of user management", async () => {
    for (const email of ["priya.nair@example.com", "jennifer.anderson@example.com"]) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await loginAs(page, email);

      await expect(page.getByRole("button", { name: "User Management" })).toHaveCount(0);
      expect((await page.request.get(`${API}/api/admin/users`)).status()).toBe(403);
      expect(
        (await page.request.post(`${API}/api/admin/users`, {
          data: { name: "Intruder", email: "intruder@example.test", role: "ADMIN", initialPassword: "Intruder2026" },
        })).status()
      ).toBe(403);

      await context.close();
    }

    expect(await prisma.user.count({ where: { email: "intruder@example.test" } })).toBe(0);
  });

  await adminContext.close();
});
