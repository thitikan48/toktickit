import fs from "fs";
import path from "path";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { getPrisma } from "../../server/src/prisma.js";

// Ticket workflow from the screen, on the test database (playwright.config.ts).
// The seeded Tickets used here are put back in afterAll, and the Ticket made
// by E2E-09 is deleted, so the dashboard values stay as the seed sets them.
const prisma = getPrisma();
const PASSWORD = "ChangeMe123";
const MARK = "[e2e-resolution]";
const SHOTS = path.resolve(process.cwd(), "artifacts", "lab-04", "screenshots", "actions-taken");
const UPLOADS = path.resolve(process.cwd(), "server", "uploads");

const GATE_MESSAGE = "Complete or cancel all open actions before resolving or closing.";
const STALE_MESSAGE = "This ticket was changed by someone else. Reload to see the latest version.";

const RESOLVE_TICKET = "TKT-2026-900002";
const RESOLVE_ACTION = "Clean the printer paper-path sensor.";
const STALE_TICKET = "TKT-2026-900007";

type TicketRow = Awaited<ReturnType<typeof prisma.ticket.findUniqueOrThrow>>;
type ActionRow = Awaited<ReturnType<typeof prisma.actionTaken.findFirstOrThrow>>;

const savedTickets: TicketRow[] = [];
let savedAction: ActionRow | null = null;
const historyBefore: Record<number, number[]> = {};

test.beforeAll(async () => {
  for (const ticketNumber of [RESOLVE_TICKET, STALE_TICKET]) {
    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { ticketNumber } });
    savedTickets.push(ticket);
    historyBefore[ticket.id] = (
      await prisma.ticketStatusHistory.findMany({ where: { ticketId: ticket.id }, select: { id: true } })
    ).map((row) => row.id);
  }

  savedAction = await prisma.actionTaken.findFirstOrThrow({
    where: { ticketId: savedTickets[0].id, description: RESOLVE_ACTION },
  });
});

test.afterAll(async () => {
  for (const ticket of savedTickets) {
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        currentStatus: ticket.currentStatus,
        ownerId: ticket.ownerId,
        itPriority: ticket.itPriority,
        requesterMarkedResolved: ticket.requesterMarkedResolved,
        resolvedAt: ticket.resolvedAt,
        version: ticket.version,
        updatedAt: ticket.updatedAt,
      },
    });
    await prisma.ticketStatusHistory.deleteMany({
      where: { ticketId: ticket.id, id: { notIn: historyBefore[ticket.id] } },
    });
  }

  if (savedAction) {
    await prisma.actionTaken.update({
      where: { id: savedAction.id },
      data: {
        status: savedAction.status,
        result: savedAction.result,
        performedById: savedAction.performedById,
        updatedById: savedAction.updatedById,
        updatedAt: savedAction.updatedAt,
      },
    });
  }

  const made = await prisma.ticket.findMany({
    where: { summary: { startsWith: MARK } },
    select: { id: true, attachments: { select: { storedName: true } } },
  });
  for (const ticket of made) {
    for (const file of ticket.attachments) {
      fs.rmSync(path.join(UPLOADS, file.storedName), { force: true });
    }
  }
  await prisma.ticket.deleteMany({ where: { summary: { startsWith: MARK } } });
});

async function newPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
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

async function resolve(page: Page) {
  await page.getByLabel("Status").selectOption("RESOLVED");
  await page.getByRole("button", { name: "Save Changes" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
}

const handling = (page: Page) =>
  page.locator(".card").filter({ has: page.getByRole("heading", { name: "Ticket Handling" }) });

const timeline = (page: Page) =>
  page.locator(".card").filter({ has: page.getByRole("heading", { name: "Status Timeline" }) });

// The summary StatusBadge in the page header, next to the Ticket Number.
const headerStatus = (page: Page, ticketNumber: string) =>
  page
    .locator("div.d-flex.mb-4")
    .filter({ has: page.getByRole("heading", { level: 1, name: ticketNumber }) })
    .locator(".badge")
    .last();

test("E2E-07 resolving is blocked by an open action, then works after the action is completed", async ({ browser }) => {
  const priya = await newPage(browser);
  await loginAs(priya, "priya.nair@example.com");
  await openStaffTicket(priya, RESOLVE_TICKET);

  await resolve(priya);
  const gate = handling(priya).getByRole("alert");
  await expect(gate).toHaveText(GATE_MESSAGE);
  await expect(priya.locator("#statusSelect option").first()).toHaveText("Current: Open");
  await expect(headerStatus(priya, RESOLVE_TICKET)).toHaveText("Open");
  await gate.scrollIntoViewIfNeeded();
  await priya.screenshot({ path: path.join(SHOTS, "desktop-blocked-resolve.png"), fullPage: true });

  const actions = priya.getByRole("region", { name: /^Actions Taken/ });
  await actions
    .getByRole("row")
    .filter({ hasText: RESOLVE_ACTION })
    .getByRole("button", { name: /^view action/i })
    .click();
  await actions.getByRole("group", { name: "Action Details" }).getByRole("button", { name: "Complete" }).click();
  await expect(actions.getByText("Action saved.")).toBeVisible();

  await resolve(priya);
  await expect(priya.getByText("Changes saved.")).toBeVisible();
  await expect(priya.locator("#statusSelect option").first()).toHaveText("Current: Resolved");
  await expect(headerStatus(priya, RESOLVE_TICKET)).toHaveText("Resolved");
  await expect(timeline(priya).getByRole("listitem").last()).toContainText("Open to Resolved");
  await expect(timeline(priya).getByRole("listitem").last()).toContainText("by Priya Nair (IT Staff)");

  const jennifer = await newPage(browser);
  await loginAs(jennifer, "jennifer.anderson@example.com");
  await openRequesterTicket(jennifer, RESOLVE_TICKET);
  await expect(headerStatus(jennifer, RESOLVE_TICKET)).toHaveText("Resolved");
  await expect(timeline(jennifer).getByRole("listitem").last()).toContainText("Open to Resolved");
});

test("E2E-08 the second of two staff users gets the stale message, keeps the input, and Reload shows the first change", async ({ browser }) => {
  const elena = await newPage(browser);
  await loginAs(elena, "elena.rossi@example.com");
  await openStaffTicket(elena, STALE_TICKET);

  const priya = await newPage(browser);
  await loginAs(priya, "priya.nair@example.com");
  await openStaffTicket(priya, STALE_TICKET);

  await priya.getByLabel("IT Priority").selectOption("HIGH");
  await priya.getByRole("button", { name: "Save Changes" }).click();
  await expect(priya.getByText("Changes saved.")).toBeVisible();

  await elena.getByLabel("IT Priority").selectOption("LOW");
  await elena.getByRole("button", { name: "Save Changes" }).click();
  const stale = handling(elena).getByRole("alert");
  await expect(stale).toContainText(STALE_MESSAGE);
  await expect(elena.getByLabel("IT Priority")).toHaveValue("LOW");

  await stale.getByRole("button", { name: "Reload" }).click();
  await expect(elena.getByLabel("IT Priority")).toHaveValue("HIGH");
  await expect(elena.getByText(STALE_MESSAGE)).toHaveCount(0);
});

test("E2E-09 earlier features still work: Ticket with an attachment and a comment, an Internal Note, and User Management", async ({ browser }) => {
  const summary = `${MARK} Monitor flickers`;
  const comment = `${MARK} The flicker starts after lunch.`;
  const note = `${MARK} Check the display cable.`;

  const errors: string[] = [];
  const watch = (page: Page) => {
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
  };

  const jennifer = await newPage(browser);
  await loginAs(jennifer, "jennifer.anderson@example.com");
  watch(jennifer);
  await jennifer.getByRole("button", { name: "Create Ticket" }).click();
  await jennifer.getByLabel(/category/i).selectOption({ index: 1 });
  await jennifer.getByLabel(/related system/i).selectOption({ index: 1 });
  await jennifer.getByLabel(/requested priority/i).selectOption("MEDIUM");
  await jennifer.getByLabel(/ticket summary/i).fill(summary);
  await jennifer.getByLabel(/description/i).fill("The monitor flickers every few minutes.");
  await jennifer.getByRole("button", { name: /submit ticket/i }).click();

  const success = jennifer.getByRole("status");
  await expect(success).toContainText(/ticket created successfully/i);
  const ticketNumber = (await success.innerText()).match(/TKT-\d{4}-\d{6}/)![0];

  await openRequesterTicket(jennifer, ticketNumber);
  await jennifer.getByLabel("Add Attachment").setInputFiles({
    name: "flicker.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n% e2e test file\n"),
  });
  await expect(jennifer.getByText("flicker.pdf")).toBeVisible();
  await jennifer.getByLabel("Add a comment").fill(comment);
  await jennifer.getByRole("button", { name: "Post Public Comment" }).click();
  await expect(jennifer.getByText(comment)).toBeVisible();
  await expect(timeline(jennifer).getByText("No status changes recorded yet.")).toBeVisible();

  const priya = await newPage(browser);
  await loginAs(priya, "priya.nair@example.com");
  watch(priya);
  await openStaffTicket(priya, ticketNumber);
  await expect(priya.getByText("flicker.pdf")).toBeVisible();
  await expect(priya.getByText(comment)).toBeVisible();
  await priya.getByLabel("Add an internal note").fill(note);
  await priya.getByRole("button", { name: "Add Internal Note" }).click();
  await expect(priya.getByText(note)).toBeVisible();

  const admin = await newPage(browser);
  await loginAs(admin, "admin@example.com");
  watch(admin);
  await admin.getByRole("button", { name: "User Management" }).click();
  await expect(admin.getByRole("heading", { name: "User Management" })).toBeVisible();
  await expect(admin.getByRole("row").filter({ hasText: "priya.nair@example.com" })).toBeVisible();

  for (const page of [jennifer, priya, admin]) {
    await expect(page.locator("body")).not.toContainText(/lorem ipsum|todo|coming soon|placeholder/i);
  }
  expect(errors).toEqual([]);
});
