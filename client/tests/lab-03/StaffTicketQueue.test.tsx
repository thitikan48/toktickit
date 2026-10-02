import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";
import StaffTicketQueue from "../../src/StaffTicketQueue.js";
import * as api from "../../src/api.js";

function item(
  overrides: Partial<api.StaffTicketListItem> = {}
): api.StaffTicketListItem {
  return {
    id: 1,
    ticketNumber: "TKT-2026-900002",
    summary: "Printer shows paper jam",
    requestedPriority: "LOW",
    itPriority: "HIGH",
    currentStatus: "OPEN",
    requesterMarkedResolved: false,
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-02T10:00:00.000Z",
    category: { id: 2, name: "Hardware" },
    requester: { id: 1, name: "Jennifer Anderson" },
    owner: { id: 6, name: "Priya Nair" },
    ...overrides,
  };
}

function page(
  items: api.StaffTicketListItem[],
  extra: Partial<api.StaffTicketListResponse> = {}
): api.StaffTicketListResponse {
  return {
    items,
    page: 1,
    pageSize: 10,
    totalItems: items.length,
    totalPages: items.length === 0 ? 0 : 1,
    ...extra,
  };
}

function renderQueue(onOpen = vi.fn()) {
  render(<StaffTicketQueue currentUserId={6} onOpenTicket={onOpen} />);
  return onOpen;
}

beforeEach(() => {
  vi.restoreAllMocks();

  vi.spyOn(api, "getCategories").mockResolvedValue([
    { id: 2, name: "Hardware" },
    { id: 4, name: "Network" },
  ]);
  vi.spyOn(api, "getAssignees").mockResolvedValue([
    { id: 6, name: "Priya Nair", role: "IT_STAFF" },
    { id: 7, name: "Elena Rossi", role: "IT_STAFF" },
  ]);
});

describe("Ticket Queue", () => {
  it("shows the tickets with requester, priority, status, and owner", async () => {
    vi.spyOn(api, "getStaffTickets").mockResolvedValue(
      page([
        item(),
        item({
          id: 2,
          ticketNumber: "TKT-2026-900005",
          summary: "VPN connection times out",
          owner: null,
          itPriority: "MEDIUM",
          currentStatus: "NEW",
          requester: { id: 3, name: "Sarah Johnson" },
        }),
      ])
    );

    renderQueue();

    // The table (desktop) and the cards (mobile) are both in the page.
    expect((await screen.findAllByText("TKT-2026-900002")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sarah Johnson").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Unassigned").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Priya Nair").length).toBeGreaterThan(0);

    const table = screen.getByRole("table");
    expect(within(table).getAllByText("High").length).toBeGreaterThan(0);
    expect(within(table).getByText("Open", { selector: ".badge" })).toBeInTheDocument();
    expect(within(table).getByText("New", { selector: ".badge" })).toBeInTheDocument();
  });

  it("marks tickets the Requester says are resolved", async () => {
    vi.spyOn(api, "getStaffTickets").mockResolvedValue(
      page([item({ requesterMarkedResolved: true })])
    );

    renderQueue();

    expect((await screen.findAllByText("Requester says resolved")).length).toBeGreaterThan(0);
  });

  it("opens a ticket with the Open action", async () => {
    const row = item();
    vi.spyOn(api, "getStaffTickets").mockResolvedValue(page([row]));

    const onOpen = renderQueue();

    const table = await screen.findByRole("table");
    await userEvent.click(within(table).getByRole("button", { name: "Open" }));

    expect(onOpen).toHaveBeenCalledWith(row);
  });

  it("sends the search and filters and returns to page 1 when a filter changes", async () => {
    const spy = vi.spyOn(api, "getStaffTickets").mockResolvedValue(page([item()]));

    renderQueue();
    await screen.findByRole("table");

    await userEvent.type(screen.getByLabelText("Search"), "printer");
    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ search: "printer", page: 1 }))
    );

    await userEvent.selectOptions(screen.getByLabelText("Status"), "OPEN");
    await userEvent.selectOptions(screen.getByLabelText("IT Priority"), "HIGH");
    await userEvent.selectOptions(screen.getByLabelText("Category"), "2");
    await userEvent.selectOptions(screen.getByLabelText("Owner"), "unassigned");

    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          search: "printer",
          status: "OPEN",
          itPriority: "HIGH",
          categoryId: 2,
          ownerId: "unassigned",
          page: 1,
        })
      )
    );
  });

  it("offers Assigned to me and each staff member as owner filters", async () => {
    const spy = vi.spyOn(api, "getStaffTickets").mockResolvedValue(page([item()]));

    renderQueue();
    await screen.findByRole("table");

    const owner = screen.getByLabelText("Owner");
    expect(within(owner).getByText("Assigned to me")).toBeInTheDocument();
    expect(await within(owner).findByText("Elena Rossi")).toBeInTheDocument();

    await userEvent.selectOptions(owner, "6");

    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ ownerId: 6 }))
    );
  });

  it("applies the sort choices", async () => {
    const spy = vi.spyOn(api, "getStaffTickets").mockResolvedValue(page([item()]));

    renderQueue();
    await screen.findByRole("table");

    await userEvent.selectOptions(screen.getByLabelText("Sort"), "oldest");
    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith(
        expect.objectContaining({ sort: "createdAt", direction: "asc" })
      )
    );

    await userEvent.selectOptions(screen.getByLabelText("Sort"), "priority");
    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith(
        expect.objectContaining({ sort: "itPriority", direction: "desc" })
      )
    );
  });

  it("pages with Previous and Next", async () => {
    const spy = vi
      .spyOn(api, "getStaffTickets")
      .mockResolvedValue(page([item()], { page: 1, totalItems: 25, totalPages: 3 }));

    renderQueue();
    await screen.findByText(/Page 1 of 3/);

    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }))
    );
  });

  it("shows an empty message when the queue is empty", async () => {
    vi.spyOn(api, "getStaffTickets").mockResolvedValue(page([]));

    renderQueue();

    expect(await screen.findByText("The queue is empty.")).toBeInTheDocument();
  });

  it("shows no-results with Clear Filters when a filter matches nothing", async () => {
    const spy = vi.spyOn(api, "getStaffTickets").mockResolvedValue(page([item()]));

    renderQueue();
    await screen.findByRole("table");

    spy.mockResolvedValue(page([]));
    await userEvent.selectOptions(screen.getByLabelText("Status"), "CLOSED");

    expect(
      await screen.findByText("No tickets match your search or filters.")
    ).toBeInTheDocument();

    spy.mockResolvedValue(page([item()]));
    await userEvent.click(screen.getAllByRole("button", { name: "Clear Filters" })[0]);

    await screen.findByRole("table");
    expect(screen.getByLabelText("Status")).toHaveValue("");
  });

  it("shows a loading state while the queue loads", () => {
    vi.spyOn(api, "getStaffTickets").mockImplementation(() => new Promise(() => {}));

    renderQueue();

    expect(screen.getByText("Loading tickets...")).toBeInTheDocument();
  });

  it("shows a safe message with Retry when loading fails", async () => {
    const spy = vi
      .spyOn(api, "getStaffTickets")
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce(page([item()]));

    renderQueue();

    expect(await screen.findByRole("alert")).toHaveTextContent(/unable to load the ticket queue/i);

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    await screen.findByRole("table");
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

describe("Ticket Queue filters are kept", () => {
  it("starts with the filters it is given and reports every change", async () => {
    const spy = vi.spyOn(api, "getStaffTickets").mockResolvedValue(page([item()]));
    const onFiltersChange = vi.fn();

    render(
      <StaffTicketQueue
        currentUserId={6}
        onOpenTicket={() => {}}
        onFiltersChange={onFiltersChange}
        initialFilters={{
          search: "printer",
          status: "OPEN",
          itPriority: "HIGH",
          categoryId: "2",
          owner: "unassigned",
          sortChoice: "oldest",
          page: 2,
        }}
      />
    );

    await screen.findByRole("table");

    expect(screen.getByLabelText("Search")).toHaveValue("printer");
    expect(screen.getByLabelText("Status")).toHaveValue("OPEN");
    expect(screen.getByLabelText("Sort")).toHaveValue("oldest");
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        search: "printer",
        status: "OPEN",
        itPriority: "HIGH",
        categoryId: 2,
        ownerId: "unassigned",
        sort: "createdAt",
        direction: "asc",
        page: 2,
      })
    );

    await userEvent.selectOptions(screen.getByLabelText("Status"), "CLOSED");

    await waitFor(() =>
      expect(onFiltersChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "CLOSED", page: 1 })
      )
    );
  });

  it("is still filtered after opening a ticket and coming back", async () => {
    vi.spyOn(api, "getCurrentUser").mockResolvedValue({
      id: 6,
      name: "Priya Nair",
      email: "priya.nair@example.com",
      role: "IT_STAFF",
      mustChangePassword: false,
    });
    vi.spyOn(api, "getStaffTickets").mockResolvedValue(page([item()]));
    vi.spyOn(api, "getStaffTicket").mockResolvedValue({
      id: 1,
      ticketNumber: "TKT-2026-900002",
      summary: "Printer shows paper jam",
      description: "The printer reports a paper jam.",
      requestedPriority: "LOW",
      itPriority: "HIGH",
      currentStatus: "OPEN",
      requesterMarkedResolved: false,
      createdAt: "2026-10-01T10:00:00.000Z",
      updatedAt: "2026-10-02T10:00:00.000Z",
      requester: { id: 1, name: "Jennifer Anderson", email: "jennifer.anderson@example.com" },
      category: { id: 2, name: "Hardware" },
      relatedSystem: { id: 6, name: "Printer" },
      owner: null,
    });
    vi.spyOn(api, "getAttachments").mockResolvedValue([]);
    vi.spyOn(api, "getComments").mockResolvedValue([]);
    vi.spyOn(api, "getInternalNotes").mockResolvedValue([]);

    render(<App />);

    await screen.findByRole("table");
    await userEvent.selectOptions(screen.getByLabelText("Status"), "OPEN");
    await userEvent.selectOptions(screen.getByLabelText("IT Priority"), "HIGH");

    await userEvent.click(
      within(screen.getByRole("table")).getByRole("button", { name: "Open" })
    );
    await userEvent.click(await screen.findByRole("button", { name: "← Back to Queue" }));

    await screen.findByRole("table");
    expect(screen.getByLabelText("Status")).toHaveValue("OPEN");
    expect(screen.getByLabelText("IT Priority")).toHaveValue("HIGH");
  });
});
