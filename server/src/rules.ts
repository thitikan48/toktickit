// Pure rules shared by routes and tests.

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72; // bcrypt ignores bytes after 72

/**
 * Returns an error message when the new password breaks the policy,
 * or null when it is acceptable. Whitespace is not trimmed.
 */
export function validateNewPassword(
  newPassword: unknown,
  currentPassword?: string
): string | null {
  if (typeof newPassword !== "string") {
    return "New password is required.";
  }

  if (
    newPassword.length < PASSWORD_MIN_LENGTH ||
    newPassword.length > PASSWORD_MAX_LENGTH
  ) {
    return `Password must be ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} characters.`;
  }

  if (
    !/[A-Za-z]/.test(newPassword) ||
    !/[0-9]/.test(newPassword)
  ) {
    return "Password must contain at least one letter and one digit.";
  }

  if (
    currentPassword !== undefined &&
    newPassword === currentPassword
  ) {
    return "New password must be different from the current password.";
  }

  return null;
}

// ---- Ticket status workflow (docs/lab-03/specification.md, BR-13 and BR-14)

export const TICKET_STATUSES = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "CANCELLED",
] as const;

export type TicketStatusValue = (typeof TICKET_STATUSES)[number];

const TRANSITIONS: Record<TicketStatusValue, TicketStatusValue[]> = {
  NEW: ["OPEN", "IN_PROGRESS", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  IN_PROGRESS: ["OPEN", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["OPEN", "IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  CANCELLED: [],
};

export function isTicketStatus(value: unknown): value is TicketStatusValue {
  return (
    typeof value === "string" &&
    (TICKET_STATUSES as readonly string[]).includes(value)
  );
}

export function allowedTransitions(
  from: TicketStatusValue
): TicketStatusValue[] {
  return TRANSITIONS[from];
}

export function canTransition(
  from: TicketStatusValue,
  to: TicketStatusValue
): boolean {
  return TRANSITIONS[from].includes(to);
}

// Resolving, closing, or cancelling needs an explicit confirmation.
export function needsConfirmation(to: TicketStatusValue): boolean {
  return to === "RESOLVED" || to === "CLOSED" || to === "CANCELLED";
}
