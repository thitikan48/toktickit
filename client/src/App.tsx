import { useEffect, useState } from "react";
import {
  DevelopmentRequester,
  getDevelopmentRequesters,
  TicketListItem,
} from "./api.js";
import CreateTicket from "./CreateTicket.js";
import MyTickets from "./MyTickets.js";

type RequesterState =
  | "loading"
  | "ready"
  | "empty"
  | "error";

type AppScreen =
  | "home"
  | "create"
  | "detail";

export default function App() {
  const [requesters, setRequesters] = useState<
    DevelopmentRequester[]
  >([]);

  const [
    selectedRequesterId,
    setSelectedRequesterId,
  ] = useState("");

  const [
    currentRequester,
    setCurrentRequester,
  ] =
    useState<DevelopmentRequester | null>(
      null
    );

  const [state, setState] =
    useState<RequesterState>("loading");

  const [screen, setScreen] =
    useState<AppScreen>("home");

  const [
    selectedTicket,
    setSelectedTicket,
  ] =
    useState<TicketListItem | null>(null);

  useEffect(() => {
    loadRequesters();
  }, []);

  async function loadRequesters() {
    setState("loading");

    try {
      const data =
        await getDevelopmentRequesters();

      setRequesters(data);

      if (data.length === 0) {
        setCurrentRequester(null);
        setState("empty");
        return;
      }

      const storedRequesterId =
        sessionStorage.getItem(
          "developmentRequesterId"
        );

      if (storedRequesterId) {
        const storedRequester =
          data.find(
            (requester) =>
              requester.id ===
              Number(storedRequesterId)
          );

        if (storedRequester) {
          setCurrentRequester(
            storedRequester
          );

          setSelectedRequesterId(
            String(storedRequester.id)
          );
        } else {
          sessionStorage.removeItem(
            "developmentRequesterId"
          );
        }
      }

      setState("ready");
    } catch {
      setState("error");
    }
  }

  function handleContinue() {
    if (!selectedRequesterId) {
      return;
    }

    const requester =
      requesters.find(
        (item) =>
          item.id ===
          Number(selectedRequesterId)
      );

    if (!requester) {
      return;
    }

    sessionStorage.setItem(
      "developmentRequesterId",
      selectedRequesterId
    );

    setCurrentRequester(requester);
    setSelectedTicket(null);
    setScreen("home");
  }

  function handleChangeRequester() {
    sessionStorage.removeItem(
      "developmentRequesterId"
    );

    setCurrentRequester(null);
    setSelectedRequesterId("");
    setSelectedTicket(null);
    setScreen("home");
  }

  function handleOpenTicket(
    ticket: TicketListItem
  ) {
    setSelectedTicket(ticket);
    setScreen("detail");
  }

  function handleBackToTickets() {
    setSelectedTicket(null);
    setScreen("home");
  }

  if (currentRequester) {
    return (
      <main
        className="min-vh-100"
        style={{
          backgroundColor: "#F5F7F6",
        }}
      >
        <header
          className="text-white"
          style={{
            backgroundColor: "#006B3C",
          }}
        >
          <div
            className="container d-flex flex-wrap justify-content-between align-items-center gap-3 py-3"
            style={{
              maxWidth: 1200,
            }}
          >
            <strong className="fs-5">
              TokTickIT
            </strong>

            <nav className="d-flex flex-wrap align-items-center gap-2">
              <button
                type="button"
                className={`btn btn-link text-white text-decoration-none px-3 py-2 ${
                  screen === "home" ||
                  screen === "detail"
                    ? "fw-bold border-bottom border-3"
                    : ""
                }`}
                onClick={() => {
                  setSelectedTicket(null);
                  setScreen("home");
                }}
              >
                My Tickets
              </button>

              <button
                type="button"
                className={`btn btn-link text-white text-decoration-none px-3 py-2 ${
                  screen === "create"
                    ? "fw-bold border-bottom border-3"
                    : ""
                }`}
                onClick={() => {
                  setSelectedTicket(null);
                  setScreen("create");
                }}
              >
                Create Ticket
              </button>
            </nav>

            <div className="d-flex flex-wrap align-items-center gap-3">
              <span>
                {currentRequester.name}
              </span>

              <button
                type="button"
                className="btn btn-light btn-sm"
                onClick={
                  handleChangeRequester
                }
              >
                Change Requester
              </button>
            </div>
          </div>
        </header>

        {screen === "create" && (
          <CreateTicket
            requesterId={
              currentRequester.id
            }
            requesterName={
              currentRequester.name
            }
          />
        )}

        {screen === "home" && (
          <MyTickets
            requesterId={
              currentRequester.id
            }
            onOpenTicket={
              handleOpenTicket
            }
          />
        )}

        {screen === "detail" &&
          selectedTicket && (
            <section
              className="container py-4"
              style={{
                maxWidth: 1000,
              }}
            >
              <button
                type="button"
                className="btn btn-link px-0 mb-3 text-decoration-none"
                style={{
                  color: "#006B3C",
                }}
                onClick={
                  handleBackToTickets
                }
              >
                ← Back to My Tickets
              </button>

              <div className="card shadow-sm">
                <div className="card-body p-4">
                  <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
                    <div>
                      <p className="text-muted mb-1">
                        Ticket Number
                      </p>

                      <h1 className="h4 mb-0">
                        {
                          selectedTicket.ticketNumber
                        }
                      </h1>
                    </div>

                    <span
                      className="badge"
                      style={{
                        backgroundColor:
                          "#EAF6EF",
                        color:
                          "#006B3C",
                        fontSize:
                          "0.9rem",
                      }}
                    >
                      New
                    </span>
                  </div>

                  <div className="row g-4">
                    <div className="col-md-6">
                      <p className="text-muted mb-1">
                        Requester
                      </p>

                      <p className="fw-semibold mb-0">
                        {
                          currentRequester.name
                        }
                      </p>
                    </div>

                    <div className="col-md-6">
                      <p className="text-muted mb-1">
                        Category
                      </p>

                      <p className="fw-semibold mb-0">
                        {
                          selectedTicket.category
                            .name
                        }
                      </p>
                    </div>

                    <div className="col-md-6">
                      <p className="text-muted mb-1">
                        Requested Priority
                      </p>

                      <p className="fw-semibold mb-0">
                        {selectedTicket.requestedPriority ===
                        "LOW"
                          ? "Low"
                          : selectedTicket.requestedPriority ===
                              "MEDIUM"
                            ? "Medium"
                            : "High"}
                      </p>
                    </div>

                    <div className="col-md-6">
                      <p className="text-muted mb-1">
                        Created
                      </p>

                      <p className="fw-semibold mb-0">
                        {new Date(
                          selectedTicket.createdAt
                        ).toLocaleString()}
                      </p>
                    </div>

                    <div className="col-12">
                      <p className="text-muted mb-1">
                        Summary
                      </p>

                      <p className="fw-semibold mb-0">
                        {
                          selectedTicket.summary
                        }
                      </p>
                    </div>

                    <div className="col-12">
                      <p className="text-muted mb-1">
                        Description
                      </p>

                      <p className="mb-0">
                        {
                          selectedTicket.description
                        }
                      </p>
                    </div>
                  </div>

                  <div
                    className="mt-4 p-3 rounded"
                    style={{
                      backgroundColor:
                        "#EAF6EF",
                      border:
                        "1px solid #D6E0DA",
                    }}
                  >
                    <strong
                      style={{
                        color:
                          "#006B3C",
                      }}
                    >
                      Ticket detail preview
                    </strong>

                    <p className="mb-0 mt-1 text-muted">
                      Full requester ticket
                      detail features will be
                      completed in the next
                      issue.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}
      </main>
    );
  }

  return (
    <main
      className="min-vh-100"
      style={{
        backgroundColor: "#F5F7F6",
      }}
    >
      <header
        className="text-white"
        style={{
          backgroundColor: "#006B3C",
        }}
      >
        <div
          className="container py-3"
          style={{
            maxWidth: 1200,
          }}
        >
          <strong className="fs-5">
            TokTickIT
          </strong>
        </div>
      </header>

      <div className="container py-5">
        <section
          className="card shadow-sm mx-auto overflow-hidden"
          style={{
            maxWidth: 680,
            border:
              "1px solid #D6E0DA",
            borderRadius: 12,
          }}
        >
          <div className="p-4 p-md-5">
            <div className="text-center mb-4">
              <div
                className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3"
                style={{
                  width: 60,
                  height: 60,
                  backgroundColor:
                    "#EAF6EF",
                  color:
                    "#006B3C",
                  fontSize: 26,
                }}
                aria-hidden="true"
              >
                👤
              </div>

              <h1 className="h3 mb-2">
                Select Development
                Requester
              </h1>

              <p className="text-muted mb-0">
                Choose a requester to
                test TokTickIT features
                in Lab 2.
              </p>
            </div>

            {state ===
              "loading" && (
              <div
                className="text-center py-4"
                aria-busy="true"
              >
                <div
                  className="spinner-border spinner-border-sm me-2"
                  role="status"
                  aria-hidden="true"
                />

                Loading Requesters...
              </div>
            )}

            {state === "error" && (
              <div
                role="alert"
                className="p-3 rounded mb-3"
                style={{
                  backgroundColor:
                    "#FEF3F2",
                  border:
                    "1px solid #B42318",
                }}
              >
                <p className="text-danger mb-2">
                  Unable to load
                  Development Requesters.
                </p>

                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm"
                  onClick={
                    loadRequesters
                  }
                >
                  Retry
                </button>
              </div>
            )}

            {state === "empty" && (
              <div
                className="p-3 rounded"
                style={{
                  backgroundColor:
                    "#FFFAEB",
                  border:
                    "1px solid #B54708",
                }}
              >
                No active Development
                Requesters are available.
              </div>
            )}

            {state === "ready" && (
              <>
                <label
                  htmlFor="requester"
                  className="form-label fw-semibold"
                >
                  Development Requester{" "}
                  <span className="text-danger">
                    *
                  </span>
                </label>

                <select
                  id="requester"
                  className="form-select mb-3"
                  style={{
                    minHeight: 44,
                  }}
                  value={
                    selectedRequesterId
                  }
                  onChange={(
                    event
                  ) =>
                    setSelectedRequesterId(
                      event.target
                        .value
                    )
                  }
                >
                  <option value="">
                    Select a requester
                  </option>

                  {requesters.map(
                    (requester) => (
                      <option
                        key={
                          requester.id
                        }
                        value={
                          requester.id
                        }
                      >
                        {
                          requester.name
                        }
                      </option>
                    )
                  )}
                </select>

                <div
                  className="p-2 px-3 rounded mb-3"
                  style={{
                    backgroundColor:
                      "#EAF6EF",
                    color:
                      "#006B3C",
                    border:
                      "1px solid #D6E0DA",
                  }}
                >
                  Only active requesters
                  are available.
                </div>

                <div
                  className="p-3 rounded mb-4"
                  style={{
                    backgroundColor:
                      "#FFFAEB",
                    border:
                      "1px solid #B54708",
                  }}
                >
                  <strong
                    style={{
                      color:
                        "#B54708",
                    }}
                  >
                    Lab 2 testing only
                  </strong>

                  <p
                    className="mb-0 mt-1"
                    style={{
                      color:
                        "#66756D",
                    }}
                  >
                    This requester
                    selection is
                    temporary. Real login
                    and authentication
                    will be introduced
                    in Lab 3.
                  </p>
                </div>

                <div className="d-flex justify-content-end">
                  <button
                    type="button"
                    className="btn text-white px-4"
                    style={{
                      backgroundColor:
                        "#006B3C",
                    }}
                    disabled={
                      !selectedRequesterId
                    }
                    onClick={
                      handleContinue
                    }
                  >
                    Continue
                  </button>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}