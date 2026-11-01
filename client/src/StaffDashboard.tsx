import { useEffect, useRef, useState } from "react";
import { StaffDashboardData, TicketStatus, getStaffDashboard } from "./api.js";
import ActionStatusBadge from "./ActionStatusBadge.js";
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
import StatusBadge, { STATUS_OPTIONS } from "./StatusBadge.js";
import { QueueFilters } from "./StaffTicketQueue.js";

interface StaffDashboardProps {
  currentUserId: number;
  /** Opens the Ticket Queue with these filters. */
  onOpenQueue: (filters: Partial<QueueFilters>) => void;
  onOpenTicket: (ticketId: number) => void;
}

/**
 * IT Staff Dashboard, also used by Administrators
 * (docs/lab-04/ui-spec.md, section 3).
 */
export default function StaffDashboard({
  currentUserId,
  onOpenQueue,
  onOpenTicket,
}: StaffDashboardProps) {
  const [data, setData] = useState<StaffDashboardData | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const actionsHeading = useRef<HTMLHeadingElement>(null);

  async function load() {
    setState("loading");

    try {
      setData(await getStaffDashboard());
      setState("ready");
    } catch (error) {
      setState(stateFromError(error));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <section className="container py-4" style={{ maxWidth: 1200 }}>
      <DashboardHeader onRefresh={() => void load()} busy={state === "loading"} />

      {state !== "ready" || !data ? (
        <DashboardState state={state} onRetry={() => void load()} />
      ) : (
        <>
          <div className="row g-3 mb-4">
            <div className="col-12 col-md-4">
              <MetricCard
                label="Unassigned"
                value={data.unassigned}
                onClick={() => onOpenQueue({ owner: "unassigned", statusGroup: "active" })}
              />
            </div>
            <div className="col-12 col-md-4">
              <MetricCard
                label="My open tickets"
                value={data.myOpenTickets}
                onClick={() =>
                  onOpenQueue({ owner: String(currentUserId), statusGroup: "active" })
                }
              />
            </div>
            <div className="col-12 col-md-4">
              <MetricCard
                label="My open actions"
                value={data.myOpenActions}
                onClick={() => actionsHeading.current?.focus()}
              />
            </div>
          </div>

          <div className="row g-4 mb-4">
            <div className="col-12 col-lg-5">
              <ListCard title="Tickets by status">
                <div className="list-group">
                  {STATUS_OPTIONS.map((option) => {
                    const count = data.countsByStatus[option.value as TicketStatus] ?? 0;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                        aria-label={`${option.label}: ${count}`}
                        onClick={() => onOpenQueue({ status: option.value })}
                      >
                        <StatusBadge status={option.value as TicketStatus} />
                        <span className="fw-semibold">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </ListCard>
            </div>

            <div className="col-12 col-lg-7">
              <ListCard title="My open actions" headingRef={actionsHeading}>
                {data.myOpenActionsList.length === 0 ? (
                  <p className="text-muted mb-0">You have no open actions.</p>
                ) : (
                  <>
                    <div className="table-responsive d-none d-md-block">
                      <table className="table align-middle mb-0">
                        <thead>
                          <tr>
                            <th scope="col">Ticket Number</th>
                            <th scope="col">Action</th>
                            <th scope="col">Status</th>
                            <th scope="col">Action Date</th>
                            <th scope="col">
                              <span className="visually-hidden">Open</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.myOpenActionsList.map((action) => (
                            <tr key={action.actionId}>
                              <td className="fw-semibold text-nowrap">{action.ticketNumber}</td>
                              <td className="text-break">{action.description}</td>
                              <td>
                                <ActionStatusBadge status={action.status} />
                              </td>
                              <td>{formatDate(action.actionAt)}</td>
                              <td>
                                <OpenButton
                                  ticketNumber={action.ticketNumber}
                                  onClick={() => onOpenTicket(action.ticketId)}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="d-md-none d-flex flex-column gap-3">
                      {data.myOpenActionsList.map((action) => (
                        <div key={action.actionId} className="border rounded p-3">
                          <div className="d-flex justify-content-between gap-2 mb-2">
                            <strong>{action.ticketNumber}</strong>
                            <ActionStatusBadge status={action.status} />
                          </div>
                          <p className="mb-1 text-break">{action.description}</p>
                          <p className="text-muted small">{formatDate(action.actionAt)}</p>
                          <OpenButton
                            ticketNumber={action.ticketNumber}
                            onClick={() => onOpenTicket(action.ticketId)}
                            block
                          />
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </ListCard>
            </div>
          </div>

          <ListCard
            title="Recently updated"
            action={
              <button
                type="button"
                className="btn btn-link p-0"
                style={{ color: "#006B3C" }}
                onClick={() => onOpenQueue({ sortChoice: "updated" })}
              >
                View all
              </button>
            }
          >
            {data.recentlyUpdated.length === 0 ? (
              <p className="text-muted mb-0">No tickets updated in the last 7 days.</p>
            ) : (
              <>
                <div className="table-responsive d-none d-md-block">
                  <table className="table align-middle mb-0">
                    <thead>
                      <tr>
                        <th scope="col">Ticket Number</th>
                        <th scope="col">Summary</th>
                        <th scope="col">Status</th>
                        <th scope="col">Owner</th>
                        <th scope="col">Last Updated</th>
                        <th scope="col">
                          <span className="visually-hidden">Open</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentlyUpdated.map((ticket) => (
                        <tr key={ticket.id}>
                          <td className="fw-semibold text-nowrap">{ticket.ticketNumber}</td>
                          <td className="text-break">{ticket.summary}</td>
                          <td>
                            <StatusBadge status={ticket.currentStatus} />
                          </td>
                          <td>{ticket.owner ? ticket.owner.name : "Unassigned"}</td>
                          <td>{formatDate(ticket.updatedAt)}</td>
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
                  {data.recentlyUpdated.map((ticket) => (
                    <div key={ticket.id} className="border rounded p-3">
                      <div className="d-flex justify-content-between gap-2 mb-2">
                        <strong>{ticket.ticketNumber}</strong>
                        <StatusBadge status={ticket.currentStatus} />
                      </div>
                      <p className="mb-1 text-break">{ticket.summary}</p>
                      <p className="small mb-1">
                        Owner: {ticket.owner ? ticket.owner.name : "Unassigned"}
                      </p>
                      <p className="text-muted small">Last updated {formatDate(ticket.updatedAt)}</p>
                      <OpenButton
                        ticketNumber={ticket.ticketNumber}
                        onClick={() => onOpenTicket(ticket.id)}
                        block
                      />
                    </div>
                  ))}
                </div>
              </>
            )}
          </ListCard>
        </>
      )}
    </section>
  );
}
