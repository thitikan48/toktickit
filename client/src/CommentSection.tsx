import { FormEvent, useEffect, useState } from "react";
import {
  TicketComment,
  getComments,
  postComment,
} from "./api.js";

const MAX_LENGTH = 2000;

const ROLE_LABELS = {
  REQUESTER: "Requester",
  IT_STAFF: "IT Staff",
  ADMIN: "Administrator",
} as const;

interface CommentSectionProps {
  ticketId: number;
}

export default function CommentSection({
  ticketId,
}: CommentSectionProps) {
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
      setComments(await getComments(ticketId));
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
      const created = await postComment(ticketId, trimmed);
      setComments((current) => [...current, created]);
      setText("");
    } catch {
      // The typed text is kept so it can be sent again.
      setPostError(
        "Unable to post the comment. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="card shadow-sm mt-4"
      aria-labelledby="comments-heading"
    >
      <div className="card-body p-4">
        <h2 id="comments-heading" className="h5 mb-1">
          Public Comments
        </h2>
        <p className="text-muted small mb-4">
          Visible to you and the IT team.
        </p>

        {loading && (
          <p aria-busy="true" className="text-muted">
            Loading comments...
          </p>
        )}

        {loadError && (
          <div className="alert alert-danger" role="alert">
            Unable to load comments.{" "}
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
          <p className="text-muted">No comments yet.</p>
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
            htmlFor="comment-text"
            className="form-label fw-semibold"
          >
            Add a comment
          </label>
          <textarea
            id="comment-text"
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
              {busy ? "Posting…" : "Post Public Comment"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
