import { ActionStatus } from "./api.js";

// Same badge style as StatusBadge, with the Zen Green colors. The text is
// always shown, so color is never the only signal.
const ACTION_STATUS_STYLES: Record<
  ActionStatus,
  { label: string; background: string; color: string }
> = {
  PLANNED: { label: "Planned", background: "#FFFAEB", color: "#B54708" },
  IN_PROGRESS: { label: "In Progress", background: "#ECFDF3", color: "#067647" },
  COMPLETED: { label: "Completed", background: "#EAF6EF", color: "#006B3C" },
  CANCELLED: { label: "Cancelled", background: "#EEF3F0", color: "#66756D" },
};

export function actionStatusLabel(status: ActionStatus): string {
  return ACTION_STATUS_STYLES[status].label;
}

export default function ActionStatusBadge({
  status,
  className = "",
}: {
  status: ActionStatus;
  className?: string;
}) {
  const style = ACTION_STATUS_STYLES[status];

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

// "Follow-up needed" label, in the warning colors.
export function FollowUpBadge() {
  return (
    <span
      className="badge ms-1"
      style={{ backgroundColor: "#FFFAEB", color: "#B54708" }}
    >
      Follow-up needed
    </span>
  );
}
