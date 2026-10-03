import { RequestedPriority } from "./api.js";

// Colors use the Zen Green tokens (docs/lab-03/ui-spec.md, section 1.3).
const PRIORITY_STYLES: Record<
  RequestedPriority,
  { label: string; background: string; color: string }
> = {
  LOW: { label: "Low", background: "#EEF3F0", color: "#66756D" },
  MEDIUM: { label: "Medium", background: "#FFFAEB", color: "#B54708" },
  HIGH: { label: "High", background: "#FEF3F2", color: "#B42318" },
};

export function priorityLabel(priority: RequestedPriority): string {
  return PRIORITY_STYLES[priority].label;
}

export default function PriorityBadge({
  priority,
  className = "",
}: {
  priority: RequestedPriority;
  className?: string;
}) {
  const style = PRIORITY_STYLES[priority];

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
