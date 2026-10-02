import { describe, expect, it } from "vitest";
import { validateNewPassword } from "../../src/rules.js";

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
