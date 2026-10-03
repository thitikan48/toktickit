import { TicketStatus } from "./api.js";

// Colors use the Zen Green tokens (docs/lab-03/ui-spec.md, section 1.3).
const STATUS_STYLES: Record<
  TicketStatus,
  { label: string; background: string; color: string }
> = {
  NEW: { label: "New", background: "#EAF6EF", color: "#006B3C" },
  OPEN: { label: "Open", background: "#EAF6EF", color: "#0B7A46" },
  IN_PROGRESS: { label: "In Progress", background: "#ECFDF3", color: "#067647" },
  WAITING_FOR_REQUESTER: {
    label: "Waiting for Requester",
    background: "#FFFAEB",
    color: "#B54708",
  },
  RESOLVED: { label: "Resolved", background: "#ECFDF3", color: "#067647" },
  CLOSED: { label: "Closed", background: "#EEF3F0", color: "#66756D" },
  REOPENED: { label: "Reopened", background: "#FFFAEB", color: "#B54708" },
  CANCELLED: { label: "Cancelled", background: "#EEF3F0", color: "#66756D" },
};

export const STATUS_OPTIONS = (
  Object.keys(STATUS_STYLES) as TicketStatus[]
).map((value) => ({ value, label: STATUS_STYLES[value].label }));

export function statusLabel(status: TicketStatus): string {
  return STATUS_STYLES[status].label;
}

export default function StatusBadge({
  status,
  className = "",
}: {
  status: TicketStatus;
  className?: string;
}) {
  const style = STATUS_STYLES[status];

  return (
    <span
      className={`badge ${className}`}
      style={{
        backgroundColor: style.background,
        color: style.color,
      }}
    >
      {style.label}
    </span>
  );
}
