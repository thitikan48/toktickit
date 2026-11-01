import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";
import RequesterDashboard from "../../src/RequesterDashboard.js";
import * as api from "../../src/api.js";

function data(overrides: Partial<api.RequesterDashboardData> = {}): api.RequesterDashboardData {
  return {
    openTickets: 3,
    waitingForMe: 0,
    recentlyUpdated: [
      {
        id: 13,
        ticketNumber: "TKT-2026-900013",
        summary: "Laptop keyboard key stuck",
        currentStatus: "RESOLVED",
        updatedAt: "2026-11-03T03:00:00.000Z",
      },
    ],
    recentlyResolved: [
      {
        id: 13,
        ticketNumber: "TKT-2026-900013",
        summary: "Laptop keyboard key stuck",
        currentStatus: "RESOLVED",
        resolvedAt: "2026-11-03T03:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

const jennifer: api.AuthUser = {
  id: 1,
  name: "Jennifer Anderson",
  email: "jennifer.anderson@example.com",
  role: "REQUESTER",
  mustChangePassword: false,
};

const ticketPage = { items: [], page: 1, pageSize: 10, totalItems: 3, totalPages: 1 };

function renderDashboard() {
  const onOpenMyTickets = vi.fn();
  const onOpenTicket = vi.fn();
  const result = render(
    <RequesterDashboard onOpenMyTickets={onOpenMyTickets} onOpenTicket={onOpenTicket} />
  );
  return { ...result, onOpenMyTickets, onOpenTicket };
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(api, "getRequesterDashboard").mockResolvedValue(data());
});

describe("Requester Dashboard", () => {
  it("UI-06 shows 2 cards named with their values, both lists, and their empty texts", async () => {
    const first = renderDashboard();

    expect(await screen.findByRole("button", { name: "Open tickets: 3" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Waiting for me: 0" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();

    const updated = screen.getByRole("heading", { name: "Recently updated" }).closest(".card") as HTMLElement;
    for (const header of ["Ticket Number", "Summary", "Status", "Last Updated"]) {
      expect(within(updated).getByRole("columnheader", { name: header })).toBeInTheDocument();
    }
    const resolved = screen.getByRole("heading", { name: "Recently resolved" }).closest(".card") as HTMLElement;
    for (const header of ["Ticket Number", "Summary", "Status", "Resolved On"]) {
      expect(within(resolved).getByRole("columnheader", { name: header })).toBeInTheDocument();
    }
    expect(within(resolved).getAllByText("3 Nov 2026, 10:00").length).toBeGreaterThan(0); // Bangkok time
    first.unmount();

    vi.mocked(api.getRequesterDashboard).mockResolvedValueOnce(
      data({ openTickets: 0, recentlyUpdated: [], recentlyResolved: [] })
    );
    renderDashboard();
    expect(await screen.findByRole("button", { name: "Open tickets: 0" })).toBeInTheDocument();
    expect(screen.getByText("No tickets updated in the last 7 days.")).toBeInTheDocument();
    expect(screen.getByText("No tickets resolved in the last 7 days.")).toBeInTheDocument();
  });

  it("UI-07 opens My Tickets with the card filters and the Active tickets only chip; the API call has no parameters", async () => {
    const { onOpenMyTickets, onOpenTicket, unmount } = renderDashboard();

    await userEvent.click(await screen.findByRole("button", { name: "Open tickets: 3" }));
    expect(onOpenMyTickets).toHaveBeenLastCalledWith({ statusGroup: "active" });
    await userEvent.click(screen.getByRole("button", { name: "Waiting for me: 0" }));
    expect(onOpenMyTickets).toHaveBeenLastCalledWith({ status: "WAITING_FOR_REQUESTER" });
    await userEvent.click(screen.getAllByRole("button", { name: "Open TKT-2026-900013" })[0]);
    expect(onOpenTicket).toHaveBeenLastCalledWith(13);
    expect(api.getRequesterDashboard).toHaveBeenCalledWith();
    unmount();

    // In the app: My Tickets gets the filter and shows the chip.
    vi.spyOn(api, "getCurrentUser").mockResolvedValue(jennifer);
    vi.spyOn(api, "getCategories").mockResolvedValue([]);
    const ticketsSpy = vi.spyOn(api, "getTickets").mockResolvedValue(ticketPage);

    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Open tickets: 3" }));

    expect(await screen.findByRole("heading", { name: "My Tickets" })).toBeInTheDocument();
    await waitFor(() =>
      expect(ticketsSpy).toHaveBeenLastCalledWith(expect.objectContaining({ statusGroup: "active" }))
    );
    expect(screen.getByText("Active tickets only")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Remove filter: Active tickets only" }));
    await waitFor(() =>
      expect(ticketsSpy).toHaveBeenLastCalledWith(expect.objectContaining({ statusGroup: undefined }))
    );
    expect(screen.queryByText("Active tickets only")).toBeNull();
  });

  it("UI-08 shows the loading, forbidden, and failure states, and opens the Dashboard first after login", async () => {
    let finish: (value: api.RequesterDashboardData) => void = () => {};
    vi.mocked(api.getRequesterDashboard).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    const loading = renderDashboard();
    expect(screen.getByRole("status")).toHaveTextContent("Loading dashboard...");
    finish(data());
    await screen.findByRole("button", { name: "Open tickets: 3" });
    loading.unmount();

    vi.mocked(api.getRequesterDashboard).mockRejectedValueOnce(
      new api.ApiError(403, "FORBIDDEN", "You are not authorized to perform this action.")
    );
    const forbidden = renderDashboard();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You are not authorized to perform this action."
    );
    forbidden.unmount();

    vi.mocked(api.getRequesterDashboard).mockRejectedValueOnce(new Error("down"));
    const failing = renderDashboard();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Unable to load the dashboard.");
    await userEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("button", { name: "Open tickets: 3" })).toBeInTheDocument();
    failing.unmount();

    vi.spyOn(api, "getCurrentUser").mockResolvedValue(jennifer);
    vi.spyOn(api, "getCategories").mockResolvedValue([]);
    vi.spyOn(api, "getRelatedSystems").mockResolvedValue([]);
    vi.spyOn(api, "getTickets").mockResolvedValue(ticketPage);

    render(<App />);
    expect(await screen.findByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Dashboard",
      "My Tickets",
      "Create Ticket",
    ]);
    expect(within(nav).getByRole("button", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");

    await userEvent.click(within(nav).getByRole("button", { name: "My Tickets" }));
    expect(await screen.findByRole("heading", { name: "My Tickets" })).toBeInTheDocument();
    expect(screen.queryByText("Active tickets only")).toBeNull();

    await userEvent.click(within(nav).getByRole("button", { name: "Create Ticket" }));
    expect(within(nav).getByRole("button", { name: "Create Ticket" })).toHaveAttribute("aria-current", "page");
  });
});
