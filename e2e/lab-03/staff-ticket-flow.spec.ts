import { expect, test, type Page } from "@playwright/test";
import { getPrisma } from "../../server/src/prisma.js";

// A Requester files a ticket through the screen, IT Staff handle it, and the
// Requester follows along. Accounts come from `npm run prisma:seed`.
// The ticket created here is removed afterwards.
const prisma = getPrisma();
const PASSWORD = "ChangeMe123";
const API = "http://localhost:3000";

const SUMMARY = `E2E staff flow ${Date.now()}`;
const PUBLIC_COMMENT = "We are looking into your printer today.";
const REQUESTER_REPLY = "Thank you, I will wait for your update.";
const INTERNAL_NOTE = "INTERNAL ONLY: toner sensor looks faulty.";

async function loginAs(page: Page, email: string) {
  await page.goto("/");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/^password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /^log in$/i }).click();
  await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();
}

test.afterAll(async () => {
  await prisma.ticket.deleteMany({ where: { summary: SUMMARY } });
});

test("a ticket goes from the Requester to IT Staff and back, and private notes stay private", async ({ browser }) => {
  const requesterContext = await browser.newContext();
  const staffContext = await browser.newContext();
  const requester = await requesterContext.newPage();
  const staff = await staffContext.newPage();

  let ticketNumber = "";

  await test.step("Requester creates a ticket and finds it in My Tickets", async () => {
    await loginAs(requester, "jennifer.anderson@example.com");

    await requester.getByRole("button", { name: "Create Ticket" }).click();
    await requester.getByLabel(/category/i).selectOption({ index: 1 });
    await requester.getByLabel(/related system/i).selectOption({ index: 1 });
    await requester.getByLabel(/requested priority/i).selectOption("MEDIUM");
    await requester.getByLabel(/ticket summary/i).fill(SUMMARY);
    await requester.getByLabel(/description/i).fill("The office printer stops halfway through a job.");
    await requester.getByRole("button", { name: /submit ticket/i }).click();

    const success = requester.getByRole("status");
    await expect(success).toContainText(/ticket created successfully/i);

    const match = (await success.innerText()).match(/TKT-\d{4}-\d{6}/);
    expect(match).not.toBeNull();
    ticketNumber = match![0];

    await requester.getByRole("button", { name: "My Tickets" }).click();
    await expect(requester.getByRole("row").filter({ hasText: ticketNumber })).toBeVisible();
  });

  await test.step("IT Staff finds it in the queue, claims it, and sets priority and status", async () => {
    await loginAs(staff, "priya.nair@example.com");

    await expect(staff.getByRole("heading", { name: "Ticket Queue" })).toBeVisible();
    await staff.getByLabel("Search").fill(ticketNumber);

    const row = staff.getByRole("row").filter({ hasText: ticketNumber });
    await expect(row).toBeVisible();
    await expect(row).toContainText("Unassigned");
    await expect(row).toContainText("New");
    await row.getByRole("button", { name: "Open" }).click();

    await expect(staff.getByRole("heading", { name: ticketNumber })).toBeVisible();

    await staff.getByRole("button", { name: "Claim Ticket" }).click();
    await staff.getByLabel("IT Priority").selectOption("HIGH");
    await staff.getByLabel("Status").selectOption("OPEN");
    await staff.getByRole("button", { name: "Save Changes" }).click();

    await expect(staff.getByText("Changes saved.")).toBeVisible();
    await expect(staff.getByLabel("Owner")).not.toHaveValue("");
    await expect(staff.getByLabel("IT Priority")).toHaveValue("HIGH");
    await expect(staff.locator("#statusSelect option").first()).toHaveText("Current: Open");
    // Requested Priority is not changed by IT.
    await expect(staff.getByText("Requested Priority").locator("xpath=following-sibling::*[1]")).toContainText("Medium");
  });

  await test.step("IT Staff writes a Public Comment and a separate Internal Note", async () => {
    await staff.getByLabel("Add a comment").fill(PUBLIC_COMMENT);
    await staff.getByRole("button", { name: "Post Public Comment" }).click();
    await expect(staff.getByText(PUBLIC_COMMENT)).toBeVisible();

    await staff.getByLabel("Add an internal note").fill(INTERNAL_NOTE);
    await staff.getByRole("button", { name: "Add Internal Note" }).click();
    await expect(staff.getByText(INTERNAL_NOTE)).toBeVisible();

    await expect(staff.getByText("Staff only")).toBeVisible();
    // Staff can look at files but not add or remove them.
    await expect(staff.getByText("+ Add Attachment")).toHaveCount(0);
  });

  await test.step("The Requester sees the update and the comment, but never the Internal Note", async () => {
    await requester.getByRole("button", { name: "My Tickets" }).click();
    await requester.getByRole("row").filter({ hasText: ticketNumber }).getByRole("button", { name: /^open$/i }).click();

    await expect(requester.getByText(PUBLIC_COMMENT)).toBeVisible();
    await expect(requester.getByText("IT Priority").locator("xpath=following-sibling::*[1]")).toContainText("High");
    await expect(requester.getByText("Assigned To").locator("xpath=following-sibling::*[1]")).toContainText("Priya Nair");
    await expect(requester.locator("main")).toContainText("Open");
    await expect(requester.getByText(INTERNAL_NOTE)).toHaveCount(0);
    await expect(requester.getByText(/internal note|staff only/i)).toHaveCount(0);

    // The Requester replies with a Public Comment of their own.
    await requester.getByLabel("Add a comment").fill(REQUESTER_REPLY);
    await requester.getByRole("button", { name: "Post Public Comment" }).click();
    await expect(requester.getByText(REQUESTER_REPLY)).toBeVisible();
  });

  await test.step("Role restrictions hold when the API is called directly", async () => {
    const list = await requester.request.get(`${API}/api/tickets?search=${encodeURIComponent(SUMMARY)}`);
    const ticketId = (await list.json()).items[0].id;

    // A Requester cannot use IT Staff operations or read Internal Notes.
    expect((await requester.request.get(`${API}/api/staff/tickets`)).status()).toBe(403);
    expect((await requester.request.get(`${API}/api/tickets/${ticketId}/internal-notes`)).status()).toBe(403);
    expect(
      (await requester.request.post(`${API}/api/staff/tickets/${ticketId}/status`, { data: { status: "CLOSED", confirm: true } })).status()
    ).toBe(403);

    // The note never appears in anything a Requester can download.
    const detail = await (await requester.request.get(`${API}/api/tickets/${ticketId}`)).text();
    const comments = await (await requester.request.get(`${API}/api/tickets/${ticketId}/comments`)).text();
    expect(detail + comments).not.toContain("INTERNAL ONLY");

    // IT Staff may read it.
    const notes = await staff.request.get(`${API}/api/tickets/${ticketId}/internal-notes`);
    expect(notes.status()).toBe(200);
    expect(await notes.text()).toContain("INTERNAL ONLY");
  });

  await test.step("The Requester says it appears resolved; IT Staff see it and resolve with confirmation", async () => {
    await requester.getByRole("button", { name: "Problem Appears Resolved" }).click();
    await expect(requester.getByText(/you told it this appears resolved/i)).toBeVisible();
    // The status does not change by itself.
    await expect(requester.locator("main")).toContainText("Open");

    await staff.reload();
    await expect(staff.getByRole("heading", { name: "Ticket Queue" })).toBeVisible();
    await staff.getByLabel("Search").fill(ticketNumber);
    const row = staff.getByRole("row").filter({ hasText: ticketNumber });
    await expect(row).toContainText("Requester says resolved");
    await row.getByRole("button", { name: "Open" }).click();

    // IT Staff see the Requester's reply next to their own comment.
    await expect(staff.getByText(REQUESTER_REPLY)).toBeVisible();
    await expect(staff.getByText(PUBLIC_COMMENT)).toBeVisible();

    await staff.getByLabel("Status").selectOption("RESOLVED");
    await staff.getByRole("button", { name: "Save Changes" }).click();

    const dialog = staff.getByRole("dialog");
    await expect(dialog).toContainText("Change status to Resolved?");
    await staff.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);

    await staff.getByRole("button", { name: "Save Changes" }).click();
    await staff.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
    await expect(staff.getByText("Changes saved.")).toBeVisible();
    await expect(staff.locator("#statusSelect option").first()).toHaveText("Current: Resolved");

    // The Requester now sees Resolved and no longer gets the resolved button.
    await requester.reload();
    await requester.getByRole("row").filter({ hasText: ticketNumber }).getByRole("button", { name: /^open$/i }).click();
    await expect(requester.locator("main")).toContainText("Resolved");
    await expect(requester.getByRole("button", { name: "Problem Appears Resolved" })).toHaveCount(0);
  });

  await requesterContext.close();
  await staffContext.close();
});
