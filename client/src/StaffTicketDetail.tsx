import { useEffect, useState } from "react";
import {
  ApiError,
  Assignee,
  AuthUser,
  RequestedPriority,
  StaffTicketDetail as StaffTicketDetailData,
  TicketStatus,
  changeStatus,
  getAssignees,
  getStaffTicket,
  updateTicket,
} from "./api.js";
import AttachmentSection from "./AttachmentSection.js";
import CommentSection from "./CommentSection.js";
import Dialog from "./Dialog.js";
import PriorityBadge from "./PriorityBadge.js";
import StatusBadge, { statusLabel } from "./StatusBadge.js";
import { allowedTransitions, needsConfirmation } from "./statusRules.js";

interface StaffTicketDetailProps {
  ticketId: number;
  currentUser: AuthUser;
  onBack: () => void;
}

export default function StaffTicketDetail({
  ticketId,
  currentUser,
  onBack,
}: StaffTicketDetailProps) {
  const [ticket, setTicket] = useState<StaffTicketDetailData | null>(null);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error" | "missing">(
    "loading"
  );

  // Nothing is saved until the user presses "Save Changes".
  const [ownerDraft, setOwnerDraft] = useState("");
  const [priorityDraft, setPriorityDraft] = useState<RequestedPriority>("LOW");
  const [statusDraft, setStatusDraft] = useState("");

  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState("");

  function resetDrafts(loaded: StaffTicketDetailData) {
    setOwnerDraft(loaded.owner ? String(loaded.owner.id) : "");
    setPriorityDraft(loaded.itPriority);
    setStatusDraft("");
  }

  async function load() {
    setState("loading");

    try {
      const [loaded, people] = await Promise.all([
        getStaffTicket(ticketId),
        getAssignees().catch(() => [] as Assignee[]),
      ]);

      setTicket(loaded);
      setAssignees(people);
      resetDrafts(loaded);
      setState("ready");
    } catch (error) {
      setState(
        error instanceof ApiError && error.status === 404
          ? "missing"
          : "error"
      );
    }
  }

  useEffect(() => {
    void load();
  }, [ticketId]);

  if (state === "loading") {
    return (
      <section className="container py-4" style={{ maxWidth: 1100 }}>
        <div className="text-center py-5" aria-busy="true">
          <div className="spinner-border mb-3" role="status" aria-hidden="true" />
          <p className="mb-0">Loading ticket...</p>
        </div>
      </section>
    );
  }

  if (state !== "ready" || !ticket) {
    return (
      <section className="container py-4" style={{ maxWidth: 1100 }}>
        <button
          type="button"
          className="btn btn-link px-0 mb-3 text-decoration-none"
          style={{ color: "#006B3C" }}
          onClick={onBack}
        >
          ← Back to Queue
        </button>
        <div className="alert alert-danger" role="alert">
          {state === "missing"
            ? "Ticket not found."
            : "Unable to load this ticket."}{" "}
          {state === "error" && (
            <button
              type="button"
              className="btn btn-link p-0 align-baseline"
              onClick={() => void load()}
            >
              Retry
            </button>
          )}
        </div>
      </section>
    );
  }

  const current = ticket;
  const choices = allowedTransitions(current.currentStatus);

  const originalOwner = current.owner ? String(current.owner.id) : "";
  const ownerChanged = ownerDraft !== originalOwner;
  const priorityChanged = priorityDraft !== current.itPriority;
  const statusChosen = statusDraft !== "";
  const hasChanges = ownerChanged || priorityChanged || statusChosen;

  function handleSave() {
    setMessage("");
    setProblem("");

    // Resolving, closing, or cancelling is confirmed before anything is saved.
    if (statusChosen && needsConfirmation(statusDraft as TicketStatus)) {
      setConfirming(true);
      return;
    }

    void saveChanges(false);
  }

  /**
   * Saves owner and priority first (a status change needs an owner), then
   * the status. If the status is refused, the earlier changes stay saved.
   */
  async function saveChanges(confirm: boolean) {
    setConfirming(false);
    setSaving(true);
    setMessage("");
    setProblem("");

    let savedOwnerOrPriority = false;

    try {
      if (ownerChanged || priorityChanged) {
        await updateTicket(ticketId, {
          ...(ownerChanged
            ? { ownerId: ownerDraft === "" ? null : Number(ownerDraft) }
            : {}),
          ...(priorityChanged ? { itPriority: priorityDraft } : {}),
        });
        savedOwnerOrPriority = true;
      }

      if (statusChosen) {
        await changeStatus(ticketId, statusDraft as TicketStatus, confirm);
      }

      setMessage("Changes saved.");
    } catch (error) {
      // Rule messages from the server (for example "Assign an owner
      // before changing the status.") are safe and written for the user.
      const reason =
        error instanceof ApiError && error.status === 409
          ? error.message
          : "Unable to save the changes. Please try again.";

      setProblem(
        savedOwnerOrPriority && statusChosen
          ? `Owner and priority were saved, but the status was not changed. ${reason}`
          : reason
      );
    } finally {
      setSaving(false);

      try {
        const reloaded = await getStaffTicket(ticketId);
        setTicket(reloaded);
        resetDrafts(reloaded);
      } catch {
        // The screen keeps what it already shows.
      }
    }
  }

  return (
    <section className="container py-4" style={{ maxWidth: 1100 }}>
      <button
        type="button"
        className="btn btn-link px-0 mb-3 text-decoration-none"
        style={{ color: "#006B3C" }}
        onClick={onBack}
      >
        ← Back to Queue
      </button>

      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <p className="text-muted mb-1">Ticket</p>
          <h1 className="h3 mb-1">{current.ticketNumber}</h1>
          {current.requesterMarkedResolved && (
            <span
              className="badge"
              style={{ backgroundColor: "#EAF6EF", color: "#006B3C" }}
            >
              Requester says resolved
            </span>
          )}
        </div>
        <div className="d-flex gap-2 align-items-center">
          <PriorityBadge priority={current.itPriority} className="px-3 py-2" />
          <StatusBadge status={current.currentStatus} className="px-3 py-2" />
        </div>
      </div>

      <div className="row g-4">
        <div className="col-12 col-lg-7">
          <div className="card shadow-sm">
            <div className="card-body p-4">
              <h2 className="h5 mb-4">Ticket Information</h2>

              <div className="row g-4">
                <div className="col-12 col-md-6">
                  <p className="text-muted small mb-1">Requester</p>
                  <p className="fw-semibold mb-0">
                    {current.requester.name}
                    <span className="d-block text-muted small fw-normal">
                      {current.requester.email}
                    </span>
                  </p>
                </div>
                <div className="col-12 col-md-6">
                  <p className="text-muted small mb-1">Created</p>
                  <p className="fw-semibold mb-0">
                    {new Date(current.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="col-12 col-md-6">
                  <p className="text-muted small mb-1">Category</p>
                  <p className="fw-semibold mb-0">{current.category.name}</p>
                </div>
                <div className="col-12 col-md-6">
                  <p className="text-muted small mb-1">Related System</p>
                  <p className="fw-semibold mb-0">{current.relatedSystem.name}</p>
                </div>
                <div className="col-12 col-md-6">
                  <p className="text-muted small mb-1">Requested Priority</p>
                  <p className="mb-0">
                    <PriorityBadge priority={current.requestedPriority} />
                  </p>
                </div>
                <div className="col-12">
                  <hr />
                </div>
                <div className="col-12">
                  <p className="text-muted small mb-1">Summary</p>
                  <p className="fw-semibold mb-0">{current.summary}</p>
                </div>
                <div className="col-12">
                  <p className="text-muted small mb-1">Description</p>
                  <p className="mb-0" style={{ whiteSpace: "pre-wrap" }}>
                    {current.description}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-5">
          <div className="card shadow-sm">
            <div className="card-body p-4">
              <h2 className="h5 mb-4">Ticket Handling</h2>

              {message && (
                <div className="alert alert-success" role="status">
                  {message}
                </div>
              )}
              {problem && (
                <div className="alert alert-danger" role="alert">
                  {problem}
                </div>
              )}

              <div className="mb-4">
                <label htmlFor="ownerSelect" className="form-label fw-semibold">
                  Owner
                </label>
                <select
                  id="ownerSelect"
                  className="form-select"
                  disabled={saving}
                  value={ownerDraft}
                  onChange={(event) => setOwnerDraft(event.target.value)}
                >
                  <option value="">Unassigned</option>
                  {current.owner &&
                    !assignees.some((person) => person.id === current.owner!.id) && (
                      <option value={current.owner.id}>
                        {current.owner.name} (inactive)
                      </option>
                    )}
                  {assignees.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </select>
                {ownerDraft === "" && (
                  <button
                    type="button"
                    className="btn btn-outline-success btn-sm mt-2"
                    disabled={saving}
                    onClick={() => setOwnerDraft(String(currentUser.id))}
                  >
                    Claim Ticket
                  </button>
                )}
              </div>

              <div className="mb-4">
                <label htmlFor="prioritySelect" className="form-label fw-semibold">
                  IT Priority
                </label>
                <select
                  id="prioritySelect"
                  className="form-select"
                  disabled={saving}
                  value={priorityDraft}
                  onChange={(event) =>
                    setPriorityDraft(event.target.value as RequestedPriority)
                  }
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
                <div className="form-text">
                  Requested by the Requester:{" "}
                  <PriorityBadge priority={current.requestedPriority} />
                </div>
              </div>

              <div className="mb-4">
                <label htmlFor="statusSelect" className="form-label fw-semibold">
                  Status
                </label>
                {choices.length === 0 ? (
                  <p className="text-muted mb-0">
                    This ticket is {statusLabel(current.currentStatus)}; its
                    status cannot be changed.
                  </p>
                ) : (
                  <select
                    id="statusSelect"
                    className="form-select"
                    disabled={saving}
                    value={statusDraft}
                    onChange={(event) => setStatusDraft(event.target.value)}
                  >
                    <option value="">
                      Current: {statusLabel(current.currentStatus)}
                    </option>
                    {choices.map((choice) => (
                      <option key={choice} value={choice}>
                        {statusLabel(choice)}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-success"
                  style={{ backgroundColor: "#006B3C", borderColor: "#006B3C" }}
                  disabled={saving || !hasChanges}
                  onClick={handleSave}
                >
                  {saving ? "Saving…" : "Save Changes"}
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  disabled={saving || !hasChanges}
                  onClick={() => resetDrafts(current)}
                >
                  Discard
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AttachmentSection ticketId={current.id} readOnly />

      <CommentSection ticketId={current.id} variant="staff" />

      <CommentSection ticketId={current.id} variant="internal" />

      {confirming && (
        <Dialog
          title={`Change status to ${statusLabel(statusDraft as TicketStatus)}?`}
          onClose={() => setConfirming(false)}
        >
          <div className="modal-body">
            The Requester will see the new status.
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => setConfirming(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-success"
              style={{ backgroundColor: "#006B3C", borderColor: "#006B3C" }}
              onClick={() => void saveChanges(true)}
            >
              Confirm
            </button>
          </div>
        </Dialog>
      )}
    </section>
  );
}
