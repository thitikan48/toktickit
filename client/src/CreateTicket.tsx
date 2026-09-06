import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Category,
  RelatedSystem,
  RequestedPriority,
  createTicket,
  getCategories,
  getRelatedSystems,
  uploadAttachment,
} from "./api.js";

interface CreateTicketProps {
  requesterId: number;
  requesterName: string;
}

interface FormErrors {
  categoryId?: string;
  relatedSystemId?: string;
  summary?: string;
  description?: string;
  requestedPriority?: string;
}

const MAX_FILE_SIZE =
  5_242_880;

const MAX_ATTACHMENTS = 5;

const ALLOWED_TYPES =
  new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
  ]);

function formatFileSize(
  bytes: number
) {
  if (
    bytes >=
    1_048_576
  ) {
    return `${(
      bytes /
      1_048_576
    ).toFixed(1)} MB`;
  }

  return `${Math.max(
    1,
    Math.round(
      bytes / 1024
    )
  )} KB`;
}

export default function CreateTicket({
  requesterId,
  requesterName,
}: CreateTicketProps) {
  const [
    categories,
    setCategories,
  ] =
    useState<Category[]>([]);

  const [
    relatedSystems,
    setRelatedSystems,
  ] =
    useState<RelatedSystem[]>([]);

  const [
    categoryId,
    setCategoryId,
  ] = useState("");

  const [
    relatedSystemId,
    setRelatedSystemId,
  ] = useState("");

  const [
    summary,
    setSummary,
  ] = useState("");

  const [
    description,
    setDescription,
  ] = useState("");

  const [
    requestedPriority,
    setRequestedPriority,
  ] = useState("");

  const [
    selectedFiles,
    setSelectedFiles,
  ] =
    useState<File[]>([]);

  const [
    attachmentError,
    setAttachmentError,
  ] = useState("");

  const [
    errors,
    setErrors,
  ] =
    useState<FormErrors>({});

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    createdTicketNumber,
    setCreatedTicketNumber,
  ] = useState("");

  const [
    apiError,
    setApiError,
  ] = useState("");

  const ticketDate =
    useMemo(
      () =>
        new Date().toLocaleDateString(),
      []
    );

  const ticketCreated =
    Boolean(
      createdTicketNumber
    );

  useEffect(() => {
    async function loadReferenceData() {
      try {
        const [
          categoryData,
          relatedSystemData,
        ] =
          await Promise.all([
            getCategories(),
            getRelatedSystems(),
          ]);

        setCategories(
          categoryData
        );

        setRelatedSystems(
          relatedSystemData
        );
      } catch {
        setApiError(
          "Unable to load ticket reference data."
        );
      }
    }

    void loadReferenceData();
  }, []);

  function validate() {
    const nextErrors: FormErrors =
      {};

    if (!categoryId) {
      nextErrors.categoryId =
        "Category is required.";
    }

    if (!relatedSystemId) {
      nextErrors.relatedSystemId =
        "Related System is required.";
    }

    const trimmedSummary =
      summary.trim();

    if (
      trimmedSummary.length < 5 ||
      trimmedSummary.length > 120
    ) {
      nextErrors.summary =
        "Summary must be between 5 and 120 characters.";
    }

    const trimmedDescription =
      description.trim();

    if (
      trimmedDescription.length <
        10 ||
      trimmedDescription.length >
        4000
    ) {
      nextErrors.description =
        "Description must be between 10 and 4000 characters.";
    }

    if (!requestedPriority) {
      nextErrors.requestedPriority =
        "Requested Priority is required.";
    }

    setErrors(nextErrors);

    return (
      Object.keys(nextErrors)
        .length === 0
    );
  }

  function handleAttachmentSelection(
    fileList: FileList | null
  ) {
    setAttachmentError("");

    if (!fileList) {
      return;
    }

    const files =
      Array.from(fileList);

    if (
      selectedFiles.length +
        files.length >
      MAX_ATTACHMENTS
    ) {
      setAttachmentError(
        "A Ticket can have at most 5 attachments."
      );

      return;
    }

    for (const file of files) {
      if (
        !ALLOWED_TYPES.has(
          file.type
        )
      ) {
        setAttachmentError(
          "Only JPG, PNG, WEBP, and PDF files are allowed."
        );

        return;
      }

      if (
        file.size >
        MAX_FILE_SIZE
      ) {
        setAttachmentError(
          "Each attachment must not exceed 5 MB."
        );

        return;
      }
    }

    setSelectedFiles(
      (current) => [
        ...current,
        ...files,
      ]
    );
  }

  function removeSelectedFile(
    index: number
  ) {
    setSelectedFiles(
      (current) =>
        current.filter(
          (
            _,
            fileIndex
          ) =>
            fileIndex !==
            index
        )
    );
  }

  function resetForm() {
    setCategoryId("");
    setRelatedSystemId("");
    setSummary("");
    setDescription("");
    setRequestedPriority("");
    setSelectedFiles([]);
    setAttachmentError("");
    setErrors({});
  }

  function handleCreateAnother() {
    setCreatedTicketNumber("");
    setApiError("");
    resetForm();
  }

  async function handleSubmit(
    event: FormEvent
  ) {
    event.preventDefault();

    if (
      isSubmitting ||
      ticketCreated ||
      !validate()
    ) {
      return;
    }

    setIsSubmitting(true);
    setApiError("");
    setAttachmentError("");

    try {
      const ticket =
        await createTicket({
          requesterId,

          categoryId:
            Number(categoryId),

          relatedSystemId:
            Number(
              relatedSystemId
            ),

          summary:
            summary.trim(),

          description:
            description.trim(),

          requestedPriority:
            requestedPriority as RequestedPriority,
        });

      setCreatedTicketNumber(
        ticket.ticketNumber
      );

      let attachmentUploadFailed =
        false;

      for (
        const file of
        selectedFiles
      ) {
        try {
          await uploadAttachment(
            ticket.id,
            requesterId,
            file
          );
        } catch {
          attachmentUploadFailed =
            true;
        }
      }

      resetForm();

      if (
        attachmentUploadFailed
      ) {
        setApiError(
          "Ticket was created successfully, but one or more attachments could not be uploaded."
        );
      }
    } catch {
      setApiError(
        "Unable to create ticket. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section
      className="container py-4"
      style={{
        maxWidth: 1000,
      }}
    >
      <h1 className="h3 mb-4">
        Create Ticket
      </h1>

      {createdTicketNumber && (
        <div
          className="alert alert-success"
          role="status"
        >
          <div>
            Ticket created
            successfully. Ticket
            Number:{" "}
            <strong>
              {
                createdTicketNumber
              }
            </strong>
          </div>

          <button
            type="button"
            className="btn btn-outline-success btn-sm mt-3"
            onClick={
              handleCreateAnother
            }
          >
            Create Another Ticket
          </button>
        </div>
      )}

      {apiError && (
        <div
          className="alert alert-danger"
          role="alert"
        >
          {apiError}
        </div>
      )}

      <form
        className="card shadow-sm p-4"
        onSubmit={
          handleSubmit
        }
        noValidate
      >
        <div className="row">
          <div className="col-md-6 mb-3">
            <label className="form-label fw-semibold">
              Ticket Number
            </label>

            <input
              className="form-control"
              value="Assigned after submission"
              readOnly
              style={{
                backgroundColor:
                  "#EEF3F0",
              }}
            />
          </div>

          <div className="col-md-6 mb-3">
            <label className="form-label fw-semibold">
              Ticket Date
            </label>

            <input
              className="form-control"
              value={ticketDate}
              readOnly
              style={{
                backgroundColor:
                  "#EEF3F0",
              }}
            />
          </div>
        </div>

        <div className="mb-3">
          <label className="form-label fw-semibold">
            Requester
          </label>

          <input
            className="form-control"
            value={
              requesterName
            }
            readOnly
            style={{
              backgroundColor:
                "#EEF3F0",
            }}
          />
        </div>

        <div className="row">
          <div className="col-md-4 mb-3">
            <label
              htmlFor="category"
              className="form-label fw-semibold"
            >
              Category{" "}
              <span className="text-danger">
                *
              </span>
            </label>

            <select
              id="category"
              className={`form-select ${
                errors.categoryId
                  ? "is-invalid"
                  : ""
              }`}
              value={
                categoryId
              }
              disabled={
                ticketCreated
              }
              onChange={(
                event
              ) =>
                setCategoryId(
                  event.target
                    .value
                )
              }
            >
              <option value="">
                Select category
              </option>

              {categories.map(
                (category) => (
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

            {errors.categoryId && (
              <div className="invalid-feedback">
                {
                  errors.categoryId
                }
              </div>
            )}
          </div>

          <div className="col-md-4 mb-3">
            <label
              htmlFor="relatedSystem"
              className="form-label fw-semibold"
            >
              Related System{" "}
              <span className="text-danger">
                *
              </span>
            </label>

            <select
              id="relatedSystem"
              className={`form-select ${
                errors.relatedSystemId
                  ? "is-invalid"
                  : ""
              }`}
              value={
                relatedSystemId
              }
              disabled={
                ticketCreated
              }
              onChange={(
                event
              ) =>
                setRelatedSystemId(
                  event.target
                    .value
                )
              }
            >
              <option value="">
                Select related
                system
              </option>

              {relatedSystems.map(
                (system) => (
                  <option
                    key={
                      system.id
                    }
                    value={
                      system.id
                    }
                  >
                    {
                      system.name
                    }
                  </option>
                )
              )}
            </select>

            {errors.relatedSystemId && (
              <div className="invalid-feedback">
                {
                  errors.relatedSystemId
                }
              </div>
            )}
          </div>

          <div className="col-md-4 mb-3">
            <label
              htmlFor="priority"
              className="form-label fw-semibold"
            >
              Requested Priority{" "}
              <span className="text-danger">
                *
              </span>
            </label>

            <select
              id="priority"
              className={`form-select ${
                errors.requestedPriority
                  ? "is-invalid"
                  : ""
              }`}
              value={
                requestedPriority
              }
              disabled={
                ticketCreated
              }
              onChange={(
                event
              ) =>
                setRequestedPriority(
                  event.target
                    .value
                )
              }
            >
              <option value="">
                Select priority
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

            {errors.requestedPriority && (
              <div className="invalid-feedback">
                {
                  errors.requestedPriority
                }
              </div>
            )}
          </div>
        </div>

        <div className="mb-3">
          <label
            htmlFor="summary"
            className="form-label fw-semibold"
          >
            Ticket Summary{" "}
            <span className="text-danger">
              *
            </span>
          </label>

          <input
            id="summary"
            className={`form-control ${
              errors.summary
                ? "is-invalid"
                : ""
            }`}
            value={summary}
            maxLength={120}
            disabled={
              ticketCreated
            }
            onChange={(
              event
            ) =>
              setSummary(
                event.target.value
              )
            }
          />

          <div className="form-text">
            {summary.length}/120
          </div>

          {errors.summary && (
            <div className="invalid-feedback">
              {
                errors.summary
              }
            </div>
          )}
        </div>

        <div className="mb-4">
          <label
            htmlFor="description"
            className="form-label fw-semibold"
          >
            Description{" "}
            <span className="text-danger">
              *
            </span>
          </label>

          <textarea
            id="description"
            className={`form-control ${
              errors.description
                ? "is-invalid"
                : ""
            }`}
            rows={6}
            maxLength={4000}
            value={
              description
            }
            disabled={
              ticketCreated
            }
            onChange={(
              event
            ) =>
              setDescription(
                event.target
                  .value
              )
            }
          />

          <div className="form-text">
            {description.length}
            /4000
          </div>

          {errors.description && (
            <div className="invalid-feedback">
              {
                errors.description
              }
            </div>
          )}
        </div>

        <div className="mb-4">
          <label
            htmlFor="ticketAttachments"
            className="form-label fw-semibold"
          >
            Attachments
          </label>

          <input
            id="ticketAttachments"
            type="file"
            className="form-control"
            multiple
            accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
            onChange={(
              event
            ) => {
              handleAttachmentSelection(
                event.target
                  .files
              );

              event.target.value =
                "";
            }}
            disabled={
              isSubmitting ||
              ticketCreated ||
              selectedFiles.length >=
                MAX_ATTACHMENTS
            }
          />

          <div className="form-text">
            Allowed: JPG, PNG,
            WEBP, PDF • Max 5 MB
            per file • Max 5
            active attachments
          </div>

          {attachmentError && (
            <div
              className="text-danger small mt-2"
              role="alert"
            >
              {
                attachmentError
              }
            </div>
          )}

          {selectedFiles.length >
            0 && (
            <div className="d-flex flex-column gap-2 mt-3">
              {selectedFiles.map(
                (
                  file,
                  index
                ) => (
                  <div
                    key={`${file.name}-${file.lastModified}-${index}`}
                    className="border rounded p-2 d-flex flex-wrap justify-content-between align-items-center gap-3"
                  >
                    <span className="text-break small">
                      {
                        file.name
                      }{" "}
                      (
                      {formatFileSize(
                        file.size
                      )}
                      )
                    </span>

                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() =>
                        removeSelectedFile(
                          index
                        )
                      }
                      disabled={
                        isSubmitting ||
                        ticketCreated
                      }
                    >
                      Remove
                    </button>
                  </div>
                )
              )}
            </div>
          )}
        </div>

        <div className="d-flex justify-content-end">
          <button
            type="submit"
            className="btn text-white px-4"
            style={{
              backgroundColor:
                "#006B3C",
            }}
            disabled={
              isSubmitting ||
              ticketCreated
            }
          >
            {isSubmitting
              ? "Submitting..."
              : ticketCreated
                ? "Ticket Created"
                : "Submit Ticket"}
          </button>
        </div>
      </form>
    </section>
  );
}