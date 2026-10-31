import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ActionsTaken from "../../src/ActionsTaken.js";
import ActionStatusBadge from "../../src/ActionStatusBadge.js";
import * as api from "../../src/api.js";

const PRIYA = 6;

function action(overrides: Partial<api.ActionTaken> = {}): api.ActionTaken {
  return {
    id: 1,
    ticketId: 10,
    actionAt: "2026-11-02T02:20:00.000Z",
    description: "Reset the multi-factor enrolment.",
    result: null,
    status: "PLANNED",
    assignedTo: { id: 7, name: "Marcus Chen" },
    performedBy: null,
    followUpRequired: false,
    followUpNote: null,
    attachmentNotes: null,
    createdBy: { id: 6, name: "Priya Nair" },
    updatedBy: { id: 6, name: "Priya Nair" },
    createdAt: "2026-11-02T02:20:00.000Z",
    updatedAt: "2026-11-02T02:20:00.000Z",
    ...overrides,
  };
}

function renderStaff() {
  return render(<ActionsTaken ticketId={10} mode="staff" currentUserId={PRIYA} />);
}

async function openView(index = 0) {
  const buttons = await screen.findAllByRole("button", { name: /^view action/i });
  await userEvent.click(buttons[index]);
  return screen.getByRole("group", { name: "Action Details" });
}

beforeEach(() => {
  vi.restoreAllMocks();

  vi.spyOn(api, "getAssignees").mockResolvedValue([
    { id: 6, name: "Priya Nair", role: "IT_STAFF" },
    { id: 7, name: "Marcus Chen", role: "IT_STAFF" },
  ]);
  vi.spyOn(api, "getStaffActions").mockResolvedValue([action()]);
  vi.spyOn(api, "getRequesterActions").mockResolvedValue([action()]);
});

describe("Actions Taken list", () => {
  it("UI-09 shows the table columns, Not yet performed, and the empty, loading, and failure states", async () => {
    vi.mocked(api.getStaffActions).mockResolvedValueOnce([
      action(),
      action({
        id: 2,
        status: "COMPLETED",
        performedBy: { id: 7, name: "Marcus Chen" },
        followUpRequired: true,
        followUpNote: "Check again.",
      }),
    ]);

    const { unmount } = renderStaff();

    expect(screen.getByText("Loading actions...")).toBeInTheDocument();

    const table = await screen.findByRole("table");
    for (const header of ["Action Date", "Description", "Status", "Assigned To", "Performed By"]) {
      expect(within(table).getByRole("columnheader", { name: header })).toBeInTheDocument();
    }
    expect(within(table).getByText("Not yet performed")).toBeInTheDocument();
    expect(within(table).getAllByText("Marcus Chen").length).toBeGreaterThan(0);
    expect(within(table).getByText("Follow-up needed")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Actions Taken (2)" })).toBeInTheDocument();
    unmount();

    vi.mocked(api.getStaffActions).mockResolvedValueOnce([]);
    const empty = renderStaff();
    expect(await screen.findByText("No actions have been recorded yet.")).toBeInTheDocument();
    empty.unmount();

    vi.mocked(api.getStaffActions)
      .mockRejectedValueOnce(new api.ApiError(500, "SERVER_ERROR", "boom"))
      .mockResolvedValueOnce([action()]);
    renderStaff();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Unable to load the actions.");
    await userEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(api.getStaffActions).toHaveBeenCalledTimes(4);
  });
});

describe("Create mode", () => {
  it("UI-10 shows the fields in order with defaults and creates the action", async () => {
    const create = vi.spyOn(api, "createAction").mockResolvedValue(action({ id: 5 }));

    renderStaff();
    await userEvent.click(await screen.findByRole("button", { name: "Add Action" }));
    const form = screen.getByRole("group", { name: "Add Action" });

    const labels = within(form)
      .getAllByText(/./, { selector: "label" })
      .map((label) => label.textContent?.replace("*", "").trim());
    expect(labels).toEqual([
      "Action Date and Time",
      "Action Description",
      "Status",
      "Result",
      "Assigned To",
      "Follow-Up Required",
      "Attachment Notes",
    ]);

    expect(within(form).getByLabelText(/^status/i)).toHaveValue("PLANNED");
    await waitFor(() => expect(within(form).getByLabelText(/^assigned to/i)).toHaveValue(String(PRIYA)));
    expect(within(form).getByLabelText(/^action date and time/i)).not.toHaveValue("");

    expect(within(form).queryByLabelText(/^follow-up note/i)).not.toBeInTheDocument();
    await userEvent.click(within(form).getByLabelText(/^follow-up required/i));
    expect(within(form).getByLabelText(/^follow-up note/i)).toBeInTheDocument();

    fireEvent.change(within(form).getByLabelText(/^action date and time/i), {
      target: { value: "2026-11-03T10:00" },
    });
    await userEvent.type(within(form).getByLabelText(/^action description/i), "Cleaned the sensor.");
    await userEvent.selectOptions(within(form).getByLabelText(/^assigned to/i), "7");
    await userEvent.type(within(form).getByLabelText(/^follow-up note/i), "Check on Monday.");
    await userEvent.type(within(form).getByLabelText(/^attachment notes/i), "See sensor.jpg");

    await userEvent.click(within(form).getByRole("button", { name: "Save Action" }));

    expect(create).toHaveBeenCalledWith(10, {
      actionAt: "2026-11-03T03:00:00.000Z",
      description: "Cleaned the sensor.",
      status: "PLANNED",
      result: "",
      assignedToId: 7,
      followUpRequired: true,
      followUpNote: "Check on Monday.",
      attachmentNotes: "See sensor.jpg",
    });
    expect(await screen.findByText("Action saved.")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Add Action" })).not.toBeInTheDocument();
  });

  it("UI-11 shows server field errors under the fields and a 409 alert, keeping the values", async () => {
    const create = vi
      .spyOn(api, "createAction")
      .mockRejectedValueOnce(
        new api.ApiError(400, "VALIDATION_ERROR", "Invalid", {
          description: "Enter between 1 and 1000 characters.",
          attachmentNotes: "Enter at most 500 characters.",
        })
      )
      .mockRejectedValueOnce(
        new api.ApiError(409, "CONFLICT", "The assignee must be an active IT Staff or Administrator user.")
      );

    renderStaff();
    await userEvent.click(await screen.findByRole("button", { name: "Add Action" }));
    const form = screen.getByRole("group", { name: "Add Action" });

    await userEvent.type(within(form).getByLabelText(/^attachment notes/i), "Kept text");
    await userEvent.click(within(form).getByRole("button", { name: "Save Action" }));

    const description = within(form).getByLabelText(/^action description/i);
    expect(await within(form).findByText("Enter between 1 and 1000 characters.")).toBeInTheDocument();
    expect(within(form).getByText("Enter at most 500 characters.")).toBeInTheDocument();
    expect(description).toHaveAttribute("aria-invalid", "true");
    expect(description).toHaveFocus();
    expect(within(form).getByLabelText(/^attachment notes/i)).toHaveValue("Kept text");

    await userEvent.type(description, "Valid text");
    await userEvent.click(within(form).getByRole("button", { name: "Save Action" }));

    expect(await within(form).findByRole("alert")).toHaveTextContent(
      "The assignee must be an active IT Staff or Administrator user."
    );
    expect(description).toHaveValue("Valid text");
    expect(create).toHaveBeenCalledTimes(2);
  });
});

describe("View and edit mode", () => {
  it("UI-12 shows the buttons for each status and confirms Cancel Action", async () => {
    const update = vi.spyOn(api, "updateAction").mockResolvedValue(action({ status: "CANCELLED" }));
    vi.mocked(api.getStaffActions).mockResolvedValue([
      action(),
      action({ id: 2, status: "IN_PROGRESS" }),
      action({ id: 3, status: "COMPLETED", performedBy: { id: 7, name: "Marcus Chen" } }),
    ]);

    renderStaff();

    let panel = await openView(0);
    for (const name of ["Edit", "Start", "Complete", "Cancel Action", "Close"]) {
      expect(within(panel).getByRole("button", { name })).toBeInTheDocument();
    }
    await userEvent.click(within(panel).getByRole("button", { name: "Close" }));

    panel = await openView(1);
    expect(within(panel).queryByRole("button", { name: "Start" })).not.toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Complete" })).toBeInTheDocument();
    await userEvent.click(within(panel).getByRole("button", { name: "Close" }));

    panel = await openView(2);
    expect(within(panel).getByText("This action is Completed and cannot be changed.")).toBeInTheDocument();
    expect(within(panel).getAllByRole("button").map((b) => b.textContent)).toEqual(["Close"]);
    await userEvent.click(within(panel).getByRole("button", { name: "Close" }));

    panel = await openView(0);
    await userEvent.click(within(panel).getByRole("button", { name: "Cancel Action" }));
    let dialog = screen.getByRole("dialog", { name: "Cancel this action?" });
    expect(dialog).toHaveTextContent("The action stays in the list as Cancelled and cannot be changed again.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Keep Action" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await userEvent.click(within(panel).getByRole("button", { name: "Cancel Action" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();

    await userEvent.click(within(panel).getByRole("button", { name: "Cancel Action" }));
    dialog = screen.getByRole("dialog", { name: "Cancel this action?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel Action" }));
    expect(update).toHaveBeenCalledWith(10, 1, { status: "CANCELLED" });

    // Edit sends only the changed fields and never the status.
    panel = await openView(0);
    await userEvent.click(within(panel).getByRole("button", { name: "Edit" }));
    const edit = screen.getByRole("group", { name: "Edit Action" });
    expect(within(edit).queryByLabelText(/^status/i)).not.toBeInTheDocument();
    await userEvent.type(within(edit).getByLabelText(/^result/i), "Partly fixed.");
    await userEvent.click(within(edit).getByRole("button", { name: "Save Changes" }));
    expect(update).toHaveBeenLastCalledWith(10, 1, { result: "Partly fixed." });
  });

  it("UI-13 sends one request on a double click and keeps the values after a 500", async () => {
    let finish: (value: api.ActionTaken) => void = () => {};
    const create = vi.spyOn(api, "createAction").mockImplementationOnce(
      () => new Promise((resolve) => (finish = resolve))
    );

    renderStaff();
    await userEvent.click(await screen.findByRole("button", { name: "Add Action" }));
    let form = screen.getByRole("group", { name: "Add Action" });
    await userEvent.type(within(form).getByLabelText(/^action description/i), "First try");

    await userEvent.dblClick(within(form).getByRole("button", { name: "Save Action" }));
    expect(create).toHaveBeenCalledTimes(1);
    expect(within(form).getByRole("button", { name: "Saving..." })).toBeDisabled();

    finish(action({ id: 9 }));
    await screen.findByText("Action saved.");

    create.mockRejectedValueOnce(new api.ApiError(500, "SERVER_ERROR", "boom"));
    await userEvent.click(screen.getByRole("button", { name: "Add Action" }));
    form = screen.getByRole("group", { name: "Add Action" });
    await userEvent.type(within(form).getByLabelText(/^action description/i), "Second try");
    await userEvent.click(within(form).getByRole("button", { name: "Save Action" }));

    expect(await within(form).findByRole("alert")).toHaveTextContent("Unable to save. Please try again.");
    expect(within(form).getByLabelText(/^action description/i)).toHaveValue("Second try");
    expect(within(form).getByRole("button", { name: "Save Action" })).toBeEnabled();
  });

  it("UI-12 edit mode keeps Performed By, Created By, and the times read-only, with no Status select", async () => {
    const update = vi.spyOn(api, "updateAction").mockResolvedValue(action());
    vi.mocked(api.getStaffActions).mockResolvedValue([
      action({
        status: "IN_PROGRESS",
        createdBy: { id: 6, name: "Priya Nair" },
        updatedBy: { id: 8, name: "Elena Rossi" },
      }),
    ]);

    renderStaff();
    const panel = await openView(0);
    await userEvent.click(within(panel).getByRole("button", { name: "Edit" }));
    const edit = screen.getByRole("group", { name: "Edit Action" });

    const performedBy = within(edit).getByLabelText(/^performed by/i);
    expect(performedBy).toHaveAttribute("readonly");
    expect(performedBy).toHaveValue("Not yet performed");
    expect(performedBy.style.backgroundColor).toBe("rgb(238, 243, 240)");
    expect(within(edit).getByText(/Created by Priya Nair on .*Last updated by Elena Rossi on/)).toBeInTheDocument();
    expect(within(edit).getByText("In Progress")).toBeInTheDocument();

    // No Status select: the only select is Assigned To.
    expect(within(edit).queryByLabelText(/^status/i)).not.toBeInTheDocument();
    expect(within(edit).getAllByRole("combobox")).toHaveLength(1);

    await userEvent.type(within(edit).getByLabelText(/^action description/i), " Again.");
    await userEvent.click(within(edit).getByRole("button", { name: "Save Changes" }));
    const sent = update.mock.calls[0][2];
    expect(sent).not.toHaveProperty("status");
    expect(sent).not.toHaveProperty("performedById");
  });

  it("UI-14 shows the Requester a finished action read-only with the message and only Close", async () => {
    vi.mocked(api.getRequesterActions).mockResolvedValue([
      action({ status: "CANCELLED" }),
    ]);

    render(<ActionsTaken ticketId={10} mode="requester" />);
    const panel = await openView(0);

    expect(within(panel).getByText("This action is Cancelled and cannot be changed.")).toBeInTheDocument();
    expect(within(panel).getAllByRole("button").map((b) => b.textContent)).toEqual(["Close"]);
    for (const field of within(panel).getAllByRole("textbox")) {
      expect(field).toHaveAttribute("readonly");
    }
  });

  it("UI-14 shows the Requester a read-only list and View panel", async () => {
    render(<ActionsTaken ticketId={10} mode="requester" />);

    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(api.getRequesterActions).toHaveBeenCalledWith(10);
    expect(api.getStaffActions).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Add Action" })).not.toBeInTheDocument();

    const panel = await openView(0);
    expect(within(panel).getByDisplayValue("Reset the multi-factor enrolment.")).toBeInTheDocument();
    expect(within(panel).getAllByRole("button").map((b) => b.textContent)).toEqual(["Close"]);
  });
});

describe("Style", () => {
  it("STYLE-01 ActionStatusBadge always shows text and uses the badge style", () => {
    const labels: Record<api.ActionStatus, string> = {
      PLANNED: "Planned",
      IN_PROGRESS: "In Progress",
      COMPLETED: "Completed",
      CANCELLED: "Cancelled",
    };

    for (const [status, label] of Object.entries(labels)) {
      const { unmount } = render(<ActionStatusBadge status={status as api.ActionStatus} />);
      const badge = screen.getByText(label);
      expect(badge).toHaveClass("badge");
      expect(badge.style.backgroundColor).not.toBe("");
      unmount();
    }
  });

  it("STYLE-02 marks required fields and shades read-only fields", async () => {
    renderStaff();
    await userEvent.click(await screen.findByRole("button", { name: "Add Action" }));
    const form = screen.getByRole("group", { name: "Add Action" });

    for (const label of [/^action date and time/i, /^action description/i, /^status/i, /^assigned to/i]) {
      const field = within(form).getByLabelText(label);
      expect(field).toHaveAttribute("aria-required", "true");
      expect(field.closest("div")!.querySelector("label")!).toHaveTextContent("*");
    }
    expect(within(form).getByLabelText(/^result/i)).not.toHaveAttribute("aria-required");
    await userEvent.click(within(form).getByRole("button", { name: "Cancel" }));

    const panel = await openView(0);
    const description = within(panel).getByLabelText(/^action description/i);
    expect(description).toHaveAttribute("readonly");
    expect(description.style.backgroundColor).toBe("rgb(238, 243, 240)");
  });
});
