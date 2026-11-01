import path from "path";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { getPrisma } from "../../server/src/prisma.js";

// Dashboards from the screen, on the seeded test database (playwright.config.ts).
// Nothing is changed here except David's password-change flag, which is put back.
const prisma = getPrisma();
const PASSWORD = "ChangeMe123";
const API = "http://localhost:3000";
const SHOTS = path.resolve(process.cwd(), "artifacts", "lab-04", "screenshots");

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 812 },
};

// David must change his initial password in the seed.
const DAVID = "david.lee@example.com";
let davidFlag: boolean | undefined;

test.beforeAll(async () => {
  davidFlag = (await prisma.user.findUniqueOrThrow({ where: { email: DAVID } })).mustChangePassword;
  await prisma.user.update({ where: { email: DAVID }, data: { mustChangePassword: false } });
});

test.afterAll(async () => {
  if (davidFlag !== undefined) {
    await prisma.user.update({ where: { email: DAVID }, data: { mustChangePassword: davidFlag } });
  }
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

async function noSideScroll(page: Page) {
  const scrolls = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(scrolls).toBe(false);
}

const nav = (page: Page) => page.getByRole("navigation", { name: "Main" });
const dashboardHeading = (page: Page) => page.getByRole("heading", { level: 1, name: "Dashboard" });

test("E2E-01 Jennifer lands on the Dashboard and Open tickets opens My Tickets with the chip and the same total", async ({ browser }) => {
  const jennifer = await newPage(browser);
  await loginAs(jennifer, "jennifer.anderson@example.com");

  await expect(dashboardHeading(jennifer)).toBeVisible();
  await expect(nav(jennifer).getByRole("button", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  await expect(jennifer.getByRole("button", { name: "Open tickets: 3" })).toBeVisible();
  await expect(jennifer.getByRole("button", { name: "Waiting for me: 0" })).toBeVisible();
  const resolved = jennifer.locator(".card").filter({ has: jennifer.getByRole("heading", { name: "Recently resolved" }) });
  await expect(resolved.getByRole("row").filter({ hasText: "TKT-2026-900013" })).toBeVisible();

  await jennifer.getByRole("button", { name: "Open tickets: 3" }).click();
  await expect(jennifer.getByRole("heading", { name: "My Tickets" })).toBeVisible();
  await expect(jennifer.getByText("Active tickets only")).toBeVisible();
  await expect(jennifer.locator("table tbody tr")).toHaveCount(3);
});

test("E2E-02 Priya drills down from the cards and list, Admin sees the same dashboard, and a Requester gets 403", async ({ browser }) => {
  const priya = await newPage(browser);
  await loginAs(priya, "priya.nair@example.com");
  await expect(dashboardHeading(priya)).toBeVisible();

  await priya.getByRole("button", { name: "Unassigned: 3" }).click();
  await expect(priya.getByRole("heading", { name: "Ticket Queue" })).toBeVisible();
  await expect(priya.getByText("Active tickets only")).toBeVisible();
  await expect(priya.getByText("Page 1 of 1 (3 tickets)")).toBeVisible();

  await nav(priya).getByRole("button", { name: "Dashboard" }).click();
  const actions = priya.locator(".card").filter({ has: priya.getByRole("heading", { name: "My open actions" }) });
  await actions.getByRole("row").filter({ hasText: "TKT-2026-900002" }).getByRole("button", { name: "Open TKT-2026-900002" }).click();
  await expect(priya.getByRole("heading", { name: "TKT-2026-900002" })).toBeVisible();

  const admin = await newPage(browser);
  await loginAs(admin, "admin@example.com");
  await expect(dashboardHeading(admin)).toBeVisible();
  await expect(admin.getByRole("button", { name: "Unassigned: 3" })).toBeVisible();
  await expect(admin.getByRole("button", { name: "My open tickets: 0" })).toBeVisible();
  await expect(admin.getByRole("button", { name: "My open actions: 0" })).toBeVisible();
  await expect(admin.getByText("You have no open actions.")).toBeVisible();

  const jennifer = await newPage(browser);
  await loginAs(jennifer, "jennifer.anderson@example.com");
  expect((await jennifer.request.get(`${API}/api/staff/dashboard`)).status()).toBe(403);
});

test("E2E-03 keyboard only reaches every card and link with visible focus, and Enter opens the target", async ({ browser }) => {
  // Tabs until the named control has focus, checking that focus is visible.
  async function tabTo(page: Page, name: string) {
    for (let step = 0; step < 60; step += 1) {
      await page.keyboard.press("Tab");
      const focused = await page.evaluate(() => {
        const element = document.activeElement as HTMLElement | null;
        if (!element) return null;
        const style = getComputedStyle(element);
        return {
          name: element.getAttribute("aria-label") ?? element.textContent?.trim() ?? "",
          visible: style.outlineStyle !== "none" || style.boxShadow !== "none",
        };
      });
      if (focused?.name === name) {
        expect(focused.visible, `${name} has a visible focus`).toBe(true);
        return;
      }
    }
    throw new Error(`Tab never reached ${name}`);
  }

  const priya = await newPage(browser);
  await loginAs(priya, "priya.nair@example.com");
  await expect(dashboardHeading(priya)).toBeVisible();
  await priya.getByRole("button", { name: "Refresh" }).focus();

  for (const name of [
    "Unassigned: 3",
    "My open tickets: 2",
    "My open actions: 1",
    "New: 2",
    "Open: 3",
    "In Progress: 2",
    "Waiting for Requester: 1",
    "Resolved: 2",
    "Closed: 1",
    "Reopened: 1",
    "Cancelled: 1",
    "Open TKT-2026-900002",
    "View all",
  ]) {
    await tabTo(priya, name);
  }
  await priya.keyboard.press("Enter");
  await expect(priya.getByRole("heading", { name: "Ticket Queue" })).toBeVisible();
  await expect(priya.getByLabel("Sort")).toHaveValue("updated");

  const jennifer = await newPage(browser);
  await loginAs(jennifer, "jennifer.anderson@example.com");
  await expect(dashboardHeading(jennifer)).toBeVisible();
  await jennifer.getByRole("button", { name: "Refresh" }).focus();
  for (const name of ["Open tickets: 3", "Waiting for me: 0", "Open TKT-2026-900013"]) {
    await tabTo(jennifer, name);
  }
  await jennifer.getByRole("button", { name: "Refresh" }).focus();
  await tabTo(jennifer, "Open tickets: 3");
  await jennifer.keyboard.press("Enter");
  await expect(jennifer.getByRole("heading", { name: "My Tickets" })).toBeVisible();
  await expect(jennifer.getByText("Active tickets only")).toBeVisible();
});

test("RESP-01 both dashboards fit desktop, tablet, and mobile and save the screenshots", async ({ browser }) => {
  const priya = await newPage(browser);
  await loginAs(priya, "priya.nair@example.com");
  for (const [name, size] of Object.entries(VIEWPORTS)) {
    await priya.setViewportSize(size);
    await expect(priya.getByRole("button", { name: "Unassigned: 3" })).toBeVisible();
    await noSideScroll(priya);
    await priya.screenshot({ path: path.join(SHOTS, "staff-dashboard", `${name}.png`), fullPage: true });
  }

  const elena = await newPage(browser);
  await loginAs(elena, "elena.rossi@example.com");
  await expect(elena.getByText("You have no open actions.")).toBeVisible();
  await noSideScroll(elena);
  await elena.screenshot({ path: path.join(SHOTS, "staff-dashboard", "desktop-empty-actions.png"), fullPage: true });

  const jennifer = await newPage(browser);
  await loginAs(jennifer, "jennifer.anderson@example.com");
  for (const [name, size] of Object.entries(VIEWPORTS)) {
    await jennifer.setViewportSize(size);
    await expect(jennifer.getByRole("button", { name: "Open tickets: 3" })).toBeVisible();
    await noSideScroll(jennifer);
    await jennifer.screenshot({ path: path.join(SHOTS, "requester-dashboard", `${name}.png`), fullPage: true });
  }

  const david = await newPage(browser);
  await loginAs(david, DAVID);
  await expect(david.getByText("No tickets resolved in the last 7 days.")).toBeVisible();
  await noSideScroll(david);
  await david.screenshot({ path: path.join(SHOTS, "requester-dashboard", "desktop-empty-lists.png"), fullPage: true });
});
