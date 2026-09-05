import { FormEvent, useEffect, useState } from "react";
import {
  Category,
  RelatedSystem,
  RequestedPriority,
  createTicket,
  getCategories,
  getRelatedSystems,
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

export default function CreateTicket({
  requesterId,
  requesterName,
}: CreateTicketProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [relatedSystems, setRelatedSystems] = useState<RelatedSystem[]>([]);

  const [categoryId, setCategoryId] = useState("");
  const [relatedSystemId, setRelatedSystemId] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [requestedPriority, setRequestedPriority] = useState("");

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdTicketNumber, setCreatedTicketNumber] = useState("");
  const [apiError, setApiError] = useState("");

  useEffect(() => {
    async function loadReferenceData() {
      try {
        const [categoryData, relatedSystemData] = await Promise.all([
          getCategories(),
          getRelatedSystems(),
        ]);

        setCategories(categoryData);
        setRelatedSystems(relatedSystemData);
      } catch {
        setApiError("Unable to load ticket reference data.");
      }
    }

    loadReferenceData();
  }, []);

  function validate() {
    const nextErrors: FormErrors = {};

    if (!categoryId) {
      nextErrors.categoryId = "Category is required.";
    }

    if (!relatedSystemId) {
      nextErrors.relatedSystemId = "Related System is required.";
    }

    const trimmedSummary = summary.trim();

    if (trimmedSummary.length < 5 || trimmedSummary.length > 120) {
      nextErrors.summary =
        "Summary must be between 5 and 120 characters.";
    }

    const trimmedDescription = description.trim();

    if (
      trimmedDescription.length < 10 ||
      trimmedDescription.length > 4000
    ) {
      nextErrors.description =
        "Description must be between 10 and 4000 characters.";
    }

    if (!requestedPriority) {
      nextErrors.requestedPriority =
        "Requested Priority is required.";
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (isSubmitting || !validate()) {
      return;
    }

    setIsSubmitting(true);
    setApiError("");
    setCreatedTicketNumber("");

    try {
      const ticket = await createTicket({
        requesterId,
        categoryId: Number(categoryId),
        relatedSystemId: Number(relatedSystemId),
        summary: summary.trim(),
        description: description.trim(),
        requestedPriority: requestedPriority as RequestedPriority,
      });

      setCreatedTicketNumber(ticket.ticketNumber);
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
      style={{ maxWidth: 1000 }}
    >
      <h1 className="h3 mb-4">Create Ticket</h1>

      {createdTicketNumber && (
        <div className="alert alert-success" role="status">
          Ticket created successfully. Ticket Number:{" "}
          <strong>{createdTicketNumber}</strong>
        </div>
      )}

      {apiError && (
        <div className="alert alert-danger" role="alert">
          {apiError}
        </div>
      )}

      <form
        className="card shadow-sm p-4"
        onSubmit={handleSubmit}
        noValidate
      >
        <div className="mb-3">
          <label className="form-label fw-semibold">
            Ticket Number
          </label>
          <input
            className="form-control"
            value="Assigned after submission"
            readOnly
            style={{ backgroundColor: "#EEF3F0" }}
          />
        </div>

        <div className="mb-3">
          <label className="form-label fw-semibold">
            Requester
          </label>
          <input
            className="form-control"
            value={requesterName}
            readOnly
            style={{ backgroundColor: "#EEF3F0" }}
          />
        </div>

        <div className="row">
          <div className="col-md-4 mb-3">
            <label
              htmlFor="category"
              className="form-label fw-semibold"
            >
              Category <span className="text-danger">*</span>
            </label>

            <select
              id="category"
              className={`form-select ${
                errors.categoryId ? "is-invalid" : ""
              }`}
              value={categoryId}
              onChange={(event) =>
                setCategoryId(event.target.value)
              }
            >
              <option value="">Select category</option>

              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>

            {errors.categoryId && (
              <div className="invalid-feedback">
                {errors.categoryId}
              </div>
            )}
          </div>

          <div className="col-md-4 mb-3">
            <label
              htmlFor="relatedSystem"
              className="form-label fw-semibold"
            >
              Related System{" "}
              <span className="text-danger">*</span>
            </label>

            <select
              id="relatedSystem"
              className={`form-select ${
                errors.relatedSystemId ? "is-invalid" : ""
              }`}
              value={relatedSystemId}
              onChange={(event) =>
                setRelatedSystemId(event.target.value)
              }
            >
              <option value="">Select related system</option>

              {relatedSystems.map((system) => (
                <option key={system.id} value={system.id}>
                  {system.name}
                </option>
              ))}
            </select>

            {errors.relatedSystemId && (
              <div className="invalid-feedback">
                {errors.relatedSystemId}
              </div>
            )}
          </div>

          <div className="col-md-4 mb-3">
            <label
              htmlFor="priority"
              className="form-label fw-semibold"
            >
              Requested Priority{" "}
              <span className="text-danger">*</span>
            </label>

            <select
              id="priority"
              className={`form-select ${
                errors.requestedPriority ? "is-invalid" : ""
              }`}
              value={requestedPriority}
              onChange={(event) =>
                setRequestedPriority(event.target.value)
              }
            >
              <option value="">Select priority</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>

            {errors.requestedPriority && (
              <div className="invalid-feedback">
                {errors.requestedPriority}
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
            <span className="text-danger">*</span>
          </label>

          <input
            id="summary"
            className={`form-control ${
              errors.summary ? "is-invalid" : ""
            }`}
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
          />

          {errors.summary && (
            <div className="invalid-feedback">
              {errors.summary}
            </div>
          )}
        </div>

        <div className="mb-4">
          <label
            htmlFor="description"
            className="form-label fw-semibold"
          >
            Description <span className="text-danger">*</span>
          </label>

          <textarea
            id="description"
            className={`form-control ${
              errors.description ? "is-invalid" : ""
            }`}
            rows={6}
            value={description}
            onChange={(event) =>
              setDescription(event.target.value)
            }
          />

          {errors.description && (
            <div className="invalid-feedback">
              {errors.description}
            </div>
          )}
        </div>

        <div className="d-flex justify-content-end">
          <button
            type="submit"
            className="btn text-white px-4"
            style={{ backgroundColor: "#006B3C" }}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Submitting..." : "Submit Ticket"}
          </button>
        </div>
      </form>
    </section>
  );
}