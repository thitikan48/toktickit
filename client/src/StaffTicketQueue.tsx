import { useEffect, useMemo, useRef, useState } from "react";
import {
  Assignee,
  Category,
  StaffTicketListItem,
  StaffTicketsParams,
  getAssignees,
  getCategories,
  getStaffTickets,
} from "./api.js";
import PriorityBadge from "./PriorityBadge.js";
import StatusBadge, { STATUS_OPTIONS } from "./StatusBadge.js";

export type SortChoice =
  | "default"
  | "newest"
  | "oldest"
  | "updated"
  | "priority";

const SORTS: Record<
  SortChoice,
  Pick<StaffTicketsParams, "sort" | "direction">
> = {
  default: {},
  newest: { sort: "createdAt", direction: "desc" },
  oldest: { sort: "createdAt", direction: "asc" },
  updated: { sort: "updatedAt", direction: "desc" },
  priority: { sort: "itPriority", direction: "desc" },
};

export interface QueueFilters {
  search: string;
  status: string;
  itPriority: string;
  categoryId: string;
  owner: string;
  sortChoice: SortChoice;
  page: number;
}

export const EMPTY_FILTERS: QueueFilters = {
  search: "",
  status: "",
  itPriority: "",
  categoryId: "",
  owner: "",
  sortChoice: "default",
  page: 1,
};

interface StaffTicketQueueProps {
  currentUserId: number;
  onOpenTicket: (ticket: StaffTicketListItem) => void;
  /** Filters to start with (kept by the app when a ticket is opened). */
  initialFilters?: QueueFilters;
  /** Called whenever the filters change, so the app can remember them. */
  onFiltersChange?: (filters: QueueFilters) => void;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

export default function StaffTicketQueue({
  currentUserId,
  onOpenTicket,
  initialFilters = EMPTY_FILTERS,
  onFiltersChange,
}: StaffTicketQueueProps) {
  const [tickets, setTickets] = useState<StaffTicketListItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);

  const [search, setSearch] = useState(initialFilters.search);
  const [appliedSearch, setAppliedSearch] = useState(initialFilters.search);
  const [status, setStatus] = useState(initialFilters.status);
  const [itPriority, setItPriority] = useState(initialFilters.itPriority);
  const [categoryId, setCategoryId] = useState(initialFilters.categoryId);
  const [owner, setOwner] = useState(initialFilters.owner);
  const [sortChoice, setSortChoice] = useState<SortChoice>(
    initialFilters.sortChoice
  );
  const [page, setPage] = useState(initialFilters.page);

  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);

  const hasFilters = useMemo(
    () =>
      Boolean(
        appliedSearch ||
          status ||
          itPriority ||
          categoryId ||
          owner ||
          sortChoice !== "default"
      ),
    [appliedSearch, status, itPriority, categoryId, owner, sortChoice]
  );

  useEffect(() => {
    // The filter lists are optional; the queue still works without them.
    getCategories().then(setCategories).catch(() => undefined);
    getAssignees().then(setAssignees).catch(() => undefined);
  }, []);

  // Search runs shortly after the user stops typing. The first run keeps the
  // page the user came back to.
  const firstSearch = useRef(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedSearch(search.trim());

      if (firstSearch.current) {
        firstSearch.current = false;
      } else {
        setPage(1);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    onFiltersChange?.({
      search: appliedSearch,
      status,
      itPriority,
      categoryId,
      owner,
      sortChoice,
      page,
    });
  }, [appliedSearch, status, itPriority, categoryId, owner, sortChoice, page]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(false);

      try {
        const result = await getStaffTickets({
          search: appliedSearch || undefined,
          status: status || undefined,
          itPriority: itPriority || undefined,
          categoryId: categoryId ? Number(categoryId) : undefined,
          ownerId:
            owner === "unassigned"
              ? "unassigned"
              : owner
                ? Number(owner)
                : undefined,
          ...SORTS[sortChoice],
          page,
        });

        if (cancelled) return;

        setTickets(result.items);
        setTotalItems(result.totalItems);
        setTotalPages(result.totalPages);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [appliedSearch, status, itPriority, categoryId, owner, sortChoice, page, reload]);

  function clearFilters() {
    setSearch("");
    setAppliedSearch("");
    setStatus("");
    setItPriority("");
    setCategoryId("");
    setOwner("");
    setSortChoice("default");
    setPage(1);
  }

  function change<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  const ownerName = (ticket: StaffTicketListItem) =>
    ticket.owner ? ticket.owner.name : "Unassigned";

  return (
    <section className="container py-4" style={{ maxWidth: 1200 }}>
      <h1 className="h2 mb-1">Ticket Queue</h1>
      <p className="text-muted mb-4">
        Find, prioritise, and open support requests.
      </p>

      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <div className="row g-3 align-items-end">
            <div className="col-12 col-lg-4">
              <label htmlFor="queueSearch" className="form-label fw-semibold">
                Search
              </label>
              <input
                id="queueSearch"
                type="search"
                className="form-control"
                placeholder="Ticket number, summary, or requester"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <div className="col-6 col-lg-2">
              <label htmlFor="queueStatus" className="form-label fw-semibold">
                Status
              </label>
              <select
                id="queueStatus"
                className="form-select"
                value={status}
                onChange={(event) => change(setStatus)(event.target.value)}
              >
                <option value="">All</option>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-6 col-lg-2">
              <label htmlFor="queuePriority" className="form-label fw-semibold">
                IT Priority
              </label>
              <select
                id="queuePriority"
                className="form-select"
                value={itPriority}
                onChange={(event) => change(setItPriority)(event.target.value)}
              >
                <option value="">All</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>

            <div className="col-6 col-lg-2">
              <label htmlFor="queueCategory" className="form-label fw-semibold">
                Category
              </label>
              <select
                id="queueCategory"
                className="form-select"
                value={categoryId}
                onChange={(event) => change(setCategoryId)(event.target.value)}
              >
                <option value="">All</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-6 col-lg-2">
              <label htmlFor="queueOwner" className="form-label fw-semibold">
                Owner
              </label>
              <select
                id="queueOwner"
                className="form-select"
                value={owner}
                onChange={(event) => change(setOwner)(event.target.value)}
              >
                <option value="">All</option>
                <option value="unassigned">Unassigned</option>
                <option value={currentUserId}>Assigned to me</option>
                {assignees
                  .filter((person) => person.id !== currentUserId)
                  .map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="col-8 col-lg-3">
              <label htmlFor="queueSort" className="form-label fw-semibold">
                Sort
              </label>
              <select
                id="queueSort"
                className="form-select"
                value={sortChoice}
                onChange={(event) =>
                  change(setSortChoice)(event.target.value as SortChoice)
                }
              >
                <option value="default">Default</option>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="updated">Last updated</option>
                <option value="priority">Highest IT Priority</option>
              </select>
            </div>

            <div className="col-4 col-lg-2">
              <button
                type="button"
                className="btn btn-outline-secondary w-100"
                onClick={clearFilters}
                disabled={!hasFilters}
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="text-center py-5" aria-busy="true">
          <div className="spinner-border mb-3" role="status" aria-hidden="true" />
          <p className="mb-0">Loading tickets...</p>
        </div>
      )}

      {!loading && error && (
        <div className="alert alert-danger" role="alert">
          Unable to load the ticket queue.{" "}
          <button
            type="button"
            className="btn btn-link p-0 align-baseline"
            onClick={() => setReload((value) => value + 1)}
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && tickets.length === 0 && (
        <div className="card shadow-sm">
          <div className="card-body text-center py-5">
            {hasFilters ? (
              <>
                <p className="mb-3">No tickets match your search or filters.</p>
                <button
                  type="button"
                  className="btn btn-outline-success"
                  onClick={clearFilters}
                >
                  Clear Filters
                </button>
              </>
            ) : (
              <p className="mb-0">The queue is empty.</p>
            )}
          </div>
        </div>
      )}

      {!loading && !error && tickets.length > 0 && (
        <>
          {/* Desktop and tablet */}
          <div className="card shadow-sm overflow-hidden d-none d-md-block">
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead>
                  <tr>
                    <th scope="col">Ticket No.</th>
                    <th scope="col">Summary</th>
                    <th scope="col" className="d-none d-lg-table-cell">
                      Requester
                    </th>
                    <th scope="col">IT Priority</th>
                    <th scope="col">Status</th>
                    <th scope="col">Owner</th>
                    <th scope="col" className="d-none d-lg-table-cell">
                      Last Updated
                    </th>
                    <th scope="col">
                      <span className="visually-hidden">Open</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr key={ticket.id}>
                      <td className="fw-semibold text-nowrap">
                        {ticket.ticketNumber}
                      </td>
                      <td>
                        {ticket.summary}
                        {/* On tablets the requester sits under the summary. */}
                        <div className="d-lg-none text-muted small">
                          {ticket.requester.name}
                        </div>
                        {ticket.requesterMarkedResolved && (
                          <div>
                            <span
                              className="badge mt-1"
                              style={{
                                backgroundColor: "#EAF6EF",
                                color: "#006B3C",
                              }}
                            >
                              Requester says resolved
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="d-none d-lg-table-cell">
                        {ticket.requester.name}
                      </td>
                      <td>
                        <PriorityBadge priority={ticket.itPriority} />
                      </td>
                      <td>
                        <StatusBadge status={ticket.currentStatus} />
                      </td>
                      <td>{ownerName(ticket)}</td>
                      <td className="d-none d-lg-table-cell">
                        {formatDate(ticket.updatedAt)}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-outline-success btn-sm"
                          onClick={() => onOpenTicket(ticket)}
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile */}
          <div className="d-md-none d-flex flex-column gap-3">
            {tickets.map((ticket) => (
              <div key={ticket.id} className="card shadow-sm">
                <div className="card-body">
                  <div className="d-flex justify-content-between gap-2 mb-2">
                    <strong>{ticket.ticketNumber}</strong>
                    <StatusBadge
                      className="flex-shrink-0"
                      status={ticket.currentStatus}
                    />
                  </div>
                  <h2 className="h6 text-break">{ticket.summary}</h2>
                  {ticket.requesterMarkedResolved && (
                    <p className="mb-2">
                      <span
                        className="badge"
                        style={{ backgroundColor: "#EAF6EF", color: "#006B3C" }}
                      >
                        Requester says resolved
                      </span>
                    </p>
                  )}
                  <p className="text-muted small mb-1">
                    Requester: {ticket.requester.name}
                  </p>
                  <p className="small mb-1">
                    IT Priority: <PriorityBadge priority={ticket.itPriority} />
                  </p>
                  <p className="small mb-1">Owner: {ownerName(ticket)}</p>
                  <p className="text-muted small">
                    Last updated {formatDate(ticket.updatedAt)}
                  </p>
                  <button
                    type="button"
                    className="btn btn-outline-success w-100"
                    onClick={() => onOpenTicket(ticket)}
                  >
                    Open
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mt-4">
            <span className="text-muted">
              Page {page} of {totalPages} ({totalItems} tickets)
            </span>
            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary"
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
