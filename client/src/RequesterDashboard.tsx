import { useEffect, useState } from "react";
import { DashboardTicket, RequesterDashboardData, getRequesterDashboard } from "./api.js";
import {
  DashboardHeader,
  DashboardState,
  ListCard,
  LoadState,
  MetricCard,
  OpenButton,
  formatDate,
  stateFromError,
} from "./DashboardParts.js";
import StatusBadge from "./StatusBadge.js";

/** Filters My Tickets can start with. */
export interface MyTicketsFilters {
  status?: string;
  statusGroup?: "active";
}

interface RequesterDashboardProps {
  onOpenMyTickets: (filters: MyTicketsFilters) => void;
  onOpenTicket: (ticketId: number) => void;
}

/**
 * Requester Dashboard: only the logged-in Requester's Tickets
 * (docs/lab-04/ui-spec.md, section 4).
 */
export default function RequesterDashboard({
  onOpenMyTickets,
  onOpenTicket,
}: RequesterDashboardProps) {
  const [data, setData] = useState<RequesterDashboardData | null>(null);
  const [state, setState] = useState<LoadState>("loading");

  async function load() {
    setState("loading");

    try {
      setData(await getRequesterDashboard());
      setState("ready");
    } catch (error) {
      setState(stateFromError(error));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function renderList(
    rows: (DashboardTicket & { date: string })[],
    dateLabel: string,
    empty: string
  ) {
    if (rows.length === 0) {
      return <p className="text-muted mb-0">{empty}</p>;
    }

    return (
      <>
        <div className="table-responsive d-none d-md-block">
          <table className="table align-middle mb-0">
            <thead>
              <tr>
                <th scope="col">Ticket Number</th>
                <th scope="col">Summary</th>
                <th scope="col">Status</th>
                <th scope="col">{dateLabel}</th>
                <th scope="col">
                  <span className="visually-hidden">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((ticket) => (
                <tr key={ticket.id}>
                  <td className="fw-semibold text-nowrap">{ticket.ticketNumber}</td>
                  <td className="text-break">{ticket.summary}</td>
                  <td>
                    <StatusBadge status={ticket.currentStatus} />
                  </td>
                  <td>{formatDate(ticket.date)}</td>
                  <td>
                    <OpenButton
                      ticketNumber={ticket.ticketNumber}
                      onClick={() => onOpenTicket(ticket.id)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="d-md-none d-flex flex-column gap-3">
          {rows.map((ticket) => (
            <div key={ticket.id} className="border rounded p-3">
              <div className="d-flex justify-content-between gap-2 mb-2">
                <strong>{ticket.ticketNumber}</strong>
                <StatusBadge status={ticket.currentStatus} />
              </div>
              <p className="mb-1 text-break">{ticket.summary}</p>
              <p className="text-muted small">
                {dateLabel}: {formatDate(ticket.date)}
              </p>
              <OpenButton
                ticketNumber={ticket.ticketNumber}
                onClick={() => onOpenTicket(ticket.id)}
                block
              />
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <section className="container py-4" style={{ maxWidth: 1200 }}>
      <DashboardHeader onRefresh={() => void load()} busy={state === "loading"} />

      {state !== "ready" || !data ? (
        <DashboardState state={state} onRetry={() => void load()} />
      ) : (
        <>
          <div className="row g-3 mb-4">
            <div className="col-12 col-md-6">
              <MetricCard
                label="Open tickets"
                value={data.openTickets}
                onClick={() => onOpenMyTickets({ statusGroup: "active" })}
              />
            </div>
            <div className="col-12 col-md-6">
              <MetricCard
                label="Waiting for me"
                value={data.waitingForMe}
                onClick={() => onOpenMyTickets({ status: "WAITING_FOR_REQUESTER" })}
              />
            </div>
          </div>

          <div className="row g-4">
            <div className="col-12 col-lg-6">
              <ListCard title="Recently updated">
                {renderList(
                  data.recentlyUpdated.map((ticket) => ({ ...ticket, date: ticket.updatedAt })),
                  "Last Updated",
                  "No tickets updated in the last 7 days."
                )}
              </ListCard>
            </div>
            <div className="col-12 col-lg-6">
              <ListCard title="Recently resolved">
                {renderList(
                  data.recentlyResolved.map((ticket) => ({ ...ticket, date: ticket.resolvedAt })),
                  "Resolved On",
                  "No tickets resolved in the last 7 days."
                )}
              </ListCard>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
