import { describe, it, expect, vi, beforeEach } from "vitest";
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

  vi.spyOn(api, "getRelatedSystems").mockResolvedValue([
    { id: 1, name: "Email" },
    { id: 7, name: "Corporate Laptop" },
  ]);
});

describe("Create Ticket", () => {
  it("shows validation errors when required fields are invalid", async () => {
    render(<App />);

    const createButton = await screen.findByRole("button", {
      name: /create ticket/i,
    });

    await userEvent.click(createButton);

    const submitButton = await screen.findByRole("button", {
      name: /submit ticket/i,
    });

    await userEvent.click(submitButton);

    expect(
      await screen.findByText(/category is required/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/related system is required/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/summary must be between 5 and 120 characters/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/description must be between 10 and 4000 characters/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/requested priority is required/i)
    ).toBeInTheDocument();
  });
});

it("submits a valid ticket and shows the generated ticket number", async () => {
  vi.spyOn(api, "createTicket").mockResolvedValue({
    id: 101,
    ticketNumber: "TKT-2026-000101",
    requesterId: 1,
    categoryId: 2,
    relatedSystemId: 7,
    summary: "Laptop battery drains quickly",
    description:
      "The laptop battery loses charge within 90 minutes even under light workload.",
    requestedPriority: "MEDIUM",
    currentStatus: "NEW",
    createdAt: "2026-09-05T10:00:00.000Z",
    updatedAt: "2026-09-05T10:00:00.000Z",
  });

  render(<App />);

  await userEvent.click(
    await screen.findByRole("button", { name: /create ticket/i })
  );

  await userEvent.selectOptions(
    await screen.findByLabelText(/category/i),
    "2"
  );

  await userEvent.selectOptions(
    screen.getByLabelText(/related system/i),
    "7"
  );

  await userEvent.selectOptions(
    screen.getByLabelText(/requested priority/i),
    "MEDIUM"
  );

  await userEvent.type(
    screen.getByLabelText(/ticket summary/i),
    "Laptop battery drains quickly"
  );

  await userEvent.type(
    screen.getByLabelText(/description/i),
    "The laptop battery loses charge within 90 minutes even under light workload."
  );

  await userEvent.click(
    screen.getByRole("button", { name: /submit ticket/i })
  );

  expect(
    await screen.findByText(/TKT-2026-000101/i)
  ).toBeInTheDocument();

  expect(api.createTicket).toHaveBeenCalledTimes(1);
});

it("prevents duplicate submission while ticket creation is in progress", async () => {
  let resolveCreateTicket:
    | ((value: api.CreatedTicket) => void)
    | undefined;

  vi.spyOn(api, "createTicket").mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveCreateTicket = resolve;
      })
  );

  render(<App />);

  await userEvent.click(
    await screen.findByRole("button", { name: /create ticket/i })
  );

  await userEvent.selectOptions(
    await screen.findByLabelText(/category/i),
    "2"
  );

  await userEvent.selectOptions(
    screen.getByLabelText(/related system/i),
    "7"
  );

  await userEvent.selectOptions(
    screen.getByLabelText(/requested priority/i),
    "MEDIUM"
  );

  await userEvent.type(
    screen.getByLabelText(/ticket summary/i),
    "Laptop battery drains quickly"
  );

  await userEvent.type(
    screen.getByLabelText(/description/i),
    "The laptop battery loses charge within 90 minutes even under light workload."
  );

  const submitButton = screen.getByRole("button", {
    name: /submit ticket/i,
  });

  await userEvent.click(submitButton);

  expect(
    screen.getByRole("button", { name: /submitting/i })
  ).toBeDisabled();

  expect(api.createTicket).toHaveBeenCalledTimes(1);

  resolveCreateTicket?.({
    id: 102,
    ticketNumber: "TKT-2026-000102",
    requesterId: 1,
    categoryId: 2,
    relatedSystemId: 7,
    summary: "Laptop battery drains quickly",
    description:
      "The laptop battery loses charge within 90 minutes even under light workload.",
    requestedPriority: "MEDIUM",
    currentStatus: "NEW",
    createdAt: "2026-09-05T10:00:00.000Z",
    updatedAt: "2026-09-05T10:00:00.000Z",
  });

  expect(
    await screen.findByText(/TKT-2026-000102/i)
  ).toBeInTheDocument();
});

it("shows a safe error and keeps form values when ticket creation fails", async () => {
  vi.spyOn(api, "createTicket").mockRejectedValue(
    new Error("Server error")
  );

  render(<App />);

  await userEvent.click(
    await screen.findByRole("button", { name: /create ticket/i })
  );

  await userEvent.selectOptions(
    await screen.findByLabelText(/category/i),
    "2"
  );

  await userEvent.selectOptions(
    screen.getByLabelText(/related system/i),
    "7"
  );

  await userEvent.selectOptions(
    screen.getByLabelText(/requested priority/i),
    "MEDIUM"
  );

  const summaryInput = screen.getByLabelText(/ticket summary/i);
  const descriptionInput = screen.getByLabelText(/description/i);

  await userEvent.type(
    summaryInput,
    "Laptop battery drains quickly"
  );

  await userEvent.type(
    descriptionInput,
    "The laptop battery loses charge within 90 minutes even under light workload."
  );

  await userEvent.click(
    screen.getByRole("button", { name: /submit ticket/i })
  );

  expect(
    await screen.findByRole("alert")
  ).toHaveTextContent(
    "Unable to create ticket. Please try again."
  );

  expect(summaryInput).toHaveValue(
    "Laptop battery drains quickly"
  );

  expect(descriptionInput).toHaveValue(
    "The laptop battery loses charge within 90 minutes even under light workload."
  );

  expect(
    screen.getByLabelText(/category/i)
  ).toHaveValue("2");

  expect(
    screen.getByLabelText(/related system/i)
  ).toHaveValue("7");

  expect(
    screen.getByLabelText(/requested priority/i)
  ).toHaveValue("MEDIUM");
});