import { ReactNode, Ref } from "react";
import { ApiError } from "./api.js";

// Pieces shared by the Requester and IT Staff Dashboards
// (docs/lab-04/ui-spec.md, sections 3, 4, and 7).

// Times are stored in UTC and shown in Bangkok time.
const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Bangkok",
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatDate(value: string): string {
  return DATE_FORMAT.format(new Date(value));
}

export type LoadState = "loading" | "ready" | "forbidden" | "error";

export function stateFromError(error: unknown): LoadState {
  return error instanceof ApiError && error.status === 403 ? "forbidden" : "error";
}

/** Title with the Refresh button. */
export function DashboardHeader({ onRefresh, busy }: { onRefresh: () => void; busy: boolean }) {
  return (
    <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
      <h1 className="h2 mb-0">Dashboard</h1>
      <button type="button" className="btn btn-outline-success" disabled={busy} onClick={onRefresh}>
        Refresh
      </button>
    </div>
  );
}

/** Loading, forbidden, and failure states. */
export function DashboardState({ state, onRetry }: { state: LoadState; onRetry: () => void }) {
  if (state === "loading") {
    return (
      <div className="text-center py-5" role="status">
        <div className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
        Loading dashboard...
      </div>
    );
  }

  if (state === "forbidden") {
    return (
      <div className="alert alert-warning" role="alert">
        You are not authorized to perform this action.
      </div>
    );
  }

  return (
    <div className="alert alert-danger" role="alert">
      Unable to load the dashboard.{" "}
      <button type="button" className="btn btn-link p-0 align-baseline" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

/** A count card: one real button named "<label>: <value>". */
export function MetricCard({
  label,
  value,
  onClick,
}: {
  label: string;
  value: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="card shadow-sm h-100 w-100 text-start"
      aria-label={`${label}: ${value}`}
      onClick={onClick}
    >
      <span className="card-body d-block">
        <span className="d-block text-muted mb-1">{label}</span>
        <span className="d-block display-6 fw-bold" style={{ color: "#006B3C" }}>
          {value}
        </span>
      </span>
    </button>
  );
}

/** A card with a heading and a list (table on desktop and tablet, cards on mobile). */
export function ListCard({
  title,
  action,
  headingRef,
  children,
}: {
  title: string;
  action?: ReactNode;
  headingRef?: Ref<HTMLHeadingElement>;
  children: ReactNode;
}) {
  return (
    <div className="card shadow-sm h-100">
      <div className="card-body p-4">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <h2 className="h5 mb-0" tabIndex={headingRef ? -1 : undefined} ref={headingRef}>
            {title}
          </h2>
          {action}
        </div>
        {children}
      </div>
    </div>
  );
}

/** The `Open` button of a list row. */
export function OpenButton({
  ticketNumber,
  onClick,
  block = false,
}: {
  ticketNumber: string;
  onClick: () => void;
  block?: boolean;
}) {
  return (
    <button
      type="button"
      className={`btn btn-outline-success btn-sm ${block ? "w-100" : ""}`}
      aria-label={`Open ${ticketNumber}`}
      onClick={onClick}
    >
      Open
    </button>
  );
}
