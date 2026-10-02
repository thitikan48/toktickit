import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";
import ChangePassword from "../../src/ChangePassword.js";
import * as api from "../../src/api.js";

const firstLogin: api.AuthUser = {
  id: 2,
  name: "Michael Brown",
  email: "michael.brown@example.com",
  role: "REQUESTER",
  mustChangePassword: true,
};

beforeEach(() => {
  vi.restoreAllMocks();

  vi.spyOn(api, "getTickets").mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 10,
    totalItems: 0,
    totalPages: 0,
  });
  vi.spyOn(api, "getCategories").mockResolvedValue([]);
});

async function fill(current: string, next: string, confirm: string) {
  await userEvent.type(screen.getByLabelText(/current password/i), current);
  await userEvent.type(screen.getByLabelText(/^new password/i), next);
  await userEvent.type(screen.getByLabelText(/confirm new password/i), confirm);
  await userEvent.click(screen.getByRole("button", { name: /save password/i }));
}

describe("Change Password", () => {
  it("shows only the Change Password screen after a first login", async () => {
    vi.spyOn(api, "getCurrentUser").mockResolvedValue(firstLogin);

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: /choose a new password/i })
    ).toBeInTheDocument();
    // No navigation until the password is changed; only Logout remains.
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.queryByRole("button", { name: "My Tickets" })).toBeNull();
    expect(screen.getByRole("button", { name: "Logout" })).toBeInTheDocument();
    expect(api.getTickets).not.toHaveBeenCalled();
  });

  it("opens the application after a valid password change", async () => {
    vi.spyOn(api, "getCurrentUser").mockResolvedValue(firstLogin);
    const changeSpy = vi
      .spyOn(api, "changePassword")
      .mockResolvedValue({ ...firstLogin, mustChangePassword: false });

    render(<App />);

    await screen.findByRole("heading", { name: /choose a new password/i });
    await fill("ChangeMe123", "Sunrise2026", "Sunrise2026");

    expect(changeSpy).toHaveBeenCalledWith("ChangeMe123", "Sunrise2026");
    expect(await screen.findByRole("button", { name: "My Tickets" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /choose a new password/i })).toBeNull();
  });

  it("validates policy, matching confirmation, and same password without calling the API", async () => {
    const changeSpy = vi.spyOn(api, "changePassword");

    render(<ChangePassword mandatory onChanged={() => {}} />);

    await fill("ChangeMe123", "short1", "short1");
    expect(
      screen.getByText("Password must be 8-72 characters.")
    ).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText(/^new password/i));
    await userEvent.clear(screen.getByLabelText(/confirm new password/i));
    await userEvent.type(screen.getByLabelText(/^new password/i), "NoDigitsHere");
    await userEvent.type(screen.getByLabelText(/confirm new password/i), "Different123");
    await userEvent.click(screen.getByRole("button", { name: /save password/i }));

    expect(
      screen.getByText("Password must contain at least one letter and one digit.")
    ).toBeInTheDocument();
    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText(/^new password/i));
    await userEvent.clear(screen.getByLabelText(/confirm new password/i));
    await userEvent.type(screen.getByLabelText(/^new password/i), "ChangeMe123");
    await userEvent.type(screen.getByLabelText(/confirm new password/i), "ChangeMe123");
    await userEvent.click(screen.getByRole("button", { name: /save password/i }));

    expect(
      screen.getByText("New password must be different from the current password.")
    ).toBeInTheDocument();
    expect(changeSpy).not.toHaveBeenCalled();
  });

  it("shows the server message next to the current password field", async () => {
    vi.spyOn(api, "changePassword").mockRejectedValue(
      new api.ApiError(400, "VALIDATION_ERROR", "invalid", {
        currentPassword: "Current password is incorrect.",
      })
    );

    render(<ChangePassword mandatory onChanged={() => {}} />);

    await fill("WrongPass999", "Sunrise2026", "Sunrise2026");

    expect(
      await screen.findByText("Current password is incorrect.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save password/i })).toBeEnabled();
  });

  it("shows a safe message when saving fails", async () => {
    vi.spyOn(api, "changePassword").mockRejectedValue(new TypeError("Failed to fetch"));

    render(<ChangePassword mandatory onChanged={() => {}} />);

    await fill("ChangeMe123", "Sunrise2026", "Sunrise2026");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /unable to change the password right now/i
    );
  });

  it("offers Cancel only when the change is optional", () => {
    const { rerender } = render(
      <ChangePassword mandatory={false} onChanged={() => {}} onCancel={() => {}} />
    );

    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();

    rerender(<ChangePassword mandatory onChanged={() => {}} onCancel={() => {}} />);

    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
  });
});
