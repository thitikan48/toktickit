import { useEffect, useState } from "react";
import {
  StatusHistoryEntry,
  UserRole,
  getRequesterHistory,
  getStaffHistory,
} from "./api.js";
import StatusBadge, { statusLabel } from "./StatusBadge.js";

const ROLE_LABELS: Record<UserRole, string> = {
  REQUESTER: "Requester",
  IT_STAFF: "IT Staff",
  ADMIN: "Administrator",
};

// Times are stored in UTC and shown in Bangkok time.
const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Bangkok",
  dateStyle: "medium",
  timeStyle: "short",
});

interface StatusTimelineProps {
  ticketId: number;
  mode: "staff" | "requester";
}

/**
 * Read-only list of the Ticket's status changes, oldest first
 * (docs/lab-04/ui-spec.md, section 6).
 */
export default function StatusTimeline({ ticketId, mode }: StatusTimelineProps) {
  const [entries, setEntries] = useState<StatusHistoryEntry[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  async function load() {
    setState("loading");

    try {
      setEntries(
        mode === "staff"
          ? await getStaffHistory(ticketId)
          : await getRequesterHistory(ticketId)
      );
      setState("ready");
    } catch {
      setState("error");
    }
  }

  useEffect(() => {
    void load();
  }, [ticketId, mode]);

  function renderBody() {
    if (state === "loading") {
      return (
        <div className="text-center py-4" role="status">
          <div className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
          Loading history...
        </div>
      );
    }

    if (state === "error") {
      return (
        <div className="alert alert-danger" role="alert">
          Unable to load the history.{" "}
          <button type="button" className="btn btn-link p-0 align-baseline" onClick={() => void load()}>
            Retry
          </button>
        </div>
      );
    }

    if (entries.length === 0) {
      return <p className="text-muted mb-0">No status changes recorded yet.</p>;
    }

    return (
      <ol className="list-unstyled mb-0">
        {entries.map((entry) => (
          <li key={entry.id} className="border-start border-3 ps-3 pb-3" style={{ borderColor: "#006B3C" }}>
            <time className="d-block text-muted small" dateTime={entry.changedAt}>
              {DATE_FORMAT.format(new Date(entry.changedAt))}
            </time>
            <span className="fw-semibold">
              {statusLabel(entry.fromStatus)} to <StatusBadge status={entry.toStatus} />
            </span>
            <span className="d-block small">
              by {entry.changedBy.name} ({ROLE_LABELS[entry.changedBy.role]})
            </span>
          </li>
        ))}
      </ol>
    );
  }

  return (
    // A plain card, not a named region, so its title does not count as a
    // second "Status" label next to the Status select.
    <section className="card shadow-sm mt-4">
      <div className="card-body p-4">
        <h2 className="h5 mb-3">
          Status Timeline
        </h2>
        {renderBody()}
      </div>
    </section>
  );
}
