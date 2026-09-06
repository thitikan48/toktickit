import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Category,
  getCategories,
  getTickets,
  RequestedPriority,
  TicketListItem,
} from "./api.js";

interface MyTicketsProps {
  requesterId: number;
  onOpenTicket?: (
    ticket: TicketListItem
  ) => void;
}

export default function MyTickets({
  requesterId,
  onOpenTicket,
}: MyTicketsProps) {
  const [tickets, setTickets] =
    useState<TicketListItem[]>([]);

  const [categories, setCategories] =
    useState<Category[]>([]);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [categoryId, setCategoryId] =
    useState("");
  const [priority, setPriority] =
    useState("");

  const [sort, setSort] = useState<
    "createdAt_desc" | "createdAt_asc"
  >("createdAt_desc");

  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  const [totalItems, setTotalItems] =
    useState(0);

  const [totalPages, setTotalPages] =
    useState(0);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] = useState("");

  const hasFilters = useMemo(() => {
    return Boolean(
      search ||
        status ||
        categoryId ||
        priority ||
        sort !== "createdAt_desc"
    );
  }, [
    search,
    status,
    categoryId,
    priority,
    sort,
  ]);

  useEffect(() => {
    async function loadCategories() {
      try {
        const data =
          await getCategories();

        setCategories(data);
      } catch {
        // Ticket list can still load.
      }
    }

    void loadCategories();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [requesterId]);

  useEffect(() => {
    let cancelled = false;

    async function loadTickets() {
      setLoading(true);
      setError("");

      try {
        const result =
          await getTickets({
            requesterId,

            search:
              search.trim() ||
              undefined,

            status:
              status || undefined,

            categoryId: categoryId
              ? Number(categoryId)
              : undefined,

            requestedPriority:
              priority
                ? (priority as RequestedPriority)
                : undefined,

            sort,
            page,
            pageSize,
          });

        if (cancelled) {
          return;
        }

        setTickets(result.items);
        setTotalItems(
          result.totalItems
        );
        setTotalPages(
          result.totalPages
        );
      } catch {
        if (cancelled) {
          return;
        }

        setTickets([]);
        setTotalItems(0);
        setTotalPages(0);

        setError(
          "Unable to load tickets. Please try again."
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadTickets();

    return () => {
      cancelled = true;
    };
  }, [
    requesterId,
    search,
    status,
    categoryId,
    priority,
    sort,
    page,
    pageSize,
  ]);

  function resetFilters() {
    setSearch("");
    setStatus("");
    setCategoryId("");
    setPriority("");
    setSort("createdAt_desc");
    setPage(1);
  }

  function goToPreviousPage() {
    setPage((current) =>
      Math.max(
        1,
        current - 1
      )
    );
  }

  function goToNextPage() {
    setPage((current) =>
      totalPages > 0
        ? Math.min(
            totalPages,
            current + 1
          )
        : current
    );
  }

  function getVisiblePages() {
    const visible: number[] = [];

    for (
      let pageNumber = 1;
      pageNumber <= totalPages;
      pageNumber++
    ) {
      if (
        pageNumber === 1 ||
        pageNumber ===
          totalPages ||
        Math.abs(
          pageNumber - page
        ) <= 2
      ) {
        visible.push(
          pageNumber
        );
      }
    }

    return visible;
  }

  function formatPriority(
    value: RequestedPriority
  ) {
    if (value === "LOW") {
      return "Low";
    }

    if (value === "MEDIUM") {
      return "Medium";
    }

    return "High";
  }

  const startItem =
    totalItems === 0
      ? 0
      : (page - 1) *
          pageSize +
        1;

  const endItem = Math.min(
    page * pageSize,
    totalItems
  );

  return (
    <section
      className="container py-4"
      style={{
        maxWidth: 1200,
      }}
    >
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <div>
          <h1 className="h3 mb-1">
            My Tickets
          </h1>

          <p className="text-muted mb-0">
            View and search your
            support requests.
          </p>
        </div>
      </div>

      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-12 col-lg-4">
              <label
                htmlFor="ticketSearch"
                className="form-label fw-semibold"
              >
                Search
              </label>

              <input
                id="ticketSearch"
                type="search"
                className="form-control"
                placeholder="Ticket number or summary"
                value={search}
                onChange={(
                  event
                ) => {
                  setSearch(
                    event.target
                      .value
                  );
                  setPage(1);
                }}
              />
            </div>

            <div className="col-6 col-lg-2">
              <label
                htmlFor="statusFilter"
                className="form-label fw-semibold"
              >
                Status
              </label>

              <select
                id="statusFilter"
                className="form-select"
                value={status}
                onChange={(
                  event
                ) => {
                  setStatus(
                    event.target
                      .value
                  );
                  setPage(1);
                }}
              >
                <option value="">
                  All
                </option>

                <option value="NEW">
                  New
                </option>
              </select>
            </div>

            <div className="col-6 col-lg-2">
              <label
                htmlFor="categoryFilter"
                className="form-label fw-semibold"
              >
                Category
              </label>

              <select
                id="categoryFilter"
                className="form-select"
                value={
                  categoryId
                }
                onChange={(
                  event
                ) => {
                  setCategoryId(
                    event.target
                      .value
                  );
                  setPage(1);
                }}
              >
                <option value="">
                  All
                </option>

                {categories.map(
                  (
                    category
                  ) => (
                    <option
                      key={
                        category.id
                      }
                      value={
                        category.id
                      }
                    >
                      {
                        category.name
                      }
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="col-6 col-lg-2">
              <label
                htmlFor="priorityFilter"
                className="form-label fw-semibold"
              >
                Priority
              </label>

              <select
                id="priorityFilter"
                className="form-select"
                value={priority}
                onChange={(
                  event
                ) => {
                  setPriority(
                    event.target
                      .value
                  );
                  setPage(1);
                }}
              >
                <option value="">
                  All
                </option>

                <option value="LOW">
                  Low
                </option>

                <option value="MEDIUM">
                  Medium
                </option>

                <option value="HIGH">
                  High
                </option>
              </select>
            </div>

            <div className="col-6 col-lg-2">
              <label
                htmlFor="sortTickets"
                className="form-label fw-semibold"
              >
                Sort
              </label>

              <select
                id="sortTickets"
                className="form-select"
                value={sort}
                onChange={(
                  event
                ) => {
                  setSort(
                    event.target
                      .value as
                      | "createdAt_desc"
                      | "createdAt_asc"
                  );

                  setPage(1);
                }}
              >
                <option value="createdAt_desc">
                  Newest first
                </option>

                <option value="createdAt_asc">
                  Oldest first
                </option>
              </select>
            </div>
          </div>

          {hasFilters && (
            <div className="mt-3">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={
                  resetFilters
                }
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div
          className="text-center py-5"
          aria-busy="true"
        >
          <div
            className="spinner-border mb-3"
            role="status"
            aria-hidden="true"
          />

          <p className="mb-0">
            Loading tickets...
          </p>
        </div>
      )}

      {!loading && error && (
        <div
          className="alert alert-danger"
          role="alert"
        >
          {error}
        </div>
      )}

      {!loading &&
        !error &&
        tickets.length ===
          0 &&
        !hasFilters && (
          <div className="card shadow-sm">
            <div className="card-body text-center py-5">
              <h2 className="h5">
                No tickets yet
              </h2>

              <p className="text-muted mb-0">
                Tickets you create
                will appear here.
              </p>
            </div>
          </div>
        )}

      {!loading &&
        !error &&
        tickets.length ===
          0 &&
        hasFilters && (
          <div className="card shadow-sm">
            <div className="card-body text-center py-5">
              <h2 className="h5">
                No matching
                tickets
              </h2>

              <p className="text-muted">
                Try changing your
                search or filters.
              </p>

              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={
                  resetFilters
                }
              >
                Clear filters
              </button>
            </div>
          </div>
        )}

      {!loading &&
        !error &&
        tickets.length >
          0 && (
          <>
            {/* Tablet and desktop */}
            <div className="card shadow-sm overflow-hidden d-none d-md-block">
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead
                    style={{
                      backgroundColor:
                        "#EAF6EF",
                    }}
                  >
                    <tr>
                      <th
                        scope="col"
                        className="py-3"
                      >
                        Ticket Number
                      </th>

                      <th
                        scope="col"
                        className="py-3"
                      >
                        Summary
                      </th>

                      <th
                        scope="col"
                        className="py-3"
                      >
                        Category
                      </th>

                      <th
                        scope="col"
                        className="py-3"
                      >
                        Status
                      </th>

                      <th
                        scope="col"
                        className="py-3"
                      >
                        Priority
                      </th>

                      <th
                        scope="col"
                        className="py-3"
                      >
                        Created
                      </th>

                      <th
                        scope="col"
                        className="py-3"
                      >
                        <span className="visually-hidden">
                          Action
                        </span>
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {tickets.map(
                      (
                        ticket
                      ) => (
                        <tr
                          key={
                            ticket.id
                          }
                        >
                          <td className="fw-semibold py-3">
                            {
                              ticket.ticketNumber
                            }
                          </td>

                          <td className="py-3">
                            {
                              ticket.summary
                            }
                          </td>

                          <td className="py-3">
                            {
                              ticket
                                .category
                                .name
                            }
                          </td>

                          <td className="py-3">
                            <span
                              className="badge"
                              style={{
                                backgroundColor:
                                  "#EAF6EF",
                                color:
                                  "#006B3C",
                              }}
                            >
                              New
                            </span>
                          </td>

                          <td className="py-3">
                            {formatPriority(
                              ticket.requestedPriority
                            )}
                          </td>

                          <td className="py-3">
                            {new Date(
                              ticket.createdAt
                            ).toLocaleDateString()}
                          </td>

                          <td className="text-end py-3">
                            <button
                              type="button"
                              className="btn btn-outline-success btn-sm"
                              onClick={() =>
                                onOpenTicket?.(
                                  ticket
                                )
                              }
                            >
                              Open
                            </button>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile */}
            <div className="d-md-none d-flex flex-column gap-3">
              {tickets.map(
                (ticket) => (
                  <article
                    key={
                      ticket.id
                    }
                    className="card shadow-sm"
                  >
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                        <div
                          className="fw-semibold text-break"
                          style={{
                            color:
                              "#006B3C",
                          }}
                        >
                          {
                            ticket.ticketNumber
                          }
                        </div>

                        <span
                          className="badge flex-shrink-0"
                          style={{
                            backgroundColor:
                              "#EAF6EF",
                            color:
                              "#006B3C",
                          }}
                        >
                          New
                        </span>
                      </div>

                      <h2 className="h6 mb-3 text-break">
                        {
                          ticket.summary
                        }
                      </h2>

                      <dl className="row small mb-3">
                        <dt className="col-4 text-muted fw-normal">
                          Category
                        </dt>

                        <dd className="col-8 mb-2 text-break">
                          {
                            ticket
                              .category
                              .name
                          }
                        </dd>

                        <dt className="col-4 text-muted fw-normal">
                          Priority
                        </dt>

                        <dd className="col-8 mb-2">
                          {formatPriority(
                            ticket.requestedPriority
                          )}
                        </dd>

                        <dt className="col-4 text-muted fw-normal">
                          Created
                        </dt>

                        <dd className="col-8 mb-0">
                          {new Date(
                            ticket.createdAt
                          ).toLocaleDateString()}
                        </dd>
                      </dl>

                      <button
                        type="button"
                        className="btn btn-outline-success w-100"
                        onClick={() =>
                          onOpenTicket?.(
                            ticket
                          )
                        }
                      >
                        Open
                      </button>
                    </div>
                  </article>
                )
              )}
            </div>

            {totalPages > 1 && (
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 px-2 py-3 mt-3">
                <div className="text-muted small">
                  Showing{" "}
                  {startItem} to{" "}
                  {endItem} of{" "}
                  {totalItems} tickets
                </div>

                <nav aria-label="Ticket pagination">
                  <ul className="pagination pagination-sm mb-0 flex-wrap">
                    <li
                      className={`page-item ${
                        page <= 1
                          ? "disabled"
                          : ""
                      }`}
                    >
                      <button
                        type="button"
                        className="page-link"
                        onClick={
                          goToPreviousPage
                        }
                        disabled={
                          page <= 1
                        }
                        style={{
                          color:
                            "#006B3C",
                        }}
                      >
                        Previous
                      </button>
                    </li>

                    {getVisiblePages().map(
                      (
                        pageNumber,
                        index,
                        visiblePages
                      ) => {
                        const previousPage =
                          visiblePages[
                            index - 1
                          ];

                        return (
                          <span
                            key={
                              pageNumber
                            }
                            className="d-flex"
                          >
                            {previousPage &&
                              pageNumber -
                                previousPage >
                                1 && (
                                <li className="page-item disabled">
                                  <span className="page-link">
                                    ...
                                  </span>
                                </li>
                              )}

                            <li
                              className={`page-item ${
                                pageNumber ===
                                page
                                  ? "active"
                                  : ""
                              }`}
                            >
                              <button
                                type="button"
                                className="page-link"
                                onClick={() =>
                                  setPage(
                                    pageNumber
                                  )
                                }
                                style={
                                  pageNumber ===
                                  page
                                    ? {
                                        backgroundColor:
                                          "#006B3C",
                                        borderColor:
                                          "#006B3C",
                                        color:
                                          "white",
                                      }
                                    : {
                                        color:
                                          "#006B3C",
                                      }
                                }
                              >
                                {
                                  pageNumber
                                }
                              </button>
                            </li>
                          </span>
                        );
                      }
                    )}

                    <li
                      className={`page-item ${
                        page >=
                        totalPages
                          ? "disabled"
                          : ""
                      }`}
                    >
                      <button
                        type="button"
                        className="page-link"
                        onClick={
                          goToNextPage
                        }
                        disabled={
                          page >=
                          totalPages
                        }
                        style={{
                          color:
                            "#006B3C",
                        }}
                      >
                        Next
                      </button>
                    </li>
                  </ul>
                </nav>
              </div>
            )}
          </>
        )}
    </section>
  );
}