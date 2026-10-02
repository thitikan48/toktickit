import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UserManagement from "../../src/UserManagement.js";
import * as api from "../../src/api.js";

function user(overrides: Partial<api.AdminUser> = {}): api.AdminUser {
  return {
    id: 2,
    name: "Priya Nair",
    email: "priya.nair@example.com",
    role: "IT_STAFF",
    isActive: true,
    mustChangePassword: false,
    ...overrides,
  };
}

const admin = user({
  id: 10,
  name: "Admin User",
  email: "admin@example.com",
  role: "ADMIN",
});

const inactive = user({
  id: 3,
  name: "Tom Baker",
  email: "tom.baker@example.com",
  isActive: false,
});

function renderPage() {
  return render(<UserManagement currentUserId={10} />);
}

/** Both the table and the mobile cards are in the page; use the table. */
const table = () => screen.getByRole("table");

beforeEach(() => {
  vi.restoreAllMocks();

  vi.spyOn(api, "getUsers").mockResolvedValue([admin, user(), inactive]);
});

describe("User list", () => {
  it("shows Name, Email, Role, Status, and an Edit action for each user", async () => {
    renderPage();

    await screen.findByRole("table");

    const headers = within(table())
      .getAllByRole("columnheader")
      .map((cell) => cell.textContent);
    expect(headers).toEqual(["Name", "Email", "Role", "Status", "Edit"]);

    const row = within(table()).getByText("Priya Nair").closest("tr") as HTMLElement;
    expect(within(row).getByText("priya.nair@example.com")).toBeInTheDocument();
    expect(within(row).getByText("IT Staff")).toBeInTheDocument();
    expect(within(row).getByText("Active")).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Edit" })).toBeInTheDocument();

    const inactiveRow = within(table()).getByText("Tom Baker").closest("tr") as HTMLElement;
    expect(within(inactiveRow).getByText("Inactive")).toBeInTheDocument();
    expect(within(table()).getByText("Administrator")).toBeInTheDocument();
  });

  it("searches by name or email and filters by one role", async () => {
    const spy = vi.spyOn(api, "getUsers").mockResolvedValue([user()]);

    renderPage();
    await screen.findByRole("table");

    await userEvent.type(screen.getByLabelText("Search"), "priya");
    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith({ search: "priya", role: "" })
    );

    await userEvent.selectOptions(screen.getByLabelText("Role"), "IT_STAFF");
    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith({ search: "priya", role: "IT_STAFF" })
    );
  });

  it("shows no results with Clear Filters", async () => {
    const spy = vi.spyOn(api, "getUsers").mockResolvedValue([user()]);

    renderPage();
    await screen.findByRole("table");

    spy.mockResolvedValue([]);
    await userEvent.selectOptions(screen.getByLabelText("Role"), "ADMIN");

    expect(await screen.findByText("No users match your search.")).toBeInTheDocument();

    spy.mockResolvedValue([user()]);
    await userEvent.click(screen.getAllByRole("button", { name: "Clear Filters" })[0]);

    await screen.findByRole("table");
    expect(screen.getByLabelText("Role")).toHaveValue("");
  });

  it("shows an empty message, a loading state, and a safe failure message with Retry", async () => {
    const spy = vi.spyOn(api, "getUsers").mockResolvedValue([]);

    const { unmount } = renderPage();
    expect(screen.getByText("Loading users...")).toBeInTheDocument();
    expect(await screen.findByText("No users yet.")).toBeInTheDocument();
    unmount();

    spy.mockRejectedValueOnce(new Error("fail")).mockResolvedValueOnce([user()]);

    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent(/unable to load users/i);

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByRole("table");
  });
});

describe("Create User", () => {
  async function openCreate() {
    renderPage();
    await screen.findByRole("table");
    await userEvent.click(screen.getByRole("button", { name: "+ Create User" }));
    return screen.findByRole("dialog", { name: "Create User" });
  }

  it("has the planned fields and the first-login hint, and focuses the first field", async () => {
    const dialog = await openCreate();

    expect(within(dialog).getByLabelText(/^Name/)).toHaveFocus();
    expect(within(dialog).getByLabelText(/^Email/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/^Role/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Active")).toBeChecked();
    expect(within(dialog).getByLabelText(/^Initial Password/)).toBeInTheDocument();
    expect(
      within(dialog).getByText("The user must change this password at first login.")
    ).toBeInTheDocument();
  });

  it("validates every required field without calling the API", async () => {
    const createSpy = vi.spyOn(api, "createUser");

    const dialog = await openCreate();
    await userEvent.click(within(dialog).getByRole("button", { name: "Create User" }));

    expect(within(dialog).getByText("Name must be between 2 and 100 characters.")).toBeInTheDocument();
    expect(within(dialog).getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(within(dialog).getByText("Choose a role.")).toBeInTheDocument();
    expect(
      within(dialog).getByText("Password must be 8-72 characters.")
    ).toBeInTheDocument();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("creates the user, closes the dialog, shows a success message, and reloads the list", async () => {
    const createSpy = vi.spyOn(api, "createUser").mockResolvedValue(user({ id: 20 }));
    const listSpy = vi.mocked(api.getUsers);

    const dialog = await openCreate();
    await userEvent.type(within(dialog).getByLabelText(/^Name/), "New Colleague");
    await userEvent.type(within(dialog).getByLabelText(/^Email/), "new.colleague@example.com");
    await userEvent.selectOptions(within(dialog).getByLabelText(/^Role/), "IT_STAFF");
    await userEvent.type(within(dialog).getByLabelText(/^Initial Password/), "Initial2026");
    await userEvent.click(within(dialog).getByRole("button", { name: "Create User" }));

    await waitFor(() =>
      expect(createSpy).toHaveBeenCalledWith({
        name: "New Colleague",
        email: "new.colleague@example.com",
        role: "IT_STAFF",
        isActive: true,
        initialPassword: "Initial2026",
      })
    );

    expect(await screen.findByText("User created.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(listSpy).toHaveBeenCalledTimes(2));
  });

  it("shows a duplicate email next to the email field and keeps the other values", async () => {
    vi.spyOn(api, "createUser").mockRejectedValue(
      new api.ApiError(409, "CONFLICT", "This email is already in use.", {
        email: "This email is already in use.",
      })
    );

    const dialog = await openCreate();
    await userEvent.type(within(dialog).getByLabelText(/^Name/), "New Colleague");
    await userEvent.type(within(dialog).getByLabelText(/^Email/), "priya.nair@example.com");
    await userEvent.selectOptions(within(dialog).getByLabelText(/^Role/), "REQUESTER");
    await userEvent.type(within(dialog).getByLabelText(/^Initial Password/), "Initial2026");
    await userEvent.click(within(dialog).getByRole("button", { name: "Create User" }));

    expect(await within(dialog).findByText("This email is already in use.")).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/^Name/)).toHaveValue("New Colleague");
    expect(within(dialog).getByRole("button", { name: "Create User" })).toBeEnabled();
  });

  it("disables the buttons while saving and shows a safe message when saving fails", async () => {
    let fail: (error: unknown) => void = () => {};
    vi.spyOn(api, "createUser").mockImplementation(
      () => new Promise((_resolve, reject) => (fail = reject))
    );

    const dialog = await openCreate();
    await userEvent.type(within(dialog).getByLabelText(/^Name/), "New Colleague");
    await userEvent.type(within(dialog).getByLabelText(/^Email/), "new@example.com");
    await userEvent.selectOptions(within(dialog).getByLabelText(/^Role/), "REQUESTER");
    await userEvent.type(within(dialog).getByLabelText(/^Initial Password/), "Initial2026");
    await userEvent.click(within(dialog).getByRole("button", { name: "Create User" }));

    expect(within(dialog).getByRole("button", { name: /saving/i })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();

    fail(new TypeError("Failed to fetch"));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/unable to save the user/i);
  });

  it("shows and hides the typed password", async () => {
    const dialog = await openCreate();
    const field = within(dialog).getByLabelText(/^Initial Password/);

    expect(field).toHaveAttribute("type", "password");
    await userEvent.click(within(dialog).getByRole("button", { name: "Show" }));
    expect(field).toHaveAttribute("type", "text");
  });

  it("closes with Escape and returns the focus to the button that opened it", async () => {
    await openCreate();

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "+ Create User" })).toHaveFocus();
  });
});

describe("Edit User", () => {
  async function openEdit(name: string) {
    renderPage();
    await screen.findByRole("table");

    const row = within(table()).getByText(name).closest("tr") as HTMLElement;
    await userEvent.click(within(row).getByRole("button", { name: "Edit" }));

    return screen.findByRole("dialog", { name: "Edit User" });
  }

  it("shows the current values and no initial-password field", async () => {
    const dialog = await openEdit("Priya Nair");

    expect(within(dialog).getByLabelText(/^Name/)).toHaveValue("Priya Nair");
    expect(within(dialog).getByLabelText(/^Email/)).toHaveValue("priya.nair@example.com");
    expect(within(dialog).getByLabelText(/^Role/)).toHaveValue("IT_STAFF");
    expect(within(dialog).getByLabelText("Active")).toBeChecked();
    expect(within(dialog).queryByLabelText(/^Initial Password/)).toBeNull();
  });

  it("saves name, email, role, and active state", async () => {
    const updateSpy = vi.spyOn(api, "updateUser").mockResolvedValue(user());

    const dialog = await openEdit("Priya Nair");

    await userEvent.clear(within(dialog).getByLabelText(/^Name/));
    await userEvent.type(within(dialog).getByLabelText(/^Name/), "Priya N.");
    await userEvent.selectOptions(within(dialog).getByLabelText(/^Role/), "ADMIN");
    await userEvent.click(within(dialog).getByLabelText("Active"));
    await userEvent.click(within(dialog).getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(updateSpy).toHaveBeenCalledWith(2, {
        name: "Priya N.",
        email: "priya.nair@example.com",
        role: "ADMIN",
        isActive: false,
      })
    );
    expect(await screen.findByText("User updated.")).toBeInTheDocument();
  });

  it("does not let an Administrator deactivate their own account", async () => {
    const dialog = await openEdit("Admin User");

    expect(within(dialog).getByLabelText("Active")).toBeDisabled();
    expect(
      within(dialog).getByText("You cannot deactivate your own account.")
    ).toBeInTheDocument();
  });

  it("shows the rule message when the last active Administrator would be lost", async () => {
    vi.spyOn(api, "updateUser").mockRejectedValue(
      new api.ApiError(409, "CONFLICT", "At least one active Administrator is required.")
    );

    const dialog = await openEdit("Admin User");

    await userEvent.selectOptions(within(dialog).getByLabelText(/^Role/), "IT_STAFF");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save Changes" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "At least one active Administrator is required."
    );
  });
});

describe("Set New Initial Password", () => {
  async function openPasswordDialog() {
    renderPage();
    await screen.findByRole("table");

    const row = within(table()).getByText("Priya Nair").closest("tr") as HTMLElement;
    await userEvent.click(within(row).getByRole("button", { name: "Edit" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Set New Initial Password" })
    );

    return screen.findByRole("dialog", { name: "Set New Initial Password" });
  }

  it("validates the password without calling the API", async () => {
    const spy = vi.spyOn(api, "setInitialPassword");

    const dialog = await openPasswordDialog();
    await userEvent.type(within(dialog).getByLabelText(/^New Initial Password/), "short1");
    await userEvent.click(within(dialog).getByRole("button", { name: "Set Password" }));

    expect(within(dialog).getByText("Password must be 8-72 characters.")).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  it("sets the password, tells the Administrator the user must change it, and closes", async () => {
    const spy = vi.spyOn(api, "setInitialPassword").mockResolvedValue();

    const dialog = await openPasswordDialog();
    await userEvent.type(within(dialog).getByLabelText(/^New Initial Password/), "Another2026");
    await userEvent.click(within(dialog).getByRole("button", { name: "Set Password" }));

    await waitFor(() => expect(spy).toHaveBeenCalledWith(2, "Another2026"));
    expect(
      await screen.findByText("Initial password set. The user must change it at the next login.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does not keep the typed password after the dialog is closed", async () => {
    const dialog = await openPasswordDialog();
    await userEvent.type(within(dialog).getByLabelText(/^New Initial Password/), "Secret2026");
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await userEvent.click(
      await screen.findByRole("button", { name: "Set New Initial Password" })
    );

    expect(
      within(await screen.findByRole("dialog", { name: "Set New Initial Password" })).getByLabelText(
        /^New Initial Password/
      )
    ).toHaveValue("");
  });

  it("shows a safe message when saving fails", async () => {
    vi.spyOn(api, "setInitialPassword").mockRejectedValue(new TypeError("Failed to fetch"));

    const dialog = await openPasswordDialog();
    await userEvent.type(within(dialog).getByLabelText(/^New Initial Password/), "Another2026");
    await userEvent.click(within(dialog).getByRole("button", { name: "Set Password" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      /unable to set the password/i
    );
  });
});

describe("Styling", () => {
  it("shows role and account badges with text labels", async () => {
    renderPage();
    await screen.findByRole("table");

    const staff = within(table()).getAllByText("IT Staff")[0];
    const active = within(table()).getAllByText("Active")[0];
    const inactiveBadge = within(table()).getByText("Inactive");
    const administrator = within(table()).getByText("Administrator");

    for (const badge of [staff, active, inactiveBadge, administrator]) {
      expect(badge).toHaveClass("badge");
    }

    expect(administrator).toHaveStyle({ backgroundColor: "#006B3C" });
    expect(active).toHaveStyle({ backgroundColor: "#ECFDF3" });
    expect(inactiveBadge).toHaveStyle({ backgroundColor: "#EEF3F0" });
  });

  it("uses the primary button style for Create User and marks invalid fields with a message", async () => {
    renderPage();
    await screen.findByRole("table");

    expect(screen.getByRole("button", { name: "+ Create User" })).toHaveClass("btn-success");

    await userEvent.click(screen.getByRole("button", { name: "+ Create User" }));
    const dialog = await screen.findByRole("dialog", { name: "Create User" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Create User" }));

    const name = within(dialog).getByLabelText(/^Name/);
    expect(name).toHaveClass("is-invalid");
    expect(name.parentElement?.querySelector(".invalid-feedback")).toHaveTextContent(
      "Name must be between 2 and 100 characters."
    );
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveClass("btn-outline-secondary");
  });
});
