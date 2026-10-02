import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TicketDetail from "../../src/TicketDetail.js";
import StatusBadge, { STATUS_OPTIONS } from "../../src/StatusBadge.js";
import * as api from "../../src/api.js";

function ticket(overrides: Partial<api.TicketDetail> = {}): api.TicketDetail {
  return {
    id: 10,
    ticketNumber: "TKT-2026-900002",
    requesterId: 1,
    categoryId: 2,
    relatedSystemId: 6,
    summary: "Printer shows paper jam",
    description: "The printer reports a paper jam.",
    requestedPriority: "LOW",
    itPriority: "HIGH",
    currentStatus: "OPEN",
    requesterMarkedResolved: false,
    createdAt: "2026-10-02T10:00:00.000Z",
    updatedAt: "2026-10-02T10:00:00.000Z",
    owner: { id: 6, name: "Priya Nair" },
    category: { id: 2, name: "Hardware" },
    relatedSystem: { id: 6, name: "Printer" },
    ...overrides,
  };
}

const staffComment: api.TicketComment = {
  id: 1,
  body: "Please try turning the printer off and on again.",
  createdAt: "2026-10-02T10:30:00.000Z",
  author: { id: 6, name: "Priya Nair", role: "IT_STAFF" },
};

function renderDetail() {
  return render(
    <TicketDetail ticketId={10} requesterName="Jennifer Anderson" onBack={() => {}} />
  );
}

beforeEach(() => {
  vi.restoreAllMocks();

  vi.spyOn(api, "getAttachments").mockResolvedValue([]);
  vi.spyOn(api, "getComments").mockResolvedValue([staffComment]);
});

describe("Requester Ticket Detail (Lab 3)", () => {
  it("shows the status, IT Priority, and owner", async () => {
    vi.spyOn(api, "getTicketById").mockResolvedValue(ticket());

    renderDetail();

    expect(await screen.findByText("TKT-2026-900002")).toBeInTheDocument();
    expect(screen.getAllByText("Open").length).toBeGreaterThan(0);
    expect(screen.getByText("IT Priority")).toBeInTheDocument();
    expect(screen.getByText("IT Priority").nextElementSibling).toHaveTextContent("High");
    expect(screen.getByText("Assigned To").nextElementSibling).toHaveTextContent("Priya Nair");
  });

  it("says the ticket is not assigned yet when it has no owner", async () => {
    vi.spyOn(api, "getTicketById").mockResolvedValue(ticket({ owner: null }));

    renderDetail();

    expect(await screen.findByText("Not assigned yet")).toBeInTheDocument();
  });

  it("never shows Internal Notes and never asks for them", async () => {
    vi.spyOn(api, "getTicketById").mockResolvedValue(ticket());

    renderDetail();

    await screen.findByText("TKT-2026-900002");

    expect(screen.queryByText(/internal note/i)).toBeNull();
    expect(screen.queryByText(/staff only/i)).toBeNull();
  });
});

describe("Problem Appears Resolved", () => {
  it("sends the update, shows the confirmation, and keeps the status", async () => {
    vi.spyOn(api, "getTicketById").mockResolvedValue(ticket());
    const resolvedSpy = vi.spyOn(api, "markAppearsResolved").mockResolvedValue();

    renderDetail();

    await userEvent.click(
      await screen.findByRole("button", { name: "Problem Appears Resolved" })
    );

    expect(resolvedSpy).toHaveBeenCalledWith(10);
    expect(
      await screen.findByText(/you told it this appears resolved/i)
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Problem Appears Resolved" })).toBeNull();
    expect(screen.getAllByText("Open").length).toBeGreaterThan(0);
  });

  it("shows the confirmation instead of the button when it was already sent", async () => {
    vi.spyOn(api, "getTicketById").mockResolvedValue(
      ticket({ requesterMarkedResolved: true })
    );

    renderDetail();

    expect(
      await screen.findByText(/you told it this appears resolved/i)
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Problem Appears Resolved" })).toBeNull();
  });

  it("is not offered once the ticket is resolved, closed, or cancelled", async () => {
    for (const status of ["RESOLVED", "CLOSED", "CANCELLED"] as const) {
      vi.spyOn(api, "getTicketById").mockResolvedValue(ticket({ currentStatus: status }));

      const { unmount } = renderDetail();

      await screen.findByText("TKT-2026-900002");
      expect(screen.queryByRole("button", { name: "Problem Appears Resolved" })).toBeNull();

      unmount();
    }
  });

  it("shows a safe message when sending fails and lets the user try again", async () => {
    vi.spyOn(api, "getTicketById").mockResolvedValue(ticket());
    vi.spyOn(api, "markAppearsResolved").mockRejectedValue(new Error("fail"));

    renderDetail();

    await userEvent.click(
      await screen.findByRole("button", { name: "Problem Appears Resolved" })
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(/unable to send your update/i);
    expect(screen.getByRole("button", { name: "Problem Appears Resolved" })).toBeEnabled();
  });
});

describe("Public Comments", () => {
  it("lists the comments with author, role, and plain text", async () => {
    vi.spyOn(api, "getTicketById").mockResolvedValue(ticket());
    vi.spyOn(api, "getComments").mockResolvedValue([
      { ...staffComment, body: "<b>not bold</b>" },
    ]);

    renderDetail();

    expect(await screen.findByText("<b>not bold</b>")).toBeInTheDocument();
    expect(screen.getByText("IT Staff")).toBeInTheDocument();
    expect(screen.getAllByText("Priya Nair").length).toBeGreaterThan(0);
  });

  it("shows an empty message when there are no comments", async () => {
    vi.spyOn(api, "getTicketById").mockResolvedValue(ticket());
    vi.spyOn(api, "getComments").mockResolvedValue([]);

    renderDetail();

    expect(await screen.findByText("No comments yet.")).toBeInTheDocument();
  });

  it("posts a comment, adds it to the list, and clears the box", async () => {
    vi.spyOn(api, "getTicketById").mockResolvedValue(ticket());
    const postSpy = vi.spyOn(api, "postComment").mockResolvedValue({
      id: 2,
      body: "Thank you, trying that now.",
      createdAt: "2026-10-02T11:00:00.000Z",
      author: { id: 1, name: "Jennifer Anderson", role: "REQUESTER" },
    });

    renderDetail();

    await userEvent.type(
      await screen.findByLabelText("Add a comment"),
      "  Thank you, trying that now.  "
    );
    await userEvent.click(screen.getByRole("button", { name: "Post Public Comment" }));

    expect(postSpy).toHaveBeenCalledWith(10, "Thank you, trying that now.");
    expect(await screen.findByText("Thank you, trying that now.")).toBeInTheDocument();
    expect(screen.getByLabelText("Add a comment")).toHaveValue("");
  });

  it("validates an empty comment without calling the API", async () => {
    vi.spyOn(api, "getTicketById").mockResolvedValue(ticket());
    const postSpy = vi.spyOn(api, "postComment");

    renderDetail();

    await screen.findByLabelText("Add a comment");
    await userEvent.click(screen.getByRole("button", { name: "Post Public Comment" }));

    expect(screen.getByText("Enter between 1 and 2000 characters.")).toBeInTheDocument();
    expect(postSpy).not.toHaveBeenCalled();
  });

  it("disables the button while posting", async () => {
    vi.spyOn(api, "getTicketById").mockResolvedValue(ticket());
    vi.spyOn(api, "postComment").mockImplementation(() => new Promise(() => {}));

    renderDetail();

    await userEvent.type(await screen.findByLabelText("Add a comment"), "Hello");
    await userEvent.click(screen.getByRole("button", { name: "Post Public Comment" }));

    expect(screen.getByRole("button", { name: /posting/i })).toBeDisabled();
  });

  it("keeps the typed text and shows a safe message when posting fails", async () => {
    vi.spyOn(api, "getTicketById").mockResolvedValue(ticket());
    vi.spyOn(api, "postComment").mockRejectedValue(new Error("fail"));

    renderDetail();

    await userEvent.type(await screen.findByLabelText("Add a comment"), "Keep me");
    await userEvent.click(screen.getByRole("button", { name: "Post Public Comment" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/unable to post the comment/i);
    expect(screen.getByLabelText("Add a comment")).toHaveValue("Keep me");
  });

  it("shows a safe message with Retry when comments cannot be loaded", async () => {
    vi.spyOn(api, "getTicketById").mockResolvedValue(ticket());
    const getSpy = vi
      .spyOn(api, "getComments")
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce([staffComment]);

    renderDetail();

    expect(await screen.findByText(/unable to load comments/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(getSpy).toHaveBeenCalledTimes(2));
    expect(
      await screen.findByText("Please try turning the printer off and on again.")
    ).toBeInTheDocument();
  });
});

describe("Status badge", () => {
  it("shows a readable label for every status", () => {
    const expected = [
      "New",
      "Open",
      "In Progress",
      "Waiting for Requester",
      "Resolved",
      "Closed",
      "Reopened",
      "Cancelled",
    ];

    expect(STATUS_OPTIONS.map((option) => option.label)).toEqual(expected);

    for (const option of STATUS_OPTIONS) {
      const { unmount } = render(<StatusBadge status={option.value} />);
      expect(screen.getByText(option.label)).toHaveClass("badge");
      unmount();
    }
  });
});
