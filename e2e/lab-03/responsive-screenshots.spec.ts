import { expect, test, type Browser, type Page } from "@playwright/test";
import { mkdir } from "fs/promises";
import path from "path";

// Captures the main Lab 3 screens at desktop, tablet, and mobile sizes into
// artifacts/lab-03/screenshots/, and checks that no screen scrolls sideways.
// Only seeded accounts and tickets are used, and nothing is changed.
const PASSWORD = "ChangeMe123";

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 375, height: 812 },
];

const ROOT = path.resolve(process.cwd(), "artifacts", "lab-03", "screenshots");

async function shot(page: Page, folder: string, viewport: string, name: string, fullPage = true) {
  await mkdir(path.join(ROOT, folder), { recursive: true });
  await page.screenshot({
    path: path.join(ROOT, folder, `${viewport}-${name}.png`),
    fullPage,
  });

  // No horizontal page scroll at this size.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth
  );
  expect(overflow, `${folder}/${viewport}-${name} scrolls sideways`).toBe(false);
}

async function open(browser: Browser, viewport: { width: number; height: number }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto("/");
  return { context, page };
}

async function login(page: Page, email: string) {
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/^password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /^log in$/i }).click();
}

for (const viewport of VIEWPORTS) {
  test.describe(`${viewport.name} (${viewport.width} x ${viewport.height})`, () => {
    test("authentication screens", async ({ browser }) => {
      const { context, page } = await open(browser, viewport);

      await expect(page.getByRole("heading", { name: /log in to toktickit/i })).toBeVisible();
      await shot(page, "authentication", viewport.name, "login");

      // Validation messages.
      await page.getByRole("button", { name: /^log in$/i }).click();
      await expect(page.getByText("Email is required.")).toBeVisible();
      await shot(page, "authentication", viewport.name, "login-validation");

      // Wrong password.
      await page.getByLabel(/email/i).fill("jennifer.anderson@example.com");
      await page.getByLabel(/^password/i).fill("WrongPass999");
      await page.getByRole("button", { name: /^log in$/i }).click();
      await expect(page.getByRole("alert")).toHaveText("Invalid email or password.");
      await shot(page, "authentication", viewport.name, "login-invalid");

      // Inactive account.
      await page.getByLabel(/email/i).fill("alex.ford@example.com");
      await page.getByLabel(/^password/i).fill(PASSWORD);
      await page.getByRole("button", { name: /^log in$/i }).click();
      await expect(page.getByRole("alert")).toContainText("inactive");
      await shot(page, "authentication", viewport.name, "login-inactive");
      await context.close();

      // Mandatory first-login password change (the password is not changed).
      const first = await open(browser, viewport);
      await login(first.page, "sarah.johnson@example.com");
      await expect(first.page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();
      await shot(first.page, "authentication", viewport.name, "change-password");

      await first.page.getByLabel(/current password/i).fill(PASSWORD);
      await first.page.getByLabel(/^new password/i).fill("short1");
      await first.page.getByLabel(/confirm new password/i).fill("other");
      await first.page.getByRole("button", { name: "Save Password" }).click();
      await expect(first.page.getByText("Passwords do not match.")).toBeVisible();
      await shot(first.page, "authentication", viewport.name, "change-password-validation");
      await first.context.close();
    });

    test("Ticket Queue", async ({ browser }) => {
      const { context, page } = await open(browser, viewport);
      await login(page, "priya.nair@example.com");

      await expect(page.getByRole("heading", { name: "Ticket Queue" })).toBeVisible();
      await expect(page.getByText(/Page 1 of/)).toBeVisible();
      await shot(page, "staff-queue", viewport.name, "queue");

      await page.getByLabel("Status").selectOption("OPEN");
      await page.getByLabel("IT Priority").selectOption("HIGH");
      await expect(page.getByText(/Page 1 of/)).toBeVisible();
      await shot(page, "staff-queue", viewport.name, "queue-filtered");

      await page.getByLabel("Search").fill("zzz-nothing-matches");
      await expect(page.getByText("No tickets match your search or filters.")).toBeVisible();
      await shot(page, "staff-queue", viewport.name, "queue-no-results");
      await context.close();

      // A failed request shows a safe message with Retry.
      const failing = await open(browser, viewport);
      await login(failing.page, "priya.nair@example.com");
      await expect(failing.page.getByRole("heading", { name: "Ticket Queue" })).toBeVisible();
      await failing.page.route("**/api/staff/tickets?**", (route) => route.abort());
      await failing.page.getByLabel("Status").selectOption("CLOSED");
      await expect(failing.page.getByRole("alert")).toContainText("Unable to load the ticket queue");
      await shot(failing.page, "staff-queue", viewport.name, "queue-failure");
      await failing.context.close();
    });

    test("Ticket Detail for IT Staff and for the Requester", async ({ browser }) => {
      const { context, page } = await open(browser, viewport);
      await login(page, "priya.nair@example.com");

      await page.getByLabel("Search").fill("TKT-2026-900005");
      // The search runs shortly after typing; wait until one ticket is left.
      await expect(page.getByRole("button", { name: "Open" })).toHaveCount(1);
      await page.getByRole("button", { name: "Open" }).click();
      await expect(page.getByRole("heading", { name: "TKT-2026-900005" })).toBeVisible();
      await expect(page.getByRole("heading", { name: /Internal Notes/ })).toBeVisible();
      await shot(page, "staff-ticket-detail", viewport.name, "staff-detail");

      // The confirmation before resolving (nothing is saved).
      await page.getByLabel("Status").selectOption("RESOLVED");
      await page.getByRole("button", { name: "Save Changes" }).click();
      await expect(page.getByRole("dialog")).toContainText("Change status to Resolved?");
      await shot(page, "staff-ticket-detail", viewport.name, "confirm-status", false);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await context.close();

      // What the Requester sees on the same kind of ticket.
      const requester = await open(browser, viewport);
      await login(requester.page, "jennifer.anderson@example.com");
      await requester.page.getByText("TKT-2026-900002").locator("visible=true").first().waitFor();
      await requester.page.getByRole("button", { name: /^open$/i }).first().click();
      await expect(requester.page.getByRole("heading", { name: /^TKT-/ })).toBeVisible();
      await expect(requester.page.getByText(/internal note|staff only/i)).toHaveCount(0);
      await shot(requester.page, "staff-ticket-detail", viewport.name, "requester-detail");
      await requester.context.close();
    });

    test("User Management", async ({ browser }) => {
      const { context, page } = await open(browser, viewport);
      await login(page, "admin@example.com");

      await page.getByRole("button", { name: "User Management" }).click();
      await expect(page.getByRole("heading", { name: "User Management" })).toBeVisible();
      await expect(page.getByText("Priya Nair").locator("visible=true").first()).toBeVisible();
      await shot(page, "user-management", viewport.name, "list");

      await page.getByRole("button", { name: "+ Create User" }).click();
      const create = page.getByRole("dialog", { name: "Create User" });
      await shot(page, "user-management", viewport.name, "create-dialog", false);

      await create.getByRole("button", { name: "Create User" }).click();
      await expect(create.getByText("Choose a role.")).toBeVisible();
      await shot(page, "user-management", viewport.name, "create-validation", false);
      await page.keyboard.press("Escape");

      // The Administrator's own row: Active cannot be turned off.
      await page.getByText("admin@example.com").locator("visible=true").first().waitFor();
      await page.getByRole("button", { name: "Edit" }).first().click();
      await expect(page.getByRole("dialog", { name: "Edit User" })).toBeVisible();
      await shot(page, "user-management", viewport.name, "edit-dialog", false);

      await page.getByRole("button", { name: "Set New Initial Password" }).click();
      await expect(page.getByRole("dialog", { name: "Set New Initial Password" })).toBeVisible();
      await shot(page, "user-management", viewport.name, "set-password-dialog", false);
      await page.keyboard.press("Escape");

      await page.keyboard.press("Escape");
      await context.close();
    });
  });
}
