import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

beforeEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();

  sessionStorage.setItem("developmentRequesterId", "1");

  vi.spyOn(api, "getDevelopmentRequesters").mockResolvedValue([
    {
      id: 1,
      name: "Jennifer Anderson",
      email: "jennifer.anderson@example.com",
    },
  ]);

  vi.spyOn(api, "getCategories").mockResolvedValue([
    { id: 1, name: "Account and Access" },
    { id: 2, name: "Hardware" },
  ]);
});

describe("My Tickets", () => {
  it("shows tickets owned by the selected requester", async () => {
    vi.spyOn(api, "getTickets").mockResolvedValue({
      items: [
        {
          id: 1,
          ticketNumber: "TKT-2026-000001",
          requesterId: 1,
          categoryId: 2,
          relatedSystemId: 7,
          summary: "Laptop battery drains quickly",
          description:
            "The laptop battery loses charge within 90 minutes.",
          requestedPriority: "MEDIUM",
          currentStatus: "NEW",
          createdAt: "2026-09-05T10:00:00.000Z",
          updatedAt: "2026-09-05T10:00:00.000Z",
          category: {
            id: 2,
            name: "Hardware",
          },
        },
      ],
      page: 1,
      pageSize: 10,
      totalItems: 1,
      totalPages: 1,
    });

    render(<App />);

    expect(
      await screen.findByText("TKT-2026-000001")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Laptop battery drains quickly")
    ).toBeInTheDocument();

    expect(
      screen.getAllByText("Hardware").length
    ).toBeGreaterThanOrEqual(2);
  });

  it("shows an empty state when the requester has no tickets", async () => {
    vi.spyOn(api, "getTickets").mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 10,
      totalItems: 0,
      totalPages: 0,
    });

    render(<App />);

    expect(
      await screen.findByText(/no tickets yet/i)
    ).toBeInTheDocument();
  });

  it("shows a safe error state when tickets cannot be loaded", async () => {
    vi.spyOn(api, "getTickets").mockRejectedValue(
      new Error("Server error")
    );

    render(<App />);

    expect(
      await screen.findByRole("alert")
    ).toHaveTextContent(
      "Unable to load tickets. Please try again."
    );
  });

  it("applies search and reloads the ticket list", async () => {
    const getTicketsSpy = vi
      .spyOn(api, "getTickets")
      .mockResolvedValue({
        items: [],
        page: 1,
        pageSize: 10,
        totalItems: 0,
        totalPages: 0,
      });

    render(<App />);

    const searchInput = await screen.findByLabelText(/search/i);

    await userEvent.type(searchInput, "laptop");

    expect(getTicketsSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        requesterId: 1,
        search: "laptop",
      })
    );
  });

  it("applies filters and sorting", async () => {
    const getTicketsSpy = vi
      .spyOn(api, "getTickets")
      .mockResolvedValue({
        items: [],
        page: 1,
        pageSize: 10,
        totalItems: 0,
        totalPages: 0,
      });

    render(<App />);

    await userEvent.selectOptions(
      await screen.findByLabelText(/status/i),
      "NEW"
    );

    await userEvent.selectOptions(
      screen.getByLabelText(/category/i),
      "2"
    );

    await userEvent.selectOptions(
      screen.getByLabelText(/priority/i),
      "HIGH"
    );

    await userEvent.selectOptions(
      screen.getByLabelText(/sort/i),
      "createdAt_asc"
    );

    expect(getTicketsSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        requesterId: 1,
        status: "NEW",
        categoryId: 2,
        requestedPriority: "HIGH",
        sort: "createdAt_asc",
        page: 1,
      })
    );
  });

  it("uses pagination metadata to load the next page", async () => {
    const getTicketsSpy = vi
      .spyOn(api, "getTickets")
      .mockResolvedValue({
        items: [
          {
            id: 1,
            ticketNumber: "TKT-2026-000001",
            requesterId: 1,
            categoryId: 2,
            relatedSystemId: 7,
            summary: "Laptop issue",
            description: "Laptop issue description.",
            requestedPriority: "MEDIUM",
            currentStatus: "NEW",
            createdAt: "2026-09-05T10:00:00.000Z",
            updatedAt: "2026-09-05T10:00:00.000Z",
            category: {
              id: 2,
              name: "Hardware",
            },
          },
        ],
        page: 1,
        pageSize: 10,
        totalItems: 20,
        totalPages: 2,
      });

    render(<App />);

    await userEvent.click(
      await screen.findByRole("button", { name: /next/i })
    );

    expect(getTicketsSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        requesterId: 1,
        page: 2,
        pageSize: 10,
      })
    );
  });

  it("reloads tickets after changing requester", async () => {
    sessionStorage.setItem("developmentRequesterId", "1");

    vi.spyOn(api, "getDevelopmentRequesters").mockResolvedValue([
      {
        id: 1,
        name: "Jennifer Anderson",
        email: "jennifer.anderson@example.com",
      },
      {
        id: 2,
        name: "Michael Brown",
        email: "michael.brown@example.com",
      },
    ]);

    const getTicketsSpy = vi
      .spyOn(api, "getTickets")
      .mockResolvedValue({
        items: [],
        page: 1,
        pageSize: 10,
        totalItems: 0,
        totalPages: 0,
      });

    render(<App />);

    await screen.findByText(/no tickets yet/i);

    await userEvent.click(
      screen.getByRole("button", {
        name: /change requester/i,
      })
    );

    await userEvent.selectOptions(
      await screen.findByLabelText(/development requester/i),
      "2"
    );

    await userEvent.click(
      screen.getByRole("button", { name: /continue/i })
    );

    expect(getTicketsSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        requesterId: 2,
      })
    );
  });

  it("provides an Open action for a ticket", async () => {
    vi.spyOn(api, "getTickets").mockResolvedValue({
      items: [
        {
          id: 1,
          ticketNumber: "TKT-2026-000001",
          requesterId: 1,
          categoryId: 2,
          relatedSystemId: 7,
          summary: "Laptop battery drains quickly",
          description:
            "The laptop battery loses charge within 90 minutes.",
          requestedPriority: "MEDIUM",
          currentStatus: "NEW",
          createdAt: "2026-09-05T10:00:00.000Z",
          updatedAt: "2026-09-05T10:00:00.000Z",
          category: {
            id: 2,
            name: "Hardware",
          },
        },
      ],
      page: 1,
      pageSize: 10,
      totalItems: 1,
      totalPages: 1,
    });

    render(<App />);

    expect(
      await screen.findByRole("button", { name: /open/i })
    ).toBeInTheDocument();
  });
});