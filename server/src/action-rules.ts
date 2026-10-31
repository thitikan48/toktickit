// Rules for Actions Taken (specification BR-03 to BR-07).

export const ACTION_STATUSES = [
  "PLANNED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;

export type ActionStatusValue = (typeof ACTION_STATUSES)[number];

const TEXT_MAX = 1000;
const ATTACHMENT_NOTES_MAX = 500;

// A new action can start in one of these statuses (not Cancelled).
const START_STATUSES: ActionStatusValue[] = ["PLANNED", "IN_PROGRESS", "COMPLETED"];

// Allowed status changes. Completed and Cancelled are final.
const NEXT_STATUSES: Record<ActionStatusValue, ActionStatusValue[]> = {
  PLANNED: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function isActionStatus(value: unknown): value is ActionStatusValue {
  return (
    typeof value === "string" &&
    (ACTION_STATUSES as readonly string[]).includes(value)
  );
}

export function isStartStatus(value: unknown): boolean {
  return isActionStatus(value) && START_STATUSES.includes(value);
}

export function canChangeActionStatus(from: string, to: string): boolean {
  if (!isActionStatus(from) || !isActionStatus(to)) {
    return false;
  }

  return NEXT_STATUSES[from].includes(to);
}

export function isFinalAction(status: string): boolean {
  return status === "COMPLETED" || status === "CANCELLED";
}

export interface ActionData {
  actionAt?: Date;
  description?: string;
  result?: string | null;
  status?: ActionStatusValue;
  assignedToId?: number;
  followUpRequired?: boolean;
  followUpNote?: string | null;
  attachmentNotes?: string | null;
}

function has(body: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, key);
}

// Trimmed text, or undefined when the value is not a string.
function text(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() : undefined;
}

/**
 * Checks the fields of a create (existing = null) or an update (existing =
 * the saved action). Only fields that were sent are returned in `data`.
 * Unknown keys, and keys the backend sets itself, are ignored.
 */
export function checkActionFields(
  body: Record<string, unknown>,
  existing: { followUpRequired: boolean; followUpNote: string | null } | null
): { data: ActionData; fields: Record<string, string> } {
  const isCreate = existing === null;
  const data: ActionData = {};
  const fields: Record<string, string> = {};

  if (isCreate || has(body, "actionAt")) {
    const date = typeof body.actionAt === "string" ? new Date(body.actionAt) : null;

    if (!date || Number.isNaN(date.getTime())) {
      fields.actionAt = "Enter a valid date and time.";
    } else {
      data.actionAt = date;
    }
  }

  if (isCreate || has(body, "description")) {
    const description = text(body.description);

    if (!description || description.length > TEXT_MAX) {
      fields.description = `Enter between 1 and ${TEXT_MAX} characters.`;
    } else {
      data.description = description;
    }
  }

  if (has(body, "result") && body.result !== null) {
    const result = text(body.result);

    if (result === undefined || result.length > TEXT_MAX) {
      fields.result = `Enter at most ${TEXT_MAX} characters.`;
    } else {
      data.result = result || null;
    }
  } else if (has(body, "result")) {
    data.result = null;
  }

  if (has(body, "attachmentNotes") && body.attachmentNotes !== null) {
    const notes = text(body.attachmentNotes);

    if (notes === undefined || notes.length > ATTACHMENT_NOTES_MAX) {
      fields.attachmentNotes = `Enter at most ${ATTACHMENT_NOTES_MAX} characters.`;
    } else {
      data.attachmentNotes = notes || null;
    }
  } else if (has(body, "attachmentNotes")) {
    data.attachmentNotes = null;
  }

  if (has(body, "status")) {
    if (isCreate && !isStartStatus(body.status)) {
      fields.status = "Status must be PLANNED, IN_PROGRESS, or COMPLETED.";
    } else if (!isCreate && !isActionStatus(body.status)) {
      fields.status = "Invalid status.";
    } else {
      data.status = body.status as ActionStatusValue;
    }
  }

  if (has(body, "assignedToId")) {
    if (!Number.isInteger(body.assignedToId)) {
      fields.assignedToId = "Assignee must be a user id.";
    } else {
      data.assignedToId = body.assignedToId as number;
    }
  }

  // Follow-up: the note is required when follow-up is needed, and saved as
  // empty when it is not. On an update the saved values are used for the
  // fields that were not sent.
  if (isCreate || has(body, "followUpRequired") || has(body, "followUpNote")) {
    let required = existing?.followUpRequired ?? false;

    if (has(body, "followUpRequired")) {
      if (typeof body.followUpRequired !== "boolean") {
        fields.followUpRequired = "Must be true or false.";
      } else {
        required = body.followUpRequired;
      }
    }

    const note = has(body, "followUpNote")
      ? text(body.followUpNote) ?? ""
      : existing?.followUpNote ?? "";

    if (required && (note.length < 1 || note.length > TEXT_MAX)) {
      fields.followUpNote = `Enter a follow-up note (1 to ${TEXT_MAX} characters).`;
    } else {
      data.followUpRequired = required;
      data.followUpNote = required ? note : null;
    }
  }

  return { data, fields };
}
