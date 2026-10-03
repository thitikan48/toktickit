import { TicketStatus } from "./api.js";

// Same transition table as the backend (docs/lab-03/specification.md, BR-13).
// The backend enforces it; the screen only offers the permitted choices.
const TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  NEW: ["OPEN", "IN_PROGRESS", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  IN_PROGRESS: ["OPEN", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["OPEN", "IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  CANCELLED: [],
};

export function allowedTransitions(from: TicketStatus): TicketStatus[] {
  return TRANSITIONS[from];
}

export function needsConfirmation(to: TicketStatus): boolean {
  return to === "RESOLVED" || to === "CLOSED" || to === "CANCELLED";
}
