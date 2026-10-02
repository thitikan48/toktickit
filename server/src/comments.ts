import { Request, Response, Router } from "express";
import { getPrisma } from "./prisma.js";

const MAX_COMMENT_LENGTH = 2000;

// Statuses after which "Problem Appears Resolved" no longer applies.
const FINISHED_STATUSES = ["RESOLVED", "CLOSED", "CANCELLED"];

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

const NOT_FOUND = errorBody("NOT_FOUND", "Ticket was not found.");

const SERVER_ERROR = errorBody(
  "SERVER_ERROR",
  "Something went wrong. Please try again."
);

/**
 * A Requester sees only their own tickets; IT Staff and Administrators see
 * every ticket. Anything else answers like a missing ticket.
 */
async function findVisibleTicket(req: Request) {
  const ticketId = Number(req.params.id);

  if (!Number.isInteger(ticketId)) {
    return null;
  }

  const ticket = await getPrisma().ticket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      requesterId: true,
      currentStatus: true,
    },
  });

  if (!ticket) {
    return null;
  }

  if (
    req.user!.role === "REQUESTER" &&
    ticket.requesterId !== req.user!.id
  ) {
    return null;
  }

  return ticket;
}

function toComment(comment: {
  id: number;
  body: string;
  createdAt: Date;
  author: { id: number; name: string; role: string };
}) {
  return {
    id: comment.id,
    body: comment.body,
    createdAt: comment.createdAt,
    author: comment.author,
  };
}

const author = {
  select: { id: true, name: true, role: true },
};

export const commentRouter = Router();

// Public Comments are visible to the Requester who owns the ticket,
// IT Staff, and Administrators.
commentRouter.get(
  "/tickets/:id/comments",
  async (req: Request, res: Response) => {
    try {
      const ticket = await findVisibleTicket(req);

      if (!ticket) {
        return res.status(404).json(NOT_FOUND);
      }

      const comments = await getPrisma().ticketComment.findMany({
        where: { ticketId: ticket.id },
        include: { author },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });

      return res.status(200).json({ items: comments.map(toComment) });
    } catch {
      return res.status(500).json(SERVER_ERROR);
    }
  }
);

commentRouter.post(
  "/tickets/:id/comments",
  async (req: Request, res: Response) => {
    try {
      const body =
        typeof req.body?.body === "string"
          ? req.body.body.trim()
          : "";

      if (body.length < 1 || body.length > MAX_COMMENT_LENGTH) {
        return res.status(400).json(
          errorBody(
            "VALIDATION_ERROR",
            "The request contains invalid or missing data.",
            {
              body: `Enter between 1 and ${MAX_COMMENT_LENGTH} characters.`,
            }
          )
        );
      }

      const ticket = await findVisibleTicket(req);

      if (!ticket) {
        return res.status(404).json(NOT_FOUND);
      }

      const prisma = getPrisma();

      // The author and time come from the server, never from the client.
      const [comment] = await prisma.$transaction([
        prisma.ticketComment.create({
          data: {
            ticketId: ticket.id,
            authorId: req.user!.id,
            body,
          },
          include: { author },
        }),
        prisma.ticket.update({
          where: { id: ticket.id },
          data: { updatedAt: new Date() },
        }),
      ]);

      return res.status(201).json(toComment(comment));
    } catch {
      return res.status(500).json(SERVER_ERROR);
    }
  }
);

// The Requester says the problem looks solved. This only sets a flag for
// IT Staff; the status is never changed here.
commentRouter.post(
  "/tickets/:id/appears-resolved",
  async (req: Request, res: Response) => {
    try {
      if (req.user!.role !== "REQUESTER") {
        return res
          .status(403)
          .json(
            errorBody(
              "FORBIDDEN",
              "You are not authorized to perform this action."
            )
          );
      }

      const ticket = await findVisibleTicket(req);

      if (!ticket) {
        return res.status(404).json(NOT_FOUND);
      }

      if (FINISHED_STATUSES.includes(ticket.currentStatus)) {
        return res
          .status(409)
          .json(
            errorBody(
              "CONFLICT",
              "This ticket is already finished."
            )
          );
      }

      const updated = await getPrisma().ticket.update({
        where: { id: ticket.id },
        data: { requesterMarkedResolved: true },
        select: {
          id: true,
          requesterMarkedResolved: true,
          currentStatus: true,
        },
      });

      return res.status(200).json(updated);
    } catch {
      return res.status(500).json(SERVER_ERROR);
    }
  }
);
