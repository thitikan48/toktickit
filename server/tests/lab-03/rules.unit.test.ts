import { describe, expect, it } from "vitest";
import {
  TICKET_STATUSES,
  allowedTransitions,
  canTransition,
  isTicketStatus,
  needsConfirmation,
  validateNewPassword,
} from "../../src/rules.js";

describe("validateNewPassword", () => {
  it("accepts 8 to 72 characters with a letter and a digit", () => {
    expect(validateNewPassword("abcdefg1")).toBeNull();
    expect(validateNewPassword("a1" + "x".repeat(70))).toBeNull();
  });

  it("rejects 7 and 73 characters", () => {
    expect(validateNewPassword("abcdef1")).not.toBeNull();
    expect(validateNewPassword("a1" + "x".repeat(71))).not.toBeNull();
  });

  it("rejects a password without a digit or without a letter", () => {
    expect(validateNewPassword("abcdefgh")).not.toBeNull();
    expect(validateNewPassword("12345678")).not.toBeNull();
  });

  it("does not trim spaces", () => {
    expect(validateNewPassword("abc 1234")).toBeNull();
    expect(validateNewPassword("       1")).not.toBeNull();
  });

  it("rejects a password equal to the current one", () => {
    expect(validateNewPassword("Sunrise2026", "Sunrise2026")).not.toBeNull();
    expect(validateNewPassword("Sunrise2027", "Sunrise2026")).toBeNull();
  });

  it("rejects a non-string value", () => {
    expect(validateNewPassword(undefined)).not.toBeNull();
    expect(validateNewPassword(12345678)).not.toBeNull();
  });
});

describe("Status transitions", () => {
  // The table from docs/lab-03/specification.md (BR-13), written out here
  // independently of the implementation.
  const EXPECTED: Record<string, string[]> = {
    NEW: ["OPEN", "IN_PROGRESS", "CANCELLED"],
    OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
    IN_PROGRESS: ["OPEN", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
    WAITING_FOR_REQUESTER: ["OPEN", "IN_PROGRESS", "RESOLVED", "CANCELLED"],
    RESOLVED: ["CLOSED", "REOPENED"],
    CLOSED: ["REOPENED"],
    REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
    CANCELLED: [],
  };

  it("allows exactly the listed transitions, for every pair of statuses", () => {
    expect([...TICKET_STATUSES]).toEqual(Object.keys(EXPECTED));

    for (const from of TICKET_STATUSES) {
      for (const to of TICKET_STATUSES) {
        expect(canTransition(from, to), `${from} -> ${to}`).toBe(
          EXPECTED[from].includes(to)
        );
      }

      expect(allowedTransitions(from)).toEqual(EXPECTED[from]);
    }
  });

  it("never allows staying in the same status", () => {
    for (const status of TICKET_STATUSES) {
      expect(canTransition(status, status)).toBe(false);
    }
  });

  it("asks for confirmation only to resolve, close, or cancel", () => {
    for (const status of TICKET_STATUSES) {
      expect(needsConfirmation(status)).toBe(
        ["RESOLVED", "CLOSED", "CANCELLED"].includes(status)
      );
    }
  });

  it("recognises valid statuses only", () => {
    expect(isTicketStatus("OPEN")).toBe(true);
    expect(isTicketStatus("DONE")).toBe(false);
    expect(isTicketStatus(undefined)).toBe(false);
  });
});
