import { expect, test, type Page } from "@playwright/test";
import { getPrisma } from "../../server/src/prisma.js";

// Uses the accounts created by `npm run prisma:seed` (initial password
// ChangeMe123). Michael Brown is a first-login account: the test changes
// his password through the screen and puts his original state back.
const prisma = getPrisma();
const PASSWORD = "ChangeMe123";
const API = "http://localhost:3000";

async function fillLogin(page: Page, email: string, password: string) {
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/^password/i).fill(password);
  await page.getByRole("button", { name: /^log in$/i }).click();
}

test.describe("Authentication", () => {
  test("a valid login opens the Requester home with the user's name and role", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /log in to toktickit/i })).toBeVisible();

    await fillLogin(page, "jennifer.anderson@example.com", PASSWORD);

    await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
    await expect(page.locator("header")).toContainText("Jennifer Anderson");
    await expect(page.locator("header")).toContainText("Requester");

    // The temporary Development Requester selector no longer exists.
    await expect(page.getByText(/change requester|development requester/i)).toHaveCount(0);
  });

  test("shows a safe message for a wrong password and keeps the email", async ({ page }) => {
    await page.goto("/");

    await fillLogin(page, "jennifer.anderson@example.com", "WrongPass999");

    await expect(page.getByRole("alert")).toHaveText("Invalid email or password.");
    await expect(page.getByLabel(/email/i)).toHaveValue("jennifer.anderson@example.com");
    await expect(page.getByLabel(/^password/i)).toHaveValue("");
  });

  test("shows the same message for an unknown email", async ({ page }) => {
    await page.goto("/");

    await fillLogin(page, "nobody@example.com", "WrongPass999");

    await expect(page.getByRole("alert")).toHaveText("Invalid email or password.");
  });

  test("tells an inactive account to contact an administrator", async ({ page }) => {
    await page.goto("/");

    await fillLogin(page, "alex.ford@example.com", PASSWORD);

    await expect(page.getByRole("alert")).toHaveText(
      "This account is inactive. Contact an administrator."
    );
    await expect(page.getByRole("button", { name: "Logout" })).toHaveCount(0);
  });

  test("validates an empty form before calling the API", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: /^log in$/i }).click();

    await expect(page.getByText("Email is required.")).toBeVisible();
    await expect(page.getByText("Password is required.")).toBeVisible();
  });

  test("disables the button while logging in and reports a failed request safely", async ({ page }) => {
    await page.route("**/api/auth/login", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.abort();
    });

    await page.goto("/");

    await fillLogin(page, "jennifer.anderson@example.com", PASSWORD);

    await expect(page.getByRole("button", { name: /logging in/i })).toBeDisabled();
    await expect(page.getByRole("alert")).toContainText("Unable to log in right now");
    await expect(page.getByRole("button", { name: /^log in$/i })).toBeEnabled();
  });

  test("logout removes access, including direct access to the API", async ({ page }) => {
    await page.goto("/");
    await fillLogin(page, "jennifer.anderson@example.com", PASSWORD);
    await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();

    // While logged in, the API answers the logged-in user.
    expect((await page.request.get(`${API}/api/tickets`)).status()).toBe(200);

    await page.getByRole("button", { name: "Logout" }).click();
    await expect(page.getByRole("heading", { name: /log in to toktickit/i })).toBeVisible();

    // The session is gone: the API refuses and a reload shows Login.
    expect((await page.request.get(`${API}/api/tickets`)).status()).toBe(401);
    expect((await page.request.get(`${API}/api/auth/me`)).status()).toBe(401);

    await page.reload();
    await expect(page.getByRole("heading", { name: /log in to toktickit/i })).toBeVisible();
  });

  test.describe("first login", () => {
    const email = "michael.brown@example.com";
    let original: { passwordHash: string; mustChangePassword: boolean };

    test.beforeAll(async () => {
      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      original = {
        passwordHash: user.passwordHash,
        mustChangePassword: user.mustChangePassword,
      };
    });

    test.afterAll(async () => {
      await prisma.user.update({ where: { email }, data: original });
    });

    test("must choose a new password before the application opens", async ({ page }) => {
      await page.goto("/");
      await fillLogin(page, email, PASSWORD);

      await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();
      // No navigation, and the API stays closed, until the password is changed.
      await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);
      expect((await page.request.get(`${API}/api/tickets`)).status()).toBe(403);

      // Validation before anything is sent.
      await page.getByLabel(/current password/i).fill(PASSWORD);
      await page.getByLabel(/^new password/i).fill("short1");
      await page.getByLabel(/confirm new password/i).fill("short1");
      await page.getByRole("button", { name: "Save Password" }).click();
      await expect(page.getByText("Password must be 8-72 characters.")).toBeVisible();

      // A wrong current password is refused by the server.
      await page.getByLabel(/current password/i).fill("WrongPass999");
      await page.getByLabel(/^new password/i).fill("Sunrise2026");
      await page.getByLabel(/confirm new password/i).fill("Sunrise2026");
      await page.getByRole("button", { name: "Save Password" }).click();
      await expect(page.getByText("Current password is incorrect.")).toBeVisible();

      // A valid change opens the normal application.
      await page.getByLabel(/current password/i).fill(PASSWORD);
      await page.getByRole("button", { name: "Save Password" }).click();

      await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
      expect((await page.request.get(`${API}/api/tickets`)).status()).toBe(200);
    });
  });
});
