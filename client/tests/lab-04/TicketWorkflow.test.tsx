import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StaffTicketDetail from "../../src/StaffTicketDetail.js";
import StatusTimeline from "../../src/StatusTimeline.js";
import * as api from "../../src/api.js";

const GATE_MESSAGE = "Complete or cancel all open actions before resolving or closing.";
const STALE_MESSAGE = "This ticket was changed by someone else. Reload to see the latest version.";

const priya: api.AuthUser = {
  id: 6,
  name: "Priya Nair",
  email: "priya.nair@example.com",
  role: "IT_STAFF",
  mustChangePassword: false,
};

function ticket(overrides: Partial<api.StaffTicketDetail> = {}): api.StaffTicketDetail {
  return {
    id: 10,
    ticketNumber: "TKT-2026-900002",
    summary: "Printer shows paper jam",
    description: "The printer reports a paper jam.",
    requestedPriority: "LOW",
    itPriority: "HIGH",
    currentStatus: "OPEN",
    requesterMarkedResolved: false,
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-02T10:00:00.000Z",
    resolvedAt: null,
    version: 3,
    requester: { id: 1, name: "Jennifer Anderson", email: "jennifer.anderson@example.com" },
    category: { id: 2, name: "Hardware" },
    relatedSystem: { id: 6, name: "Printer" },
    owner: { id: 6, name: "Priya Nair" },
    ...overrides,
  };
}

function entry(overrides: Partial<api.StatusHistoryEntry> = {}): api.StatusHistoryEntry {
  return {
    id: 1,
    fromStatus: "NEW",
    toStatus: "OPEN",
    changedBy: { id: 6, name: "Priya Nair", role: "IT_STAFF" },
    changedAt: "2026-11-02T02:20:00.000Z",
    ...overrides,
  };
}

function renderDetail() {
  return render(<StaffTicketDetail ticketId={10} currentUser={priya} onBack={() => {}} />);
}

const save = () => screen.getByRole("button", { name: "Save Changes" });
const handling = () => screen.getByRole("heading", { name: "Ticket Handling" }).closest(".card") as HTMLElement;

beforeEach(() => {
  vi.restoreAllMocks();

  vi.spyOn(api, "getAssignees").mockResolvedValue([
    { id: 6, name: "Priya Nair", role: "IT_STAFF" },
    { id: 7, name: "Elena Rossi", role: "IT_STAFF" },
  ]);
  vi.spyOn(api, "getAttachments").mockResolvedValue([]);
  vi.spyOn(api, "getComments").mockResolvedValue([]);
  vi.spyOn(api, "getInternalNotes").mockResolvedValue([]);
  vi.spyOn(api, "getStaffActions").mockResolvedValue([]);
  vi.spyOn(api, "getStaffHistory").mockResolvedValue([entry()]);
  vi.spyOn(api, "getRequesterHistory").mockResolvedValue([entry()]);
});

describe("Status control", () => {
  it("UI-15 lists only the allowed targets for each current status", async () => {
    const expected: Record<api.TicketStatus, string[]> = {
      NEW: ["Open", "In Progress", "Cancelled"],
      OPEN: ["In Progress", "Waiting for Requester", "Resolved", "Cancelled"],
      IN_PROGRESS: ["Open", "Waiting for Requester", "Resolved", "Cancelled"],
      WAITING_FOR_REQUESTER: ["Open", "In Progress", "Resolved", "Cancelled"],
      RESOLVED: ["Closed", "Reopened"],
      CLOSED: ["Reopened"],
      REOPENED: ["In Progress", "Waiting for Requester", "Resolved", "Cancelled"],
      CANCELLED: [],
    };

    for (const [status, targets] of Object.entries(expected) as [api.TicketStatus, string[]][]) {
      vi.spyOn(api, "getStaffTicket").mockResolvedValue(ticket({ currentStatus: status }));
      const { unmount } = renderDetail();

      await screen.findByRole("heading", { name: "Ticket Handling" });

      if (targets.length === 0) {
        expect(screen.queryByLabelText("Status")).toBeNull();
      } else {
        const options = within(screen.getByLabelText("Status"))
          .getAllByRole("option")
          .slice(1)
          .map((option) => option.textContent);
        expect(options, status).toEqual(targets);
      }

      unmount();
    }
  });

  it("UI-16 sends expectedVersion, then reloads the Ticket, actions, and timeline and shows Changes saved.", async () => {
    const getSpy = vi
      .spyOn(api, "getStaffTicket")
      .mockResolvedValueOnce(ticket())
      .mockResolvedValue(
        ticket({ currentStatus: "IN_PROGRESS", owner: { id: 7, name: "Elena Rossi" }, version: 5 })
      );
    const updateSpy = vi.spyOn(api, "updateTicket").mockResolvedValue({ version: 4 });
    const statusSpy = vi.spyOn(api, "changeStatus").mockResolvedValue();

    renderDetail();

    const owner = await screen.findByLabelText("Owner");
    await waitFor(() => expect(within(owner).getByText("Elena Rossi")).toBeInTheDocument());
    await waitFor(() => expect(api.getStaffHistory).toHaveBeenCalledTimes(1));
    expect(api.getStaffActions).toHaveBeenCalledTimes(1);

    await userEvent.selectOptions(owner, "7");
    await userEvent.selectOptions(screen.getByLabelText("Status"), "IN_PROGRESS");
    await userEvent.click(save());

    // The status change uses the version returned by the owner update.
    await waitFor(() => expect(statusSpy).toHaveBeenCalledWith(10, "IN_PROGRESS", false, 4));
    expect(updateSpy).toHaveBeenCalledWith(10, { ownerId: 7 }, 3);

    expect(await screen.findByText("Changes saved.")).toBeInTheDocument();
    expect(getSpy).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(api.getStaffActions).toHaveBeenCalledTimes(2));
    expect(api.getStaffHistory).toHaveBeenCalledTimes(2);

    // The summary shows the new status.
    const header = screen.getByRole("heading", { name: "TKT-2026-900002" }).parentElement!.parentElement!;
    expect(within(header).getByText("In Progress")).toBeInTheDocument();
  });

  it("UI-17 shows the gate message as an alert under the Status select and keeps the status", async () => {
    vi.spyOn(api, "getStaffTicket").mockResolvedValue(ticket());
    vi.spyOn(api, "changeStatus").mockRejectedValue(
      new api.ApiError(409, "OPEN_ACTIONS_EXIST", GATE_MESSAGE)
    );

    renderDetail();

    await userEvent.selectOptions(await screen.findByLabelText("Status"), "RESOLVED");
    await userEvent.click(save());
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Confirm" }));

    const alert = await within(handling()).findByRole("alert");
    expect(alert).toHaveTextContent(GATE_MESSAGE);

    // The message sits under the Status select.
    const select = screen.getByLabelText("Status");
    expect(select.compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(select).toHaveAttribute("aria-describedby", alert.id);

    const header = screen.getByRole("heading", { name: "TKT-2026-900002" }).parentElement!.parentElement!;
    expect(within(header).getByText("Open")).toBeInTheDocument();
    expect(screen.queryByText("Changes saved.")).toBeNull();
  });

  it("UI-18 shows the stale message, keeps the input, and Reload loads the latest Ticket", async () => {
    const getSpy = vi
      .spyOn(api, "getStaffTicket")
      .mockResolvedValueOnce(ticket())
      .mockResolvedValue(ticket({ itPriority: "MEDIUM", version: 4 }));
    vi.spyOn(api, "updateTicket").mockRejectedValue(
      new api.ApiError(409, "STALE_UPDATE", STALE_MESSAGE)
    );

    renderDetail();

    const owner = await screen.findByLabelText("Owner");
    await waitFor(() => expect(within(owner).getByText("Elena Rossi")).toBeInTheDocument());
    await userEvent.selectOptions(owner, "7");
    await userEvent.selectOptions(screen.getByLabelText("IT Priority"), "LOW");
    await userEvent.click(save());

    const alert = await within(handling()).findByRole("alert");
    expect(alert).toHaveTextContent(STALE_MESSAGE);

    // The user's input stays, and nothing is reloaded yet.
    expect(screen.getByLabelText("Owner")).toHaveValue("7");
    expect(screen.getByLabelText("IT Priority")).toHaveValue("LOW");
    expect(getSpy).toHaveBeenCalledTimes(1);

    await userEvent.click(within(alert).getByRole("button", { name: "Reload" }));

    await waitFor(() => expect(screen.getByLabelText("IT Priority")).toHaveValue("MEDIUM"));
    expect(getSpy).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText("Owner")).toHaveValue("6");
    expect(screen.queryByText(STALE_MESSAGE)).toBeNull();
    await waitFor(() => expect(api.getStaffHistory).toHaveBeenCalledTimes(2));
    expect(api.getStaffActions).toHaveBeenCalledTimes(2);
  });
});

describe("Workflow message style", () => {
  it("STYLE-04 shows the gate and stale messages as role=\"alert\" with the Lab 3 warning alert style", async () => {
    vi.spyOn(api, "getStaffTicket").mockResolvedValue(ticket());
    vi.spyOn(api, "changeStatus")
      .mockRejectedValueOnce(new api.ApiError(409, "OPEN_ACTIONS_EXIST", GATE_MESSAGE))
      .mockRejectedValueOnce(new api.ApiError(409, "STALE_UPDATE", STALE_MESSAGE));

    renderDetail();

    // Gate message.
    await userEvent.selectOptions(await screen.findByLabelText("Status"), "IN_PROGRESS");
    await userEvent.click(save());
    const gate = await within(handling()).findByRole("alert");
    expect(gate).toHaveTextContent(GATE_MESSAGE);
    expect(gate).toHaveClass("alert", "alert-warning");

    // Stale message.
    await userEvent.selectOptions(screen.getByLabelText("Status"), "IN_PROGRESS");
    await userEvent.click(save());
    const stale = await within(handling()).findByText(/changed by someone else/);
    expect(stale).toHaveAttribute("role", "alert");
    expect(stale).toHaveClass("alert", "alert-warning");
    expect(within(handling()).getAllByRole("alert")).toHaveLength(1);
  });
});

describe("Status Timeline", () => {
  it("UI-19 shows the entries in order for staff and the Requester, and the empty, loading, and failure states", async () => {
    vi.mocked(api.getStaffHistory).mockResolvedValueOnce([
      entry(),
      entry({
        id: 2,
        fromStatus: "OPEN",
        toStatus: "IN_PROGRESS",
        changedBy: { id: 1, name: "Admin User", role: "ADMIN" },
        changedAt: "2026-11-03T03:00:00.000Z",
      }),
    ]);

    const staff = render(<StatusTimeline ticketId={10} mode="staff" />);
    expect(screen.getByText("Loading history...")).toBeInTheDocument();

    const region = (await screen.findByRole("heading", { name: "Status Timeline" })).closest(".card") as HTMLElement;
    const items = await within(region).findAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("New to Open");
    expect(items[0]).toHaveTextContent("by Priya Nair (IT Staff)");
    expect(items[0]).toHaveTextContent("2 Nov 2026, 09:20"); // Bangkok time
    expect(items[1]).toHaveTextContent("Open to In Progress");
    expect(items[1]).toHaveTextContent("by Admin User (Administrator)");
    expect(within(items[1]).getByText("In Progress")).toHaveClass("badge");
    expect(api.getStaffHistory).toHaveBeenCalledWith(10);
    staff.unmount();

    vi.mocked(api.getRequesterHistory).mockResolvedValueOnce([]);
    const requester = render(<StatusTimeline ticketId={10} mode="requester" />);
    expect(await screen.findByText("No status changes recorded yet.")).toBeInTheDocument();
    expect(api.getRequesterHistory).toHaveBeenCalledWith(10);
    requester.unmount();

    vi.mocked(api.getStaffHistory).mockRejectedValueOnce(new Error("down"));
    render(<StatusTimeline ticketId={10} mode="staff" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load the history.");
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("listitem")).toHaveTextContent("New to Open");
  });
});
