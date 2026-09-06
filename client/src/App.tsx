import {
  useEffect,
  useState,
} from "react";
import {
  DevelopmentRequester,
  getDevelopmentRequesters,
  TicketListItem,
} from "./api.js";
import CreateTicket from "./CreateTicket.js";
import MyTickets from "./MyTickets.js";
import TicketDetail from "./TicketDetail.js";

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
  const [requesters, setRequesters] =
    useState<DevelopmentRequester[]>([]);

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
    selectedTicketId,
    setSelectedTicketId,
  ] = useState<number | null>(null);

  useEffect(() => {
    void loadRequesters();
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
    setSelectedTicketId(null);
    setScreen("home");
  }

  function handleChangeRequester() {
    sessionStorage.removeItem(
      "developmentRequesterId"
    );

    setCurrentRequester(null);
    setSelectedRequesterId("");
    setSelectedTicketId(null);
    setScreen("home");
  }

  function handleOpenTicket(
    ticket: TicketListItem
  ) {
    setSelectedTicketId(ticket.id);
    setScreen("detail");
  }

  function handleBackToTickets() {
    setSelectedTicketId(null);
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
            className="container py-3"
            style={{
              maxWidth: 1200,
            }}
          >
            <div className="d-flex flex-wrap align-items-center gap-3">
              <strong className="fs-5 me-md-3">
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
                    setSelectedTicketId(
                      null
                    );
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
                    setSelectedTicketId(
                      null
                    );
                    setScreen("create");
                  }}
                >
                  Create Ticket
                </button>
              </nav>

              {/*
               * Force the Requester area
               * onto a new row on mobile.
               * Hidden from md and larger.
               */}
              <div className="w-100 d-md-none" />

              <div className="d-flex flex-wrap align-items-center gap-2 gap-md-3 ms-md-auto">
                <span>
                  {
                    currentRequester.name
                  }
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
          </div>
        </header>

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

        {screen === "detail" &&
          selectedTicketId !== null && (
            <TicketDetail
              ticketId={
                selectedTicketId
              }
              requesterId={
                currentRequester.id
              }
              requesterName={
                currentRequester.name
              }
              onBack={
                handleBackToTickets
              }
            />
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
              >
                👤
              </div>

              <h1 className="h3 mb-2">
                Select Development
                Requester
              </h1>

              <p className="text-muted mb-1">
                Select a Development
                Requester for Lab 2
                testing only.
              </p>

              <p className="text-muted small mb-0">
                This is not a login
                screen. Authentication
                and role-based access
                will be introduced in
                Lab 3.
              </p>
            </div>

            {state ===
              "loading" && (
              <div
                className="text-center py-4"
                aria-busy="true"
              >
                <div
                  className="spinner-border mb-3"
                  role="status"
                  aria-hidden="true"
                />

                <p className="mb-0">
                  Loading Requesters...
                </p>
              </div>
            )}

            {state === "error" && (
              <div>
                <div
                  className="alert alert-danger"
                  role="alert"
                >
                  Unable to load
                  Development
                  Requesters. Please
                  try again.
                </div>

                <div className="d-flex justify-content-end">
                  <button
                    type="button"
                    className="btn btn-outline-success"
                    onClick={() =>
                      void loadRequesters()
                    }
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}

            {state === "empty" && (
              <div
                className="alert alert-warning"
                role="status"
              >
                No active Development
                Requesters are
                available.
              </div>
            )}

            {state === "ready" && (
              <div>
                <label
                  htmlFor="developmentRequester"
                  className="form-label fw-semibold"
                >
                  Development
                  Requester{" "}
                  <span className="text-danger">
                    *
                  </span>
                </label>

                <select
                  id="developmentRequester"
                  className="form-select"
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
                    Select requester
                  </option>

                  {requesters.map(
                    (
                      requester
                    ) => (
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

                <div className="d-flex justify-content-end mt-4">
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
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}