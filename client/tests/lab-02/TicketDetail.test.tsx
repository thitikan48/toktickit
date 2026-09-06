import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TicketDetail from "../../src/TicketDetail.js";
import * as api from "../../src/api.js";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("Requester Ticket Detail", () => {
  it("shows an owned Ticket as read-only information", async () => {
    vi.spyOn(
      api,
      "getTicketById"
    ).mockResolvedValue({
      id: 1,
      ticketNumber:
        "TKT-2026-000001",
      requesterId: 1,
      categoryId: 2,
      relatedSystemId: 7,
      summary:
        "Laptop battery drains quickly",
      description:
        "The laptop battery loses charge within 90 minutes.",
      requestedPriority:
        "MEDIUM",
      currentStatus: "NEW",
      createdAt:
        "2026-09-05T10:00:00.000Z",
      updatedAt:
        "2026-09-05T10:00:00.000Z",

      category: {
        id: 2,
        name: "Hardware",
      },

      relatedSystem: {
        id: 7,
        name:
          "Corporate Laptop",
      },
    });

    render(
      <TicketDetail
        ticketId={1}
        requesterId={1}
        requesterName="Jennifer Anderson"
        onBack={() => {}}
      />
    );

    expect(
      await screen.findByText(
        "TKT-2026-000001"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Laptop battery drains quickly"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "The laptop battery loses charge within 90 minutes."
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Hardware"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Corporate Laptop"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Jennifer Anderson"
      )
    ).toBeInTheDocument();

    expect(
      screen.queryByRole(
        "textbox"
      )
    ).not.toBeInTheDocument();
  });

  it("requests the Ticket for the selected Requester", async () => {
    const getTicketSpy =
      vi.spyOn(
        api,
        "getTicketById"
      ).mockResolvedValue({
        id: 10,
        ticketNumber:
          "TKT-2026-000010",
        requesterId: 2,
        categoryId: 1,
        relatedSystemId: 1,
        summary:
          "Account access issue",
        description:
          "Unable to access the account.",
        requestedPriority:
          "LOW",
        currentStatus: "NEW",
        createdAt:
          "2026-09-05T10:00:00.000Z",
        updatedAt:
          "2026-09-05T10:00:00.000Z",

        category: {
          id: 1,
          name:
            "Account and Access",
        },

        relatedSystem: {
          id: 1,
          name: "Email",
        },
      });

    render(
      <TicketDetail
        ticketId={10}
        requesterId={2}
        requesterName="Michael Brown"
        onBack={() => {}}
      />
    );

    await screen.findByText(
      "TKT-2026-000010"
    );

    expect(
      getTicketSpy
    ).toHaveBeenCalledWith(
      10,
      2
    );
  });

  it("shows a loading state", () => {
    vi.spyOn(
      api,
      "getTicketById"
    ).mockImplementation(
      () =>
        new Promise(
          () => {}
        )
    );

    render(
      <TicketDetail
        ticketId={1}
        requesterId={1}
        requesterName="Jennifer Anderson"
        onBack={() => {}}
      />
    );

    expect(
      screen.getByText(
        /loading ticket/i
      )
    ).toBeInTheDocument();
  });

  it("shows a safe error state", async () => {
    vi.spyOn(
      api,
      "getTicketById"
    ).mockRejectedValue(
      new Error(
        "Server error"
      )
    );

    render(
      <TicketDetail
        ticketId={1}
        requesterId={1}
        requesterName="Jennifer Anderson"
        onBack={() => {}}
      />
    );

    expect(
      await screen.findByRole(
        "alert"
      )
    ).toHaveTextContent(
      "Unable to load this ticket. Please return to My Tickets and try again."
    );
  });

  it("allows returning to My Tickets", async () => {
    vi.spyOn(
      api,
      "getTicketById"
    ).mockResolvedValue({
      id: 1,
      ticketNumber:
        "TKT-2026-000001",
      requesterId: 1,
      categoryId: 2,
      relatedSystemId: 7,
      summary:
        "Laptop issue",
      description:
        "Laptop issue description.",
      requestedPriority:
        "MEDIUM",
      currentStatus: "NEW",
      createdAt:
        "2026-09-05T10:00:00.000Z",
      updatedAt:
        "2026-09-05T10:00:00.000Z",

      category: {
        id: 2,
        name: "Hardware",
      },

      relatedSystem: {
        id: 7,
        name:
          "Corporate Laptop",
      },
    });

    const onBack = vi.fn();

    render(
      <TicketDetail
        ticketId={1}
        requesterId={1}
        requesterName="Jennifer Anderson"
        onBack={onBack}
      />
    );

    await userEvent.click(
      await screen.findByRole(
        "button",
        {
          name:
            /back to my tickets/i,
        }
      )
    );

    expect(
      onBack
    ).toHaveBeenCalledTimes(1);
  });
});