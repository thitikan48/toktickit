import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

describe("Development Requester Selection", () => {
  it("shows the requester selection screen when no requester is selected", async () => {
    vi.spyOn(api, "getDevelopmentRequesters").mockResolvedValue([
      {
        id: 1,
        name: "Jennifer Anderson",
        email: "jennifer.anderson@example.com",
      },
    ]);

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: /select development requester/i,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Lab 2 testing only/i)
    ).toBeInTheDocument();
  });

  it("loads active development requesters into the selector", async () => {
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
      {
        id: 3,
        name: "Sarah Johnson",
        email: "sarah.johnson@example.com",
      },
      {
        id: 4,
        name: "David Lee",
        email: "david.lee@example.com",
      },
    ]);

    render(<App />);

    expect(
      await screen.findByRole("option", {
        name: /Jennifer Anderson/i,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("option", {
        name: /Michael Brown/i,
      })
    ).toBeInTheDocument();

    expect(
      screen.queryByText(/Inactive Test User/i)
    ).not.toBeInTheDocument();
  });
});

it("shows the selected requester and allows changing requester", async () => {
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

  render(<App />);

  const selector = await screen.findByLabelText(/development requester/i);

  await userEvent.selectOptions(selector, "1");

  await userEvent.click(
    screen.getByRole("button", { name: /continue/i })
  );

  expect(
    (await screen.findAllByText(/Jennifer Anderson/i)).length
  ).toBeGreaterThan(0);

  expect(
    screen.getByRole("button", { name: /change requester/i })
  ).toBeInTheDocument();

  await userEvent.click(
    screen.getByRole("button", { name: /change requester/i })
  );

  expect(
    await screen.findByRole("heading", {
      name: /select development requester/i,
    })
  ).toBeInTheDocument();

  expect(
    sessionStorage.getItem("developmentRequesterId")
  ).toBeNull();
});

it("shows loading state while requesters are being loaded", () => {
  vi.spyOn(api, "getDevelopmentRequesters").mockImplementation(
    () => new Promise(() => {})
  );

  render(<App />);

  expect(screen.getByText(/Loading Requesters/i)).toBeInTheDocument();
});

it("shows a safe error state when requester loading fails", async () => {
  vi.spyOn(api, "getDevelopmentRequesters").mockRejectedValue(
    new Error("Unable to load Development Requesters")
  );

  render(<App />);

  expect(
    await screen.findByText(/Unable to load Development Requesters/i)
  ).toBeInTheDocument();

  expect(
    screen.getByRole("button", { name: /retry/i })
  ).toBeInTheDocument();
});