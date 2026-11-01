import { Request, Response, Router } from "express";
import { getPrisma } from "./prisma.js";
import { logServerError } from "./log.js";
import { requireRole } from "./auth.js";

// Status history is append-only: rows are written by the status change in
// staff.ts, and there are no update or delete routes (BR-15).

const NOT_FOUND = { error: { code: "NOT_FOUND", message: "Ticket was not found." } };

const SERVER_ERROR = {
  error: { code: "SERVER_ERROR", message: "Something went wrong. Please try again." },
};

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

// Oldest change first, then by id.
async function listHistory(ticketId: number) {
  return getPrisma().ticketStatusHistory.findMany({
    where: { ticketId },
    orderBy: [{ changedAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      fromStatus: true,
      toStatus: true,
      changedBy: { select: { id: true, name: true, role: true } },
      changedAt: true,
    },
  });
}

export const historyRouter = Router();

historyRouter.get(
  "/staff/tickets/:id/history",
  requireRole("IT_STAFF", "ADMIN"),
  async (req: Request, res: Response) => {
    try {
      const ticket = await findTicket(req.params.id);

      if (!ticket) {
        return res.status(404).json(NOT_FOUND);
      }

      return res.status(200).json({ items: await listHistory(ticket.id) });
    } catch (error) {
      logServerError(error);
      return res.status(500).json(SERVER_ERROR);
    }
  }
);

// The owning Requester only. Another Requester's Ticket answers like a missing one.
historyRouter.get(
  "/tickets/:id/history",
  requireRole("REQUESTER"),
  async (req: Request, res: Response) => {
    try {
      const ticket = await findTicket(req.params.id);

      if (!ticket || ticket.requesterId !== req.user!.id) {
        return res.status(404).json(NOT_FOUND);
      }

      return res.status(200).json({ items: await listHistory(ticket.id) });
    } catch (error) {
      logServerError(error);
      return res.status(500).json(SERVER_ERROR);
    }
  }
);
