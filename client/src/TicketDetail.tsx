import {
  useEffect,
  useState,
} from "react";
import {
  getTicketById,
  TicketDetail as TicketDetailData,
} from "./api.js";

interface TicketDetailProps {
  ticketId: number;
  requesterId: number;
  requesterName: string;
  onBack: () => void;
}

type DetailState =
  | "loading"
  | "success"
  | "error";

export default function TicketDetail({
  ticketId,
  requesterId,
  requesterName,
  onBack,
}: TicketDetailProps) {
  const [ticket, setTicket] =
    useState<TicketDetailData | null>(
      null
    );

  const [state, setState] =
    useState<DetailState>("loading");

  useEffect(() => {
    let cancelled = false;

    async function loadTicket() {
      setState("loading");

      try {
        const data =
          await getTicketById(
            ticketId,
            requesterId
          );

        if (cancelled) {
          return;
        }

        setTicket(data);
        setState("success");
      } catch {
        if (cancelled) {
          return;
        }

        setTicket(null);
        setState("error");
      }
    }

    loadTicket();

    return () => {
      cancelled = true;
    };
  }, [
    ticketId,
    requesterId,
  ]);

  if (state === "loading") {
    return (
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
          onClick={onBack}
        >
          ← Back to My Tickets
        </button>

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
            Loading ticket...
          </p>
        </div>
      </section>
    );
  }

  if (
    state === "error" ||
    !ticket
  ) {
    return (
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
          onClick={onBack}
        >
          ← Back to My Tickets
        </button>

        <div
          className="alert alert-danger"
          role="alert"
        >
          Unable to load this ticket.
          Please return to My Tickets
          and try again.
        </div>
      </section>
    );
  }

  return (
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
        onClick={onBack}
      >
        ← Back to My Tickets
      </button>

      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <p className="text-muted mb-1">
            Ticket
          </p>

          <h1 className="h3 mb-1">
            {ticket.ticketNumber}
          </h1>

          <p className="text-muted mb-0">
            View your support request
            details.
          </p>
        </div>

        <span
          className="badge px-3 py-2"
          style={{
            backgroundColor:
              "#EAF6EF",
            color: "#006B3C",
          }}
        >
          New
        </span>
      </div>

      <div className="card shadow-sm mb-4">
        <div className="card-body p-4">
          <h2 className="h5 mb-4">
            Ticket Information
          </h2>

          <div className="row g-4">
            <div className="col-12 col-md-6">
              <p className="text-muted small mb-1">
                Requester
              </p>

              <p className="fw-semibold mb-0">
                {requesterName}
              </p>
            </div>

            <div className="col-12 col-md-6">
              <p className="text-muted small mb-1">
                Current Status
              </p>

              <p className="fw-semibold mb-0">
                New
              </p>
            </div>

            <div className="col-12 col-md-6">
              <p className="text-muted small mb-1">
                Category
              </p>

              <p className="fw-semibold mb-0">
                {
                  ticket.category
                    .name
                }
              </p>
            </div>

            <div className="col-12 col-md-6">
              <p className="text-muted small mb-1">
                Related System
              </p>

              <p className="fw-semibold mb-0">
                {
                  ticket
                    .relatedSystem
                    .name
                }
              </p>
            </div>

            <div className="col-12 col-md-6">
              <p className="text-muted small mb-1">
                Requested Priority
              </p>

              <p className="fw-semibold mb-0">
                {ticket.requestedPriority ===
                "LOW"
                  ? "Low"
                  : ticket.requestedPriority ===
                      "MEDIUM"
                    ? "Medium"
                    : "High"}
              </p>
            </div>

            <div className="col-12 col-md-6">
              <p className="text-muted small mb-1">
                Created
              </p>

              <p className="fw-semibold mb-0">
                {new Date(
                  ticket.createdAt
                ).toLocaleString()}
              </p>
            </div>

            <div className="col-12">
              <hr />
            </div>

            <div className="col-12">
              <p className="text-muted small mb-1">
                Summary
              </p>

              <p className="fw-semibold mb-0">
                {ticket.summary}
              </p>
            </div>

            <div className="col-12">
              <p className="text-muted small mb-1">
                Description
              </p>

              <p
                className="mb-0"
                style={{
                  whiteSpace:
                    "pre-wrap",
                }}
              >
                {
                  ticket.description
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      <div
        className="p-3 rounded"
        style={{
          backgroundColor:
            "#EAF6EF",
          border:
            "1px solid #D6E0DA",
        }}
      >
        <p
          className="mb-0"
          style={{
            color: "#006B3C",
          }}
        >
          Ticket information is
          read-only for Requesters.
        </p>
      </div>
    </section>
  );
}

<div className="card shadow-sm mt-4">
  <div className="card-body p-4">
    <h2 className="h5 mb-2">
      Attachments
    </h2>

    <p className="text-muted mb-0">
      No attachments yet.
    </p>
  </div>
</div>