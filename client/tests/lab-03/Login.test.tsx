import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";
import Login from "../../src/Login.js";
import * as api from "../../src/api.js";

const requester: api.AuthUser = {
  id: 1,
  name: "Jennifer Anderson",
  email: "jennifer.anderson@example.com",
  role: "REQUESTER",
  mustChangePassword: false,
};

const staff: api.AuthUser = {
  id: 6,
  name: "Priya Nair",
  email: "priya.nair@example.com",
  role: "IT_STAFF",
  mustChangePassword: false,
};

const admin: api.AuthUser = {
  id: 10,
  name: "Admin User",
  email: "admin@example.com",
  role: "ADMIN",
  mustChangePassword: false,
};

beforeEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();

  vi.spyOn(api, "getTickets").mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 10,
    totalItems: 0,
    totalPages: 0,
  });
  vi.spyOn(api, "getCategories").mockResolvedValue([]);
  vi.spyOn(api, "getAssignees").mockResolvedValue([]);
  vi.spyOn(api, "getStaffTickets").mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 10,
    totalItems: 0,
    totalPages: 0,
  });
});

async function fillAndSubmit(email: string, password: string) {
  await userEvent.type(screen.getByLabelText(/email/i), email);
  await userEvent.type(screen.getByLabelText(/^password/i), password);
  await userEvent.click(screen.getByRole("button", { name: /^log in$/i }));
}

describe("Login", () => {
  it("logs in, disables the button while busy, and reports the user", async () => {
    let finish: (user: api.AuthUser) => void = () => {};
    const loginSpy = vi.spyOn(api, "login").mockImplementation(
      () => new Promise((resolve) => (finish = resolve))
    );
    const onLoggedIn = vi.fn();

    render(<Login onLoggedIn={onLoggedIn} />);

    await fillAndSubmit("jennifer.anderson@example.com", "ChangeMe123");

    expect(loginSpy).toHaveBeenCalledWith(
      "jennifer.anderson@example.com",
      "ChangeMe123"
    );
    expect(screen.getByRole("button", { name: /logging in/i })).toBeDisabled();

    finish(requester);

    await waitFor(() => expect(onLoggedIn).toHaveBeenCalledWith(requester));
  });

  it("shows a generic message for invalid credentials and keeps the email", async () => {
    vi.spyOn(api, "login").mockRejectedValue(
      new api.ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password.")
    );

    render(<Login onLoggedIn={() => {}} />);

    await fillAndSubmit("jennifer.anderson@example.com", "WrongPass999");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid email or password."
    );
    expect(screen.getByLabelText(/email/i)).toHaveValue(
      "jennifer.anderson@example.com"
    );
    expect(screen.getByLabelText(/^password/i)).toHaveValue("");
    expect(screen.getByRole("button", { name: /^log in$/i })).toBeEnabled();
  });

  it("shows the inactive account message", async () => {
    vi.spyOn(api, "login").mockRejectedValue(
      new api.ApiError(403, "ACCOUNT_INACTIVE", "inactive")
    );

    render(<Login onLoggedIn={() => {}} />);

    await fillAndSubmit("alex.ford@example.com", "ChangeMe123");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This account is inactive. Contact an administrator."
    );
  });

  it("shows a safe message when the server cannot be reached", async () => {
    vi.spyOn(api, "login").mockRejectedValue(new TypeError("Failed to fetch"));

    render(<Login onLoggedIn={() => {}} />);

    await fillAndSubmit("jennifer.anderson@example.com", "ChangeMe123");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /unable to log in right now/i
    );
  });

  it("validates empty and malformed input without calling the API", async () => {
    const loginSpy = vi.spyOn(api, "login");

    render(<Login onLoggedIn={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: /^log in$/i }));

    expect(screen.getByText("Email is required.")).toBeInTheDocument();
    expect(screen.getByText("Password is required.")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/email/i), "not-an-email");
    await userEvent.click(screen.getByRole("button", { name: /^log in$/i }));

    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(loginSpy).not.toHaveBeenCalled();
  });
});

describe("Application shell", () => {
  it("shows Login when there is no session", async () => {
    vi.spyOn(api, "getCurrentUser").mockResolvedValue(null);

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: /log in to toktickit/i })
    ).toBeInTheDocument();
  });

  it("restores the session and shows the name, role, and Requester navigation", async () => {
    vi.spyOn(api, "getCurrentUser").mockResolvedValue(requester);

    render(<App />);

    expect(await screen.findByText("Jennifer Anderson")).toBeInTheDocument();
    expect(screen.getByText("Requester")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "My Tickets" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Ticket" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /ticket queue/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /user management/i })).toBeNull();
    expect(screen.queryByText(/change requester/i)).toBeNull();
    expect(screen.queryByLabelText(/development requester/i)).toBeNull();
  });

  it("shows only the Ticket Queue for IT Staff", async () => {
    vi.spyOn(api, "getCurrentUser").mockResolvedValue(staff);

    render(<App />);

    expect(await screen.findByText("IT Staff")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ticket Queue" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /user management/i })).toBeNull();
    expect(screen.queryByRole("button", { name: "My Tickets" })).toBeNull();
  });

  it("shows User Management for an Administrator", async () => {
    vi.spyOn(api, "getCurrentUser").mockResolvedValue(admin);

    render(<App />);

    expect(await screen.findByText("Administrator")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "User Management" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ticket Queue" })).toBeInTheDocument();
  });

  it("logs out and returns to Login", async () => {
    vi.spyOn(api, "getCurrentUser").mockResolvedValue(requester);
    const logoutSpy = vi.spyOn(api, "logout").mockResolvedValue();

    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "Logout" }));

    expect(logoutSpy).toHaveBeenCalled();
    expect(
      await screen.findByRole("heading", { name: /log in to toktickit/i })
    ).toBeInTheDocument();
  });

  it("removes the old Development Requester value from the browser", async () => {
    sessionStorage.setItem("developmentRequesterId", "1");
    vi.spyOn(api, "getCurrentUser").mockResolvedValue(null);

    render(<App />);

    await screen.findByRole("heading", { name: /log in to toktickit/i });

    expect(sessionStorage.getItem("developmentRequesterId")).toBeNull();
  });

  it("returns to Login with a message when the session expires", async () => {
    vi.spyOn(api, "getCurrentUser").mockResolvedValue(requester);
    let expire: (() => void) | null = null;
    const original = api.setUnauthorizedHandler;
    vi.spyOn(api, "setUnauthorizedHandler").mockImplementation((handler) => {
      expire = handler;
      original(handler);
    });

    render(<App />);

    await screen.findByText("Jennifer Anderson");
    expire!();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your session has expired. Please log in again."
    );
  });
});
