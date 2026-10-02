import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StaffTicketDetail from "../../src/StaffTicketDetail.js";
import * as api from "../../src/api.js";

const priya: api.AuthUser = {
  id: 6,
  name: "Priya Nair",
  email: "priya.nair@example.com",
  role: "IT_STAFF",
  mustChangePassword: false,
};

function ticket(
  overrides: Partial<api.StaffTicketDetail> = {}
): api.StaffTicketDetail {
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
    requester: { id: 1, name: "Jennifer Anderson", email: "jennifer.anderson@example.com" },
    category: { id: 2, name: "Hardware" },
    relatedSystem: { id: 6, name: "Printer" },
    owner: { id: 6, name: "Priya Nair" },
    ...overrides,
  };
}

const comment: api.TicketComment = {
  id: 1,
  body: "Please try turning the printer off and on again.",
  createdAt: "2026-10-02T10:30:00.000Z",
  author: { id: 6, name: "Priya Nair", role: "IT_STAFF" },
};

const note: api.TicketComment = {
  id: 1,
  body: "Sensor may need cleaning.",
  createdAt: "2026-10-02T10:40:00.000Z",
  author: { id: 6, name: "Priya Nair", role: "IT_STAFF" },
};

function renderDetail() {
  return render(<StaffTicketDetail ticketId={10} currentUser={priya} onBack={() => {}} />);
}

beforeEach(() => {
  vi.restoreAllMocks();

  vi.spyOn(api, "getAssignees").mockResolvedValue([
    { id: 6, name: "Priya Nair", role: "IT_STAFF" },
    { id: 7, name: "Elena Rossi", role: "IT_STAFF" },
  ]);
  vi.spyOn(api, "getAttachments").mockResolvedValue([
    {
      id: 1,
      ticketId: 10,
      originalName: "error.png",
      mimeType: "image/png",
      sizeBytes: 2048,
      isRemoved: false,
      removalReason: null,
      removedAt: null,
      createdAt: "2026-10-02T09:00:00.000Z",
    },
  ]);
  vi.spyOn(api, "getComments").mockResolvedValue([comment]);
  vi.spyOn(api, "getInternalNotes").mockResolvedValue([note]);
});

describe("Staff Ticket Detail", () => {
  it("shows the ticket information, priorities, and requester", async () => {
    vi.spyOn(api, "getStaffTicket").mockResolvedValue(ticket());

    renderDetail();

    expect(await screen.findByText("TKT-2026-900002")).toBeInTheDocument();
    expect(screen.getByText("Jennifer Anderson")).toBeInTheDocument();
    expect(screen.getByText("jennifer.anderson@example.com")).toBeInTheDocument();
    expect(screen.getByText("Hardware")).toBeInTheDocument();
    expect(screen.getByText("Printer")).toBeInTheDocument();
    expect(screen.getByText("Requested Priority").nextElementSibling).toHaveTextContent("Low");
    expect(screen.getByLabelText("IT Priority")).toHaveValue("HIGH");
  });

  it("shows the requester's resolved indicator", async () => {
    vi.spyOn(api, "getStaffTicket").mockResolvedValue(ticket({ requesterMarkedResolved: true }));

    renderDetail();

    expect(await screen.findByText("Requester says resolved")).toBeInTheDocument();
  });

  it("shows attachments for download only", async () => {
    vi.spyOn(api, "getStaffTicket").mockResolvedValue(ticket());

    renderDetail();

    expect(await screen.findByText("error.png")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Download" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
    expect(screen.queryByText("+ Add Attachment")).toBeNull();
  });

  it("keeps Public Comments and Internal Notes apart", async () => {
    vi.spyOn(api, "getStaffTicket").mockResolvedValue(ticket());

    renderDetail();

    const publicPanel = (await screen.findByRole("heading", { name: "Public Comments" }))
      .closest("section") as HTMLElement;
    const internalPanel = screen
      .getByRole("heading", { name: /Internal Notes/ })
      .closest("section") as HTMLElement;

    expect(await within(publicPanel).findByText(comment.body)).toBeInTheDocument();
    expect(within(publicPanel).queryByText(note.body)).toBeNull();
    expect(within(publicPanel).getByText("Visible to the Requester.")).toBeInTheDocument();
    expect(within(publicPanel).getByRole("button", { name: "Post Public Comment" })).toBeInTheDocument();

    expect(await within(internalPanel).findByText(note.body)).toBeInTheDocument();
    expect(within(internalPanel).queryByText(comment.body)).toBeNull();
    expect(within(internalPanel).getByText("Staff only")).toBeInTheDocument();
    expect(within(internalPanel).getByText("Not visible to the Requester.")).toBeInTheDocument();
    expect(within(internalPanel).getByRole("button", { name: "Add Internal Note" })).toBeInTheDocument();
  });

  it("posts a Public Comment and an Internal Note through different endpoints", async () => {
    vi.spyOn(api, "getStaffTicket").mockResolvedValue(ticket());
    const commentSpy = vi.spyOn(api, "postComment").mockResolvedValue({ ...comment, id: 2, body: "Hello" });
    const noteSpy = vi.spyOn(api, "postInternalNote").mockResolvedValue({ ...note, id: 2, body: "Private" });

    renderDetail();

    await userEvent.type(await screen.findByLabelText("Add a comment"), "Hello");
    await userEvent.click(screen.getByRole("button", { name: "Post Public Comment" }));
    await waitFor(() => expect(commentSpy).toHaveBeenCalledWith(10, "Hello"));
    expect(noteSpy).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText("Add an internal note"), "Private");
    await userEvent.click(screen.getByRole("button", { name: "Add Internal Note" }));
    await waitFor(() => expect(noteSpy).toHaveBeenCalledWith(10, "Private"));
    expect(commentSpy).toHaveBeenCalledTimes(1);
  });

  it("validates an empty note and keeps the text when saving fails", async () => {
    vi.spyOn(api, "getStaffTicket").mockResolvedValue(ticket());
    const noteSpy = vi.spyOn(api, "postInternalNote").mockRejectedValue(new Error("fail"));

    renderDetail();

    await screen.findByLabelText("Add an internal note");
    await userEvent.click(screen.getByRole("button", { name: "Add Internal Note" }));
    expect(screen.getByText("Enter between 1 and 2000 characters.")).toBeInTheDocument();
    expect(noteSpy).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText("Add an internal note"), "Keep me");
    await userEvent.click(screen.getByRole("button", { name: "Add Internal Note" }));

    expect(await screen.findByText(/unable to add the note/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Add an internal note")).toHaveValue("Keep me");
  });
});

const save = () => screen.getByRole("button", { name: "Save Changes" });

describe("Saving changes", () => {
  it("saves nothing until Save Changes is pressed, and the button starts disabled", async () => {
    vi.spyOn(api, "getStaffTicket").mockResolvedValue(ticket());
    const updateSpy = vi.spyOn(api, "updateTicket").mockResolvedValue();
    const statusSpy = vi.spyOn(api, "changeStatus").mockResolvedValue();

    renderDetail();

    await screen.findByLabelText("Owner");
    expect(save()).toBeDisabled();

    await userEvent.selectOptions(screen.getByLabelText("Owner"), "7");
    await userEvent.selectOptions(screen.getByLabelText("IT Priority"), "LOW");
    await userEvent.selectOptions(screen.getByLabelText("Status"), "IN_PROGRESS");

    expect(save()).toBeEnabled();
    expect(updateSpy).not.toHaveBeenCalled();
    expect(statusSpy).not.toHaveBeenCalled();
  });

  it("Claim Ticket only selects you as the owner until you save", async () => {
    const getSpy = vi
      .spyOn(api, "getStaffTicket")
      .mockResolvedValueOnce(ticket({ owner: null }))
      .mockResolvedValue(ticket());
    const updateSpy = vi.spyOn(api, "updateTicket").mockResolvedValue();

    renderDetail();

    await userEvent.click(await screen.findByRole("button", { name: "Claim Ticket" }));

    expect(screen.getByLabelText("Owner")).toHaveValue("6");
    expect(updateSpy).not.toHaveBeenCalled();

    await userEvent.click(save());

    await waitFor(() => expect(updateSpy).toHaveBeenCalledWith(10, { ownerId: 6 }));
    expect(await screen.findByText("Changes saved.")).toBeInTheDocument();
    await waitFor(() => expect(getSpy).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("button", { name: "Claim Ticket" })).toBeNull();
  });

  it("does not offer Claim when the ticket already has an owner", async () => {
    vi.spyOn(api, "getStaffTicket").mockResolvedValue(ticket());

    renderDetail();

    await screen.findByLabelText("Owner");
    expect(screen.queryByRole("button", { name: "Claim Ticket" })).toBeNull();
  });

  it("reassigns and unassigns through the owner list", async () => {
    vi.spyOn(api, "getStaffTicket").mockResolvedValue(ticket());
    const updateSpy = vi.spyOn(api, "updateTicket").mockResolvedValue();

    renderDetail();

    const owner = await screen.findByLabelText("Owner");
    await waitFor(() => expect(within(owner).getByText("Elena Rossi")).toBeInTheDocument());

    await userEvent.selectOptions(owner, "7");
    await userEvent.click(save());
    await waitFor(() => expect(updateSpy).toHaveBeenLastCalledWith(10, { ownerId: 7 }));

    await screen.findByText("Changes saved.");
    await userEvent.selectOptions(screen.getByLabelText("Owner"), "");
    await userEvent.click(save());
    await waitFor(() => expect(updateSpy).toHaveBeenLastCalledWith(10, { ownerId: null }));
  });

  it("saves a new IT Priority and keeps the Requested Priority visible", async () => {
    vi.spyOn(api, "getStaffTicket").mockResolvedValue(ticket());
    const updateSpy = vi.spyOn(api, "updateTicket").mockResolvedValue();

    renderDetail();

    await userEvent.selectOptions(await screen.findByLabelText("IT Priority"), "LOW");
    await userEvent.click(save());

    await waitFor(() => expect(updateSpy).toHaveBeenCalledWith(10, { itPriority: "LOW" }));
    expect(await screen.findByText("Changes saved.")).toBeInTheDocument();
    expect(screen.getByText(/Requested by the Requester/)).toBeInTheDocument();
  });

  it("saves owner and priority in one request and sends only what changed", async () => {
    vi.spyOn(api, "getStaffTicket").mockResolvedValue(ticket());
    const updateSpy = vi.spyOn(api, "updateTicket").mockResolvedValue();

    renderDetail();

    const owner = await screen.findByLabelText("Owner");
    await waitFor(() => expect(within(owner).getByText("Elena Rossi")).toBeInTheDocument());
    await userEvent.selectOptions(owner, "7");
    await userEvent.selectOptions(screen.getByLabelText("IT Priority"), "MEDIUM");
    await userEvent.click(save());

    await waitFor(() => expect(updateSpy).toHaveBeenCalledTimes(1));
    expect(updateSpy).toHaveBeenCalledWith(10, { ownerId: 7, itPriority: "MEDIUM" });
  });

  it("Discard puts the original values back without saving", async () => {
    vi.spyOn(api, "getStaffTicket").mockResolvedValue(ticket());
    const updateSpy = vi.spyOn(api, "updateTicket").mockResolvedValue();

    renderDetail();

    await userEvent.selectOptions(await screen.findByLabelText("IT Priority"), "LOW");
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));

    expect(screen.getByLabelText("IT Priority")).toHaveValue("HIGH");
    expect(save()).toBeDisabled();
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("shows a safe message when saving fails", async () => {
    vi.spyOn(api, "getStaffTicket").mockResolvedValue(ticket());
    vi.spyOn(api, "updateTicket").mockRejectedValue(new Error("fail"));

    renderDetail();

    await userEvent.selectOptions(await screen.findByLabelText("IT Priority"), "LOW");
    await userEvent.click(save());

    expect(await screen.findByRole("alert")).toHaveTextContent(/unable to save the changes/i);
  });
});

describe("Status", () => {
  it("offers only the permitted next statuses", async () => {
    vi.spyOn(api, "getStaffTicket").mockResolvedValue(ticket({ currentStatus: "OPEN" }));

    renderDetail();

    const select = await screen.findByLabelText("Status");
    const options = within(select).getAllByRole("option").map((o) => o.textContent);

    expect(options).toEqual([
      "Current: Open",
      "In Progress",
      "Waiting for Requester",
      "Resolved",
      "Cancelled",
    ]);
  });

  it("changes the status without a confirmation for ordinary changes", async () => {
    vi.spyOn(api, "getStaffTicket").mockResolvedValue(ticket({ currentStatus: "OPEN" }));
    const statusSpy = vi.spyOn(api, "changeStatus").mockResolvedValue();
    const updateSpy = vi.spyOn(api, "updateTicket").mockResolvedValue();

    renderDetail();

    await userEvent.selectOptions(await screen.findByLabelText("Status"), "IN_PROGRESS");
    await userEvent.click(save());

    await waitFor(() => expect(statusSpy).toHaveBeenCalledWith(10, "IN_PROGRESS", false));
    expect(updateSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("saves the owner before the status, so one Save can claim and change status", async () => {
    vi.spyOn(api, "getStaffTicket").mockResolvedValue(ticket({ currentStatus: "NEW", owner: null }));
    const calls: string[] = [];
    vi.spyOn(api, "updateTicket").mockImplementation(async () => {
      calls.push("owner");
    });
    vi.spyOn(api, "changeStatus").mockImplementation(async () => {
      calls.push("status");
    });

    renderDetail();

    await userEvent.click(await screen.findByRole("button", { name: "Claim Ticket" }));
    await userEvent.selectOptions(screen.getByLabelText("Status"), "OPEN");
    await userEvent.click(save());

    await waitFor(() => expect(calls).toEqual(["owner", "status"]));
  });

  it("asks for confirmation to resolve before saving anything; Cancel makes no request", async () => {
    vi.spyOn(api, "getStaffTicket").mockResolvedValue(ticket({ currentStatus: "OPEN" }));
    const statusSpy = vi.spyOn(api, "changeStatus").mockResolvedValue();
    const updateSpy = vi.spyOn(api, "updateTicket").mockResolvedValue();

    renderDetail();

    await userEvent.selectOptions(await screen.findByLabelText("IT Priority"), "LOW");
    await userEvent.selectOptions(screen.getByLabelText("Status"), "RESOLVED");
    await userEvent.click(save());

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Change status to Resolved?")).toBeInTheDocument();
    expect(updateSpy).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(statusSpy).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("sends the confirmation when the user confirms", async () => {
    vi.spyOn(api, "getStaffTicket").mockResolvedValue(ticket({ currentStatus: "RESOLVED" }));
    const statusSpy = vi.spyOn(api, "changeStatus").mockResolvedValue();

    renderDetail();

    await userEvent.selectOptions(await screen.findByLabelText("Status"), "CLOSED");
    await userEvent.click(save());
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(statusSpy).toHaveBeenCalledWith(10, "CLOSED", true));
  });

  it("shows the rule message when the server refuses the status", async () => {
    vi.spyOn(api, "getStaffTicket").mockResolvedValue(ticket({ currentStatus: "NEW", owner: null }));
    vi.spyOn(api, "changeStatus").mockRejectedValue(
      new api.ApiError(409, "CONFLICT", "Assign an owner before changing the status.")
    );

    renderDetail();

    await userEvent.selectOptions(await screen.findByLabelText("Status"), "OPEN");
    await userEvent.click(save());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Assign an owner before changing the status."
    );
  });

  it("says what was saved when the status is refused after the other changes were saved", async () => {
    vi.spyOn(api, "getStaffTicket").mockResolvedValue(ticket({ currentStatus: "OPEN" }));
    vi.spyOn(api, "updateTicket").mockResolvedValue();
    vi.spyOn(api, "changeStatus").mockRejectedValue(
      new api.ApiError(409, "CONFLICT", "This status change is not allowed for the current status.")
    );

    renderDetail();

    await userEvent.selectOptions(await screen.findByLabelText("IT Priority"), "LOW");
    await userEvent.selectOptions(screen.getByLabelText("Status"), "IN_PROGRESS");
    await userEvent.click(save());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Owner and priority were saved, but the status was not changed\./
    );
  });

  it("says a cancelled ticket cannot change status", async () => {
    vi.spyOn(api, "getStaffTicket").mockResolvedValue(ticket({ currentStatus: "CANCELLED" }));

    renderDetail();

    expect(await screen.findByText(/its status cannot be changed/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("Status")).toBeNull();
  });
});

describe("Loading and failure", () => {
  it("shows a loading state", () => {
    vi.spyOn(api, "getStaffTicket").mockImplementation(() => new Promise(() => {}));

    renderDetail();

    expect(screen.getByText("Loading ticket...")).toBeInTheDocument();
  });

  it("shows not found for an unknown ticket", async () => {
    vi.spyOn(api, "getStaffTicket").mockRejectedValue(
      new api.ApiError(404, "NOT_FOUND", "Ticket was not found.")
    );

    renderDetail();

    expect(await screen.findByRole("alert")).toHaveTextContent("Ticket not found.");
  });

  it("shows a safe message with Retry when loading fails", async () => {
    const spy = vi
      .spyOn(api, "getStaffTicket")
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce(ticket());

    renderDetail();

    expect(await screen.findByRole("alert")).toHaveTextContent(/unable to load this ticket/i);

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("TKT-2026-900002")).toBeInTheDocument();
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
