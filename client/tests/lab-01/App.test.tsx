import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../../src/App.js";

describe("App", () => {
  it("renders the TokTickIT application name", () => {
    render(<App />);

    expect(
      screen.getByText("TokTickIT", {
        selector: "strong",
      })
    ).toBeInTheDocument();
  });
});