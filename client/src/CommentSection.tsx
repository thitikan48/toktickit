import { FormEvent, useEffect, useState } from "react";
import {
  TicketComment,
  getComments,
  getInternalNotes,
  postComment,
  postInternalNote,
} from "./api.js";

const MAX_LENGTH = 2000;

const ROLE_LABELS = {
  REQUESTER: "Requester",
  IT_STAFF: "IT Staff",
  ADMIN: "Administrator",
} as const;

/*
 * requester: Public Comments seen by the Requester who owns the ticket
 * staff:     the same Public Comments, seen by IT Staff
 * internal:  Internal Notes, visible only to IT Staff and Administrators
 */
type Variant = "requester" | "staff" | "internal";

const TEXT: Record<
  Variant,
  {
    heading: string;
    subtitle: string;
    label: string;
    button: string;
    empty: string;
    loadError: string;
    postError: string;
  }
> = {
  requester: {
    heading: "Public Comments",
    subtitle: "Visible to you and the IT team.",
    label: "Add a comment",
    button: "Post Public Comment",
    empty: "No comments yet.",
    loadError: "Unable to load comments.",
    postError: "Unable to post the comment. Please try again.",
  },
  staff: {
    heading: "Public Comments",
    subtitle: "Visible to the Requester.",
    label: "Add a comment",
    button: "Post Public Comment",
    empty: "No comments yet.",
    loadError: "Unable to load comments.",
    postError: "Unable to post the comment. Please try again.",
  },
  internal: {
    heading: "Internal Notes",
    subtitle: "Not visible to the Requester.",
    label: "Add an internal note",
    button: "Add Internal Note",
    empty: "No internal notes yet.",
    loadError: "Unable to load internal notes.",
    postError: "Unable to add the note. Please try again.",
  },
};

interface CommentSectionProps {
  ticketId: number;
  variant?: Variant;
}

export default function CommentSection({
  ticketId,
  variant = "requester",
}: CommentSectionProps) {
  const text_ = TEXT[variant];
  const internal = variant === "internal";
  const fetchEntries = internal ? getInternalNotes : getComments;
  const sendEntry = internal ? postInternalNote : postComment;

  const [comments, setComments] = useState<TicketComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [text, setText] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [postError, setPostError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError(false);

    try {
      setComments(await fetchEntries(ticketId));
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [ticketId]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setPostError("");

    const trimmed = text.trim();

    if (trimmed.length < 1 || trimmed.length > MAX_LENGTH) {
      setFieldError(
        `Enter between 1 and ${MAX_LENGTH} characters.`
      );
      return;
    }

    setFieldError("");
    setBusy(true);

    try {
      const created = await sendEntry(ticketId, trimmed);
      setComments((current) => [...current, created]);
      setText("");
    } catch {
      // The typed text is kept so it can be sent again.
      setPostError(text_.postError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="card shadow-sm mt-4"
      aria-labelledby={`${variant}-heading`}
      style={
        internal
          ? {
              backgroundColor: "#FFFAEB",
              borderLeft: "4px solid #B54708",
            }
          : undefined
      }
    >
      <div className="card-body p-4">
        <h2 id={`${variant}-heading`} className="h5 mb-1">
          {text_.heading}
          {internal && (
            <span
              className="badge ms-2"
              style={{
                backgroundColor: "#B54708",
                color: "#FFFFFF",
              }}
            >
              Staff only
            </span>
          )}
        </h2>
        <p className="text-muted small mb-4">
          {text_.subtitle}
        </p>

        {loading && (
          <p aria-busy="true" className="text-muted">
            Loading comments...
          </p>
        )}

        {loadError && (
          <div className="alert alert-danger" role="alert">
            {text_.loadError}{" "}
            <button
              type="button"
              className="btn btn-link p-0 align-baseline"
              onClick={() => void load()}
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !loadError && comments.length === 0 && (
          <p className="text-muted">{text_.empty}</p>
        )}

        {comments.length > 0 && (
          <ul className="list-unstyled mb-4">
            {comments.map((comment) => (
              <li
                key={comment.id}
                className="mb-3 pb-3 border-bottom"
              >
                <div className="d-flex flex-wrap gap-2 align-items-baseline mb-1">
                  <strong>{comment.author.name}</strong>
                  <span className="badge bg-light text-dark">
                    {ROLE_LABELS[comment.author.role]}
                  </span>
                  <span className="text-muted small">
                    {new Date(comment.createdAt).toLocaleString()}
                  </span>
                </div>
                {/* Plain text only; line breaks are kept. */}
                <p
                  className="mb-0 text-break"
                  style={{ whiteSpace: "pre-wrap" }}
                >
                  {comment.body}
                </p>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleSubmit} noValidate aria-busy={busy}>
          {postError && (
            <div className="alert alert-danger" role="alert">
              {postError}
            </div>
          )}

          <label
            htmlFor={`${variant}-text`}
            className="form-label fw-semibold"
          >
            {text_.label}
          </label>
          <textarea
            id={`${variant}-text`}
            rows={3}
            className={`form-control ${
              fieldError ? "is-invalid" : ""
            }`}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          {fieldError && (
            <div className="invalid-feedback">{fieldError}</div>
          )}
          <div className="d-flex justify-content-between align-items-center mt-2">
            <span className="text-muted small">
              {text.length}/{MAX_LENGTH}
            </span>
            <button
              type="submit"
              className="btn btn-success"
              style={{
                backgroundColor: "#006B3C",
                borderColor: "#006B3C",
              }}
              disabled={busy}
            >
              {busy ? "Posting…" : text_.button}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
