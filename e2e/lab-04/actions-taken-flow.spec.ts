import path from "path";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { getPrisma } from "../../server/src/prisma.js";

// Actions Taken from the screen. Uses the seeded accounts and Tickets on the
// test database (playwright.config.ts). Actions created here start with MARK
// and are deleted afterwards.
const prisma = getPrisma();
const PASSWORD = "ChangeMe123";
const MARK = "[e2e-actions]";
const SHOTS = path.resolve(process.cwd(), "artifacts", "lab-04", "screenshots", "actions-taken");

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 812 },
};

// Marcus and Michael must change their initial password in the seed. The
// flag is cleared for these tests and put back afterwards.
const notReady = ["marcus.chen@example.com", "michael.brown@example.com"];
const originalFlags: Record<string, boolean> = {};

test.beforeAll(async () => {
  for (const email of notReady) {
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    originalFlags[email] = user.mustChangePassword;
    await prisma.user.update({ where: { email }, data: { mustChangePassword: false } });
  }
});

test.afterAll(async () => {
  for (const email of notReady) {
    if (originalFlags[email] !== undefined) {
      await prisma.user.update({ where: { email }, data: { mustChangePassword: originalFlags[email] } });
    }
  }
  await prisma.actionTaken.deleteMany({ where: { description: { startsWith: MARK } } });
});

async function newPage(browser: Browser, viewport = VIEWPORTS.desktop): Promise<Page> {
  const context = await browser.newContext({ viewport });
  return context.newPage();
}

async function loginAs(page: Page, email: string) {
  await page.goto("/");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/^password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /^log in$/i }).click();
  await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();
}

async function openStaffTicket(page: Page, ticketNumber: string) {
  await page.getByRole("button", { name: "Ticket Queue" }).first().click();
  await page.getByLabel("Search").fill(ticketNumber);
  const row = page.getByRole("row").filter({ hasText: ticketNumber });
  await row.getByRole("button", { name: "Open" }).click();
  await expect(page.getByRole("heading", { name: ticketNumber })).toBeVisible();
}

async function openRequesterTicket(page: Page, ticketNumber: string) {
  await page.getByRole("button", { name: "My Tickets" }).first().click();
  await page.getByRole("row").filter({ hasText: ticketNumber }).getByRole("button", { name: /^open$/i }).click();
  await expect(page.getByRole("heading", { name: ticketNumber })).toBeVisible();
}

function actionsCard(page: Page) {
  return page.getByRole("region", { name: /^Actions Taken/ });
}

async function noSideScroll(page: Page) {
  const scrolls = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth
  );
  expect(scrolls).toBe(false);
}

test("E2E-04 Priya adds an action for Marcus on Elena's Ticket and Marcus completes it", async ({ browser }) => {
  const description = `${MARK} Check the grade upload server logs again.`;

  const priya = await newPage(browser);
  await loginAs(priya, "priya.nair@example.com");
  await openStaffTicket(priya, "TKT-2026-900007");

  const card = actionsCard(priya);
  await card.getByRole("button", { name: "Add Action" }).click();
  const form = card.getByRole("group", { name: "Add Action" });
  await form.getByLabel(/^action description/i).fill(description);
  await form.getByLabel(/^assigned to/i).selectOption({ label: "Marcus Chen" });
  await form.getByRole("button", { name: "Save Action" }).click();

  await expect(card.getByText("Action saved.")).toBeVisible();
  const row = card.getByRole("row").filter({ hasText: description });
  await expect(row).toContainText("Marcus Chen");
  await expect(row).toContainText("Not yet performed");

  const marcus = await newPage(browser);
  await loginAs(marcus, "marcus.chen@example.com");
  await openStaffTicket(marcus, "TKT-2026-900007");

  const marcusCard = actionsCard(marcus);
  await marcusCard.getByRole("row").filter({ hasText: description }).getByRole("button", { name: /^view action/i }).click();
  await marcusCard.getByRole("group", { name: "Action Details" }).getByRole("button", { name: "Complete" }).click();
  await expect(marcusCard.getByText("Action saved.")).toBeVisible();

  const done = marcusCard.getByRole("row").filter({ hasText: description });
  await expect(done).toContainText("Completed");
  await expect(done.getByRole("cell").nth(4)).toHaveText("Marcus Chen");

  // The Ticket Owner is still Elena.
  await expect(marcus.locator("#ownerSelect option:checked")).toHaveText("Elena Rossi");
});

test("E2E-05 shows validation, saves once on a double click, and keeps a cancelled action", async ({ browser }) => {
  const description = `${MARK} Clean the printer rollers.`;

  const priya = await newPage(browser);
  await loginAs(priya, "priya.nair@example.com");
  await openStaffTicket(priya, "TKT-2026-900002");

  const card = actionsCard(priya);
  await card.getByRole("button", { name: "Add Action" }).click();
  const form = card.getByRole("group", { name: "Add Action" });

  await form.getByLabel(/^follow-up required/i).check();
  await form.getByRole("button", { name: "Save Action" }).click();
  await expect(form.getByText("Enter between 1 and 1000 characters.")).toBeVisible();
  await expect(form.getByText(/enter a follow-up note/i)).toBeVisible();
  await expect(form.getByLabel(/^action description/i)).toBeFocused();

  await form.getByLabel(/^action description/i).fill(description);
  await form.getByLabel(/^follow-up required/i).uncheck();
  await form.getByRole("button", { name: "Save Action" }).dblclick();
  await expect(card.getByText("Action saved.")).toBeVisible();

  expect(await prisma.actionTaken.count({ where: { description } })).toBe(1);

  await card.getByRole("row").filter({ hasText: description }).getByRole("button", { name: /^view action/i }).click();
  await card.getByRole("group", { name: "Action Details" }).getByRole("button", { name: "Cancel Action" }).click();
  const dialog = priya.getByRole("dialog", { name: "Cancel this action?" });
  await dialog.getByRole("button", { name: "Cancel Action" }).click();

  const row = card.getByRole("row").filter({ hasText: description });
  await expect(row).toContainText("Cancelled");
});

test("E2E-06 the owning Requester sees the actions read-only", async ({ browser }) => {
  const michael = await newPage(browser);
  await loginAs(michael, "michael.brown@example.com");
  await openRequesterTicket(michael, "TKT-2026-900003");

  const card = actionsCard(michael);
  await expect(card.getByRole("row").filter({ hasText: "Reset the multi-factor enrolment" })).toBeVisible();
  await expect(card.getByRole("button", { name: "Add Action" })).toHaveCount(0);

  await card.getByRole("button", { name: /^view action/i }).first().click();
  const panel = card.getByRole("group", { name: "Action Details" });
  await expect(panel.getByLabel(/^action description/i)).toHaveAttribute("readonly", "");
  await expect(panel.getByRole("button")).toHaveText(["Close"]);
});

test("RESP-02 Actions Taken fits desktop, tablet, and mobile and saves the screenshots", async ({ browser }) => {
  const priya = await newPage(browser);
  await loginAs(priya, "priya.nair@example.com");
  await openStaffTicket(priya, "TKT-2026-900003");
  const card = actionsCard(priya);

  for (const [name, size] of Object.entries(VIEWPORTS)) {
    await priya.setViewportSize(size);
    if (name === "mobile") {
      await expect(card.getByRole("table")).toBeHidden();
      await expect(card.getByText("Reset the multi-factor enrolment for the mail account.").last()).toBeVisible();
    } else {
      await expect(card.getByRole("table")).toBeVisible();
    }
    await noSideScroll(priya);
    await card.scrollIntoViewIfNeeded();
    await priya.screenshot({ path: path.join(SHOTS, `${name}-list.png`), fullPage: true });
  }

  await priya.setViewportSize(VIEWPORTS.desktop);
  await card.getByRole("button", { name: "Add Action" }).click();
  const form = card.getByRole("group", { name: "Add Action" });
  await form.getByLabel(/^follow-up required/i).check();
  await form.getByRole("button", { name: "Save Action" }).click();
  await expect(form.getByText("Enter between 1 and 1000 characters.")).toBeVisible();
  await noSideScroll(priya);
  await priya.screenshot({ path: path.join(SHOTS, "desktop-create-validation.png"), fullPage: true });

  const michael = await newPage(browser);
  await loginAs(michael, "michael.brown@example.com");
  await openRequesterTicket(michael, "TKT-2026-900003");
  await michael.setViewportSize(VIEWPORTS.mobile);
  await actionsCard(michael).getByRole("button", { name: /^view action/i }).last().click();
  await expect(actionsCard(michael).getByRole("group", { name: "Action Details" })).toBeVisible();
  await noSideScroll(michael);
  await michael.screenshot({ path: path.join(SHOTS, "mobile-requester-view.png"), fullPage: true });
});
