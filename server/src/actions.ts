import { Request, Response, Router } from "express";
import { Prisma } from "@prisma/client";
import { getPrisma } from "./prisma.js";
import { logServerError } from "./log.js";
import { requireRole } from "./auth.js";
import {
  canChangeActionStatus,
  checkActionFields,
  isFinalAction,
} from "./action-rules.js";

function errorBody(
  code: string,
  message: string,
  fields?: Record<string, string>
) {
  return {
    error: fields
      ? { code, message, fields }
      : { code, message },
  };
}

const TICKET_NOT_FOUND = errorBody("NOT_FOUND", "Ticket was not found.");
const ACTION_NOT_FOUND = errorBody("NOT_FOUND", "Action was not found.");

const SERVER_ERROR = errorBody(
  "SERVER_ERROR",
  "Something went wrong. Please try again."
);

function validation(fields: Record<string, string>) {
  return errorBody(
    "VALIDATION_ERROR",
    "The request contains invalid or missing data.",
    fields
  );
}

const INVALID_ASSIGNEE = errorBody(
  "CONFLICT",
  "The assignee must be an active IT Staff or Administrator user."
);

// Fields a client may send. Everything else is ignored.
const ACTION_FIELDS = [
  "actionAt",
  "description",
  "result",
  "status",
  "assignedToId",
  "followUpRequired",
  "followUpNote",
  "attachmentNotes",
];

const userSummary = { select: { id: true, name: true } };

const actionInclude = {
  assignedTo: userSummary,
  performedBy: userSummary,
  createdBy: userSummary,
  updatedBy: userSummary,
};

type ActionRow = Prisma.ActionTakenGetPayload<{ include: typeof actionInclude }>;

function toAction(action: ActionRow) {
  return {
    id: action.id,
    ticketId: action.ticketId,
    actionAt: action.actionAt,
    description: action.description,
    result: action.result,
    status: action.status,
    assignedTo: action.assignedTo,
    performedBy: action.performedBy,
    followUpRequired: action.followUpRequired,
    followUpNote: action.followUpNote,
    attachmentNotes: action.attachmentNotes,
    createdBy: action.createdBy,
    updatedBy: action.updatedBy,
    createdAt: action.createdAt,
    updatedAt: action.updatedAt,
  };
}

async function findTicket(idParam: string) {
  const ticketId = Number(idParam);

  if (!Number.isInteger(ticketId)) {
    return null;
  }

  return getPrisma().ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, requesterId: true },
  });
}

// Same rule as the Ticket Owner in Lab 3: an active IT Staff or Administrator.
async function isValidAssignee(userId: number): Promise<boolean> {
  const user = await getPrisma().user.findFirst({
    where: {
      id: userId,
      isActive: true,
      role: { in: ["IT_STAFF", "ADMIN"] },
    },
    select: { id: true },
  });

  return user !== null;
}

// Oldest Action Date/Time first, then by id (BR-10).
async function listActions(ticketId: number) {
  const actions = await getPrisma().actionTaken.findMany({
    where: { ticketId },
    include: actionInclude,
    orderBy: [{ actionAt: "asc" }, { id: "asc" }],
  });

  return actions.map(toAction);
}

export const actionRouter = Router();

/*
 * IT Staff and Administrators: list, create, and update actions on any Ticket.
 */
actionRouter.get(
  "/staff/tickets/:id/actions",
  requireRole("IT_STAFF", "ADMIN"),
  async (req: Request, res: Response) => {
    try {
      const ticket = await findTicket(req.params.id);

      if (!ticket) {
        return res.status(404).json(TICKET_NOT_FOUND);
      }

      return res.status(200).json({ items: await listActions(ticket.id) });
    } catch (error) {
      logServerError(error);
      return res.status(500).json(SERVER_ERROR);
    }
  }
);

actionRouter.post(
  "/staff/tickets/:id/actions",
  requireRole("IT_STAFF", "ADMIN"),
  async (req: Request, res: Response) => {
    try {
      const { data, fields } = checkActionFields(req.body ?? {}, null);

      if (Object.keys(fields).length > 0) {
        return res.status(400).json(validation(fields));
      }

      const ticket = await findTicket(req.params.id);

      if (!ticket) {
        return res.status(404).json(TICKET_NOT_FOUND);
      }

      const me = req.user!.id;
      const assignedToId = data.assignedToId ?? me;

      if (!(await isValidAssignee(assignedToId))) {
        return res.status(409).json(INVALID_ASSIGNEE);
      }

      const status = data.status ?? "PLANNED";

      // Creator, updater, and performer come from the session (BR-09).
      const action = await getPrisma().actionTaken.create({
        data: {
          ticketId: ticket.id,
          actionAt: data.actionAt!,
          description: data.description!,
          result: data.result ?? null,
          status,
          assignedToId,
          performedById: status === "COMPLETED" ? me : null,
          followUpRequired: data.followUpRequired ?? false,
          followUpNote: data.followUpNote ?? null,
          attachmentNotes: data.attachmentNotes ?? null,
          createdById: me,
          updatedById: me,
        },
        include: actionInclude,
      });

      return res.status(201).json(toAction(action));
    } catch (error) {
      logServerError(error);
      return res.status(500).json(SERVER_ERROR);
    }
  }
);

actionRouter.patch(
  "/staff/tickets/:id/actions/:actionId",
  requireRole("IT_STAFF", "ADMIN"),
  async (req: Request, res: Response) => {
    try {
      const body = req.body ?? {};

      const sent = ACTION_FIELDS.filter((key) =>
        Object.prototype.hasOwnProperty.call(body, key)
      );

      if (sent.length === 0) {
        return res
          .status(400)
          .json(validation({ body: "Send at least one field to change." }));
      }

      const ticket = await findTicket(req.params.id);

      if (!ticket) {
        return res.status(404).json(TICKET_NOT_FOUND);
      }

      const actionId = Number(req.params.actionId);
      const prisma = getPrisma();

      const action = Number.isInteger(actionId)
        ? await prisma.actionTaken.findFirst({
            where: { id: actionId, ticketId: ticket.id },
          })
        : null;

      if (!action) {
        return res.status(404).json(ACTION_NOT_FOUND);
      }

      // Completed and Cancelled actions are read-only (BR-08).
      if (isFinalAction(action.status)) {
        return res
          .status(409)
          .json(
            errorBody(
              "CONFLICT",
              "This action is finished and cannot be changed."
            )
          );
      }

      const { data, fields } = checkActionFields(body, action);

      if (Object.keys(fields).length > 0) {
        return res.status(400).json(validation(fields));
      }

      if (
        data.status !== undefined &&
        !canChangeActionStatus(action.status, data.status)
      ) {
        return res
          .status(409)
          .json(
            errorBody(
              "CONFLICT",
              "This status change is not allowed for the current action status."
            )
          );
      }

      if (
        data.assignedToId !== undefined &&
        !(await isValidAssignee(data.assignedToId))
      ) {
        return res.status(409).json(INVALID_ASSIGNEE);
      }

      const me = req.user!.id;

      const updated = await prisma.actionTaken.update({
        where: { id: action.id },
        data: {
          ...data,
          updatedById: me,
          // The user who completes the action is the performer (BR-09).
          ...(data.status === "COMPLETED" ? { performedById: me } : {}),
        },
        include: actionInclude,
      });

      return res.status(200).json(toAction(updated));
    } catch (error) {
      logServerError(error);
      return res.status(500).json(SERVER_ERROR);
    }
  }
);

/*
 * Requester: read-only list for their own Ticket. Another Requester's
 * Ticket answers like a missing one.
 */
actionRouter.get(
  "/tickets/:id/actions",
  requireRole("REQUESTER"),
  async (req: Request, res: Response) => {
    try {
      const ticket = await findTicket(req.params.id);

      if (!ticket || ticket.requesterId !== req.user!.id) {
        return res.status(404).json(TICKET_NOT_FOUND);
      }

      return res.status(200).json({ items: await listActions(ticket.id) });
    } catch (error) {
      logServerError(error);
      return res.status(500).json(SERVER_ERROR);
    }
  }
);
