import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Attachment,
  getAttachmentDownloadUrl,
  getAttachments,
  removeAttachment,
  uploadAttachment,
} from "./api.js";

interface AttachmentSectionProps {
  ticketId: number;
  requesterId: number;
}

const MAX_FILE_SIZE = 5_242_880;
const MAX_ATTACHMENTS = 5;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

function formatFileSize(bytes: number) {
  if (bytes >= 1_048_576) {
    return `${(
      bytes / 1_048_576
    ).toFixed(1)} MB`;
  }

  return `${Math.max(
    1,
    Math.round(bytes / 1024)
  )} KB`;
}

export default function AttachmentSection({
  ticketId,
  requesterId,
}: AttachmentSectionProps) {
  const [
    attachments,
    setAttachments,
  ] =
    useState<Attachment[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    uploading,
    setUploading,
  ] = useState(false);

  const [
    removing,
    setRemoving,
  ] = useState(false);

  const [
    attachmentToRemove,
    setAttachmentToRemove,
  ] =
    useState<Attachment | null>(
      null
    );

  const [
    removalReason,
    setRemovalReason,
  ] = useState("");

  const [
    removalError,
    setRemovalError,
  ] = useState("");

  const activeAttachments =
    useMemo(
      () =>
        attachments.filter(
          (attachment) =>
            !attachment.isRemoved
        ),
      [attachments]
    );

  const removedAttachments =
    useMemo(
      () =>
        attachments.filter(
          (attachment) =>
            attachment.isRemoved
        ),
      [attachments]
    );

  async function loadAttachments() {
    setLoading(true);
    setError("");

    try {
      const data =
        await getAttachments(
          ticketId,
          requesterId
        );

      setAttachments(data);
    } catch {
      setError(
        "Unable to load attachments. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAttachments();
  }, [ticketId, requesterId]);

  async function handleFileChange(
    fileList: FileList | null
  ) {
    setError("");

    const file = fileList?.[0];

    if (!file) {
      return;
    }

    if (
      !ALLOWED_TYPES.has(
        file.type
      )
    ) {
      setError(
        "Only JPG, PNG, WEBP, and PDF files are allowed."
      );
      return;
    }

    if (
      file.size >
      MAX_FILE_SIZE
    ) {
      setError(
        "Attachment must not exceed 5 MB."
      );
      return;
    }

    if (
      activeAttachments.length >=
      MAX_ATTACHMENTS
    ) {
      setError(
        "Maximum active attachments (5/5) reached."
      );
      return;
    }

    setUploading(true);

    try {
      const created =
        await uploadAttachment(
          ticketId,
          requesterId,
          file
        );

      setAttachments(
        (current) => [
          ...current,
          created,
        ]
      );
    } catch (
      uploadError
    ) {
      setError(
        uploadError instanceof
          Error
          ? uploadError.message
          : "Unable to upload attachment."
      );
    } finally {
      setUploading(false);
    }
  }

  function openRemoveDialog(
    attachment: Attachment
  ) {
    setAttachmentToRemove(
      attachment
    );

    setRemovalReason("");
    setRemovalError("");
    setError("");
  }

  function closeRemoveDialog() {
    if (removing) {
      return;
    }

    setAttachmentToRemove(
      null
    );

    setRemovalReason("");
    setRemovalError("");
  }

  async function confirmRemoval() {
    if (
      !attachmentToRemove
    ) {
      return;
    }

    const trimmedReason =
      removalReason.trim();

    if (!trimmedReason) {
      setRemovalError(
        "Removal reason is required."
      );
      return;
    }

    setRemovalError("");
    setRemoving(true);
    setError("");

    try {
      const updated =
        await removeAttachment(
          attachmentToRemove.id,
          requesterId,
          trimmedReason
        );

      setAttachments(
        (current) =>
          current.map(
            (attachment) =>
              attachment.id ===
              updated.id
                ? updated
                : attachment
          )
      );

      setAttachmentToRemove(
        null
      );

      setRemovalReason("");
    } catch (
      removeError
    ) {
      setError(
        removeError instanceof
          Error
          ? removeError.message
          : "Unable to remove attachment."
      );
    } finally {
      setRemoving(false);
    }
  }

  return (
    <>
      <div className="card shadow-sm mt-4">
        <div className="card-body p-4">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
            <div>
              <h2 className="h5 mb-1">
                Attachments (
                {
                  activeAttachments.length
                }
                /5 active)
              </h2>

              <p className="text-muted small mb-0">
                Allowed: JPG, PNG,
                WEBP, PDF • Max
                5 MB per file
              </p>
            </div>

            <div>
              <label
                htmlFor="addAttachment"
                className={`btn ${
                  activeAttachments.length >=
                  MAX_ATTACHMENTS
                    ? "btn-secondary disabled"
                    : "btn-success"
                } mb-0`}
              >
                {uploading
                  ? "Uploading..."
                  : "+ Add Attachment"}
              </label>

              <input
                id="addAttachment"
                aria-label="Add Attachment"
                type="file"
                className="d-none"
                accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                disabled={
                  uploading ||
                  activeAttachments.length >=
                    MAX_ATTACHMENTS
                }
                onChange={(
                  event
                ) => {
                  void handleFileChange(
                    event.target.files
                  );

                  event.target.value =
                    "";
                }}
              />
            </div>
          </div>

          {activeAttachments.length >=
            MAX_ATTACHMENTS && (
            <p className="small text-muted mb-3">
              Maximum active
              attachments (5/5)
              reached.
            </p>
          )}

          {error && (
            <div
              className="alert alert-danger"
              role="alert"
            >
              {error}
            </div>
          )}

          {loading && (
            <div
              className="text-center py-4"
              aria-busy="true"
            >
              Loading attachments...
            </div>
          )}

          {!loading &&
            attachments.length ===
              0 && (
              <div className="text-muted py-3">
                No attachments
                uploaded for this
                ticket yet.
              </div>
            )}

          {!loading &&
            activeAttachments.length >
              0 && (
              <div className="mb-4">
                <h3 className="h6 mb-3">
                  Active Attachments
                </h3>

                <div className="d-flex flex-column gap-2">
                  {activeAttachments.map(
                    (
                      attachment
                    ) => (
                      <div
                        key={
                          attachment.id
                        }
                        className="border rounded p-3 d-flex flex-wrap justify-content-between align-items-center gap-3"
                      >
                        <div>
                          <div className="fw-semibold text-break">
                            {
                              attachment.originalName
                            }
                          </div>

                          <div className="text-muted small">
                            {formatFileSize(
                              attachment.sizeBytes
                            )}
                            {" • "}
                            {new Date(
                              attachment.createdAt
                            ).toLocaleString()}
                          </div>
                        </div>

                        <div className="d-flex gap-2">
                          <a
                            className="btn btn-outline-success btn-sm"
                            href={getAttachmentDownloadUrl(
                              attachment.id,
                              requesterId
                            )}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Download
                          </a>

                          <button
                            type="button"
                            className="btn btn-outline-danger btn-sm"
                            onClick={() =>
                              openRemoveDialog(
                                attachment
                              )
                            }
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

          {!loading &&
            removedAttachments.length >
              0 && (
              <div>
                <h3 className="h6 mb-3">
                  Removed
                  Attachments
                </h3>

                <div className="d-flex flex-column gap-2">
                  {removedAttachments.map(
                    (
                      attachment
                    ) => (
                      <div
                        key={
                          attachment.id
                        }
                        className="border rounded p-3 bg-light text-muted"
                      >
                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                          <div className="fw-semibold text-break">
                            {
                              attachment.originalName
                            }
                          </div>

                          <span className="badge text-bg-secondary">
                            Removed
                          </span>
                        </div>

                        <div className="small mt-2">
                          {formatFileSize(
                            attachment.sizeBytes
                          )}
                        </div>

                        {attachment.removedAt && (
                          <div className="small mt-1">
                            Removed:{" "}
                            {new Date(
                              attachment.removedAt
                            ).toLocaleString()}
                          </div>
                        )}

                        {attachment.removalReason && (
                          <div className="small mt-1">
                            Reason:{" "}
                            {
                              attachment.removalReason
                            }
                          </div>
                        )}
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
        </div>
      </div>

      {attachmentToRemove && (
        <div
          className="modal d-block"
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="removeAttachmentTitle"
          style={{
            backgroundColor:
              "rgba(0, 0, 0, 0.45)",
          }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h2
                  id="removeAttachmentTitle"
                  className="modal-title h5"
                >
                  Confirm
                  Attachment
                  Removal
                </h2>
              </div>

              <div className="modal-body">
                <p>
                  Remove{" "}
                  <strong>
                    {
                      attachmentToRemove.originalName
                    }
                  </strong>
                  ?
                </p>

                <div>
                  <label
                    htmlFor="removalReason"
                    className="form-label"
                  >
                    Removal Reason
                    <span className="text-danger">
                      {" "}
                      *
                    </span>
                  </label>

                  <textarea
                    id="removalReason"
                    className={`form-control ${
                      removalError
                        ? "is-invalid"
                        : ""
                    }`}
                    rows={3}
                    value={
                      removalReason
                    }
                    disabled={
                      removing
                    }
                    onChange={(
                      event
                    ) => {
                      setRemovalReason(
                        event.target
                          .value
                      );

                      if (
                        removalError
                      ) {
                        setRemovalError(
                          ""
                        );
                      }
                    }}
                  />

                  {removalError && (
                    <div className="invalid-feedback">
                      {
                        removalError
                      }
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={
                    closeRemoveDialog
                  }
                  disabled={
                    removing
                  }
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="btn btn-outline-danger"
                  onClick={() =>
                    void confirmRemoval()
                  }
                  disabled={
                    removing
                  }
                >
                  {removing
                    ? "Removing..."
                    : "Confirm Removal"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}