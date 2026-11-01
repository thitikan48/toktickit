import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";
import StaffDashboard from "../../src/StaffDashboard.js";
import * as api from "../../src/api.js";

const PRIYA = 6;

function data(overrides: Partial<api.StaffDashboardData> = {}): api.StaffDashboardData {
  return {
    unassigned: 3,
    myOpenTickets: 2,
    myOpenActions: 1,
    myOpenActionsList: [
      {
        actionId: 1,
        ticketId: 2,
        ticketNumber: "TKT-2026-900002",
        description: "Clean the printer paper-path sensor.",
        status: "PLANNED",
        actionAt: "2026-11-02T02:20:00.000Z",
      },
    ],
    countsByStatus: {
      NEW: 2,
      OPEN: 3,
      IN_PROGRESS: 2,
      WAITING_FOR_REQUESTER: 1,
      RESOLVED: 2,
      CLOSED: 1,
      REOPENED: 1,
      CANCELLED: 0,
    },
    recentlyUpdated: [
      {
        id: 13,
        ticketNumber: "TKT-2026-900013",
        summary: "Laptop keyboard key stuck",
        currentStatus: "RESOLVED",
        owner: { id: 8, name: "Elena Rossi" },
        updatedAt: "2026-11-03T03:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

function renderDashboard() {
  const onOpenQueue = vi.fn();
  const onOpenTicket = vi.fn();
  render(
    <StaffDashboard currentUserId={PRIYA} onOpenQueue={onOpenQueue} onOpenTicket={onOpenTicket} />
  );
  return { onOpenQueue, onOpenTicket };
}

const staffUser = (role: api.UserRole = "IT_STAFF"): api.AuthUser => ({
  id: PRIYA,
  name: role === "ADMIN" ? "Admin User" : "Priya Nair",
  email: "priya.nair@example.com",
  role,
  mustChangePassword: false,
});

const emptyPage = { items: [], page: 1, pageSize: 10, totalItems: 3, totalPages: 1 };

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(api, "getStaffDashboard").mockResolvedValue(data());
});

describe("IT Staff Dashboard", () => {
  it("UI-01 shows 3 card buttons named with their values and 8 status rows including zeros", async () => {
    renderDashboard();

    expect(await screen.findByRole("button", { name: "Unassigned: 3" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "My open tickets: 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "My open actions: 1" })).toBeInTheDocument();

    const rows = [
      "New: 2",
      "Open: 3",
      "In Progress: 2",
      "Waiting for Requester: 1",
      "Resolved: 2",
      "Closed: 1",
      "Reopened: 1",
      "Cancelled: 0",
    ];
    for (const name of rows) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
  });

  it("UI-02 shows the list columns, and the empty texts when there are no rows", async () => {
    const { unmount } = render(
      <StaffDashboard currentUserId={PRIYA} onOpenQueue={vi.fn()} onOpenTicket={vi.fn()} />
    );

    const actions = (await screen.findByRole("heading", { name: "My open actions" })).closest(".card") as HTMLElement;
    for (const header of ["Ticket Number", "Action", "Status", "Action Date"]) {
      expect(within(actions).getByRole("columnheader", { name: header })).toBeInTheDocument();
    }
    expect(within(actions).getAllByText("Clean the printer paper-path sensor.").length).toBeGreaterThan(0);
    expect(within(actions).getAllByText("Planned").length).toBeGreaterThan(0);

    const recent = screen.getByRole("heading", { name: "Recently updated" }).closest(".card") as HTMLElement;
    for (const header of ["Ticket Number", "Summary", "Status", "Owner", "Last Updated"]) {
      expect(within(recent).getByRole("columnheader", { name: header })).toBeInTheDocument();
    }
    expect(within(recent).getAllByText("Elena Rossi").length).toBeGreaterThan(0);
    expect(within(recent).getAllByText("3 Nov 2026, 10:00").length).toBeGreaterThan(0); // Bangkok time
    unmount();

    vi.mocked(api.getStaffDashboard).mockResolvedValueOnce(
      data({ myOpenActions: 0, myOpenActionsList: [], recentlyUpdated: [] })
    );
    renderDashboard();
    expect(await screen.findByText("You have no open actions.")).toBeInTheDocument();
    expect(screen.getByText("No tickets updated in the last 7 days.")).toBeInTheDocument();
  });

  it("UI-03 opens the Ticket Queue or Ticket Detail with the right filters, and My open actions moves focus to its list", async () => {
    const { onOpenQueue, onOpenTicket } = renderDashboard();

    await userEvent.click(await screen.findByRole("button", { name: "Unassigned: 3" }));
    expect(onOpenQueue).toHaveBeenLastCalledWith({ owner: "unassigned", statusGroup: "active" });

    await userEvent.click(screen.getByRole("button", { name: "My open tickets: 2" }));
    expect(onOpenQueue).toHaveBeenLastCalledWith({ owner: String(PRIYA), statusGroup: "active" });

    await userEvent.click(screen.getByRole("button", { name: "Waiting for Requester: 1" }));
    expect(onOpenQueue).toHaveBeenLastCalledWith({ status: "WAITING_FOR_REQUESTER" });

    await userEvent.click(screen.getByRole("button", { name: "View all" }));
    expect(onOpenQueue).toHaveBeenLastCalledWith({ sortChoice: "updated" });

    await userEvent.click(screen.getAllByRole("button", { name: "Open TKT-2026-900002" })[0]);
    expect(onOpenTicket).toHaveBeenLastCalledWith(2);
    await userEvent.click(screen.getAllByRole("button", { name: "Open TKT-2026-900013" })[0]);
    expect(onOpenTicket).toHaveBeenLastCalledWith(13);

    await userEvent.click(screen.getByRole("button", { name: "My open actions: 1" }));
    expect(screen.getByRole("heading", { name: "My open actions" })).toHaveFocus();
    expect(onOpenQueue).toHaveBeenCalledTimes(4);
  });

  it("UI-04 shows loading, the forbidden message, and a failure with Retry that loads again", async () => {
    let finish: (value: api.StaffDashboardData) => void = () => {};
    vi.mocked(api.getStaffDashboard).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    const first = render(
      <StaffDashboard currentUserId={PRIYA} onOpenQueue={vi.fn()} onOpenTicket={vi.fn()} />
    );
    expect(screen.getByRole("status")).toHaveTextContent("Loading dashboard...");
    finish(data());
    await screen.findByRole("button", { name: "Unassigned: 3" });
    first.unmount();

    vi.mocked(api.getStaffDashboard).mockRejectedValueOnce(
      new api.ApiError(403, "FORBIDDEN", "You are not authorized to perform this action.")
    );
    const forbidden = render(
      <StaffDashboard currentUserId={PRIYA} onOpenQueue={vi.fn()} onOpenTicket={vi.fn()} />
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You are not authorized to perform this action."
    );
    forbidden.unmount();

    vi.mocked(api.getStaffDashboard).mockRejectedValueOnce(new Error("down"));
    renderDashboard();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Unable to load the dashboard.");
    await userEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("button", { name: "Unassigned: 3" })).toBeInTheDocument();

    // Refresh loads again.
    const calls = vi.mocked(api.getStaffDashboard).mock.calls.length;
    await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(api.getStaffDashboard).toHaveBeenCalledTimes(calls + 1));
  });

  it("UI-05 opens the Dashboard first for IT Staff and Administrators, marked active, with the earlier screens still reachable", async () => {
    vi.spyOn(api, "getStaffTickets").mockResolvedValue(emptyPage);
    vi.spyOn(api, "getCategories").mockResolvedValue([]);
    vi.spyOn(api, "getAssignees").mockResolvedValue([]);
    vi.spyOn(api, "getUsers").mockResolvedValue([]);

    for (const role of ["IT_STAFF", "ADMIN"] as const) {
      vi.spyOn(api, "getCurrentUser").mockResolvedValue(staffUser(role));
      const { unmount } = render(<App />);

      expect(await screen.findByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
      const nav = screen.getByRole("navigation", { name: "Main" });
      const items = within(nav).getAllByRole("button").map((button) => button.textContent);
      expect(items).toEqual(
        role === "ADMIN"
          ? ["Dashboard", "Ticket Queue", "User Management"]
          : ["Dashboard", "Ticket Queue"]
      );
      expect(within(nav).getByRole("button", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");

      // A card opens the Ticket Queue with its filters.
      await userEvent.click(await screen.findByRole("button", { name: "Unassigned: 3" }));
      expect(await screen.findByRole("heading", { name: "Ticket Queue" })).toBeInTheDocument();
      await waitFor(() =>
        expect(api.getStaffTickets).toHaveBeenLastCalledWith(
          expect.objectContaining({ ownerId: "unassigned", statusGroup: "active" })
        )
      );
      expect(screen.getByText("Active tickets only")).toBeInTheDocument();
      expect(within(nav).getByRole("button", { name: "Ticket Queue" })).toHaveAttribute("aria-current", "page");

      if (role === "ADMIN") {
        await userEvent.click(within(nav).getByRole("button", { name: "User Management" }));
        expect(await screen.findByRole("heading", { name: "User Management" })).toBeInTheDocument();
      }

      unmount();
    }
  });

  it("STYLE-03 uses real buttons with the Lab 2 and 3 card classes, and a StatusBadge on each status row", async () => {
    renderDashboard();

    const card = await screen.findByRole("button", { name: "Unassigned: 3" });
    expect(card.tagName).toBe("BUTTON");
    expect(card).toHaveClass("card", "shadow-sm");

    const row = screen.getByRole("button", { name: "Waiting for Requester: 1" });
    expect(row.tagName).toBe("BUTTON");
    expect(within(row).getByText("Waiting for Requester")).toHaveClass("badge");
  });
});
