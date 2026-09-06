import {
  describe,
  expect,
  it,
} from "vitest";

import {
  generateTicketNumber,
} from "../../src/ticket-number.js";

describe("generateTicketNumber", () => {
  it("generates a Ticket Number in the required format", () => {
    expect(
      generateTicketNumber(2026, 101)
    ).toBe("TKT-2026-000101");
  });

  it("pads the numeric part to six digits", () => {
    expect(
      generateTicketNumber(2026, 1)
    ).toBe("TKT-2026-000001");
  });
});