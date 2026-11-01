import { FormEvent, ReactNode, useEffect, useId, useRef, useState } from "react";
import {
  ActionInput,
  ActionStatus,
  ActionTaken,
  ApiError,
  Assignee,
  createAction,
  getAssignees,
  getRequesterActions,
  getStaffActions,
  updateAction,
} from "./api.js";
import ActionStatusBadge, {
  FollowUpBadge,
  actionStatusLabel,
} from "./ActionStatusBadge.js";
import Dialog from "./Dialog.js";

interface ActionsTakenProps {
  ticketId: number;
  mode: "staff" | "requester";
  currentUserId?: number;
}

type Panel =
  | { kind: "create" }
  | { kind: "view"; action: ActionTaken }
  | { kind: "edit"; action: ActionTaken }
  | null;

interface FormValues {
  actionAt: string;
  description: string;
  status: ActionStatus;
  result: string;
  assignedToId: string;
  followUpRequired: boolean;
  followUpNote: string;
  attachmentNotes: string;
}

// Order of the form fields, used to focus the first invalid one.
const FIELD_ORDER = [
  "actionAt",
  "description",
  "status",
  "result",
  "assignedToId",
  "followUpNote",
  "attachmentNotes",
];

const TEXT_MAX = 1000;
const ATTACHMENT_NOTES_MAX = 500;

const PRIMARY = { backgroundColor: "#006B3C", borderColor: "#006B3C" };
const READ_ONLY = { backgroundColor: "#EEF3F0" };
// Chromium does not show the Bootstrap focus ring on a datetime-local input
// (focus sits on its date and time parts), so the ring is set while focused.
const FOCUS_RING = {
  borderColor: "#86b7fe",
  boxShadow: "0 0 0 0.25rem rgba(13, 110, 253, 0.25)",
};

// Times are stored in UTC and shown in Bangkok time.
const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Bangkok",
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDate(value: string): string {
  return DATE_FORMAT.format(new Date(value));
}

// The datetime-local input is Bangkok time (UTC+7, no daylight saving).
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

function toBangkokInput(date: Date): string {
  return new Date(date.getTime() + BANGKOK_OFFSET_MS).toISOString().slice(0, 16);
}

function fromBangkokInput(value: string): string {
  const date = new Date(`${value}:00+07:00`);
  // An empty or invalid value is sent as is; the server answers with a field error.
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function valuesFrom(action: ActionTaken): FormValues {
  return {
    actionAt: toBangkokInput(new Date(action.actionAt)),
    description: action.description,
    status: action.status,
    result: action.result ?? "",
    assignedToId: String(action.assignedTo.id),
    followUpRequired: action.followUpRequired,
    followUpNote: action.followUpNote ?? "",
    attachmentNotes: action.attachmentNotes ?? "",
  };
}

const fieldId = (field: string) => `action-${field}`;

export default function ActionsTaken({
  ticketId,
  mode,
  currentUserId,
}: ActionsTakenProps) {
  const isStaff = mode === "staff";
  const headingId = useId();
  const panelHeadingId = useId();

  const [actions, setActions] = useState<ActionTaken[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [assignees, setAssignees] = useState<Assignee[]>([]);

  const [panel, setPanel] = useState<Panel>(null);
  const [values, setValues] = useState<FormValues | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState("");
  const [message, setMessage] = useState("");
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  // The ref blocks a second click before React has re-rendered the button.
  const [saving, setSaving] = useState(false);
  const [dateFocused, setDateFocused] = useState(false);
  const savingRef = useRef(false);

  async function load() {
    setState("loading");

    try {
      setActions(
        await (isStaff ? getStaffActions(ticketId) : getRequesterActions(ticketId))
      );
      setState("ready");
    } catch {
      setState("error");
    }
  }

  useEffect(() => {
    void load();

    if (isStaff) {
      getAssignees()
        .then(setAssignees)
        .catch(() => setAssignees([]));
    }
  }, [ticketId]);

  // After a server validation error, the first invalid field gets focus.
  useEffect(() => {
    const first = FIELD_ORDER.find((field) => errors[field]);
    if (first) {
      document.getElementById(fieldId(first))?.focus();
    }
  }, [errors]);

  function clearFeedback() {
    setErrors({});
    setProblem("");
    setMessage("");
  }

  function openCreate() {
    clearFeedback();
    setValues({
      actionAt: toBangkokInput(new Date()),
      description: "",
      status: "PLANNED",
      result: "",
      assignedToId: currentUserId ? String(currentUserId) : "",
      followUpRequired: false,
      followUpNote: "",
      attachmentNotes: "",
    });
    setPanel({ kind: "create" });
  }

  function openView(action: ActionTaken) {
    clearFeedback();
    setPanel({ kind: "view", action });
  }

  function openEdit(action: ActionTaken) {
    clearFeedback();
    setValues(valuesFrom(action));
    setPanel({ kind: "edit", action });
  }

  function showError(error: unknown) {
    if (
      error instanceof ApiError &&
      error.status === 400 &&
      Object.keys(error.fields).length > 0
    ) {
      setErrors(error.fields);
    } else if (error instanceof ApiError && error.status === 409) {
      // Rule messages from the server are safe and written for the user.
      setProblem(error.message);
    } else {
      setProblem("Unable to save. Please try again.");
    }
  }

  // Runs one save at a time. Typed values stay when it fails.
  async function save(request: () => Promise<unknown>) {
    if (savingRef.current) return;

    savingRef.current = true;
    setSaving(true);
    setErrors({});
    setProblem("");

    try {
      await request();
      setPanel(null);
      setMessage("Action saved.");
      void load();
    } catch (error) {
      showError(error);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!values) return;

    void save(() =>
      createAction(ticketId, {
        actionAt: fromBangkokInput(values.actionAt),
        description: values.description,
        status: values.status,
        result: values.result,
        assignedToId: Number(values.assignedToId),
        followUpRequired: values.followUpRequired,
        followUpNote: values.followUpNote,
        attachmentNotes: values.attachmentNotes,
      })
    );
  }

  // Edit sends only the fields that changed, and never the status.
  function handleEdit(event: FormEvent, action: ActionTaken) {
    event.preventDefault();
    if (!values) return;

    const before = valuesFrom(action);
    const changes: ActionInput = {};

    if (values.actionAt !== before.actionAt) changes.actionAt = fromBangkokInput(values.actionAt);
    if (values.description !== before.description) changes.description = values.description;
    if (values.result !== before.result) changes.result = values.result;
    if (values.assignedToId !== before.assignedToId) changes.assignedToId = Number(values.assignedToId);
    if (values.followUpRequired !== before.followUpRequired) changes.followUpRequired = values.followUpRequired;
    if (values.followUpNote !== before.followUpNote) changes.followUpNote = values.followUpNote;
    if (values.attachmentNotes !== before.attachmentNotes) changes.attachmentNotes = values.attachmentNotes;

    if (Object.keys(changes).length === 0) {
      openView(action);
      return;
    }

    void save(() => updateAction(ticketId, action.id, changes));
  }

  function changeStatus(action: ActionTaken, status: ActionStatus) {
    setConfirmingCancel(false);
    void save(() => updateAction(ticketId, action.id, { status }));
  }

  function setValue<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => (current ? { ...current, [key]: value } : current));
  }

  /*
   * Form fields (create and edit mode)
   */
  function field(
    name: string,
    label: string,
    required: boolean,
    control: (props: {
      id: string;
      className: string;
      "aria-required"?: "true";
      "aria-invalid"?: "true";
      "aria-describedby"?: string;
    }) => ReactNode,
    hint?: string
  ) {
    const id = fieldId(name);
    const error = errors[name];
    const describedBy = [hint ? `${id}-hint` : "", error ? `${id}-error` : ""]
      .filter(Boolean)
      .join(" ");

    return (
      <div className="mb-3">
        <label htmlFor={id} className="form-label fw-semibold">
          {label} {required && <span className="text-danger">*</span>}
        </label>
        {control({
          id,
          className: error ? "is-invalid" : "",
          ...(required ? { "aria-required": "true" as const } : {}),
          ...(error ? { "aria-invalid": "true" as const } : {}),
          ...(describedBy ? { "aria-describedby": describedBy } : {}),
        })}
        {hint && (
          <div id={`${id}-hint`} className="form-text">
            {hint}
          </div>
        )}
        {error && (
          <div id={`${id}-error`} className="invalid-feedback">
            {error}
          </div>
        )}
      </div>
    );
  }

  function textArea(name: "description" | "result" | "followUpNote" | "attachmentNotes") {
    return (props: { id: string; className: string }) => (
      <textarea
        {...props}
        className={`form-control ${props.className}`}
        rows={3}
        disabled={saving}
        value={values![name]}
        onChange={(event) => setValue(name, event.target.value)}
      />
    );
  }

  function counter(name: "description" | "result" | "followUpNote" | "attachmentNotes", max: number) {
    return `${values![name].length} / ${max}`;
  }

  function renderForm(kind: "create" | "edit", action?: ActionTaken) {
    if (!values) return null;

    return (
      <form
        noValidate
        onSubmit={(event) =>
          kind === "create" ? handleCreate(event) : handleEdit(event, action!)
        }
      >
        {field(
          "actionAt",
          "Action Date and Time",
          true,
          (props) => (
            <input
              {...props}
              type="datetime-local"
              className={`form-control ${props.className}`}
              disabled={saving}
              value={values.actionAt}
              style={dateFocused ? FOCUS_RING : undefined}
              onFocus={() => setDateFocused(true)}
              onBlur={() => setDateFocused(false)}
              onChange={(event) => setValue("actionAt", event.target.value)}
            />
          ),
          "Bangkok time (UTC+7)"
        )}

        {field(
          "description",
          "Action Description",
          true,
          textArea("description"),
          counter("description", TEXT_MAX)
        )}

        {kind === "create" &&
          field("status", "Status", true, (props) => (
            <select
              {...props}
              className={`form-select ${props.className}`}
              disabled={saving}
              value={values.status}
              onChange={(event) => setValue("status", event.target.value as ActionStatus)}
            >
              <option value="PLANNED">Planned</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
            </select>
          ))}

        {field("result", "Result", false, textArea("result"), counter("result", TEXT_MAX))}

        {field("assignedToId", "Assigned To", true, (props) => (
          <select
            {...props}
            className={`form-select ${props.className}`}
            disabled={saving}
            value={values.assignedToId}
            onChange={(event) => setValue("assignedToId", event.target.value)}
          >
            {action && !assignees.some((person) => person.id === action.assignedTo.id) && (
              <option value={action.assignedTo.id}>{action.assignedTo.name} (inactive)</option>
            )}
            {assignees.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        ))}

        <div className="mb-3 form-check">
          <input
            id={fieldId("followUpRequired")}
            type="checkbox"
            className="form-check-input"
            disabled={saving}
            checked={values.followUpRequired}
            onChange={(event) => setValue("followUpRequired", event.target.checked)}
          />
          <label htmlFor={fieldId("followUpRequired")} className="form-check-label">
            Follow-Up Required
          </label>
        </div>

        {values.followUpRequired &&
          field(
            "followUpNote",
            "Follow-up Note",
            true,
            textArea("followUpNote"),
            counter("followUpNote", TEXT_MAX)
          )}

        {field(
          "attachmentNotes",
          "Attachment Notes",
          false,
          textArea("attachmentNotes"),
          `${counter("attachmentNotes", ATTACHMENT_NOTES_MAX)}. Which file or image to look at. This is not an upload.`
        )}

        {/* Set by the system: shown in edit mode, but never editable. */}
        {kind === "edit" && action && (
          <div className="row g-3 mb-3">{recordInfo(action)}</div>
        )}

        <div className="d-flex flex-wrap gap-2">
          <button type="submit" className="btn btn-success" style={PRIMARY} disabled={saving}>
            {saving ? "Saving..." : kind === "create" ? "Save Action" : "Save Changes"}
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary"
            disabled={saving}
            onClick={() => (kind === "create" ? setPanel(null) : openView(action!))}
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  /*
   * View mode: every field read-only
   */
  function readOnlyField(name: string, label: string, value: string, multiline = false) {
    const id = `action-view-${name}`;

    return (
      <div className="col-12 col-md-6">
        <label htmlFor={id} className="form-label fw-semibold mb-1">
          {label}
        </label>
        {multiline ? (
          <textarea id={id} className="form-control" rows={3} readOnly value={value} style={READ_ONLY} />
        ) : (
          <input id={id} className="form-control" readOnly value={value} style={READ_ONLY} />
        )}
      </div>
    );
  }

  // Status, Performed By, and who created and updated the action are set by
  // the system. They are read-only in view mode and in edit mode.
  function recordInfo(action: ActionTaken) {
    return (
      <>
        <div className="col-12 col-md-6">
          <p className="form-label fw-semibold mb-1">Status</p>
          <ActionStatusBadge status={action.status} />
          {action.followUpRequired && <FollowUpBadge />}
        </div>
        {readOnlyField("performedBy", "Performed By", action.performedBy?.name ?? "Not yet performed")}
        <div className="col-12 text-muted small">
          Created by {action.createdBy.name} on {formatDate(action.createdAt)}. Last updated by{" "}
          {action.updatedBy.name} on {formatDate(action.updatedAt)}.
        </div>
      </>
    );
  }

  function renderView(action: ActionTaken) {
    const open = action.status === "PLANNED" || action.status === "IN_PROGRESS";

    return (
      <>
        <div className="row g-3 mb-3">
          {readOnlyField("actionAt", "Action Date and Time", formatDate(action.actionAt))}
          {readOnlyField("description", "Action Description", action.description, true)}
          {readOnlyField("result", "Result", action.result ?? "", true)}
          {readOnlyField("assignedTo", "Assigned To", action.assignedTo.name)}
          {readOnlyField("followUpRequired", "Follow-Up Required", action.followUpRequired ? "Yes" : "No")}
          {action.followUpRequired &&
            readOnlyField("followUpNote", "Follow-up Note", action.followUpNote ?? "", true)}
          {readOnlyField("attachmentNotes", "Attachment Notes", action.attachmentNotes ?? "", true)}
          {recordInfo(action)}
        </div>

        {!open && (
          <p className="text-muted">
            This action is {actionStatusLabel(action.status)} and cannot be changed.
          </p>
        )}

        <div className="d-flex flex-wrap gap-2">
          {isStaff && open && (
            <>
              <button type="button" className="btn btn-outline-secondary" disabled={saving} onClick={() => openEdit(action)}>
                Edit
              </button>
              {action.status === "PLANNED" && (
                <button
                  type="button"
                  className="btn btn-outline-success"
                  disabled={saving}
                  onClick={() => changeStatus(action, "IN_PROGRESS")}
                >
                  Start
                </button>
              )}
              <button
                type="button"
                className="btn btn-success"
                style={PRIMARY}
                disabled={saving}
                onClick={() => changeStatus(action, "COMPLETED")}
              >
                Complete
              </button>
              <button
                type="button"
                className="btn btn-outline-danger"
                disabled={saving}
                onClick={() => setConfirmingCancel(true)}
              >
                Cancel Action
              </button>
            </>
          )}
          <button type="button" className="btn btn-outline-secondary" disabled={saving} onClick={() => setPanel(null)}>
            Close
          </button>
        </div>
      </>
    );
  }

  function renderPanel() {
    if (!panel) return null;

    const title =
      panel.kind === "create" ? "Add Action" : panel.kind === "edit" ? "Edit Action" : "Action Details";

    return (
      <div
        role="group"
        aria-labelledby={panelHeadingId}
        className="border rounded p-3 mb-4"
        style={{ borderColor: "#D6E0DA" }}
      >
        <h3 id={panelHeadingId} className="h6 mb-3">
          {title}
        </h3>

        {problem && (
          <div className="alert alert-danger" role="alert">
            {problem}
          </div>
        )}

        {panel.kind === "view" ? renderView(panel.action) : renderForm(panel.kind, panel.kind === "edit" ? panel.action : undefined)}
      </div>
    );
  }

  /*
   * List: a table on desktop and tablet, cards below 768 px.
   */
  function viewButton(action: ActionTaken, className: string) {
    return (
      <button
        type="button"
        className={`btn btn-outline-success btn-sm ${className}`}
        aria-label={`View action from ${formatDate(action.actionAt)}`}
        onClick={() => openView(action)}
      >
        View
      </button>
    );
  }

  function renderList() {
    if (state === "loading") {
      return (
        <div className="text-center py-4" role="status">
          <div className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
          Loading actions...
        </div>
      );
    }

    if (state === "error") {
      return (
        <div className="alert alert-danger" role="alert">
          Unable to load the actions.{" "}
          <button type="button" className="btn btn-link p-0 align-baseline" onClick={() => void load()}>
            Retry
          </button>
        </div>
      );
    }

    if (actions.length === 0) {
      return <p className="text-muted mb-0">No actions have been recorded yet.</p>;
    }

    return (
      <>
        <div className="table-responsive d-none d-md-block">
          <table className="table align-middle mb-0">
            <thead>
              <tr>
                <th scope="col">Action Date</th>
                <th scope="col">Description</th>
                <th scope="col">Status</th>
                <th scope="col">Assigned To</th>
                <th scope="col">Performed By</th>
                <th scope="col">
                  <span className="visually-hidden">View</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {actions.map((action) => (
                <tr key={action.id}>
                  <td className="text-nowrap">{formatDate(action.actionAt)}</td>
                  <td style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{action.description}</td>
                  <td>
                    <ActionStatusBadge status={action.status} />
                    {action.followUpRequired && <FollowUpBadge />}
                  </td>
                  <td>{action.assignedTo.name}</td>
                  <td>{action.performedBy?.name ?? "Not yet performed"}</td>
                  <td className="text-end">{viewButton(action, "")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="d-md-none d-flex flex-column gap-3">
          {actions.map((action) => (
            <div key={action.id} className="card">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                  <span className="text-muted small">{formatDate(action.actionAt)}</span>
                  <span>
                    <ActionStatusBadge status={action.status} />
                    {action.followUpRequired && <FollowUpBadge />}
                  </span>
                </div>
                <p className="mb-2" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {action.description}
                </p>
                <p className="small mb-1">Assigned to: {action.assignedTo.name}</p>
                <p className="small mb-3">Performed by: {action.performedBy?.name ?? "Not yet performed"}</p>
                {viewButton(action, "w-100")}
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <section className="card shadow-sm mt-4" aria-labelledby={headingId}>
      <div className="card-body p-4">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <h2 id={headingId} className="h5 mb-0">
            Actions Taken ({actions.length})
          </h2>
          {isStaff && (
            <button
              type="button"
              className="btn btn-success"
              style={PRIMARY}
              disabled={saving}
              onClick={openCreate}
            >
              Add Action
            </button>
          )}
        </div>

        {message && (
          <div className="alert alert-success" role="status">
            {message}
          </div>
        )}

        {renderPanel()}

        {renderList()}
      </div>

      {confirmingCancel && panel?.kind === "view" && (
        <Dialog title="Cancel this action?" onClose={() => setConfirmingCancel(false)}>
          <div className="modal-body">
            The action stays in the list as Cancelled and cannot be changed again.
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" onClick={() => setConfirmingCancel(false)}>
              Keep Action
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => changeStatus(panel.action, "CANCELLED")}
            >
              Cancel Action
            </button>
          </div>
        </Dialog>
      )}
    </section>
  );
}
